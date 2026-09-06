import { MerchantAdapter, MerchantDetectionResult, PageContext } from '@payments-optimizer/domain';
import { AmazonAdapter } from './adapters/amazon.js';
import { FlipkartAdapter } from './adapters/flipkart.js';
import { GenericMerchantAdapter } from './adapters/generic.js';

// Ordered list of adapters — more specific adapters come first.
// GenericMerchantAdapter is always last as the catch-all fallback.
const CORE_ADAPTERS: MerchantAdapter[] = [
  new AmazonAdapter(),
  new FlipkartAdapter(),
  new GenericMerchantAdapter(),
];

/**
 * Detect which merchant a given page belongs to.
 * Returns the first high-priority adapter's result or the generic fallback.
 */
export function detectMerchant(context: PageContext): MerchantDetectionResult {
  // First check core adapters
  for (const adapter of CORE_ADAPTERS) {
    if (adapter.canHandle(context)) {
      return adapter.detectMerchant(context);
    }
  }

  // Plugin system is optional - can be added via workspace dependency
  // The plugin registry would be registered here if available

  return { confidence: 'NONE' };
}

/**
 * Get the most specific adapter capable of handling a given URL.
 */
export function getAdapterForContext(context: PageContext): MerchantAdapter {
  // First check core adapters
  for (const adapter of CORE_ADAPTERS) {
    if (adapter.canHandle(context)) {
      return adapter;
    }
  }

  return new GenericMerchantAdapter();
}

/**
 * Register a plugin to extend merchant detection
 * Note: This function is a placeholder - actual plugin registration
 * would require integrating with @payments-optimizer/plugins package
 */
export function registerPlugin(plugin: any): void {
  console.log('[merchant-detector] Plugin registration: This is a placeholder for optional plugin system');
}

/**
 * Unregister a plugin
 */
export function unregisterPlugin(pluginId: string): void {
  console.log('[merchant-detector] Plugin unregistration: This is a placeholder for optional plugin system');
}
