/**
 * Comprehensive GBP (British) test fixtures
 */

import { Cart, CreditCard, Offer, Coupon, Money } from '@payments-optimizer/domain';

function createMoneyGBP(amount: number): Money {
  return {
    amountMinor: BigInt(Math.round(amount * 100)),
    currency: 'GBP',
  };
}

// ── GBP Carts ────────────────────────────────────────────────────────────────

export const tescoCart: Cart = {
  merchantId: 'tesco-uk',
  items: [
    {
      id: 'gbp-grocery-1',
      name: 'Weekly Groceries',
      price: createMoneyGBP(85.5),
      quantity: 1,
      category: 'GROCERIES',
    },
  ],
  subtotal: createMoneyGBP(85.5),
  discounts: [],
  shipping: createMoneyGBP(0),
  taxes: createMoneyGBP(0), // VAT included
  total: createMoneyGBP(85.5),
  currency: 'GBP',
};

export const currysCart: Cart = {
  merchantId: 'currys-uk',
  items: [
    {
      id: 'gbp-electronics-1',
      name: 'Laptop',
      price: createMoneyGBP(799.99),
      quantity: 1,
      category: 'ELECTRONICS',
    },
    {
      id: 'gbp-electronics-2',
      name: 'Wireless Mouse',
      price: createMoneyGBP(29.99),
      quantity: 1,
      category: 'ELECTRONICS',
    },
  ],
  subtotal: createMoneyGBP(829.98),
  discounts: [],
  shipping: createMoneyGBP(4.99),
  taxes: createMoneyGBP(166.99), // 20% VAT
  total: createMoneyGBP(1001.96),
  currency: 'GBP',
};

export const marksAndSpencerCart: Cart = {
  merchantId: 'marks-spencer-uk',
  items: [
    {
      id: 'gbp-clothing-1',
      name: 'Formal Suit',
      price: createMoneyGBP(249.0),
      quantity: 1,
      category: 'APPAREL',
    },
    {
      id: 'gbp-clothing-2',
      name: 'Dress Shoes',
      price: createMoneyGBP(89.0),
      quantity: 1,
      category: 'APPAREL',
    },
  ],
  subtotal: createMoneyGBP(338.0),
  discounts: [],
  shipping: createMoneyGBP(3.99),
  taxes: createMoneyGBP(68.4),
  total: createMoneyGBP(410.39),
  currency: 'GBP',
};

export const argosCart: Cart = {
  merchantId: 'argos-uk',
  items: [
    {
      id: 'gbp-home-1',
      name: 'Coffee Machine',
      price: createMoneyGBP(149.99),
      quantity: 1,
      category: 'HOME',
    },
    {
      id: 'gbp-home-2',
      name: 'Toaster',
      price: createMoneyGBP(39.99),
      quantity: 1,
      category: 'HOME',
    },
  ],
  subtotal: createMoneyGBP(189.98),
  discounts: [],
  shipping: createMoneyGBP(0), // Free shipping
  taxes: createMoneyGBP(38.0),
  total: createMoneyGBP(227.98),
  currency: 'GBP',
};

// ── GBP Cards ────────────────────────────────────────────────────────────────

export const amexPlatinumUK: CreditCard = {
  id: 'amex-platinum-uk',
  issuer: 'American Express',
  productName: 'Platinum Card',
  network: 'AMEX',
  rewardProgram: 'Membership Rewards',
  annualFee: createMoneyGBP(575.0),
  rewardRules: [
    {
      id: 'amex-platinum-travel',
      rewardType: 'POINTS',
      rate: 0.02, // 2 points per £1 on travel
      category: ['TRAVEL', 'AIRLINES', 'HOTELS'],
      maximumReward: createMoneyGBP(50000),
      period: 'ANNUAL',
    },
    {
      id: 'amex-platinum-default',
      rewardType: 'POINTS',
      rate: 0.01, // 1 point per £1 on everything else
      maximumReward: createMoneyGBP(100000),
      period: 'ANNUAL',
    },
  ],
  milestoneRules: [
    {
      id: 'amex-welcome-bonus',
      targetSpend: createMoneyGBP(3000),
      reward: createMoneyGBP(200), // 20,000 points value
      rewardType: 'POINTS',
      period: 'ANNUAL',
    },
  ],
  userState: {
    isAvailable: true,
    currentStatementSpend: createMoneyGBP(0),
    annualSpendToDate: createMoneyGBP(25000),
    monthlySpendToDate: createMoneyGBP(0),
  },
};

export const barclaysPlatinumCashback: CreditCard = {
  id: 'barclays-platinum-cashback',
  issuer: 'Barclays',
  productName: 'Platinum Cashback',
  network: 'VISA',
  rewardProgram: 'Barclays Cashback',
  annualFee: createMoneyGBP(0),
  rewardRules: [
    {
      id: 'barclays-cashback-supermarkets',
      rewardType: 'CASHBACK',
      rate: 0.015, // 1.5% cashback at supermarkets
      category: ['GROCERIES'],
      merchantIds: ['tesco-uk', 'sainsburys-uk', 'asda-uk'],
      maximumReward: createMoneyGBP(100),
      period: 'MONTHLY',
    },
    {
      id: 'barclays-cashback-default',
      rewardType: 'CASHBACK',
      rate: 0.005, // 0.5% on everything else
      maximumReward: createMoneyGBP(50),
      period: 'MONTHLY',
    },
  ],
  userState: {
    isAvailable: true,
    currentStatementSpend: createMoneyGBP(0),
    annualSpendToDate: createMoneyGBP(8000),
    monthlySpendToDate: createMoneyGBP(0),
  },
};

