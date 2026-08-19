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

import {
  generateCandidates,
  filterDominated,
  rankStrategies,
} from '@payments-optimizer/optimizer';
import type { UserProfile } from '@payments-optimizer/domain';
import { PublicDataManager } from '@payments-optimizer/offer-engine';
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

// Initialize and seed public data manager
const dataManager = new PublicDataManager();
try {
  dataManager.loadBundle(offersBundle);
  console.info(
    `[PaymentsOptimizer] Public data bundle loaded successfully. Version: ${dataManager.getVersionInfo()?.dataVersion}`
  );
} catch (err) {
  console.error('[PaymentsOptimizer] Failed to validate public data bundle:', err);
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

          // Retrieve active tab profile, fallback to seeded default
          const localData = await chrome.storage.local.get('user-profile');
          const profile = (localData['user-profile'] as UserProfile) || DEFAULT_PROFILE;

          // Query dynamic active offers and coupons from validated PublicDataManager
          const offers = dataManager.getOffersForMerchant(cart.merchantId);
          const coupons = dataManager.getCouponsForMerchant(cart.merchantId);

          const candidates = generateCandidates(cart, profile, offers, coupons);
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
