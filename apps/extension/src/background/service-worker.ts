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
import { PublicDataManager, CartSchema } from '@payments-optimizer/offer-engine';
import {
  hdfcMillenniaCard,
  sbiCashbackCard,
  axisAtlasCard,
} from '@payments-optimizer/test-fixtures';
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

// ── Default seed profile ─────────────────────────────────────────────────────
// Used on first run until the user configures their own profile via UI.

const DEFAULT_PROFILE: UserProfile = {
  version: 1,
  currency: 'INR',
  paymentMethods: [
    { type: 'CREDIT_CARD', card: hdfcMillenniaCard },
    { type: 'CREDIT_CARD', card: sbiCashbackCard },
    { type: 'CREDIT_CARD', card: axisAtlasCard },
  ],
  rewardPreferences: {
    defaultValuations: {
      'HDFC Millennia Points': { amountMinor: 100n, currency: 'INR' }, // 1 pt = ₹1
      'SBI Cashback Program': { amountMinor: 100n, currency: 'INR' },
      'Axis Edge Miles': { amountMinor: 100n, currency: 'INR' },
    },
  },
  optimizationPreferences: {
    immediateSavingsWeight: 1.0,
    rewardValueWeight: 1.0,
    milestoneWeight: 0.8,
    simplicityWeight: 0.2,
    riskWeight: 0.1,
  },
};

/**
 * Rate limiting constants for optimization requests
 */
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;

/**
 * Saves an optimization result to the savings history
 * @param cart - The cart that was optimized
 * @param strategy - The selected optimization strategy
 * @param originalTotal - The original cart total before optimization
 * @param benefitsApplied - List of benefits applied
 */
async function saveOptimizationResult(
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

    const savingsMinor = BigInt(originalTotal.amountMinor) - BigInt(strategy.totalBenefit.amountMinor);
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

    // Save to IndexedDB savings store
    if (typeof indexedDB !== 'undefined') {
      const dbRequest = indexedDB.open('payments-optimizer-savings', 1);
      dbRequest.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('savings')) {
          db.createObjectStore('savings', { keyPath: 'id' });
        }
      };
      dbRequest.onsuccess = () => {
        const db = dbRequest.result;
        const tx = db.transaction('savings', 'readwrite');
        tx.objectStore('savings').put(savingsEntry);
        tx.oncomplete = () => {
          console.info('[PaymentsOptimizer] Saved optimization result to savings history');
        };
        tx.onerror = () => {
          console.warn('[PaymentsOptimizer] Failed to save savings entry:', tx.error);
        };
      };
    }
  } catch (err) {
    console.warn('[PaymentsOptimizer] Failed to save optimization result:', err);
  }
}

/**
 * Checks if rate limit has been exceeded for a specific user/session
 * @returns true if under the limit, false if rate limited
 */
function isOptimizationRateLimited(): boolean {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
    return false;
  }

  const now = Date.now();
  
  return new Promise<boolean>((resolve) => {
    chrome.storage.local.get(['optimizationRateLimit'], (result) => {
      const rateLimitData = result.optimizationRateLimit as {
        count: number;
        windowStart: number;
      } | undefined;

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

chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: OptimizePaymentResponse | OptimizePaymentErrorResponse) => void
  ) => {
    const msg = message as ContentToBackgroundMessage;

    if (msg.type === 'OPTIMIZE_PAYMENT') {
      // Wrap in IIFE to allow async/await while keeping the listener synchronous.
      // Return true to keep the message channel open for the async response.
      (async () => {
        // Check rate limit before processing
        if (await isOptimizationRateLimited()) {
          const errorResponse: OptimizePaymentErrorResponse = {
            type: 'OPTIMIZE_PAYMENT_ERROR',
            error: `Rate limit exceeded. Maximum ${RATE_LIMIT_MAX_REQUESTS} optimization requests per minute.`,
          };
          sendResponse(errorResponse);
          return;
        }

        try {
          const rawCart = deserializeCart(msg.payload.cartJson);
          // Strict Zod validation of untrusted inputs from the page script context
          const cart = CartSchema.parse(
            rawCart
          ) as unknown as import('@payments-optimizer/domain').Cart;

          // Retrieve active tab profile, fallback to seeded default
          const localData = await chrome.storage.local.get('user-profile');
          const profile = (localData['user-profile'] as UserProfile) || DEFAULT_PROFILE;

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

          // Save optimization result to savings history
          const originalCartTotal = {
            amountMinor: cart.total.amountMinor,
            currency: cart.total.currency,
          };
          const bestStrategy = serialized[0] ?? null;
          if (bestStrategy) {
            // Extract benefits applied from the strategy's recipe steps
            const benefitsApplied = (bestStrategy as any).recipeSteps?.map((step: any) => ({
              benefitId: step.benefitSourceId,
              benefitType: step.actionType,
              benefitSourceId: step.benefitSourceId,
              benefitSourceName: step.benefitSourceName,
              amountApplied: step.savingsGenerated,
            })) || [];

            saveOptimizationResult(cart, bestStrategy, originalCartTotal, benefitsApplied);
          }

          const response: OptimizePaymentResponse = {
            type: 'OPTIMIZE_PAYMENT_RESULT',
            payload: {
              strategies: serialized,
              bestStrategy: bestStrategy,
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
          const errorResponse: OptimizePaymentErrorResponse = {
            type: 'OPTIMIZE_PAYMENT_ERROR',
            error: err instanceof Error ? err.message : String(err),
          };
          sendResponse(errorResponse);
        }
      })();

      return true; // keep message channel open for async sendResponse
    }

    return false;
  }
);

chrome.runtime.onInstalled.addListener(() => {
  console.info('[PaymentsOptimizer] Extension installed and service worker ready.');
});
