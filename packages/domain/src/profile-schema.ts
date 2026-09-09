import { z } from 'zod';
import type {
  Currency,
  Money,
  UserProfile,
} from './index.js';

/**
 * F7/F18 (audit remediation): runtime validation for UserProfile.
 *
 * Root cause being fixed: profiles crossed trust boundaries (chrome.storage
 * read, import files) via blind `as UserProfile` casts with zero runtime
 * checking. This module is the single shared validator â€” every read and
 * write of a profile goes through it, and the import path reuses it.
 *
 * Storage-shape note: chrome.storage cannot structured-clone BigInt, so
 * persisted profiles carry Money.amountMinor as string (or number). This
 * schema accepts bigint | number | string and normalizes to bigint.
 */

// F6 alignment: money magnitudes are bounded so a corrupted or hostile
// profile cannot push arithmetic into pathological operand sizes.
const MAX_AMOUNT_MINOR = 10n ** 15n; // 1e15 minor units â€” far beyond any real balance
const AMOUNT_MINOR_PATTERN = /^-?\d{1,17}$/;

const CurrencySchema = z.enum(['INR', 'USD', 'EUR', 'GBP', 'JPY', 'SGD', 'AED']);

const MoneySchema = z
  .object({
    amountMinor: z.union([z.bigint(), z.number(), z.string()]),
    currency: CurrencySchema,
  })
  .superRefine((money, ctx) => {
    let amountMinor: bigint;
    if (typeof money.amountMinor === 'bigint') {
      amountMinor = money.amountMinor;
    } else if (typeof money.amountMinor === 'number') {
      if (!Number.isSafeInteger(money.amountMinor)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `amountMinor must be an integer, got ${money.amountMinor}`,
          path: ['amountMinor'],
        });
        return;
      }
      amountMinor = BigInt(money.amountMinor);
    } else {
      if (!AMOUNT_MINOR_PATTERN.test(money.amountMinor)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `amountMinor must be a plain integer string (max 17 digits), got "${money.amountMinor}"`,
          path: ['amountMinor'],
        });
        return;
      }
      amountMinor = BigInt(money.amountMinor);
    }
    if (amountMinor < 0n) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `amountMinor must be non-negative, got ${amountMinor}`,
        path: ['amountMinor'],
      });
      return;
    }
    if (amountMinor > MAX_AMOUNT_MINOR) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `amountMinor exceeds the maximum supported magnitude (${MAX_AMOUNT_MINOR})`,
        path: ['amountMinor'],
      });
    }
  })
  .transform((money): Money => {
    // superRefine above has already accepted the input, so this conversion
    // is safe by construction â€” no throwing path remains.
    const amountMinor =
      typeof money.amountMinor === 'bigint'
        ? money.amountMinor
        : BigInt(money.amountMinor);
    return { amountMinor, currency: money.currency };
  });

const IdSchema = z.string().min(1).max(200);

const RuleConditionSchema = z.lazy(() =>
  z.object({
    type: z.enum([
      'MINIMUM_SPEND',
      'MCC_ELIGIBILITY',
      'MERCHANT_ELIGIBILITY',
      'COUPON_COMPATIBILITY',
      'EXPIRY',
      'STACKING_RESTRICTION',
      'OTHER',
    ]),
    value: z
      .union([z.string().max(500), MoneySchema, z.number().finite(), z.boolean(), z.array(z.string().max(500)).max(100)])
      .optional(),
  })
);

const RewardRuleSchema = z.lazy(() =>
  z.object({
    id: IdSchema,
    rewardType: z.enum(['CASHBACK', 'POINTS', 'MILES', 'HOTEL_POINTS', 'VOUCHER', 'OTHER']),
    rate: z.number().finite().nonnegative().max(1000),
    category: z.array(z.string().max(200)).max(100).optional(),
    merchantIds: z.array(z.string().max(200)).max(1000).optional(),
    minimumSpend: MoneySchema.optional(),
    maximumReward: MoneySchema.optional(),
    period: z.enum(['MONTHLY', 'ANNUAL', 'STATEMENT']).optional(),
    conditions: z.array(RuleConditionSchema).max(50).optional(),
  })
);

