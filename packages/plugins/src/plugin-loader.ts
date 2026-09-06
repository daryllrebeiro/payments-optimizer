import type { Plugin } from './types';

/**
 * Loads plugins for the Chrome extension
 */
export class PluginLoader {
  constructor(private pluginDirectory: string = 'plugins') {}

  /**
   * Load a single plugin from a directory
   */
  async loadPlugin(dir: string): Promise<Plugin | null> {
    console.warn('[PluginLoader] File system loading not available in browser environment');
    return null;
  }

  /**
   * Validate plugin manifest
   */
  validateManifest(manifest: unknown): manifest is { id: string; name: string; version: string; adapters: any[] } {
    if (typeof manifest !== 'object' || manifest === null) {
      return false;
    }

    const m = manifest as any;
    
    return (
      typeof m.id === 'string' &&
      typeof m.name === 'string' &&
      typeof m.version === 'string' &&
      Array.isArray(m.adapters)
    );
  }

  /**
   * Load plugins from array (for bundled plugins)
   */
  loadBundledPlugins(plugins: Plugin[]): void {
    const registry = (globalThis as any).paymentsOptimizerPluginRegistry;
    if (registry) {
      for (const plugin of plugins) {
        registry.register(plugin);
      }
    }
  }
}
