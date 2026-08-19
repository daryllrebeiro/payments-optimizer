import { MerchantAdapter, MerchantDetectionResult, PageContext } from '@payments-optimizer/domain';
import { AmazonAdapter } from './adapters/amazon.js';
import { FlipkartAdapter } from './adapters/flipkart.js';
import { GenericMerchantAdapter } from './adapters/generic.js';

// Ordered list of adapters — more specific adapters come first.
// GenericMerchantAdapter is always last as the catch-all fallback.
const ADAPTERS: MerchantAdapter[] = [
  new AmazonAdapter(),
  new FlipkartAdapter(),
  new GenericMerchantAdapter(),
];

/**
 * Detect which merchant a given page belongs to.
 * Returns the first high-priority adapter's result or the generic fallback.
 */
export function detectMerchant(context: PageContext): MerchantDetectionResult {
  for (const adapter of ADAPTERS) {
    if (adapter.canHandle(context)) {
      return adapter.detectMerchant(context);
    }
  }
  return { confidence: 'NONE' };
}

/**
 * Get the most specific adapter capable of handling a given URL.
 */
export function getAdapterForContext(context: PageContext): MerchantAdapter {
  for (const adapter of ADAPTERS) {
    if (adapter.canHandle(context)) {
      return adapter;
    }
  }
  return new GenericMerchantAdapter();
}
