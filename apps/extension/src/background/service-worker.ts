/**
 * PaymentsOptimizer Extension — Background Service Worker
 *
 * Responsibilities:
 *  1. Listen for OPTIMIZE_PAYMENT messages from content scripts
 *  2. Load user profile from chrome.storage (or seed a default on first run)
 *  3. Run generateCandidates → filterDominated → rankStrategies
 *  4. Return serialized results to the content script
 *
 * IMPORTANT (Manifest V3): Service workers are ephemeral.
 * State MUST NOT be kept in module-level variables — use chrome.storage.
 */

import {
  generateCandidates,
  filterDominated,
  rankStrategies,
} from '@payments-optimizer/optimizer';
import type { UserProfile, Offer, Coupon } from '@payments-optimizer/domain';
import {
  hdfcMillenniaCard,
  sbiCashbackCard,
  axisAtlasCard,
  hdfcInstantDiscountOffer,
  amazonCoupon,
} from '@payments-optimizer/test-fixtures';
import type {
  ContentToBackgroundMessage,
  OptimizePaymentResponse,
  OptimizePaymentErrorResponse,
} from '../types/messages.js';
import { deserializeCart, serializeStrategy } from '../types/messages.js';

// ── Default seed profile ─────────────────────────────────────────────────────
// Used on first run until the user configures their own profile via UI (Phase 6).

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

// ── Public offer data (Phase 7 will load this from a versioned data bundle) ──

const PUBLIC_OFFERS: Offer[] = [hdfcInstantDiscountOffer];
const PUBLIC_COUPONS: Coupon[] = [amazonCoupon];

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
        try {
          const cart = deserializeCart(msg.payload.cartJson);

          // Phase 4 would load this from IndexedDB/chrome.storage.local.
          // For now we use the seeded default profile.
          const profile = DEFAULT_PROFILE;

          const candidates = generateCandidates(cart, profile, PUBLIC_OFFERS, PUBLIC_COUPONS);
          const pruned = filterDominated(candidates);
          const ranked = rankStrategies(pruned, profile.optimizationPreferences);

          const serialized = ranked.map(serializeStrategy);

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
