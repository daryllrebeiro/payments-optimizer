# Payment Optimizer API Documentation

Comprehensive API reference for the Payment Optimizer system.

## Table of Contents

1. [Core Packages](#core-packages)
2. [Benefits Package](#benefits-package)
3. [Rules Engine Package](#rules-engine-package)
4. [Storage Package](#storage-package)
5. [Profile Package](#profile-package)
6. [Type Definitions](#type-definitions)

---

## Core Packages

### @payments-optimizer/domain

Core type definitions and domain models.

#### Key Types

**Money**
```typescript
interface Money {
  amountMinor: bigint;  // Amount in smallest currency unit (e.g., cents)
  currency: Currency;    // 'INR' | 'USD' | 'EUR' | 'GBP' | etc.
}
```

**Cart**
```typescript
interface Cart {
  merchantId: string;
  items: CartItem[];
  subtotal: Money;
  discounts: Discount[];
  shipping: Money;
  taxes: Money;
  total: Money;
  currency: Currency;
}
```

**UserProfile**
```typescript
interface UserProfile {
  version: number;
  currency: Currency;
  paymentMethods: PaymentMethod[];
  memberships?: UserMembership[];
  vouchers?: UserVoucher[];
  rewardPreferences: RewardPreferences;
  optimizationPreferences: OptimizationPreferences;
}
```

---

## Benefits Package

### @payments-optimizer/benefits

Main optimization engine and benefit calculation.

#### UnifiedBenefitOptimizer

The core optimizer that combines all benefit types.

**Constructor**
```typescript
constructor(catalog?: PublicBenefitCatalog)
```

**optimize()**
```typescript
optimize(
  cart: Cart,
  profile: UserProfile,
  additionalOffers?: Offer[],
  now?: number
): UnifiedTransactionStrategy[]
```

Returns array of strategies sorted by opportunity score (best first).

**Example Usage**
```typescript
import { UnifiedBenefitOptimizer } from '@payments-optimizer/benefits';

const optimizer = new UnifiedBenefitOptimizer();
const strategies = optimizer.optimize(cart, userProfile);

// Best strategy
const best = strategies[0];
console.log(`Total benefit: $${best.totalBenefit.amountMinor / 100n}`);
console.log(`Opportunity score: ${best.opportunityScore}`);

// Recipe steps to follow
best.recipeSteps.forEach(step => {
  console.log(`${step.stepNumber}. ${step.description}`);
});
```

**Strategy Properties**
```typescript
interface UnifiedTransactionStrategy {
  id: string;
  steps: PaymentStep[];
  recipeSteps: StrategyRecipeStep[];
  voucherSavings: Money;
  partnerSavings: Money;
  cardSavings: Money;
  immediateDiscount: Money;
  rewardValue: Money;
  futureBenefit: Money;
  fees: Money;
  effectiveCost: Money;
  totalBenefit: Money;
  opportunityScore: number;
  urgencyBonus: Money;
  confidence: number;
  complexityScore: number;
}
```

---

## Rules Engine Package

### @payments-optimizer/rules-engine

Eligibility checking and benefit calculation logic.

#### checkEligibility()

Checks if a cart meets eligibility conditions.

```typescript
function checkEligibility(
  cart: Cart,
  conditions: RuleCondition[],
  contextDate?: string
): boolean
```

**Supported Conditions:**
- `MINIMUM_SPEND`: Cart subtotal must meet minimum
- `MERCHANT_ELIGIBILITY`: Merchant must be in allowed list
- `MCC_ELIGIBILITY`: Items must be in allowed categories
- `EXPIRY`: Offer must not be expired

**Example**
```typescript
import { checkEligibility } from '@payments-optimizer/rules-engine';

const conditions: RuleCondition[] = [
  { 
    type: 'MINIMUM_SPEND', 
    value: { amountMinor: 5000n, currency: 'USD' } 
  },
  { 
    type: 'MERCHANT_ELIGIBILITY', 
    value: ['amazon', 'ebay'] 
  }
];

if (checkEligibility(cart, conditions)) {
  // Cart is eligible for offer
}
```

#### calculateBenefit()

Calculates monetary value of a benefit.

```typescript
function calculateBenefit(
  cart: Cart,
  benefit: OfferBenefit
): Money
```

**Supported Benefit Types:**
- `PERCENTAGE_DISCOUNT`: Percentage off with optional cap
- `FIXED_DISCOUNT`: Fixed amount off
- `CASHBACK`: Cashback percentage with optional cap
- `POINTS`: Points value with optional cap

**Example**
```typescript
import { calculateBenefit } from '@payments-optimizer/rules-engine';

const benefit: OfferBenefit = {
  type: 'PERCENTAGE_DISCOUNT',
  value: 0.10,  // 10%
  cap: { amountMinor: 5000n, currency: 'USD' }  // Max $50
};

const savings = calculateBenefit(cart, benefit);
```

#### evaluateCardReward()

Evaluates card reward for a transaction.

```typescript
function evaluateCardReward(
  cart: Cart,
  rule: RewardRule,
  exclusions?: string[],
  currentSpentInPeriod?: Money
): Money
```

---

## Storage Package

### @payments-optimizer/storage

IndexedDB-based storage for user data.

#### StorageRepository

Main storage interface.

**Methods**

```typescript
class StorageRepository {
  // Card Management
  async saveCard(card: CreditCard): Promise<void>
  async getCard(id: string): Promise<CreditCard | undefined>
  async getAllCards(): Promise<CreditCard[]>
  async deleteCard(id: string): Promise<void>
  
  // Offer Management
  async saveOffer(offer: Offer): Promise<void>
  async getOffer(id: string): Promise<Offer | undefined>
  async getOffersByMerchant(merchantId: string): Promise<Offer[]>
  async deleteOffer(id: string): Promise<void>
  
  // Coupon Management
  async saveCoupon(coupon: Coupon): Promise<void>
  async getCoupon(id: string): Promise<Coupon | undefined>
  async getAllCoupons(): Promise<Coupon[]>
  async deleteCoupon(id: string): Promise<void>
}
```

**Example Usage**
```typescript
import { StorageRepository } from '@payments-optimizer/storage';

const storage = new StorageRepository();

// Save a card
await storage.saveCard(myCard);

// Get all cards
const cards = await storage.getAllCards();

// Get offers for a merchant
const amazonOffers = await storage.getOffersByMerchant('amazon');
```

---

## Profile Package

### @payments-optimizer/profile

User profile management with encryption support.

#### ProfileManager

Manages user profiles in IndexedDB.

```typescript
class ProfileManager {
  async createProfile(profile: UserProfile): Promise<void>
  async getProfile(): Promise<UserProfile | null>
  async saveProfile(profile: UserProfile): Promise<void>
  async addPaymentMethod(method: PaymentMethod): Promise<void>
  async addMembership(membership: UserMembership): Promise<void>
  async addVoucher(voucher: UserVoucher): Promise<void>
}
```

#### ProfileImportExport

Import/export profiles with optional encryption.

```typescript
class ProfileImportExport {
  static async exportProfile(
    profile: UserProfile,
    passphrase?: string
  ): Promise<string>
  
  static async importProfile(
    json: string,
    passphrase?: string
  ): Promise<UserProfile>
}
```

**Example**
```typescript
import { ProfileImportExport } from '@payments-optimizer/profile';

// Export with encryption
const encrypted = await ProfileImportExport.exportProfile(
  profile,
  'my-secure-password'
);

// Import encrypted profile
const imported = await ProfileImportExport.importProfile(
  encrypted,
  'my-secure-password'
);
```

---

## Type Definitions

### Payment Methods

```typescript
type PaymentMethod =
  | { type: 'CREDIT_CARD'; card: CreditCard }
  | { type: 'DEBIT_CARD'; card: DebitCard }
  | { type: 'UPI'; account: UpiAccount }
  | { type: 'WALLET'; wallet: Wallet }
  | { type: 'BANK_ACCOUNT'; account: BankAccount }
  | { type: 'GIFT_CARD'; giftCard: GiftCard };
```

### Credit Card

```typescript
interface CreditCard {
  id: string;
  issuer: string;
  productName: string;
  network: CardNetwork;  // 'VISA' | 'MASTERCARD' | 'AMEX' | 'RUPAY'
  rewardProgram: string;
  annualFee: Money;
  rewardRules: RewardRule[];
  milestoneRules?: MilestoneRule[];
  exclusions?: string[];
  userState?: UserCardState;
}
```

### Reward Rule

```typescript
interface RewardRule {
  id: string;
  rewardType: 'CASHBACK' | 'POINTS' | 'MILES';
  rate: Decimal;  // Percentage as decimal (0.05 = 5%)
  category?: string[];
  merchantIds?: string[];
  maximumReward?: Money;
  period: 'MONTHLY' | 'ANNUAL' | 'STATEMENT';
  minimumTransaction?: Money;
}
```

### Milestone Rule

```typescript
interface MilestoneRule {
  id: string;
  targetSpend: Money;
  reward: Money;
  rewardType: 'CASHBACK' | 'POINTS' | 'MILES';
  period: 'ANNUAL' | 'MONTHLY';
}
```

### Offer

```typescript
interface Offer {
  id: string;
  merchantId: string;
  title: string;
  description?: string;
  validFrom: string;  // ISO 8601 date
  validUntil: string;  // ISO 8601 date
  conditions: RuleCondition[];
  benefit: OfferBenefit;
  paymentRequirements?: PaymentRequirement[];
  stackingPolicy: StackingPolicy;
  source: OfferSource;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}
```

### Optimization Preferences

```typescript
interface OptimizationPreferences {
  immediateSavingsWeight: Decimal;  // 0.0 to 1.0
  rewardValueWeight: Decimal;       // 0.0 to 1.0
  milestoneWeight: Decimal;         // 0.0 to 1.0
  simplicityWeight: Decimal;        // 0.0 to 1.0
  riskWeight: Decimal;              // 0.0 to 1.0
  urgencyWeight?: Decimal;          // 0.0 to 1.0
}
```

---

## Best Practices

### Working with Money

Always use BigInt for amounts to avoid floating-point precision issues:

```typescript
// ✅ Correct
const amount: Money = {
  amountMinor: 12345n,  // $123.45
  currency: 'USD'
};

// ❌ Wrong
const amount = {
  amountMinor: 123.45,  // Will cause type error
  currency: 'USD'
};
```

### Display Money

```typescript
function formatMoney(money: Money): string {
  const major = money.amountMinor / 100n;
  const minor = money.amountMinor % 100n;
  return `${money.currency} ${major}.${minor.toString().padStart(2, '0')}`;
}

console.log(formatMoney({ amountMinor: 12345n, currency: 'USD' }));
// Output: "USD 123.45"
```

### Error Handling

```typescript
try {
  const strategies = optimizer.optimize(cart, profile);
  if (strategies.length === 0) {
    console.warn('No optimization strategies found');
  }
} catch (error) {
  console.error('Optimization failed:', error);
}
```

### Testing with Fixtures

```typescript
import {
  amazonCart,
  hdfcMillenniaCard,
  hdfcInstantDiscountOffer
} from '@payments-optimizer/test-fixtures';

// Use pre-built test data
const strategies = optimizer.optimize(amazonCart, {
  version: 1,
  currency: 'INR',
  paymentMethods: [{ type: 'CREDIT_CARD', card: hdfcMillenniaCard }],
  // ... other profile fields
});
```

---

## Migration Guide

### Upgrading from v0.6.0 to v0.7.0

**Breaking Changes:**
- `BenefitOptimizer` renamed to `UnifiedBenefitOptimizer`
- `OptimizationPreferences` now uses numeric weights instead of boolean flags
- `UserVoucher` structure changed (removed `programId`, added `merchantId` and `title`)

**Migration Example:**

```typescript
// v0.6.0
const preferences = {
  prioritizeCash: true,
  minimizeSteps: false,
  riskTolerance: 'MEDIUM'
};

// v0.7.0
const preferences = {
  immediateSavingsWeight: 0.4,
  rewardValueWeight: 0.3,
  milestoneWeight: 0.1,
  simplicityWeight: 0.1,
  riskWeight: 0.1
};
```

---

## Support

For issues, questions, or feature requests:
- GitHub Issues: https://github.com/daryllrebeiro/payments-optimizer/issues
- Documentation: See `/docs` folder in repository
- Examples: See `/packages/*/src/*.spec.ts` for usage examples
