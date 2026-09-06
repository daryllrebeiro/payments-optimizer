import { Cart, CreditCard, Offer, Coupon, RewardRule, Money, Currency } from '@payments-optimizer/domain';

// Helper functions for multi-currency fixtures
function createMoney(amount: number, currency: Currency): Money {
  return {
    amountMinor: BigInt(Math.round(amount * 100)),
    currency,
  };
}

export const dummyMoney: Money = {
  amountMinor: 10000n, // 100.00
  currency: 'INR',
};

// ── INR Fixtures (existing) ──────────────────────────────────────────────────

export * from './fixtures.js';

// ── USD Fixtures ─────────────────────────────────────────────────────────────

// Carts
export const amazonCartUSD: Cart = {
  merchantId: 'amazon-us',
  items: [
    {
      id: 'us-item-1',
      name: 'Laptop',
      price: createMoney(999.99, 'USD'), // $999.99
      quantity: 1,
      category: 'ELECTRONICS',
    },
  ],
  subtotal: createMoney(999.99, 'USD'),
  discounts: [],
  shipping: createMoney(0, 'USD'),
  taxes: createMoney(80.00, 'USD'), // $80 tax
  total: createMoney(1079.99, 'USD'),
  currency: 'USD',
};

export const ebayCartUSD: Cart = {
  merchantId: 'ebay',
  items: [
    {
      id: 'us-item-2',
      name: 'Smart Watch',
      price: createMoney(299.99, 'USD'), // $299.99
      quantity: 1,
      category: 'ELECTRONICS',
    },
  ],
  subtotal: createMoney(299.99, 'USD'),
  discounts: [],
  shipping: createMoney(10.00, 'USD'),
  taxes: createMoney(24.00, 'USD'),
  total: createMoney(333.99, 'USD'),
  currency: 'USD',
};

// USD Cards
export const chaseSapphireCard: CreditCard = {
  id: 'chase-sapphire',
  issuer: 'Chase',
  productName: 'Sapphire Preferred',
  network: 'VISA',
  rewardProgram: 'Chase Ultimate Rewards',
  annualFee: createMoney(95.00, 'USD'), // $95 annual fee
  rewardRules: [
    {
      id: 'chase-sapphire-travel',
      rewardType: 'POINTS',
      rate: 0.02, // 2 points per $1 on travel
      category: ['TRAVEL'],
      maximumReward: createMoney(50000, 'USD'), // $500 cap (50,000 points at $0.01/value)
      period: 'ANNUAL',
    },
  ],
  userState: {
    isAvailable: true,
    currentStatementSpend: createMoney(0, 'USD'),
    annualSpendToDate: createMoney(15000, 'USD'),
    monthlySpendToDate: createMoney(0, 'USD'),
  },
};

export const capitalOneQueroCard: CreditCard = {
  id: 'capital-one-quero',
  issuer: 'Capital One',
  productName: 'Quero',
  network: 'MASTERCARD',
  rewardProgram: 'Capital One Rewards',
  annualFee: createMoney(0, 'USD'),
  rewardRules: [
    {
      id: 'capital-one-default',
      rewardType: 'POINTS',
      rate: 0.015, // 1.5 points per $1
      maximumReward: createMoney(75000, 'USD'), // $750 cap (75,000 points)
      period: 'MONTHLY',
    },
  ],
  userState: {
    isAvailable: true,
    currentStatementSpend: createMoney(0, 'USD'),
    annualSpendToDate: createMoney(8000, 'USD'),
    monthlySpendToDate: createMoney(0, 'USD'),
  },
};

// USD Coupons & Offers
export const amazonUSD5OffCoupon: Coupon = {
  id: 'coupon-amz-us-5',
  merchantId: 'amazon-us',
  code: 'US5OFF',
  benefit: {
    type: 'FIXED_DISCOUNT',
    value: createMoney(5.00, 'USD'),
  },
  conditions: [
    {
      type: 'MINIMUM_SPEND',
      value: createMoney(35.00, 'USD'), // Min $35
    },
  ],
  stackability: 'STACKABLE',
};

export const chaseOffers: Offer = {
  id: 'offer-chase-10-percent',
  merchantId: 'amazon-us',
  title: 'Chase 10% Back',
  description: '10% cash back on Amazon purchases',
  validFrom: '2026-08-01T00:00:00Z',
  validUntil: '2026-12-31T23:59:59Z',
  conditions: [],
  benefit: {
    type: 'CASHBACK',
    value: 0.10, // 10%
  },
  paymentRequirements: [
    {
      methodType: 'CREDIT_CARD',
      issuer: 'Chase',
    },
  ],
  stackingPolicy: {
    canStackWithCoupons: true,
    canStackWithGiftCards: true,
  },
  source: {
    type: 'OFFICIAL',
    retrievedAt: '2026-08-19T10:00:00Z',
  },
  confidence: 'HIGH',
};

// ── EUR Fixtures ─────────────────────────────────────────────────────────────

export const amazonEURCart: Cart = {
  merchantId: 'amazon-de',
  items: [
    {
      id: 'de-item-1',
      name: 'Kopfsteller',
      price: createMoney(29.99, 'EUR'), // €29.99
      quantity: 1,
      category: 'ELECTRONICS',
    },
  ],
  subtotal: createMoney(29.99, 'EUR'),
  discounts: [],
  shipping: createMoney(3.99, 'EUR'),
  taxes: createMoney(3.60, 'EUR'),
  total: createMoney(37.58, 'EUR'),
  currency: 'EUR',
};

// GBP Fixtures
export const amazonUKCart: Cart = {
  merchantId: 'amazon-uk',
  items: [
    {
      id: 'uk-item-1',
      name: 'Wireless Headphones',
      price: createMoney(79.99, 'GBP'), // £79.99
      quantity: 1,
      category: 'ELECTRONICS',
    },
  ],
  subtotal: createMoney(79.99, 'GBP'),
  discounts: [],
  shipping: createMoney(0, 'GBP'),
  taxes: createMoney(16.00, 'GBP'),
  total: createMoney(95.99, 'GBP'),
  currency: 'GBP',
};

