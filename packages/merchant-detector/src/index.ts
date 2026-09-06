export { AmazonAdapter } from './adapters/amazon.js';
export { FlipkartAdapter } from './adapters/flipkart.js';
export { GenericMerchantAdapter } from './adapters/generic.js';
export { detectMerchant, getAdapterForContext, registerPlugin, unregisterPlugin } from './registry.js';

// PluginRegistry is exported separately for optional use
// import { PluginRegistry } from '@payments-optimizer/plugins';