export const hsbcPremierCard: CreditCard = {
  id: 'hsbc-premier',
  issuer: 'HSBC',
  productName: 'Premier World Elite Mastercard',
  network: 'MASTERCARD',
  rewardProgram: 'HSBC Rewards',
  annualFee: createMoneyGBP(195.0),
  rewardRules: [
    {
      id: 'hsbc-premier-rewards',
      rewardType: 'POINTS',
      rate: 0.015, // 1.5% rewards
      maximumReward: createMoneyGBP(25000),
      period: 'ANNUAL',
    },
  ],
  milestoneRules: [
    {
      id: 'hsbc-premier-milestone-10k',
      targetSpend: createMoneyGBP(10000),
      reward: createMoneyGBP(150),
      rewardType: 'CASHBACK',
      period: 'ANNUAL',
    },
  ],
  userState: {
    isAvailable: true,
    currentStatementSpend: createMoneyGBP(0),
    annualSpendToDate: createMoneyGBP(9200), // Close to milestone
    monthlySpendToDate: createMoneyGBP(0),
  },
};

export const santanderAllRounder: CreditCard = {
  id: 'santander-all-rounder',
  issuer: 'Santander',
  productName: 'All in One Credit Card',
  network: 'MASTERCARD',
  rewardProgram: 'Santander Cashback',
  annualFee: createMoneyGBP(0),
  rewardRules: [
    {
      id: 'santander-cashback',
      rewardType: 'CASHBACK',
      rate: 0.005, // 0.5% cashback everywhere
      maximumReward: createMoneyGBP(120),
      period: 'ANNUAL',
    },
  ],
  userState: {
    isAvailable: true,
    currentStatementSpend: createMoneyGBP(0),
    annualSpendToDate: createMoneyGBP(5500),
    monthlySpendToDate: createMoneyGBP(0),
  },
};

// ── GBP Offers & Coupons ─────────────────────────────────────────────────────

export const tescoClubcardOffer: Offer = {
  id: 'tesco-clubcard-10',
  merchantId: 'tesco-uk',
  title: 'Clubcard 10% Off',
  description: '10% off with Clubcard',
  validFrom: '2026-08-01T00:00:00Z',
  validUntil: '2026-09-30T23:59:59Z',
  conditions: [
    {
      type: 'MINIMUM_SPEND',
      value: createMoneyGBP(50),
    },
  ],
  benefit: {
    type: 'PERCENTAGE_DISCOUNT',
    value: 0.1,
    cap: createMoneyGBP(20),
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

export const currysVISAOffer: Offer = {
  id: 'currys-visa-cashback',
  merchantId: 'currys-uk',
  title: 'VISA 5% Cashback',
  description: '5% cashback on electronics with VISA',
  validFrom: '2026-08-15T00:00:00Z',
  validUntil: '2026-10-15T23:59:59Z',
  conditions: [
    {
      type: 'MINIMUM_SPEND',
      value: createMoneyGBP(300),
    },
  ],
  benefit: {
    type: 'CASHBACK',
    value: 0.05,
    cap: createMoneyGBP(50),
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

export const marksAndSpencerSparksCard: Coupon = {
  id: 'ms-sparks-voucher',
  merchantId: 'marks-spencer-uk',
  code: 'SPARKS15',
  benefit: {
    type: 'FIXED_DISCOUNT',
    value: createMoneyGBP(15),
  },
  conditions: [
    {
      type: 'MINIMUM_SPEND',
      value: createMoneyGBP(100),
    },
  ],
  stackability: 'STACKABLE',
};

export const argosDiscountCoupon: Coupon = {
  id: 'argos-20-off',
  merchantId: 'argos-uk',
  code: 'SAVE20',
  benefit: {
    type: 'FIXED_DISCOUNT',
    value: createMoneyGBP(20),
  },
  conditions: [
    {
      type: 'MINIMUM_SPEND',
      value: createMoneyGBP(150),
    },
  ],
  stackability: 'NON_STACKABLE',
};

export const amazonUKPrimeDay: Offer = {
  id: 'amazon-uk-prime-day',
  merchantId: 'amazon-uk',
  title: 'Prime Day 20% Off',
  description: 'Exclusive Prime Day discount',
  validFrom: '2026-07-15T00:00:00Z',
  validUntil: '2026-07-16T23:59:59Z',
  conditions: [
    {
      type: 'MINIMUM_SPEND',
      value: createMoneyGBP(75),
    },
  ],
  benefit: {
    type: 'PERCENTAGE_DISCOUNT',
    value: 0.2,
    cap: createMoneyGBP(100),
  },
  paymentRequirements: [],
  stackingPolicy: {
    canStackWithCoupons: true,
    canStackWithGiftCards: false,
  },
  source: {
    type: 'OFFICIAL',
    retrievedAt: '2026-07-10T10:00:00Z',
  },
  confidence: 'HIGH',
};
