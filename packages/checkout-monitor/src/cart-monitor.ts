import type { Cart, Currency } from '@payments-optimizer/domain';
import type { CartUpdateEvent, CartChangeCallback, CartMonitorOptions } from './types';

/**
 * Monitors cart changes on e-commerce pages
 * Supports single-page applications and multi-step checkouts
 */
export class CartMonitor {
  private observer: MutationObserver | null = null;
  private callbacks: CartChangeCallback[] = [];
  private lastCart: Cart | null = null;
  private debounceTimer: number | null = null;
  private lastTimestamp = 0;
  private initialized = false;

  constructor(private options: CartMonitorOptions = {}) {
    this.options.debounceMs = options.debounceMs ?? 300;
    this.options.minChangeThreshold = options.minChangeThreshold ?? 0.01; // 1%
  }

  /**
   * Start monitoring cart changes
   */
  start(): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    this.lastTimestamp = Date.now();

    // Start mutation observer
    this.observer = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });

    // Observe DOM changes
    if (typeof document !== 'undefined') {
      this.observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'data-*'],
      });

      // Also monitor URL changes for SPA navigation
      this.watchURLChanges();

      // Initial cart extraction
      this.extractCart();
    }
  }

  /**
   * Stop monitoring cart changes
   */
  stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.initialized = false;
  }

  /**
   * Add a callback to be called when cart changes
   */
  onCartUpdate(callback: CartChangeCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Remove a callback
   */
  offCartUpdate(callback: CartChangeCallback): void {
    const index = this.callbacks.indexOf(callback);
    if (index > -1) {
      this.callbacks.splice(index, 1);
    }
  }

  /**
   * Extract cart from DOM
   * This is a simplified implementation - should be extended for specific merchants
   */
  private extractCart(): Cart {
    // This is a placeholder - actual implementation would use merchant-specific adapters
    // For now, we'll just return a minimal cart
    const cart: Cart = {
      merchantId: 'unknown',
      items: [],
      subtotal: { amountMinor: 0n, currency: 'INR' },
      discounts: [],
      shipping: { amountMinor: 0n, currency: 'INR' },
      taxes: { amountMinor: 0n, currency: 'INR' },
      total: { amountMinor: 0n, currency: 'INR' },
      currency: 'INR',
    };

    return cart;
  }

  /**
   * Handle DOM mutations
   */
  private handleMutations(mutations: MutationRecord[]): void {
    // Check if any mutation affects cart-related elements
    for (const mutation of mutations) {
      if (this.affectsCart(mutation)) {
        this.scheduleCartUpdate('DEBOUNCE');
        return;
      }
    }
  }

  /**
   * Check if a mutation affects cart elements
   */
  private affectsCart(mutation: MutationRecord): boolean {
    // Look for cart-related DOM changes
    const cartSelectors = [
      '.cart',
      '.checkout',
      '.total',
      '.price',
      '[data-cart]',
      '[data-total]',
    ];

    for (const node of [mutation.target, ...mutation.addedNodes]) {
      if (node instanceof HTMLElement) {
        if (cartSelectors.some((selector) => node.matches(selector))) {
          return true;
        }
        if (cartSelectors.some((selector) => node.closest(selector))) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Schedule a cart update with debouncing
   */
  private scheduleCartUpdate(reason: CartUpdateEvent['reason']): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = window.setTimeout(() => {
      this.debounceTimer = null;
      const cart = this.extractCart();
      this.triggerCallbacks(cart, reason);
    }, this.options.debounceMs);
  }

  /**
   * Trigger all callbacks with cart update
   */
  private triggerCallbacks(cart: Cart, reason: CartUpdateEvent['reason']): void {
    const timestamp = Date.now();
    const hasChanged = this.hasSignificantChange(this.lastCart, cart);
    const significantReason = hasChanged ? 'SIGNIFICANT_CHANGE' : reason;

    const event: CartUpdateEvent = {
      timestamp,
      merchantId: cart.merchantId,
      cart,
      reason: significantReason,
    };

    this.lastCart = cart;
    this.lastTimestamp = timestamp;

    for (const callback of this.callbacks) {
      try {
        callback(event);
      } catch (err) {
        console.error('[CartMonitor] Callback error:', err);
      }
    }
  }

  /**
   * Check if cart has changed significantly
   */
  private hasSignificantChange(oldCart: Cart | null, newCart: Cart): boolean {
    if (!oldCart) {
      return true;
    }

    // Check total change
    const oldTotal = Number(oldCart.total.amountMinor);
    const newTotal = Number(newCart.total.amountMinor);
    const diff = Math.abs(oldTotal - newTotal);
    const threshold = this.options.minChangeThreshold ? oldTotal * this.options.minChangeThreshold : 0;

    if (diff > threshold) {
      return true;
    }

    // Check item count change
    if (oldCart.items.length !== newCart.items.length) {
      return true;
    }

    // Check merchant change
    if (oldCart.merchantId !== newCart.merchantId) {
      return true;
    }

    return false;
  }

  /**
   * Watch URL changes for SPA navigation
   */
  private watchURLChanges(): void {
    if (typeof history !== 'undefined' && history.pushState) {
      const originalPushState = history.pushState;
      history.pushState = function (...args) {
        originalPushState.apply(this, args);
        window.dispatchEvent(new PopStateEvent('popstate'));
      };

      window.addEventListener('popstate', () => {
        this.triggerCallbacks(this.extractCart(), 'PAGE_NAVIGATION');
      });

      window.addEventListener('hashchange', () => {
        this.triggerCallbacks(this.extractCart(), 'PAGE_NAVIGATION');
      });
    }
  }
}
