import type { CreditCard, Offer, Coupon, RewardRule } from '@payments-optimizer/domain';

/**
 * F8: extension-local card catalog.
 *
 * Root cause being fixed: the popup's user-facing catalog templates and the
 * Dashboard's demo offers were imported from `@payments-optimizer/test-fixtures`
 * — a *test* package in the production dependency graph. Card definitions
 * users add to their profile are product data and live here, with the
 * test-fixtures package remaining test-only (devDependency).
 *
 * Values mirror the current catalog content; they are now owned by the
 * extension and can evolve with the product without touching test data.
 */

const hdfcMillenniaRules: RewardRule[] = [
  {
    id: 'hdfc-millennia-amazon',
    rewardType: 'POINTS',
    rate: 0.05, // 5% reward on Amazon
    merchantIds: ['amazon'],
    maximumReward: { amountMinor: 100000n, currency: 'INR' }, // ₹1,000 cap
    period: 'MONTHLY',
  },
  {
    id: 'hdfc-millennia-other',
    rewardType: 'POINTS',
    rate: 0.01, // 1% reward elsewhere
    maximumReward: { amountMinor: 100000n, currency: 'INR' }, // ₹1,000 cap
    period: 'MONTHLY',
  },
];

const sbiCashbackRules: RewardRule[] = [
  {
    id: 'sbi-cashback-online',
    rewardType: 'CASHBACK',
    rate: 0.05, // 5% cashback online
    maximumReward: { amountMinor: 500000n, currency: 'INR' }, // ₹5,000 cap
    period: 'MONTHLY',
  },
];

const axisAtlasRules: RewardRule[] = [
  {
    id: 'axis-atlas-default',
    rewardType: 'MILES',
    rate: 0.02, // 2% reward value (2 miles per ₹100, 1 mile = ₹1 value)
    period: 'MONTHLY',
  },
];

export const hdfcMillenniaCard: CreditCard = {
  id: 'hdfc-millennia',
  issuer: 'HDFC',
  productName: 'Millennia',
  network: 'MASTERCARD',
  rewardProgram: 'HDFC Millennia Points',
  annualFee: { amountMinor: 100000n, currency: 'INR' }, // ₹1,000
  rewardRules: hdfcMillenniaRules,
  userState: {
    isAvailable: true,
    currentStatementSpend: { amountMinor: 0n, currency: 'INR' },
    annualSpendToDate: { amountMinor: 0n, currency: 'INR' },
    monthlySpendToDate: { amountMinor: 0n, currency: 'INR' },
  },
};

export const sbiCashbackCard: CreditCard = {
  id: 'sbi-cashback',
  issuer: 'SBI',
  productName: 'Cashback Card',
  network: 'VISA',
  rewardProgram: 'SBI Cashback Program',
  annualFee: { amountMinor: 99900n, currency: 'INR' }, // ₹999
  rewardRules: sbiCashbackRules,
  userState: {
    isAvailable: true,
    currentStatementSpend: { amountMinor: 0n, currency: 'INR' },
    annualSpendToDate: { amountMinor: 0n, currency: 'INR' },
    monthlySpendToDate: { amountMinor: 0n, currency: 'INR' },
  },
};

export const axisAtlasCard: CreditCard = {
  id: 'axis-atlas',
  issuer: 'AXIS',
  productName: 'Atlas',
  network: 'VISA',
  rewardProgram: 'Axis Edge Miles',
  annualFee: { amountMinor: 500000n, currency: 'INR' }, // ₹5,000
  rewardRules: axisAtlasRules,
  milestoneRules: [
    {
      id: 'axis-atlas-milestone-4l',
      targetSpend: { amountMinor: 40000000n, currency: 'INR' }, // ₹4,00,000
      reward: { amountMinor: 500000n, currency: 'INR' }, // ₹5,000 value
      rewardType: 'MILES',
      period: 'ANNUAL',
    },
  ],
  userState: {
    isAvailable: true,
    currentStatementSpend: { amountMinor: 0n, currency: 'INR' },
    annualSpendToDate: { amountMinor: 0n, currency: 'INR' },
    monthlySpendToDate: { amountMinor: 0n, currency: 'INR' },
  },
};

/**
 * Demo offer/coupon used by the Dashboard's "simulate optimization"
 * preview. The service worker uses the real validated offers-bundle; this
 * is presentation-layer sample data only.
 */
export const demoInstantDiscountOffer: Offer = {
  id: 'offer-hdfc-instant',
  merchantId: 'amazon',
  title: 'HDFC Instant Discount',
  description: '10% instant discount up to ₹1,500 with HDFC Cards',
  validFrom: '2026-08-01T00:00:00Z',
  validUntil: '2031-08-31T23:59:59Z',
  conditions: [
    {
      type: 'MINIMUM_SPEND',
      value: { amountMinor: 500000n, currency: 'INR' }, // Min spend ₹5,000
    },
  ],
  benefit: {
    type: 'PERCENTAGE_DISCOUNT',
    value: 0.1, // 10%
    cap: { amountMinor: 150000n, currency: 'INR' }, // Up to ₹1,500
  },
  paymentRequirements: [
    {
      methodType: 'CREDIT_CARD',
      issuer: 'HDFC',
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

export const demoCoupon: Coupon = {
  id: 'coupon-amz-1000',
  merchantId: 'amazon',
  code: 'SAVE1000',
  benefit: {
    type: 'FIXED_DISCOUNT',
    value: { amountMinor: 100000n, currency: 'INR' }, // ₹1,000 off
  },
  conditions: [
    {
      type: 'MINIMUM_SPEND',
      value: { amountMinor: 1500000n, currency: 'INR' }, // Min spend ₹15,000
    },
  ],
  stackability: 'STACKABLE',
};
