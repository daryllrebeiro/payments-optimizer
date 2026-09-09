/**
 * Comprehensive EUR (European) test fixtures
 */

import { Cart, CreditCard, Offer, Coupon, Money } from '@payments-optimizer/domain';

function createMoneyEUR(amount: number): Money {
  return {
    amountMinor: BigInt(Math.round(amount * 100)),
    currency: 'EUR',
  };
}

// ── EUR Carts ────────────────────────────────────────────────────────────────

export const zalandoCart: Cart = {
  merchantId: 'zalando-de',
  items: [
    {
      id: 'eur-fashion-1',
      name: 'Designer Jacket',
      price: createMoneyEUR(149.99),
      quantity: 1,
      category: 'APPAREL',
    },
    {
      id: 'eur-fashion-2',
      name: 'Leather Boots',
      price: createMoneyEUR(89.99),
      quantity: 1,
      category: 'APPAREL',
    },
  ],
  subtotal: createMoneyEUR(239.98),
  discounts: [],
  shipping: createMoneyEUR(0), // Free shipping
  taxes: createMoneyEUR(45.6), // 19% VAT
  total: createMoneyEUR(285.58),
  currency: 'EUR',
};

export const mediaMarktCart: Cart = {
  merchantId: 'mediamarkt-de',
  items: [
    {
      id: 'eur-electronics-1',
      name: 'Smart TV 55"',
      price: createMoneyEUR(599.0),
      quantity: 1,
      category: 'ELECTRONICS',
    },
    {
      id: 'eur-electronics-2',
      name: 'Soundbar',
      price: createMoneyEUR(199.0),
      quantity: 1,
      category: 'ELECTRONICS',
    },
  ],
  subtotal: createMoneyEUR(798.0),
  discounts: [],
  shipping: createMoneyEUR(29.9),
  taxes: createMoneyEUR(157.3),
  total: createMoneyEUR(985.2),
  currency: 'EUR',
};

export const carrefourCart: Cart = {
  merchantId: 'carrefour-fr',
  items: [
    {
      id: 'eur-grocery-1',
      name: 'Fresh Produce',
      price: createMoneyEUR(25.5),
      quantity: 1,
      category: 'GROCERIES',
    },
    {
      id: 'eur-grocery-2',
      name: 'Wine Selection',
      price: createMoneyEUR(45.0),
      quantity: 2,
      category: 'BEVERAGES',
    },
  ],
  subtotal: createMoneyEUR(115.5),
  discounts: [],
  shipping: createMoneyEUR(0),
  taxes: createMoneyEUR(0), // Already included
  total: createMoneyEUR(115.5),
  currency: 'EUR',
};

// ── EUR Cards ────────────────────────────────────────────────────────────────

export const revolutPremiumCard: CreditCard = {
  id: 'revolut-premium',
  issuer: 'Revolut',
  productName: 'Premium Metal Card',
  network: 'MASTERCARD',
  rewardProgram: 'Revolut Cashback',
  annualFee: createMoneyEUR(119.88), // €9.99/month
  rewardRules: [
    {
      id: 'revolut-cashback',
      rewardType: 'CASHBACK',
      rate: 0.01, // 1% cashback on all purchases
      maximumReward: createMoneyEUR(10000),
      period: 'MONTHLY',
    },
  ],
  userState: {
    isAvailable: true,
    currentStatementSpend: createMoneyEUR(0),
    annualSpendToDate: createMoneyEUR(12000),
    monthlySpendToDate: createMoneyEUR(0),
  },
};

export const n26Card: CreditCard = {
  id: 'n26-you',
  issuer: 'N26',
  productName: 'N26 You',
  network: 'MASTERCARD',
  rewardProgram: 'N26 Rewards',
  annualFee: createMoneyEUR(118.8), // €9.90/month
  rewardRules: [
    {
      id: 'n26-travel',
      rewardType: 'POINTS',
      rate: 0.005, // 0.5% on travel
      category: ['TRAVEL', 'AIRLINES', 'HOTELS'],
      maximumReward: createMoneyEUR(5000),
      period: 'ANNUAL',
    },
    {
      id: 'n26-shopping',
      rewardType: 'POINTS',
      rate: 0.003, // 0.3% on shopping
      category: ['SHOPPING', 'ELECTRONICS', 'APPAREL'],
      maximumReward: createMoneyEUR(3000),
      period: 'ANNUAL',
    },
  ],
  userState: {
    isAvailable: true,
    currentStatementSpend: createMoneyEUR(0),
    annualSpendToDate: createMoneyEUR(8500),
    monthlySpendToDate: createMoneyEUR(0),
  },
};

