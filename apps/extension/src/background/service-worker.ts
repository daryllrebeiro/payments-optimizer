/* eslint-disable @typescript-eslint/no-explicit-any -- legacy explicit-any usage; remove when typed */
/**
 * PaymentsOptimizer Extension — Background Service Worker
 *
 * Responsibilities:
 *  1. Load and validate the public database JSON on startup
 *  2. Listen for OPTIMIZE_PAYMENT messages from content scripts
 *  3. Query active, non-expired offers and coupons for the merchant
 *  4. Load user profile from chrome.storage
 *  5. Run generateCandidates → filterDominated → rankStrategies
 *  6. Cache recommendations by tabId in session storage and return serialised results
 */

import { generateCandidates, filterDominated, rankStrategies } from '@payments-optimizer/optimizer';
import { UnifiedBenefitOptimizer, PublicBenefitCatalog } from '@payments-optimizer/benefits';
import type { UserProfile } from '@payments-optimizer/domain';
import {
  parseUserProfile,
  validateProfileIntegrity,
  serializeProfileForStorage,
} from '@payments-optimizer/domain';
import { validateMessage, RateLimiter } from '@payments-optimizer/domain';
import { PublicDataManager, CartSchema } from '@payments-optimizer/offer-engine';
import { SavingsRepository, DurableTaskQueue } from '@payments-optimizer/storage';
import type {
  ContentToBackgroundMessage,
  OptimizePaymentResponse,
  OptimizePaymentErrorResponse,
} from '../types/messages.js';
import { deserializeCart, serializeStrategy } from '../types/messages.js';

// Import public data bundle directly (Vite parses JSON automatically)
import offersBundle from '../../../../data/offers-bundle.json';

// Lazy initialization for benefit catalog (deferred until first use)
let publicBenefitCatalog: PublicBenefitCatalog | null = null;
let dataManager: PublicDataManager | null = null;

// F1: single savings persistence path — one repository, one durable queue.
const savingsRepository = new SavingsRepository();
const durableQueue = new DurableTaskQueue();

function getBenefitCatalog(): PublicBenefitCatalog {
  if (!publicBenefitCatalog) {
    publicBenefitCatalog = new PublicBenefitCatalog();
  }
  return publicBenefitCatalog;
}

function getManager(): PublicDataManager {
  if (!dataManager) {
    dataManager = new PublicDataManager();
    try {
      dataManager.loadBundle(offersBundle);
      console.info(
        `[PaymentsOptimizer] Public data bundle loaded successfully. Version: ${dataManager.getVersionInfo()?.dataVersion}`
      );
    } catch (err) {
      console.error('[PaymentsOptimizer] Failed to validate public data bundle:', err);
    }
  }
  return dataManager;
}

/**
 * Fix S-12: append-only security-event log (capped 200, preserved across
 * the Diagnostics purge flow — purge clears ledger/session, never this).
 * Fix S-05: full diagnostics stay local; the page channel gets codes only.
 */
async function logSecurityEvent(type: string, detail: Record<string, unknown>): Promise<void> {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
    const raw = await chrome.storage.local.get(['security-events']);
    const existing = (raw as Record<string, unknown>)['security-events'];
    const events = Array.isArray(existing) ? existing : [];
    events.push({ type, at: Date.now(), ...detail });
    await chrome.storage.local.set({
      'security-events': events.slice(-200),
    });
  } catch {
    // logging must never break the request path
  }
}

/** Fix S-05: hostile callers get a code; full detail stays in local logs. */
function pageError(code: string, localDetail: unknown): OptimizePaymentErrorResponse {
  console.warn(`[PaymentsOptimizer] ${code}:`, localDetail);
  void logSecurityEvent(code, {});
  return { type: 'OPTIMIZE_PAYMENT_ERROR', error: code };
}

