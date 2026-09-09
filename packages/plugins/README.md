# @payments-optimizer/plugins

Plugin system for PaymentsOptimizer to extend merchant detection capabilities.

## Overview

The plugin system allows you to add support for new merchants without modifying the core extension code. Plugins can be:

- **Custom Adapters**: Full control over merchant detection and cart extraction
- **Generic Adapters**: Use pattern-based detection for standard e-commerce sites

## Plugin Structure

```
my-plugin/
├── plugin.json          # Plugin manifest (required)
├── adapter.js          # Custom adapter code (optional)
└── README.md           # Plugin documentation
```

### plugin.json

```json
{
  "id": "my-merchant",
  "name": "My Merchant Adapter",
  "version": "1.0.0",
  "description": "Support for my-merchant.com",
  "author": "Your Name <email@example.com>",
  "adapters": [
    {
      "merchantId": "my-merchant",
      "adapterType": "custom",
      "config": {
        "domains": ["my-merchant.com", "www.my-merchant.com"]
      }
    }
  ]
}
```

## Creating a Plugin

1. Create a new directory for your plugin
2. Create `plugin.json` with your plugin configuration
3. Implement custom adapter logic (optional)
4. Test your plugin with the PaymentsOptimizer extension

## Example: Custom Adapter

```typescript
import type { MerchantAdapter, PageContext, Cart } from '@payments-optimizer/domain';

class MyMerchantAdapter implements MerchantAdapter {
  canHandle(context: PageContext): boolean {
    return context.url.includes('my-merchant.com');
  }

  detectMerchant(context: PageContext) {
    return { merchantId: 'my-merchant', confidence: 'HIGH' };
  }

  async extractCart(context: PageContext): Promise<Cart> {
    // Custom cart extraction logic
    return {
      merchantId: 'my-merchant',
      items: [],
      subtotal: { amountMinor: 0n, currency: 'INR' },
      discounts: [],
      shipping: { amountMinor: 0n, currency: 'INR' },
      taxes: { amountMinor: 0n, currency: 'INR' },
      total: { amountMinor: 0n, currency: 'INR' },
      currency: 'INR',
    };
  }
}
```

## Loading Plugins

In the browser environment, plugins are bundled with the extension. For development:

1. Place your plugin directory in `extensions/plugins/`
2. Restart the extension
3. The plugin will be automatically loaded

## Plugin Manifest Schema

| Field       | Type   | Required | Description                    |
| ----------- | ------ | -------- | ------------------------------ |
| id          | string | Yes      | Unique plugin identifier       |
| name        | string | Yes      | Display name                   |
| version     | string | Yes      | Plugin version                 |
| description | string | No       | Plugin description             |
| author      | string | No       | Author info                    |
| adapters    | array  | Yes      | List of adapter configurations |

## Adapter Config Schema

| Field       | Type                  | Required | Description          |
| ----------- | --------------------- | -------- | -------------------- |
| merchantId  | string                | Yes      | Merchant identifier  |
| adapterType | 'custom' \| 'generic' | Yes      | Adapter type         |
| config      | object                | No       | Custom configuration |

## License

MIT