const SpendingCapSchema = z.lazy(() =>
  z.object({
    period: z.enum(['MONTHLY', 'ANNUAL', 'STATEMENT']),
    rewardProgramId: IdSchema,
    limit: MoneySchema,
    currentSpent: MoneySchema,
  })
);

const MilestoneRuleSchema = z.lazy(() =>
  z.object({
    id: IdSchema,
    targetSpend: MoneySchema,
    reward: MoneySchema,
    rewardType: z.enum(['CASHBACK', 'POINTS', 'MILES', 'HOTEL_POINTS', 'VOUCHER', 'OTHER']),
    period: z.enum(['MONTHLY', 'ANNUAL']),
  })
);

const UserCardStateSchema = z.lazy(() =>
  z.object({
    isAvailable: z.boolean(),
    currentStatementSpend: MoneySchema,
    annualSpendToDate: MoneySchema,
    monthlySpendToDate: MoneySchema,
  })
);

const CardBaseFields = {
  id: IdSchema,
  issuer: z.string().min(1).max(200),
  productName: z.string().min(1).max(200),
  network: z.enum(['VISA', 'MASTERCARD', 'AMEX', 'RUPAY', 'DINERS']).optional(),
  rewardProgram: z.string().min(1).max(200),
  annualFee: MoneySchema.optional(),
  rewardRules: z.array(RewardRuleSchema).max(200),
  spendingCaps: z.array(SpendingCapSchema).max(50).optional(),
  milestoneRules: z.array(MilestoneRuleSchema).max(50).optional(),
  eligibleCategories: z.array(z.string().max(200)).max(200).optional(),
  exclusions: z.array(z.string().max(500)).max(200).optional(),
  userState: UserCardStateSchema.optional(),
};

const CreditCardSchema = z.lazy(() => z.object(CardBaseFields).strict());

const DebitCardSchema = z.lazy(() =>
  z.object({ ...CardBaseFields, milestoneRules: z.undefined().optional() }).strict()
);

const WalletSchema = z.lazy(() =>
  z.object({
    name: z.string().min(1).max(200),
    balance: MoneySchema.optional(),
  })
);

const UpiAccountSchema = z.lazy(() =>
  z.object({
    upiId: z.string().max(200).optional(),
    bankName: z.string().max(200).optional(),
  })
);

const BankAccountSchema = z.lazy(() =>
  z.object({
    bankName: z.string().min(1).max(200),
    accountNumberTail: z.string().max(12).optional(),
  })
);

const GiftCardSchema = z.lazy(() =>
  z.object({
    id: IdSchema,
    merchantId: IdSchema,
    faceValue: MoneySchema,
    cost: MoneySchema,
    balance: MoneySchema,
    expiry: z.string().max(40).optional(),
  })
);

const PaymentMethodSchema = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('CREDIT_CARD'), card: CreditCardSchema }),
    z.object({ type: z.literal('DEBIT_CARD'), card: DebitCardSchema }),
    z.object({ type: z.literal('WALLET'), wallet: WalletSchema }),
    z.object({ type: z.literal('UPI'), upi: UpiAccountSchema }),
    z.object({ type: z.literal('BANK_ACCOUNT'), bank: BankAccountSchema }),
    z.object({ type: z.literal('GIFT_CARD'), giftCard: GiftCardSchema }),
  ])
);

const UserMembershipSchema = z.lazy(() =>
  z.object({
    id: IdSchema,
    programId: IdSchema,
    programName: z.string().min(1).max(200),
    tier: z.string().max(100).optional(),
    membershipNumber: z.string().max(100).optional(),
    validUntil: z.string().max(40).optional(),
    autoRenew: z.boolean().optional(),
  })
);

const UserVoucherSchema = z.lazy(() =>
  z.object({
    id: IdSchema,
    merchantId: IdSchema,
    title: z.string().min(1).max(300),
    code: z.string().max(200).optional(),
    initialValue: MoneySchema,
    remainingValue: MoneySchema,
    minimumSpend: MoneySchema.optional(),
    expiryDate: z.string().min(1).max(40),
    singleUse: z.boolean(),
    terms: z.string().max(2000).optional(),
  })
);

