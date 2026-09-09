# Quick Start Guide

Get started with Payment Optimizer in 5 minutes.

## Installation

### Prerequisites

- Node.js 18+ and pnpm 8+
- Chrome/Edge browser (Chromium-based)

### Setup

```bash
# Clone repository
git clone https://github.com/daryllrebeiro/payments-optimizer.git
cd payments-optimizer

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

### Load Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select `apps/extension/dist/` folder
5. Extension icon should appear in toolbar

---

## Basic Usage

### 1. Set Up Your Profile

Click the extension icon → **Settings** → **Profile**

```typescript
// Add your credit cards
{
  issuer: "HDFC",
  productName: "Millennia",
  network: "MASTERCARD",
  rewardProgram: "HDFC Millennia Points",
  annualFee: { amountMinor: 100000n, currency: "INR" },
  rewardRules: [{
    rate: 0.05,  // 5% cashback
    category: ["ELECTRONICS"]
  }]
}
```

### 2. Browse and Shop

1. Navigate to supported merchant (e.g., Amazon)
2. Add items to cart
3. Extension automatically detects cart
4. Click extension icon to see recommendations

### 3. Apply Recommendations

Follow the recipe steps shown:

```
1. Apply coupon code: SAVE1000
2. Add gift card: ₹5,000
3. Pay remaining ₹20,000 with HDFC Millennia
4. Earn ₹1,000 in rewards

Total benefit: ₹6,000 💰
```

---

## Code Examples

### Using the Optimizer Programmatically

```typescript
import { UnifiedBenefitOptimizer } from '@payments-optimizer/benefits';
import { amazonCart, hdfcMillenniaCard } from '@payments-optimizer/test-fixtures';

// Create optimizer
const optimizer = new UnifiedBenefitOptimizer();

// Define user profile
const profile = {
  version: 1,
  currency: 'INR',
  paymentMethods: [{ type: 'CREDIT_CARD', card: hdfcMillenniaCard }],
  rewardPreferences: {
    defaultValuations: {
      'HDFC Millennia Points': { amountMinor: 50n, currency: 'INR' },
    },
  },
  optimizationPreferences: {
    immediateSavingsWeight: 0.4,
    rewardValueWeight: 0.3,
    milestoneWeight: 0.1,
    simplicityWeight: 0.1,
    riskWeight: 0.1,
  },
};

// Optimize
const strategies = optimizer.optimize(amazonCart, profile);

// Best strategy
const best = strategies[0];
console.log(`Save: ₹${best.totalBenefit.amountMinor / 100n}`);
console.log(`Score: ${best.opportunityScore}`);
```

### Working with Storage

```typescript
import { StorageRepository } from '@payments-optimizer/storage';

const storage = new StorageRepository();

// Save a card
await storage.saveCard({
  id: 'my-card-1',
  issuer: 'Chase',
  productName: 'Sapphire Preferred',
  network: 'VISA',
  // ... other fields
});

// Get all cards
const cards = await storage.getAllCards();

// Get offers for merchant
const offers = await storage.getOffersByMerchant('amazon');
```

### Checking Eligibility

```typescript
import { checkEligibility } from '@payments-optimizer/rules-engine';

const conditions = [
  {
    type: 'MINIMUM_SPEND',
    value: { amountMinor: 5000n, currency: 'USD' },
  },
];

if (checkEligibility(cart, conditions)) {
  console.log('Cart is eligible for this offer');
}
```

---

## Testing

### Run All Tests

```bash
pnpm test
```

### Run Specific Package Tests

```bash
pnpm --filter @payments-optimizer/benefits test
```

### Using Test Fixtures

```typescript
import {
  // INR fixtures
  amazonCart,
  hdfcMillenniaCard,

  // USD fixtures
  amazonCartUSD,
  chaseSapphireCard,

  // Edge cases
  emptyCart,
  expiredCard,
  highValueCart,
} from '@payments-optimizer/test-fixtures';

