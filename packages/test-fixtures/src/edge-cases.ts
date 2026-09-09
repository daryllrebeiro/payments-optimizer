/**
 * Edge case test fixtures for comprehensive testing
 */

import {
  Cart,
  CreditCard,
  Offer,
  Coupon,
  UserVoucher,
  Money,
  Currency,
} from '@payments-optimizer/domain';

function createMoney(amount: number, currency: Currency): Money {
  return {
    amountMinor: BigInt(Math.round(amount * 100)),
    currency,
  };
}

// ── Edge Case: Expired Card ──────────────────────────────────────────────────

export const expiredCard: CreditCard = {
  id: 'expired-card',
  issuer: 'TestBank',
  productName: 'Expired Card',
  network: 'VISA',
  rewardProgram: 'Test Rewards',
  annualFee: createMoney(0, 'USD'),
  rewardRules: [],
  userState: {
    isAvailable: false, // Card expired or unavailable
    currentStatementSpend: createMoney(0, 'USD'),
    annualSpendToDate: createMoney(0, 'USD'),
    monthlySpendToDate: createMoney(0, 'USD'),
  },
};

// ── Edge Case: Zero Balance Card ─────────────────────────────────────────────

export const zeroBalanceCard: CreditCard = {
  id: 'zero-balance-card',
  issuer: 'TestBank',
  productName: 'Zero Balance',
  network: 'MASTERCARD',
  rewardProgram: 'Test Rewards',
  annualFee: createMoney(0, 'USD'),
  rewardRules: [
    {
      id: 'zero-rule',
      rewardType: 'CASHBACK',
      rate: 0.01,
      maximumReward: createMoney(0, 'USD'), // Max reward already reached
      period: 'MONTHLY',
    },
  ],
  userState: {
    isAvailable: true,
    currentStatementSpend: createMoney(0, 'USD'),
    annualSpendToDate: createMoney(0, 'USD'),
    monthlySpendToDate: createMoney(0, 'USD'),
  },
};

// ── Edge Case: Cap Reached Card ──────────────────────────────────────────────

export const capReachedCard: CreditCard = {
  id: 'cap-reached-card',
  issuer: 'TestBank',
  productName: 'Cap Reached Card',
  network: 'VISA',
  rewardProgram: 'Test Rewards',
  annualFee: createMoney(0, 'INR'),
  rewardRules: [
    {
      id: 'capped-rule',
      rewardType: 'POINTS',
      rate: 0.05,
      maximumReward: createMoney(1000, 'INR'),
      period: 'MONTHLY',
    },
  ],
  userState: {
    isAvailable: true,
    currentStatementSpend: createMoney(20000, 'INR'), // Already at cap (20000 * 0.05 = 1000)
    annualSpendToDate: createMoney(240000, 'INR'),
    monthlySpendToDate: createMoney(20000, 'INR'),
  },
};

// ── Edge Case: Empty Cart ────────────────────────────────────────────────────

export const emptyCart: Cart = {
  merchantId: 'test-merchant',
  items: [],
  subtotal: createMoney(0, 'USD'),
  discounts: [],
  shipping: createMoney(0, 'USD'),
  taxes: createMoney(0, 'USD'),
  total: createMoney(0, 'USD'),
  currency: 'USD',
};

// ── Edge Case: Single Penny Cart ─────────────────────────────────────────────

export const pennyCart: Cart = {
  merchantId: 'test-merchant',
  items: [
    {
      id: 'penny-item',
      name: 'Penny Item',
      price: createMoney(0.01, 'USD'),
      quantity: 1,
      category: 'GENERAL',
    },
  ],
  subtotal: createMoney(0.01, 'USD'),
  discounts: [],
  shipping: createMoney(0, 'USD'),
  taxes: createMoney(0, 'USD'),
  total: createMoney(0.01, 'USD'),
  currency: 'USD',
};

// ── Edge Case: High Value Cart ──────────────────────────────────────────────