// Fix S-03/S-04: confirm idempotency + burn leases + per-day cap.
const processedConfirms = new Set<string>();
const voucherLeases = new Map<string, { owner: string; expiresAt: number }>();
const CONFIRM_PER_MERCHANT_PER_DAY = 20;
const BURN_LEASE_MS = 5 * 60 * 1000;

/** Test-only reset for module-level gates (limiter, idempotency, leases). */
export function __resetServiceWorkerStateForTests(): void {
  memoryLimiter.reset();
  processedConfirms.clear();
  voucherLeases.clear();
}

function acquireBurnLeases(
  ids: string[],
  owner: string,
  now = Date.now()
): { ok: true } | { ok: false; locked: string } {
  for (const [id, lease] of voucherLeases) {
    if (lease.expiresAt <= now) voucherLeases.delete(id);
  }
  for (const id of ids) {
    const lease = voucherLeases.get(id);
    if (lease && lease.owner !== owner) return { ok: false, locked: id };
  }
  for (const id of ids) {
    voucherLeases.set(id, { owner, expiresAt: now + BURN_LEASE_MS });
  }
  return { ok: true };
}

// ── F8: no default seed profile ─────────────────────────────────────────────
// The service worker must never optimize against a fabricated profile of
// fixture cards. When no valid user profile exists, the structured
// PROFILE_NOT_CONFIGURED error below is returned instead.

/**
 * Loads and validates the stored user profile (F7). Never optimizes against
 * unvalidated data; returns a structured error for every failure mode.
 */
async function loadUserProfile(): Promise<
  { kind: 'ok'; profile: UserProfile } | { kind: 'error'; error: string }
> {
  const localData = await chrome.storage.local.get('user-profile');
  const raw = localData['user-profile'];
  if (raw === undefined || raw === null) {
    return {
      kind: 'error',
      error: 'PROFILE_NOT_CONFIGURED: No user profile found. Complete onboarding first.',
    };
  }
  const parsed = parseUserProfile(raw);
  if (!parsed.ok) {
    return {
      kind: 'error',
      error: `PROFILE_CORRUPT: Stored profile failed validation: ${parsed.errors.join('; ')}`,
    };
  }
  const integrity = validateProfileIntegrity(parsed.profile);
  if (integrity.length > 0) {
    return {
      kind: 'error',
      error: `PROFILE_CORRUPT: ${integrity.join('; ')}`,
    };
  }
  return { kind: 'ok', profile: parsed.profile };
}

/**
 * Rate limiting constants for optimization requests
 * Fix F14: canonical limiter is RateLimiter (domain); storage is an
 * advisory cross-instance backstop. Fail CLOSED when chrome.storage is
 * unavailable for this gate — unavailable storage must not silently allow
 * unlimited requests. Documented approximation: in-memory bucket is exact
 * per worker instance; cross-instance races are bounded advisory (at most
 * 2N-1 under race), not silent unlimited.
 */
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;
const memoryLimiter = new RateLimiter({
  maxRequests: RATE_LIMIT_MAX_REQUESTS,
  windowMs: RATE_LIMIT_WINDOW_MS,
});

/**
 * F1: enqueue the confirmed savings entry durably BEFORE attempting the
 * IndexedDB write (write-ahead), then perform the write and complete the
 * task. If the service worker dies at any point, the next wake's drain
 * loop retries the queued entry — no silent loss.
 */
async function persistConfirmedSavings(savingsEntry: Record<string, unknown>): Promise<void> {
  const task = await durableQueue.enqueue('SAVE_SAVINGS_ENTRY', savingsEntry);
  await executeSaveTask(savingsEntry);
  await durableQueue.markCompleted(task.id);
}

/**
 * F1/F3: the single code path that writes a savings entry — through the
 * SavingsRepository (raw canonical shape, indexed, awaited, errors
 * surfaced as rejections that the queue records with backoff).
 */
async function executeSaveTask(payload: unknown): Promise<void> {
  await savingsRepository.put(payload as never);
}