describe('My Test', () => {
  it('handles empty cart', () => {
    const result = optimizer.optimize(emptyCart, profile);
    expect(result).toHaveLength(0);
  });
});
```

---

## Common Tasks

### Add a New Card

```typescript
import { ProfileManager } from '@payments-optimizer/profile';

const manager = new ProfileManager();

await manager.addPaymentMethod({
  type: 'CREDIT_CARD',
  card: {
    id: 'new-card',
    issuer: 'Bank Name',
    productName: 'Card Name',
    network: 'VISA',
    rewardProgram: 'Rewards Program',
    annualFee: { amountMinor: 0n, currency: 'USD' },
    rewardRules: [
      {
        id: 'rule-1',
        rewardType: 'CASHBACK',
        rate: 0.02, // 2%
        period: 'MONTHLY',
      },
    ],
    userState: {
      isAvailable: true,
      currentStatementSpend: { amountMinor: 0n, currency: 'USD' },
      annualSpendToDate: { amountMinor: 0n, currency: 'USD' },
      monthlySpendToDate: { amountMinor: 0n, currency: 'USD' },
    },
  },
});
```

### Export/Import Profile

```typescript
import { ProfileImportExport } from '@payments-optimizer/profile';

// Export with encryption
const encrypted = await ProfileImportExport.exportProfile(profile, 'my-password');

// Save to file
const blob = new Blob([encrypted], { type: 'application/json' });
const url = URL.createObjectURL(blob);
// Download via <a> tag

// Import
const imported = await ProfileImportExport.importProfile(encryptedData, 'my-password');
```

### Add Custom Merchant Adapter

```typescript
import { MerchantAdapter, PageContext } from '@payments-optimizer/domain';

class MyStoreAdapter implements MerchantAdapter {
  canHandle(context: PageContext): boolean {
    return context.url.includes('mystore.com');
  }

  detectMerchant(context: PageContext) {
    return {
      merchantId: 'mystore',
      confidence: 1.0
    };
  }

  async extractCart(context: PageContext): Promise<Cart> {
    // Parse DOM to extract cart
    const total = document.querySelector('.cart-total')?.textContent;
    // ... extract items

    return {
      merchantId: 'mystore',
      items: [...],
      total: { amountMinor: 10000n, currency: 'USD' },
      currency: 'USD'
    };
  }

  async extractProduct(context: PageContext) {
    // Extract product details
  }
}

// Register adapter
registry.register('mystore.com', new MyStoreAdapter());
```

---

## Performance Tips

### 1. Minimize Storage Operations

```typescript
// ❌ Bad: Multiple queries
for (const id of cardIds) {
  await storage.getCard(id);
}

// ✅ Good: Batch query
const allCards = await storage.getAllCards();
const selectedCards = allCards.filter((c) => cardIds.includes(c.id));
```

### 2. Use Benchmarks

```bash
pnpm --filter @payments-optimizer/benchmarks bench
```

### 3. Profile Memory

```typescript
// Enable garbage collection
node --expose-gc dist/run-benchmarks.js
```

---

## Troubleshooting

### Extension Not Loading

1. Check `chrome://extensions/` for errors
2. Verify `manifest.json` is in dist folder
3. Rebuild: `pnpm build`

### Tests Failing

1. Clean build: `rm -rf node_modules && pnpm install`
2. Rebuild packages: `pnpm build`
3. Check for TypeScript errors: `pnpm tsc --noEmit`

### Performance Issues

1. Check bundle size: `pnpm build` (look for output sizes)
2. Run benchmarks: `pnpm --filter @payments-optimizer/benchmarks bench`
3. Profile with Chrome DevTools

---

## Next Steps

- Read [API Documentation](./API.md) for detailed reference
- Explore [Architecture Guide](./ARCHITECTURE.md) for system design
- Check [Contributing Guide](../CONTRIBUTING.md) for development workflow
- Review [ADRs](./architecture/) for design decisions

---

## Getting Help

- **Issues**: https://github.com/daryllrebeiro/payments-optimizer/issues
- **Discussions**: GitHub Discussions
- **Documentation**: `/docs` folder

---

## License

MIT License - see [LICENSE](../LICENSE) file for details