export const bnpParibasCard: CreditCard = {
  id: 'bnp-paribas-premium',
  issuer: 'BNP Paribas',
  productName: 'Premium Visa',
  network: 'VISA',
  rewardProgram: 'BNP Points',
  annualFee: createMoneyEUR(150.0),
  rewardRules: [
    {
      id: 'bnp-premium-rewards',
      rewardType: 'POINTS',
      rate: 0.02, // 2% rewards
      maximumReward: createMoneyEUR(20000),
      period: 'ANNUAL',
    },
  ],
  milestoneRules: [
    {
      id: 'bnp-milestone-20k',
      targetSpend: createMoneyEUR(20000),
      reward: createMoneyEUR(200),
      rewardType: 'CASHBACK',
      period: 'ANNUAL',
    },
  ],
  userState: {
    isAvailable: true,
    currentStatementSpend: createMoneyEUR(0),
    annualSpendToDate: createMoneyEUR(18500), // Close to milestone
    monthlySpendToDate: createMoneyEUR(0),
  },
};

// ── EUR Offers & Coupons ─────────────────────────────────────────────────────

export const zalandoSummerSale: Offer = {
  id: 'zalando-summer-sale',
  merchantId: 'zalando-de',
  title: 'Summer Sale 15% Off',
  description: '15% off on fashion items',
  validFrom: '2026-07-01T00:00:00Z',
  validUntil: '2026-08-31T23:59:59Z',
  conditions: [
    {
      type: 'MINIMUM_SPEND',
      value: createMoneyEUR(50),
    },
  ],
  benefit: {
    type: 'PERCENTAGE_DISCOUNT',
    value: 0.15,
    cap: createMoneyEUR(50),
  },
  paymentRequirements: [],
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

export const mediaMarktVISAOffer: Offer = {
  id: 'mediamarkt-visa-offer',
  merchantId: 'mediamarkt-de',
  title: 'VISA 10% Instant Discount',
  description: '10% off with VISA cards',
  validFrom: '2026-08-01T00:00:00Z',
  validUntil: '2026-09-30T23:59:59Z',
  conditions: [
    {
      type: 'MINIMUM_SPEND',
      value: createMoneyEUR(200),
    },
  ],
  benefit: {
    type: 'PERCENTAGE_DISCOUNT',
    value: 0.1,
    cap: createMoneyEUR(100),
  },
  paymentRequirements: [
    {
      methodType: 'CREDIT_CARD',
      network: 'VISA',
    },
  ],
  stackingPolicy: {
    canStackWithCoupons: false,
    canStackWithGiftCards: true,
  },
  source: {
    type: 'PARTNER',
    retrievedAt: '2026-08-19T10:00:00Z',
  },
  confidence: 'HIGH',
};

export const carrefourLoyaltyCoupon: Coupon = {
  id: 'carrefour-loyalty',
  merchantId: 'carrefour-fr',
  code: 'LOYAL10',
  benefit: {
    type: 'FIXED_DISCOUNT',
    value: createMoneyEUR(10),
  },
  conditions: [
    {
      type: 'MINIMUM_SPEND',
      value: createMoneyEUR(75),
    },
  ],
  stackability: 'STACKABLE',
};

export const amazonDEPrimeCoupon: Coupon = {
  id: 'amazon-de-prime',
  merchantId: 'amazon-de',
  code: 'PRIME15',
  benefit: {
    type: 'PERCENTAGE_DISCOUNT',
    value: 0.15,
  },
  conditions: [
    {
      type: 'MINIMUM_SPEND',
      value: createMoneyEUR(40),
    },
  ],
  stackability: 'STACKABLE',
};
