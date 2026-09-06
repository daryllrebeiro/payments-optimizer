import type { Cart } from '@payments-optimizer/domain';

export interface CartUpdateEvent {
  timestamp: number;
  merchantId: string;
  cart: Cart;
  reason: 'INITIAL' | 'DEBOUNCE' | 'SIGNIFICANT_CHANGE' | 'PAGE_NAVIGATION';
}

export interface CartChangeCallback {
  (event: CartUpdateEvent): void;
}

export interface CartMonitorOptions {
  debounceMs?: number;
  minChangeThreshold?: number; // Percentage change threshold
  observeDOM?: boolean;
  observeHistory?: boolean;
}
