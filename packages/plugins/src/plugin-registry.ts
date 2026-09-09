import type { Plugin, AdapterConfig } from './types';
import type {
  MerchantAdapter,
  PageContext,
  MerchantDetectionResult,
  Cart,
  ProductContext,
} from '@payments-optimizer/domain';

class SimpleAdapter implements MerchantAdapter {
  constructor(
    private merchantId: string,
    private domains: string[] = [],
    private canHandleImpl?: (context: PageContext) => boolean,
    private detectMerchantImpl?: (context: PageContext) => MerchantDetectionResult,
    private extractCartImpl?: (context: PageContext) => Promise<Cart>,
    private extractProductImpl?: (context: PageContext) => Promise<ProductContext>
  ) {}

  canHandle(context: PageContext): boolean {
    if (this.canHandleImpl) {
      return this.canHandleImpl(context);
    }
    return this.domains.some((domain) => context.url.includes(domain));
  }

  detectMerchant(context: PageContext): MerchantDetectionResult {
    if (this.detectMerchantImpl) {
      return this.detectMerchantImpl(context);
    }
    return { merchantId: this.merchantId, confidence: 'HIGH' };
  }

  async extractCart(context: PageContext): Promise<Cart> {
    if (this.extractCartImpl) {
      return this.extractCartImpl(context);
    }
    throw new Error(`Cart extraction not implemented for ${this.merchantId}`);
  }

  async extractProduct(context: PageContext): Promise<ProductContext> {
    if (this.extractProductImpl) {
      return this.extractProductImpl(context);
    }
    throw new Error(`Product extraction not implemented for ${this.merchantId}`);
  }
}

export class PluginRegistry {
  private plugins: Map<string, Plugin> = new Map();
  private adapters: Map<string, SimpleAdapter> = new Map();

  register(plugin: Plugin): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin with ID "${plugin.id}" already registered`);
    }

    this.plugins.set(plugin.id, plugin);

    for (const adapterConfig of plugin.adapters) {
      const adapter = new SimpleAdapter(
        adapterConfig.merchantId,
        adapterConfig.config?.domains,
        adapterConfig.config?.canHandle,
        adapterConfig.config?.detectMerchant,
        adapterConfig.config?.extractCart,
        adapterConfig.config?.extractProduct
      );

      this.adapters.set(adapterConfig.merchantId, adapter);

      if (plugin.load) {
        plugin.load();
      }
    }
  }

  unregister(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      for (const adapterConfig of plugin.adapters) {
        this.adapters.delete(adapterConfig.merchantId);
      }

      if (plugin.unload) {
        plugin.unload();
      }

      this.plugins.delete(pluginId);
    }
  }

  getAdapter(merchantId: string): MerchantAdapter | null {
    return this.adapters.get(merchantId) ?? null;
  }

  listPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  hasPlugin(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  clear(): void {
    this.plugins.clear();
    this.adapters.clear();
  }
}
