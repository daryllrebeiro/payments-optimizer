import { Cart, CreditCard, Offer, Coupon, RewardRule } from '@payments-optimizer/domain';

// Carts
export const amazonCart: Cart = {
  merchantId: 'amazon',
  items: [
    {
      id: 'item-1',
      name: 'Smartphone',
      price: { amountMinor: 2300000n, currency: 'INR' }, // ₹23,000
      quantity: 1,
      category: 'ELECTRONICS',
    },
    {
      id: 'item-2',
      name: 'Programming Book',
      price: { amountMinor: 200000n, currency: 'INR' }, // ₹2,000
      quantity: 1,
      category: 'BOOKS',
    },
  ],
  subtotal: { amountMinor: 2500000n, currency: 'INR' }, // ₹25,000
  discounts: [],
  shipping: { amountMinor: 0n, currency: 'INR' },
  taxes: { amountMinor: 0n, currency: 'INR' },
  total: { amountMinor: 2500000n, currency: 'INR' }, // ₹25,000
  currency: 'INR',
};

export const flipkartCart: Cart = {
  merchantId: 'flipkart',
  items: [
    {
      id: 'item-3',
      name: 'Running Shoes',
      price: { amountMinor: 1000000n, currency: 'INR' }, // ₹10,000
      quantity: 1,
      category: 'APPAREL',
    },
  ],
  subtotal: { amountMinor: 1000000n, currency: 'INR' }, // ₹10,000
  discounts: [],
  shipping: { amountMinor: 0n, currency: 'INR' },
  taxes: { amountMinor: 0n, currency: 'INR' },
  total: { amountMinor: 1000000n, currency: 'INR' }, // ₹10,000
  currency: 'INR',
};

// Card Reward Rules
export const hdfcMillenniaRules: RewardRule[] = [
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

export const sbiCashbackRules: RewardRule[] = [
  {
    id: 'sbi-cashback-online',
    rewardType: 'CASHBACK',
    rate: 0.05, // 5% cashback online
    maximumReward: { amountMinor: 500000n, currency: 'INR' }, // ₹5,000 cap
    period: 'MONTHLY',
  },
];

export const axisAtlasRules: RewardRule[] = [
  {
    id: 'axis-atlas-default',
    rewardType: 'MILES',
    rate: 0.02, // 2% reward value (2 miles per ₹100, where 1 mile = ₹1 value)
    period: 'MONTHLY',
  },
];

// Cards
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
    annualSpendToDate: { amountMinor: 5000000n, currency: 'INR' },
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
    annualSpendToDate: { amountMinor: 2000000n, currency: 'INR' },
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
    annualSpendToDate: { amountMinor: 37200000n, currency: 'INR' }, // ₹3,72,000 spent
    monthlySpendToDate: { amountMinor: 0n, currency: 'INR' },
  },
};

// Coupons & Offers
export const amazonCoupon: Coupon = {
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

export const hdfcInstantDiscountOffer: Offer = {
  id: 'offer-hdfc-instant',
  merchantId: 'amazon',
  title: 'HDFC Instant Discount',
  description: '10% instant discount up to ₹1,500 with HDFC Cards',
  validFrom: '2026-08-01T00:00:00Z',
  validUntil: '2026-08-31T23:59:59Z',
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