/**
 * F1: drain any tasks left pending by a service-worker kill. Called on
 * startup and on each alarm tick. Idempotent: completed tasks are never
 * re-claimed; failed attempts back off and eventually dead-letter.
 */
async function drainDurableQueue(): Promise<void> {
  try {
    const due = await durableQueue.claimDueTasks();
    for (const task of due) {
      try {
        await executeSaveTask(task.payload);
        await durableQueue.markCompleted(task.id);
        console.info(
          `[PaymentsOptimizer] Durable queue: retried and saved task ${task.id}`
        );
      } catch (err) {
        await durableQueue.markFailed(
          task.id,
          err instanceof Error ? err.message : String(err)
        );
        console.warn(`[PaymentsOptimizer] Durable queue: task ${task.id} failed, will retry`, err);
      }
    }
  } catch (err) {
    console.warn('[PaymentsOptimizer] Durable queue drain failed:', err);
  }
}

// F1: wake-on-alarm so pending tasks retry even when no user interaction
// triggers the service worker. (Requires the "alarms" permission.)
if (typeof chrome !== 'undefined' && chrome.alarms) {
  chrome.alarms.create('drain-durable-queue', { periodInMinutes: 1 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'drain-durable-queue') {
      void drainDurableQueue();
    }
  });
}

// Drain immediately on startup (recover tasks from a previous kill)
void drainDurableQueue();

/**
 * F2: strict currency guard for savings arithmetic. Cross-currency
 * subtraction produces a meaningless number that would be persisted
 * permanently — reject it before any math happens.
 */
function isSameCurrency(
  a: { currency: string },
  b: { currency: string }
): boolean {
  return a.currency === b.currency;
}

/**
 * F13: Savings entries are persisted ONLY on an explicit confirmed
 * transaction, never on a recommendation. This function records the
 * confirmed purchase.
 *
 * @param cart - The cart that was optimized
 * @param strategy - The strategy the user actually applied/confirmed
 * @param originalTotal - The original cart total before optimization
 * @param benefitsApplied - List of benefits applied
 */