const RewardPreferencesSchema = z.lazy(() =>
  z.object({
    defaultValuations: z.record(z.string().max(200), MoneySchema),
    preferredType: z
      .enum(['CASHBACK', 'POINTS', 'MILES', 'HOTEL_POINTS', 'VOUCHER', 'OTHER'])
      .optional(),
  })
);

const OptimizationPreferencesSchema = z.lazy(() =>
  z.object({
    immediateSavingsWeight: z.number().finite().min(0).max(100),
    rewardValueWeight: z.number().finite().min(0).max(100),
    milestoneWeight: z.number().finite().min(0).max(100),
    simplicityWeight: z.number().finite().min(0).max(100),
    riskWeight: z.number().finite().min(0).max(100),
    urgencyWeight: z.number().finite().min(0).max(100).optional(),
  })
);

export const UserProfileSchema = z.object({
  version: z.number().int().min(1).max(100),
  currency: CurrencySchema,
  paymentMethods: z.array(PaymentMethodSchema).max(100),
  memberships: z.array(UserMembershipSchema).max(100).optional(),
  vouchers: z.array(UserVoucherSchema).max(1000).optional(),
  rewardPreferences: RewardPreferencesSchema,
  optimizationPreferences: OptimizationPreferencesSchema,
});

export type ProfileParseResult =
  | { ok: true; profile: UserProfile }
  | { ok: false; errors: string[] };

/**
 * Parses and validates an untrusted serialized profile (e.g. from
 * chrome.storage or an import file). Never throws — always returns a
 * structured result so callers can fail closed.
 */
export function parseUserProfile(raw: unknown): ProfileParseResult {
  const outcome = UserProfileSchema.safeParse(raw);
  if (outcome.success) {
    // The inferred schema output differs from UserProfile only in
    // optional-property variance under exactOptionalPropertyTypes; the
    // shapes are structurally identical, and this is the single
    // boundary where the validated output is handed to typed consumers.
    return { ok: true, profile: outcome.data as unknown as UserProfile };
  }
  const errors = outcome.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
    return `${path}: ${issue.message}`;
  });
  return { ok: false, errors };
}

/**
 * Converts a validated profile into a structured-clone-safe shape for
 * chrome.storage (BigInt amountMinor -> decimal string).
 */
export function serializeProfileForStorage(profile: UserProfile): unknown {
  return JSON.parse(
    JSON.stringify(profile, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
  );
}

/**
 * Referential-integrity checks that field-level schemas cannot express:
 * duplicate payment-method/voucher ids and vouchers whose remaining value
 * exceeds their initial value (a corrupted burn history). Returns a list of
 * violations; empty means the profile is internally consistent.
 */
export function validateProfileIntegrity(profile: UserProfile): string[] {
  const violations: string[] = [];

  const cardIds = new Set<string>();
  for (const method of profile.paymentMethods) {
    const entityId =
      method.type === 'CREDIT_CARD' || method.type === 'DEBIT_CARD'
        ? method.card.id
        : method.type === 'GIFT_CARD'
          ? method.giftCard.id
          : null;
    if (entityId) {
      if (cardIds.has(entityId)) {
        violations.push(`Duplicate payment method id: ${entityId}`);
      }
      cardIds.add(entityId);
    }
  }

  const voucherIds = new Set<string>();
  for (const voucher of profile.vouchers ?? []) {
    if (voucherIds.has(voucher.id)) {
      violations.push(`Duplicate voucher id: ${voucher.id}`);
    }
    voucherIds.add(voucher.id);
    if (voucher.remainingValue.amountMinor > voucher.initialValue.amountMinor) {
      violations.push(
        `Voucher ${voucher.id}: remaining value ${voucher.remainingValue.amountMinor} exceeds initial value ${voucher.initialValue.amountMinor}`
      );
    }
  }

  return violations;
}
