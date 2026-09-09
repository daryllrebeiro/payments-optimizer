# @payments-optimizer/test-fixtures

Comprehensive test fixtures for payment optimization scenarios across multiple currencies and edge cases.

## Overview

This package provides pre-built test data for:

- **Multi-currency scenarios** (INR, USD, EUR, GBP)
- **Edge cases** (expired cards, zero balances, high-value transactions)
- **Realistic merchant carts** (Amazon, eBay, Tesco, Zalando, etc.)
- **Credit cards with reward programs**
- **Offers, coupons, and vouchers**

## Usage

```typescript
import {
  // INR Fixtures
  amazonCart,
  hdfcMillenniaCard,
  sbiCashbackCard,
  hdfcInstantDiscountOffer,

  // USD Fixtures
  amazonCartUSD,
  chaseSapphireCard,
  chaseOffers,

  // EUR Fixtures
  zalandoCart,
  revolutPremiumCard,
  zalandoSummerSale,

  // GBP Fixtures
  tescoCart,
  barclaysPlatinumCashback,
  tescoClubcardOffer,

  // Edge Cases
  expiredCard,
  emptyCart,
  highValueCart,
  expiredVoucher,
} from '@payments-optimizer/test-fixtures';
```

## Fixture Categories

### INR (Indian) Fixtures

#### Carts

- `amazonCart` - ₹25,000 electronics and books cart
- `flipkartCart` - ₹10,000 apparel cart

#### Cards

- `hdfcMillenniaCard` - HDFC Millennia with 5% on Amazon
- `sbiCashbackCard` - SBI Cashback Card with 5% online
- `axisAtlasCard` - Axis Atlas with milestone rewards

#### Offers & Coupons

- `hdfcInstantDiscountOffer` - 10% discount up to ₹1,500
- `amazonCoupon` - ₹1,000 off on ₹15,000+

### USD (American) Fixtures

#### Carts

- `amazonCartUSD` - $1,079.99 laptop cart
- `ebayCartUSD` - $333.99 smartwatch cart

#### Cards

- `chaseSapphireCard` - Chase Sapphire Preferred with travel rewards
- `capitalOneQueroCard` - Capital One Quero 1.5% flat rewards

#### Offers & Coupons

- `chaseOffers` - 10% cashback on Amazon
- `amazonUSD5OffCoupon` - $5 off $35+

### EUR (European) Fixtures

#### Carts

- `zalandoCart` - €285.58 fashion cart
- `mediaMarktCart` - €985.20 electronics cart
- `carrefourCart` - €115.50 groceries cart

#### Cards

- `revolutPremiumCard` - Revolut Premium with 1% cashback
- `n26Card` - N26 You with travel/shopping rewards
- `bnpParibasCard` - BNP Paribas Premium with milestone bonuses

#### Offers & Coupons

- `zalandoSummerSale` - 15% off fashion (max €50)
- `mediaMarktVISAOffer` - 10% VISA discount
- `carrefourLoyaltyCoupon` - €10 off €75+

### GBP (British) Fixtures

#### Carts

- `tescoCart` - £85.50 groceries cart
- `currysCart` - £1,001.96 electronics cart
- `marksAndSpencerCart` - £410.39 clothing cart
- `argosCart` - £227.98 home goods cart

#### Cards

- `amexPlatinumUK` - Amex Platinum with premium travel rewards
- `barclaysPlatinumCashback` - Barclays 1.5% supermarket cashback
- `hsbcPremierCard` - HSBC Premier with milestone bonuses
- `santanderAllRounder` - Santander 0.5% everywhere cashback

#### Offers & Coupons

- `tescoClubcardOffer` - 10% Clubcard discount
- `currysVISAOffer` - 5% VISA cashback
- `amazonUKPrimeDay` - 20% Prime Day discount

### Edge Cases

#### Problem Cards

- `expiredCard` - Unavailable/expired card
- `zeroBalanceCard` - Card with reward cap already reached
- `capReachedCard` - Card at spending cap limit

#### Problem Carts

- `emptyCart` - Cart with no items
- `pennyCart` - $0.01 single item cart
- `highValueCart` - $137,500 luxury goods cart
- `multiMerchantCart` - Multi-seller marketplace cart

#### Complex Scenarios

- `complexStackingOffer` - Non-stackable high-value offer
- `nonStackableOffer` - Exclusive 30% discount
- `multiTierRewardCard` - Card with multiple reward tiers and milestones

#### Vouchers

- `expiredVoucher` - Expired gift voucher
- `validVoucher` - Valid $25 voucher
- `expiringSoonVoucher` - Voucher expiring in 10 days

#### Coupons

- `minSpendNotMetCoupon` - $100 off but requires $1,000 spend
- `noMinSpendCoupon` - 5% off with no minimum

## Test Scenarios

### Multi-Currency Testing

```typescript
import {
  amazonCart,
  amazonCartUSD,
  amazonEURCart,
  amazonUKCart,
} from '@payments-optimizer/test-fixtures';

// Test same merchant across currencies
const carts = [amazonCart, amazonCartUSD, amazonEURCart, amazonUKCart];
```

### Edge Case Testing

```typescript
import {
  emptyCart,
  pennyCart,
  highValueCart,
  expiredCard,
  capReachedCard,
} from '@payments-optimizer/test-fixtures';

describe('Edge Cases', () => {
  it('handles empty cart', () => {
    // Test with emptyCart
  });

  it('handles expired cards', () => {
    // Test with expiredCard
  });
});
```

### Stacking Scenarios

```typescript
import {
  amazonCart,
  hdfcMillenniaCard,
  hdfcInstantDiscountOffer,
  amazonCoupon,
} from '@payments-optimizer/test-fixtures';

// Test complex benefit stacking
const strategy = optimizer.optimize(amazonCart, {
  paymentMethods: [{ type: 'CREDIT_CARD', card: hdfcMillenniaCard }],
  offers: [hdfcInstantDiscountOffer],
  coupons: [amazonCoupon],
});
```

### Milestone Testing

```typescript
import { axisAtlasCard, bnpParibasCard, hsbcPremierCard } from '@payments-optimizer/test-fixtures';

// All these cards have annualSpendToDate close to milestones
const cardsNearMilestone = [axisAtlasCard, bnpParibasCard, hsbcPremierCard];
```

## Data Characteristics

### Realistic Values

- Prices match regional expectations (₹, $, €, £)
- VAT/Tax rates reflect regional standards (0%, 19%, 20%)
- Shipping costs vary by merchant and region
- Reward rates match real-world card programs

### Comprehensive Coverage

- **4 currencies**: INR, USD, EUR, GBP
- **20+ cards**: Covering all major networks and reward types
- **15+ merchants**: E-commerce, retail, groceries, electronics
- **30+ offers/coupons**: Various stacking policies and conditions
- **10+ edge cases**: Boundary conditions and error scenarios

### Test-Friendly Design

- All amounts use BigInt for precision
- Dates use ISO 8601 format
- Consistent naming conventions
- Well-documented structures

## Contributing

When adding new fixtures:

1. Follow the currency-specific file pattern (`xxx-fixtures.ts`)
2. Use the `createMoneyXXX()` helper for consistent formatting
3. Add realistic merchant names and product categories
4. Document edge cases clearly
5. Update this README with new fixtures
6. Export from `index.ts`

## Related Packages

- `@payments-optimizer/domain` - Type definitions
- `@payments-optimizer/benchmarks` - Uses these fixtures for performance testing
- `@payments-optimizer/benefits` - Optimization logic tested with these fixtures