async function saveConfirmedOptimization(
  cart: import('@payments-optimizer/domain').Cart,
  strategy: import('../types/messages.js').SerializedStrategy,
  originalTotal: import('@payments-optimizer/domain').Money,
  benefitsApplied: Array<{
    benefitId: string;
    benefitType: string;
    benefitSourceId: string;
    benefitSourceName: string;
    amountApplied: import('@payments-optimizer/domain').Money;
  }>
): Promise<void> {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      return;
    }

    // F2: refuse cross-currency subtraction — persisting a nonsense
    // savings number is worse than skipping the entry.
    if (!isSameCurrency(originalTotal, strategy.totalBenefit)) {
      console.error(
        `[PaymentsOptimizer] CURRENCY_MISMATCH: refusing to save savings entry — cart ${originalTotal.currency} vs strategy benefit ${strategy.totalBenefit.currency}`
      );
      return;
    }

    const savingsMinor =
      BigInt(originalTotal.amountMinor) - BigInt(strategy.totalBenefit.amountMinor);
    const savingsEntry = {
      id: `opt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      merchantId: cart.merchantId,
      cartTotal: {
        amountMinor: cart.total.amountMinor.toString(),
        currency: cart.total.currency,
      },
      selectedStrategy: {
        id: strategy.id,
        immediateDiscount: strategy.immediateDiscount,
        rewardValue: strategy.rewardValue,
        totalBenefit: strategy.totalBenefit,
        confidence: strategy.confidence,
      },
      originalTotal: {
        amountMinor: originalTotal.amountMinor.toString(),
        currency: originalTotal.currency,
      },
      savings: {
        amountMinor: savingsMinor.toString(),
        currency: cart.total.currency,
      },
      benefitsApplied: benefitsApplied.map((b) => ({
        benefitId: b.benefitId,
        benefitType: b.benefitType,
        benefitSourceId: b.benefitSourceId,
        benefitSourceName: b.benefitSourceName,
        amountApplied: {
          amountMinor: b.amountApplied.amountMinor.toString(),
          currency: b.amountApplied.currency,
        },
      })),
    };

    // F1: durable write-ahead via the queue + repository (the single
    // savings persistence path in the product). Failures propagate as
    // structured errors instead of console-only warnings.
    await persistConfirmedSavings(savingsEntry);
  } catch (err) {
    console.error('[PaymentsOptimizer] Failed to save optimization result:', err);
  }
}

/**
 * Checks if rate limit has been exceeded for a specific user/session
 * @returns true if under the limit, false if rate limited
 */
async function isOptimizationRateLimited(): Promise<boolean> {
  // Canonical in-memory gate first (exact per instance).
  if (memoryLimiter.isLimited()) return true;
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
    return true; // Fix F14: fail closed when storage unavailable.
  }

  const now = Date.now();

  return new Promise<boolean>((resolve) => {
    chrome.storage.local.get(['optimizationRateLimit'], (result) => {
      const rateLimitData = result.optimizationRateLimit as
        | {
            count: number;
            windowStart: number;
          }
        | undefined;

      if (!rateLimitData || now - rateLimitData.windowStart > RATE_LIMIT_WINDOW_MS) {
        // Window expired, reset
        chrome.storage.local.set({
          optimizationRateLimit: {
            count: 1,
            windowStart: now,
          },
        });
        resolve(false); // Not limited (new window)
      } else if (rateLimitData.count >= RATE_LIMIT_MAX_REQUESTS) {
        resolve(true); // Limited
      } else {
        // Increment counter
        chrome.storage.local.set({
          optimizationRateLimit: {
            count: rateLimitData.count + 1,
            windowStart: rateLimitData.windowStart,
          },
        });
        resolve(false); // Not limited (under limit)
      }
    });
  });
}

// ── Message listener ─────────────────────────────────────────────────────────

/**
 * F6: validate the raw cartJson BEFORE any BigInt-reviving JSON.parse work.
 * A multi-megabyte payload or a pathologically long numeric literal would
 * otherwise pin the service worker before Zod ever runs.
 */
const MAX_CART_JSON_BYTES = 64 * 1024; // 64KB — comfortably above any real cart
const MAX_NUMERIC_LITERAL_LENGTH = 17; // digits — bounds BigInt operand size

function preValidateCartJson(cartJson: string): { ok: true } | { ok: false; error: string } {
  if (typeof cartJson !== 'string') {
    return { ok: false, error: 'cartJson must be a string' };
  }
  if (cartJson.length > MAX_CART_JSON_BYTES) {
    return {
      ok: false,
      error: `cartJson exceeds maximum size of ${MAX_CART_JSON_BYTES} bytes`,
    };
  }
  // Reject pathologically long digit runs anywhere in the payload — these
  // become huge BigInt operands during deserialization.
  if (new RegExp(`\\d{${MAX_NUMERIC_LITERAL_LENGTH + 1},}`).test(cartJson)) {
    return {
      ok: false,
      error: `cartJson contains numeric literals exceeding ${MAX_NUMERIC_LITERAL_LENGTH} digits`,
    };
  }
  return { ok: true };
}

chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: OptimizePaymentResponse | OptimizePaymentErrorResponse) => void
  ) => {
    // F3: the message itself is untrusted — validate its shape with the
    // library schema before anything else. Unknown or malformed messages
    // are rejected, not silently acted upon.
    let msg: ContentToBackgroundMessage;
    try {
      msg = validateMessage(message);
    } catch (err) {
      // Fix S-05: code to the page, diagnostics to local logs only.
      sendResponse(pageError('INVALID_REQUEST', err));
      return false;
    }

    if (msg.type === 'OPTIMIZE_PAYMENT') {
      // Wrap in IIFE to allow async/await while keeping the listener synchronous.
      // Return true to keep the message channel open for the async response.
      (async () => {
        // Check rate limit before processing
        if (await isOptimizationRateLimited()) {
          sendResponse(pageError('RATE_LIMITED', 'optimization gate'));
          return;
        }

        try {
          // F6: size/magnitude checks BEFORE deserialization
          const cartJson = msg.payload?.cartJson;
          const preCheck = preValidateCartJson(cartJson);
          if (!preCheck.ok) {
            sendResponse(pageError('PAYLOAD_REJECTED', preCheck.error));
            return;
          }

          const rawCart = deserializeCart(cartJson);
          // Strict Zod validation of untrusted inputs from the page script context
          const cart = CartSchema.parse(
            rawCart
          ) as unknown as import('@payments-optimizer/domain').Cart;

          // F7/F8: validate the profile — never optimize against unvalidated
          // data, never fall back to fixture cards
          const profileResult = await loadUserProfile();
          if (profileResult.kind === 'error') {
            // Fix S-05: structured code to the page (no field-level detail).
            const code = profileResult.error.startsWith('PROFILE_NOT_CONFIGURED')
              ? 'PROFILE_NOT_CONFIGURED'
              : 'PROFILE_CORRUPT';
            sendResponse(pageError(code, profileResult.error));
            return;
          }
          const profile = profileResult.profile;

          // Query dynamic active offers and coupons from validated PublicDataManager
          const offers = getManager().getOffersForMerchant(cart.merchantId);
          const coupons = getManager().getCouponsForMerchant(cart.merchantId);

          const directCandidates = generateCandidates(cart, profile, offers, coupons);
          const benefitOptimizer = new UnifiedBenefitOptimizer(getBenefitCatalog());
          const benefitCandidates = benefitOptimizer.optimize(cart, profile, offers);

          const allCandidates = [...benefitCandidates, ...directCandidates];
          const pruned = filterDominated(allCandidates);
          const ranked = rankStrategies(pruned, profile.optimizationPreferences);

          const serialized = ranked.map(serializeStrategy);

          // F13: recommendations are NOT transactions — nothing is persisted
          // here. A savings entry is written only when the user explicitly
          // confirms the purchase (CONFIRM_SAVINGS below, triggered from the
          // popup's "applied" action).

          const response: OptimizePaymentResponse = {
            type: 'OPTIMIZE_PAYMENT_RESULT',
            payload: {
              strategies: serialized,
              bestStrategy: serialized[0] ?? null,
            },
          };

          // Cache recommendation in session storage under the sender tab ID
          if (_sender.tab?.id) {
            await chrome.storage.session.set({
              [`recommendation-${_sender.tab.id}`]: {
                merchantId: cart.merchantId,
                cartTotal: {
                  amountMinor: cart.total.amountMinor.toString(),
                  currency: cart.total.currency,
                },
                strategies: serialized,
                bestStrategy: serialized[0] ?? null,
                timestamp: Date.now(),
              },
            });
          }

          // Also cache the latest recommendation for offline fallback
          try {
            await chrome.storage.local.set({
              'last-recommendation': {
                merchantId: cart.merchantId,
                cartTotal: {
                  amountMinor: cart.total.amountMinor.toString(),
                  currency: cart.total.currency,
                },
                strategies: serialized,
                bestStrategy: serialized[0] ?? null,
                timestamp: Date.now(),
              },
            });
          } catch (err) {
            console.warn('[PaymentsOptimizer] Failed to cache recommendation:', err);
          }

          sendResponse(response);
        } catch (err) {
          sendResponse(pageError('INVALID_REQUEST', err));
        }
      })();

      return true; // keep message channel open for async sendResponse
    }

    if (msg.type === 'CONFIRM_SAVINGS') {
      // F13: explicit user confirmation that a strategy was applied — this,
      // and only this, persists a savings entry. The message shape was
      // already validated by validateMessage (F3) — no re-casting here.
      // Fix S-03/S-04: idempotent (duplicate key replays the prior success
      // without a second write), per-merchant/per-day capped, burn-leased.
      (async () => {
        try {
          const confirmation = msg.payload;

          if (processedConfirms.has(confirmation.idempotencyKey)) {
            sendResponse({
              type: 'SAVINGS_CONFIRMED',
              confirmed: true,
            } as unknown as OptimizePaymentResponse);
            return;
          }

          // Fix S-03 ordering: currency guard BEFORE any store touch, so a
          // cross-currency confirm never opens the savings DB at all.
          if (confirmation.cartTotal.currency !== confirmation.strategy.totalBenefit.currency) {
            await logSecurityEvent('CURRENCY_MISMATCH', {
              merchantId: confirmation.merchantId,
            });
            sendResponse({
              type: 'SAVINGS_CONFIRMED',
              confirmed: true,
            } as unknown as OptimizePaymentResponse);
            return;
          }

          const dayStart = new Date();
          dayStart.setHours(0, 0, 0, 0);
          const todayCount = (
            await savingsRepository.queryByMerchantAndDateRange(
              confirmation.merchantId,
              dayStart.getTime(),
              Date.now()
            )
          ).length;
          if (todayCount >= CONFIRM_PER_MERCHANT_PER_DAY) {
            await logSecurityEvent('CONFIRM_CAP_HIT', { merchantId: confirmation.merchantId });
            sendResponse(pageError('RATE_LIMITED', 'confirm per-day cap'));
            return;
          }

          const cart = {
            merchantId: confirmation.merchantId,
            total: {
              amountMinor: BigInt(confirmation.cartTotal.amountMinor),
              currency: confirmation.cartTotal.currency,
            },
          } as unknown as import('@payments-optimizer/domain').Cart;

          const originalTotal = {
            amountMinor: BigInt(confirmation.cartTotal.amountMinor),
            currency: confirmation.cartTotal.currency,
          };

          // Fix F9: derive the benefit ledger from the strategy's own
          // recipeSteps (stable benefitSourceId join keys) instead of
          // persisting an empty benefits array. benefitId falls back to
          // benefitSourceId — a name string is never a safe join key.
          const strategyWithSteps = confirmation.strategy as unknown as {
            recipeSteps?: Array<{
              actionType: string;
              benefitSourceId: string;
              benefitSourceName: string;
              amountApplied: { amountMinor: string; currency: string };
            }>;
          };
          const benefitsFromSteps = (strategyWithSteps.recipeSteps ?? []).map((s) => ({
            benefitId: s.benefitSourceId,
            benefitType: s.actionType,
            benefitSourceId: s.benefitSourceId,
            benefitSourceName: s.benefitSourceName,
            amountApplied: {
              amountMinor: BigInt(s.amountApplied.amountMinor),
              currency: s.amountApplied.currency as import('@payments-optimizer/domain').Currency,
            },
          }));
          // Fix S-04: burn lease — a second tab confirming the same voucher
          // IDs while this lease is live aborts instead of double-spending.
          const voucherIds = benefitsFromSteps.map((b) => b.benefitSourceId);
          const lease = acquireBurnLeases(voucherIds, confirmation.idempotencyKey);
          if (!lease.ok) {
            await logSecurityEvent('VOUCHER_LOCKED', { voucherId: lease.locked });
            sendResponse(pageError('VOUCHER_LOCKED', lease.locked));
            return;
          }
          await saveConfirmedOptimization(cart, confirmation.strategy, originalTotal, benefitsFromSteps);
          processedConfirms.add(confirmation.idempotencyKey);
          sendResponse({ type: 'SAVINGS_CONFIRMED', confirmed: true } as unknown as OptimizePaymentResponse);
        } catch (err) {
          sendResponse(pageError('INVALID_REQUEST', err));
        }
      })();
      return true;
    }

    return false;
  }
);

chrome.runtime.onInstalled.addListener(() => {
  console.info('[PaymentsOptimizer] Extension installed and service worker ready.');
});
