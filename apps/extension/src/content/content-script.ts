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
  OptimizePaymentResponse,
  OptimizePaymentErrorResponse,
} from '../types/messages.js';
import { serializeCart } from '../types/messages.js';

/**
 * Sanitizes DOM content by removing potentially dangerous elements
 * @param html - Raw HTML string to sanitize
 * @returns Sanitized HTML string
 */
function sanitizeDomContent(html: string): string {
  // Remove script tags and their content
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove style tags and their content
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove event handlers (onXYZ attributes)
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');

  // Remove javascript: URLs
  sanitized = sanitized.replace(/javascript:/gi, '');

  return sanitized;
}

/**
 * Truncates DOM content to safe size limits
 * @param html - HTML string to truncate
 * @returns Truncated HTML string
 */
function truncateDomContent(html: string): string {
  const MAX_LENGTH = 10_000; // Reduced from 50k for security
  if (html.length <= MAX_LENGTH) {
    return html;
  }
  return html.slice(0, MAX_LENGTH) + '\n<!-- DOM content truncated for security -->';
}

async function run(): Promise<void> {
  // Extract and sanitize DOM content
  let rawHtml = document.documentElement.outerHTML;
  rawHtml = sanitizeDomContent(rawHtml);
  rawHtml = truncateDomContent(rawHtml);

  const context: PageContext = {
    url: window.location.href,
    domContentStub: rawHtml,
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
  const message: import('../types/messages.js').OptimizePaymentMessageLegacy = {
    type: 'OPTIMIZE_PAYMENT',
    payload: {
      cart,
      cartJson: serializeCart(cart),
    },
  };

  try {
    const response = (await chrome.runtime.sendMessage(message)) as
      OptimizePaymentResponse | OptimizePaymentErrorResponse;

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

// Configuration for cart updates (multi-step checkout support)
const CART_UPDATE_INTERVAL_MS = 2000; // Check cart updates every 2 seconds
const MAX_OBSERVER_AGE_MS = 15 * 60 * 1000; // Stop observing after 15 minutes

let lastOptimizationTime = 0;
let cartUpdateObserver: MutationObserver | null = null;

/**
 * Sends cart data for optimization to background service worker
 */
async function sendCartForOptimization(
  cart: import('@payments-optimizer/domain').Cart
): Promise<void> {
  const message: import('../types/messages.js').OptimizePaymentMessageLegacy = {
    type: 'OPTIMIZE_PAYMENT',
    payload: {
      cart,
      cartJson: serializeCart(cart),
    },
  };

  try {
    const response = (await chrome.runtime.sendMessage(message)) as
      OptimizePaymentResponse | OptimizePaymentErrorResponse;

    if (response.type === 'OPTIMIZE_PAYMENT_ERROR') {
      console.warn('[PaymentsOptimizer] Optimization error:', response.error);
      return;
    }

    const { bestStrategy, strategies } = response.payload;

    if (!bestStrategy) {
      console.info('[PaymentsOptimizer] No payment strategies found.');
      return;
    }

    console.info(
      `[PaymentsOptimizer] Cart updated — ${cart.merchantId}, total: ${cart.total.amountMinor / 100n} ${cart.currency}, best strategy: ${bestStrategy.id}`
    );
  } catch (err) {
    console.warn('[PaymentsOptimizer] Failed to communicate with service worker:', err);
  }
}

/**
 * Sends cart data for optimization if enough time has passed since last optimization
 */
async function sendCartWithRateLimit(
  cart: import('@payments-optimizer/domain').Cart
): Promise<void> {
  const now = Date.now();
  if (now - lastOptimizationTime > CART_UPDATE_INTERVAL_MS) {
    lastOptimizationTime = now;
    await sendCartForOptimization(cart);
  } else {
    console.info('[PaymentsOptimizer] Cart update detected, throttled to prevent spam');
  }
}

/**
 * Sets up a MutationObserver to watch for cart updates on multi-step checkout flows
 */
function setupCartUpdateObserver(): void {
  const body = document.querySelector('body');
  if (!body) return;

  cartUpdateObserver = new MutationObserver(async (mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList' || mutation.type === 'attributes') {
        // Re-extract cart and send for optimization
        try {
          const adapter = getAdapterForContext({
            url: window.location.href,
            domContentStub: document.documentElement.outerHTML,
          });
          if (adapter.canHandle({ url: window.location.href })) {
            const cart = await adapter.extractCart({
              url: window.location.href,
              domContentStub: document.documentElement.outerHTML,
            });
            if (cart.total.amountMinor > 0n) {
              await sendCartWithRateLimit(cart);
            }
          }
        } catch (err) {
          console.warn('[PaymentsOptimizer] Cart update detection failed:', err);
        }
      }
    }
  });

  cartUpdateObserver.observe(body, {
    childList: true,
    attributes: true,
    subtree: true,
    attributeFilter: ['class', 'style', 'data-*'],
  });

  // Stop observer after 15 minutes to prevent memory leaks
  setTimeout(() => {
    if (cartUpdateObserver) {
      cartUpdateObserver.disconnect();
      cartUpdateObserver = null;
    }
  }, MAX_OBSERVER_AGE_MS);
}

// Run after the DOM settles
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    await run();
    setupCartUpdateObserver();
  });
} else {
  void run();
  setupCartUpdateObserver();
}