export const highValueCart: Cart = {
  merchantId: 'luxury-store',
  items: [
    {
      id: 'luxury-item-1',
      name: 'Luxury Watch',
      price: createMoney(50000, 'USD'),
      quantity: 1,
      category: 'LUXURY',
    },
    {
      id: 'luxury-item-2',
      name: 'Diamond Ring',
      price: createMoney(75000, 'USD'),
      quantity: 1,
      category: 'JEWELRY',
    },
  ],
  subtotal: createMoney(125000, 'USD'),
  discounts: [],
  shipping: createMoney(0, 'USD'),
  taxes: createMoney(12500, 'USD'),
  total: createMoney(137500, 'USD'),
  currency: 'USD',
};

// ── Edge Case: Complex Stacking Scenario ─────────────────────────────────────

export const complexStackingOffer: Offer = {
  id: 'complex-stacking-offer',
  merchantId: 'test-merchant',
  title: 'Complex Stacking 20% Off',
  description: 'Cannot stack with coupons or gift cards',
  validFrom: '2026-01-01T00:00:00Z',
  validUntil: '2026-12-31T23:59:59Z',
  conditions: [
    {
      type: 'MINIMUM_SPEND',
      value: createMoney(100, 'USD'),
    },
  ],
  benefit: {
    type: 'PERCENTAGE_DISCOUNT',
    value: 0.2,
    cap: createMoney(50, 'USD'),
  },
  paymentRequirements: [],
  stackingPolicy: {
    canStackWithCoupons: false,
    canStackWithGiftCards: false,
  },
  source: {
    type: 'OFFICIAL',
    retrievedAt: '2026-08-19T10:00:00Z',
  },
  confidence: 'HIGH',
};

// ── Edge Case: Expired Voucher ───────────────────────────────────────────────

export const expiredVoucher: UserVoucher = {
  id: 'expired-voucher',
  merchantId: 'test-merchant',
  title: 'Expired Gift Voucher',
  code: 'EXPIRED123',
  initialValue: createMoney(10, 'USD'),
  remainingValue: createMoney(10, 'USD'),
  expiryDate: '2025-01-01T00:00:00Z', // Expired
  singleUse: false,
};

// ── Edge Case: Valid Voucher ─────────────────────────────────────────────────

export const validVoucher: UserVoucher = {
  id: 'valid-voucher',
  merchantId: 'test-merchant',
  title: 'Valid Gift Voucher',
  code: 'VALID456',
  initialValue: createMoney(25, 'USD'),
  remainingValue: createMoney(25, 'USD'),
  expiryDate: '2027-12-31T23:59:59Z',
  singleUse: false,
};

// ── Edge Case: Expiring Soon Voucher ─────────────────────────────────────────

export const expiringSoonVoucher: UserVoucher = {
  id: 'expiring-soon-voucher',
  merchantId: 'test-merchant',
  title: 'Expiring Soon Voucher',
  code: 'EXPIRING789',
  initialValue: createMoney(50, 'USD'),
  remainingValue: createMoney(50, 'USD'),
  expiryDate: '2026-09-15T23:59:59Z', // Expiring in ~10 days from 2026-09-05
  singleUse: false,
};

// ── Edge Case: Currency Mismatch Cart ────────────────────────────────────────

export const currencyMismatchCart: Cart = {
  merchantId: 'international-store',
  items: [
    {
      id: 'item-eur',
      name: 'European Product',
      price: createMoney(100, 'EUR'),
      quantity: 1,
      category: 'GENERAL',
    },
  ],
  subtotal: createMoney(100, 'EUR'),
  discounts: [],
  shipping: createMoney(10, 'EUR'),
  taxes: createMoney(20, 'EUR'),
  total: createMoney(130, 'EUR'),
  currency: 'EUR',
};

// ── Edge Case: Multi-Merchant Cart ──────────────────────────────────────────

export const multiMerchantCart: Cart = {
  merchantId: 'marketplace',
  items: [
    {
      id: 'seller-1-item',
      name: 'Seller 1 Product',
      price: createMoney(50, 'USD'),
      quantity: 2,
      category: 'ELECTRONICS',
    },
    {
      id: 'seller-2-item',
      name: 'Seller 2 Product',
      price: createMoney(30, 'USD'),
      quantity: 1,
      category: 'BOOKS',
    },
    {
      id: 'seller-3-item',
      name: 'Seller 3 Product',
      price: createMoney(75, 'USD'),
      quantity: 1,
      category: 'APPAREL',
    },
  ],
  subtotal: createMoney(205, 'USD'),
  discounts: [],
  shipping: createMoney(15, 'USD'),
  taxes: createMoney(18, 'USD'),
  total: createMoney(238, 'USD'),
  currency: 'USD',
};

