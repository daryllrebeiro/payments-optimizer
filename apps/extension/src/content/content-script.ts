/**
 * PaymentsOptimizer Extension — Content Script
 *
 * Runs at document_idle on supported merchant pages.
 *
 * Responsibilities:
 *  1. Use the merchant-detector registry to identify the current merchant
 *  2. Extract the cart/product data from the page DOM
 *  3. Send an OPTIMIZE_PAYMENT message to the background service worker
 *  4. Log the best strategy recommendation to the console
 *     (Phase 6 will render a popup/overlay UI instead)
 *
 * Security note: this script runs inside an untrusted web page context.
 * All data extracted from the DOM is treated as UNTRUSTED INPUT.
 * The background service worker is responsible for validation.
 */

import { detectMerchant, getAdapterForContext } from '@payments-optimizer/merchant-detector';
import type { PageContext } from '@payments-optimizer/domain';
import type {
  ContentToBackgroundMessage,
  OptimizePaymentResponse,
  OptimizePaymentErrorResponse,
} from '../types/messages.js';
import { serializeCart } from '../types/messages.js';

async function run(): Promise<void> {
  const context: PageContext = {
    url: window.location.href,
    domContentStub: document.documentElement.outerHTML.slice(0, 50_000),
  };

  // Step 1 — detect merchant
  const detection = detectMerchant(context);

  if (detection.confidence === 'NONE' || !detection.merchantId) {
    return; // Not a supported merchant
  }

  console.info(
    `[PaymentsOptimizer] Detected merchant: ${detection.merchantId} (confidence: ${detection.confidence})`
  );

  // Step 2 — extract cart
  let cart;
  try {
    const adapter = getAdapterForContext(context);
    cart = await adapter.extractCart(context);
  } catch (err) {
    console.warn('[PaymentsOptimizer] Cart extraction failed:', err);
    return;
  }

  if (cart.total.amountMinor <= 0n) {
    console.info('[PaymentsOptimizer] No purchasable item found on this page.');
    return;
  }

  console.info(
    `[PaymentsOptimizer] Cart detected — ${cart.merchantId}, total: ${cart.total.amountMinor / 100n} ${cart.currency}`
  );

  // Step 3 — send to service worker
  const message: ContentToBackgroundMessage = {
    type: 'OPTIMIZE_PAYMENT',
    payload: {
      cart,
      cartJson: serializeCart(cart),
    },
  };

  try {
    const response = (await chrome.runtime.sendMessage(message)) as
      | OptimizePaymentResponse
      | OptimizePaymentErrorResponse;

    if (response.type === 'OPTIMIZE_PAYMENT_ERROR') {
      console.warn('[PaymentsOptimizer] Optimization error:', response.error);
      return;
    }

    const { bestStrategy, strategies } = response.payload;

    if (!bestStrategy) {
      console.info('[PaymentsOptimizer] No payment strategies found.');
      return;
    }

    // Step 4 — log recommendation (Phase 6 will render this as UI)
    const effectiveCost = Number(bestStrategy.effectiveCost.amountMinor) / 100;
    const savings = Number(bestStrategy.totalBenefit.amountMinor) / 100;
    const rewardValue = Number(bestStrategy.rewardValue.amountMinor) / 100;
    const immediate = Number(bestStrategy.immediateDiscount.amountMinor) / 100;

    console.info(
      [
        '┌─────────────────────────────────────────────┐',
        '│  PaymentsOptimizer — Best Way To Pay         │',
        '├─────────────────────────────────────────────┤',
        `│  Strategy:       ${bestStrategy.id.slice(0, 25).padEnd(25)} │`,
        `│  Effective Cost: ₹${effectiveCost.toFixed(2).padStart(10)}               │`,
        `│  Total Savings:  ₹${savings.toFixed(2).padStart(10)}               │`,
        `│  Immediate:      ₹${immediate.toFixed(2).padStart(10)}               │`,
        `│  Reward Value:   ₹${rewardValue.toFixed(2).padStart(10)}               │`,
        `│  Confidence:     ${(bestStrategy.confidence * 100).toFixed(0).padStart(3)}%                        │`,
        `│  Complexity:     ${String(bestStrategy.complexityScore).padStart(1)} steps                      │`,
        `│  Options found:  ${strategies.length}                             │`,
        '└─────────────────────────────────────────────┘',
      ].join('\n')
    );

    if (bestStrategy.stepDescriptions.length > 0) {
      console.info('[PaymentsOptimizer] Steps:');
      bestStrategy.stepDescriptions.forEach((desc, i) => {
        console.info(`  ${i + 1}. ${desc}`);
      });
    }
  } catch (err) {
    console.warn('[PaymentsOptimizer] Failed to communicate with service worker:', err);
  }
}

// Run after the DOM settles
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void run());
} else {
  void run();
}
