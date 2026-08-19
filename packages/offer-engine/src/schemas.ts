import { z } from 'zod';

export const CurrencySchema = z.enum(['INR', 'USD', 'EUR', 'GBP', 'JPY', 'SGD', 'AED']);

export const MoneySchema = z.object({
  amountMinor: z.union([z.number(), z.string(), z.bigint()]).transform((val) => {
    if (typeof val === 'bigint') return val;
    return BigInt(val);
  }).refine((val) => val >= 0n, {
    message: "Amount must be non-negative",
  }),
  currency: CurrencySchema,
});

export const RuleConditionSchema = z.object({
  type: z.enum([
    'MINIMUM_SPEND',
    'MCC_ELIGIBILITY',
    'MERCHANT_ELIGIBILITY',
    'COUPON_COMPATIBILITY',
    'EXPIRY',
    'STACKING_RESTRICTION',
    'OTHER',
  ]),
  value: z.any().optional(),
});

export const OfferBenefitSchema = z.object({
  type: z.enum(['PERCENTAGE_DISCOUNT', 'FIXED_DISCOUNT', 'CASHBACK', 'POINTS']),
  value: z.union([z.number(), MoneySchema]),
  cap: MoneySchema.optional(),
});

export const PaymentRequirementSchema = z.object({
  methodType: z.enum(['CREDIT_CARD', 'DEBIT_CARD', 'UPI', 'WALLET', 'BANK_ACCOUNT', 'GIFT_CARD']),
  network: z.enum(['VISA', 'MASTERCARD', 'AMEX', 'RUPAY', 'DINERS']).optional(),
  issuer: z.string().optional(),
});

export const StackingPolicySchema = z.object({
  canStackWithCoupons: z.boolean(),
  canStackWithGiftCards: z.boolean(),
});

export const OfferSourceSchema = z.object({
  type: z.enum(['OFFICIAL', 'PARTNER', 'VERIFIED', 'COMMUNITY']),
  reference: z.string().optional(),
  retrievedAt: z.string(),
});

export const OfferSchema = z.object({
  id: z.string(),
  merchantId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  validFrom: z.string(),
  validUntil: z.string(),
  conditions: z.array(RuleConditionSchema),
  benefit: OfferBenefitSchema,
  paymentRequirements: z.array(PaymentRequirementSchema).optional(),
  stackingPolicy: StackingPolicySchema,
  source: OfferSourceSchema,
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),
});

export const CouponSchema = z.object({
  id: z.string(),
  merchantId: z.string(),
  code: z.string(),
  benefit: OfferBenefitSchema,
  conditions: z.array(RuleConditionSchema),
  validUntil: z.string().optional(),
  stackability: z.enum(['STACKABLE', 'NON_STACKABLE']),
});

export const RewardRuleSchema = z.object({
  id: z.string(),
  rewardType: z.enum(['CASHBACK', 'POINTS', 'MILES', 'HOTEL_POINTS', 'VOUCHER', 'OTHER']),
  rate: z.number(),
  category: z.array(z.string()).optional(),
  merchantIds: z.array(z.string()).optional(),
  minimumSpend: MoneySchema.optional(),
  maximumReward: MoneySchema.optional(),
  period: z.enum(['MONTHLY', 'ANNUAL', 'STATEMENT']).optional(),
  conditions: z.array(RuleConditionSchema).optional(),
});

export const SpendingCapSchema = z.object({
  rewardProgramId: z.string(),
  limit: MoneySchema,
  currentSpent: MoneySchema,
});

export const MilestoneRuleSchema = z.object({
  id: z.string(),
  targetSpend: MoneySchema,
  reward: MoneySchema,
  rewardType: z.enum(['CASHBACK', 'POINTS', 'MILES', 'HOTEL_POINTS', 'VOUCHER', 'OTHER']),
  period: z.enum(['MONTHLY', 'ANNUAL']),
});

export const UserCardStateSchema = z.object({
  isAvailable: z.boolean(),
  currentStatementSpend: MoneySchema,
  annualSpendToDate: MoneySchema,
  monthlySpendToDate: MoneySchema,
});

export const CreditCardSchema = z.object({
  id: z.string(),
  issuer: z.string(),
  productName: z.string(),
  network: z.enum(['VISA', 'MASTERCARD', 'AMEX', 'RUPAY', 'DINERS']).optional(),
  rewardProgram: z.string(),
  annualFee: MoneySchema.optional(),
  rewardRules: z.array(RewardRuleSchema),
  spendingCaps: z.array(SpendingCapSchema).optional(),
  milestoneRules: z.array(MilestoneRuleSchema).optional(),
  eligibleCategories: z.array(z.string()).optional(),
  exclusions: z.array(z.string()).optional(),
  userState: UserCardStateSchema.optional(),
});

export const DatasetBundleSchema = z.object({
  schemaVersion: z.number(),
  dataVersion: z.string(),
  createdAt: z.string(),
  checksum: z.string().optional(),
  cards: z.array(CreditCardSchema),
  offers: z.array(OfferSchema),
  coupons: z.array(CouponSchema),
});

export type DatasetBundle = z.infer<typeof DatasetBundleSchema>;

export const CartItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: MoneySchema,
  quantity: z.number().int().positive(),
  category: z.string().optional(),
});

export const CartSchema = z.object({
  merchantId: z.string(),
  items: z.array(CartItemSchema),
  subtotal: MoneySchema,
  discounts: z.array(
    z.object({
      id: z.string(),
      code: z.string().optional(),
      amount: MoneySchema,
    })
  ),
  shipping: MoneySchema,
  taxes: MoneySchema,
  total: MoneySchema,
  currency: CurrencySchema,
});