// ── Edge Case: Minimum Spend Not Met Coupon ─────────────────────────────────

export const minSpendNotMetCoupon: Coupon = {
  id: 'high-min-spend-coupon',
  merchantId: 'test-merchant',
  code: 'BIGSPEND',
  benefit: {
    type: 'FIXED_DISCOUNT',
    value: createMoney(100, 'USD'),
  },
  conditions: [
    {
      type: 'MINIMUM_SPEND',
      value: createMoney(1000, 'USD'), // Very high minimum
    },
  ],
  stackability: 'STACKABLE',
};

// ── Edge Case: No Minimum Spend Coupon ──────────────────────────────────────

export const noMinSpendCoupon: Coupon = {
  id: 'no-min-coupon',
  merchantId: 'test-merchant',
  code: 'FREEMONEY',
  benefit: {
    type: 'PERCENTAGE_DISCOUNT',
    value: 0.05,
  },
  conditions: [], // No minimum spend required
  stackability: 'STACKABLE',
};

// ── Edge Case: Non-Stackable Offer ──────────────────────────────────────────

export const nonStackableOffer: Offer = {
  id: 'non-stackable-offer',
  merchantId: 'test-merchant',
  title: 'Exclusive 30% Off',
  description: 'Cannot be combined with any other offers',
  validFrom: '2026-08-01T00:00:00Z',
  validUntil: '2026-12-31T23:59:59Z',
  conditions: [],
  benefit: {
    type: 'PERCENTAGE_DISCOUNT',
    value: 0.3,
  },
  paymentRequirements: [],
  stackingPolicy: {
    canStackWithCoupons: false,
    canStackWithGiftCards: false,
  },
  source: {
    type: 'PARTNER',
    retrievedAt: '2026-08-19T10:00:00Z',
  },
  confidence: 'MEDIUM',
};

// ── Edge Case: Card With Multiple Reward Tiers ──────────────────────────────

export const multiTierRewardCard: CreditCard = {
  id: 'multi-tier-card',
  issuer: 'PremiumBank',
  productName: 'Tiered Rewards Card',
  network: 'VISA',
  rewardProgram: 'Premium Rewards',
  annualFee: createMoney(150, 'USD'),
  rewardRules: [
    {
      id: 'tier-1-dining',
      rewardType: 'POINTS',
      rate: 0.05,
      category: ['DINING', 'RESTAURANTS'],
      maximumReward: createMoney(10000, 'USD'),
      period: 'ANNUAL',
    },
    {
      id: 'tier-2-travel',
      rewardType: 'POINTS',
      rate: 0.03,
      category: ['TRAVEL', 'AIRLINES', 'HOTELS'],
      maximumReward: createMoney(15000, 'USD'),
      period: 'ANNUAL',
    },
    {
      id: 'tier-3-default',
      rewardType: 'POINTS',
      rate: 0.01,
      maximumReward: createMoney(50000, 'USD'),
      period: 'ANNUAL',
    },
  ],
  milestoneRules: [
    {
      id: 'milestone-10k',
      targetSpend: createMoney(10000, 'USD'),
      reward: createMoney(100, 'USD'),
      rewardType: 'CASHBACK',
      period: 'ANNUAL',
    },
    {
      id: 'milestone-50k',
      targetSpend: createMoney(50000, 'USD'),
      reward: createMoney(750, 'USD'),
      rewardType: 'CASHBACK',
      period: 'ANNUAL',
    },
  ],
  userState: {
    isAvailable: true,
    currentStatementSpend: createMoney(3500, 'USD'),
    annualSpendToDate: createMoney(45000, 'USD'), // Close to milestone
    monthlySpendToDate: createMoney(3500, 'USD'),
  },
};
