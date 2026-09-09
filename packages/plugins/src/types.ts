import type {
  MerchantAdapter,
  PageContext,
  MerchantDetectionResult,
  Cart,
  ProductContext,
} from '@payments-optimizer/domain';

export interface AdapterConfig {
  merchantId: string;
  adapterType: 'custom' | 'generic';
  config?: {
    domains?: string[];
    canHandle?: (context: PageContext) => boolean;
    detectMerchant?: (context: PageContext) => MerchantDetectionResult;
    extractCart?: (context: PageContext) => Promise<Cart>;
    extractProduct?: (context: PageContext) => Promise<ProductContext>;
  };
}

export interface PluginOptions {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  adapters: AdapterConfig[];
}

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  adapters: AdapterConfig[];
  load?: () => void;
  unload?: () => void;
}

// SimpleAdapter class is defined in plugin-registry.ts
