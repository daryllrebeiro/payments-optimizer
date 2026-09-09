/**
 * Fix F7 regression tests — runtime profile validation on every read.
 *
 * Encodes the audit's exploit scenarios: corrupted profiles that previously
 * flowed straight into the optimizer via `as UserProfile` casts must now be
 * rejected at read time with a structured error, and the optimizer must
 * never be invoked against them.
 */
import { describe, it, expect } from 'vitest';
import {
  parseUserProfile,
  validateProfileIntegrity,
} from '../../packages/domain/src/profile-schema.js';
import {
  hdfcMillenniaCard,
  sbiCashbackCard,
} from '../../packages/test-fixtures/src/index.js';
import type { UserProfile } from '../../packages/domain/src/index.js';

const validProfile: UserProfile = {
  version: 1,
  currency: 'INR',
  paymentMethods: [
    { type: 'CREDIT_CARD', card: hdfcMillenniaCard },
    { type: 'CREDIT_CARD', card: sbiCashbackCard },
  ],
  rewardPreferences: {
    defaultValuations: {
      'HDFC Millennia Points': { amountMinor: 100n, currency: 'INR' },
      'SBI Cashback Program': { amountMinor: 100n, currency: 'INR' },
    },
  },
  optimizationPreferences: {
    immediateSavingsWeight: 1.0,
    rewardValueWeight: 1.0,
    milestoneWeight: 0.8,
    simplicityWeight: 0.2,
    riskWeight: 0.1,
  },
};

describe('parseUserProfile — accept the sound case', () => {
  it('accepts a valid profile (bigint money)', () => {
    const result = parseUserProfile(validProfile);
    expect(result.ok).toBe(true);
  });

  it('accepts the storage shape (amountMinor as string) and normalizes to bigint', () => {
    const storageShape = JSON.parse(
      JSON.stringify(validProfile, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))
    );
    const result = parseUserProfile(storageShape);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const valuation = result.profile.rewardPreferences.defaultValuations[
        'HDFC Millennia Points'
      ]!;
      expect(typeof valuation.amountMinor).toBe('bigint');
      expect(valuation.amountMinor).toBe(100n);
    }
  });
});

describe('parseUserProfile — reject the audit\'s corruption cases', () => {
  it('rejects a payment method missing its card object (exploit: optimizer crash)', () => {
    const corrupted = { ...validProfile, paymentMethods: [{ type: 'CREDIT_CARD' }] };
    const result = parseUserProfile(corrupted);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('card'))).toBe(true);
    }
  });

  it('rejects a non-numeric amountMinor string on a valuation (exploit: wrong-but-plausible math)', () => {
    const corrupted = JSON.parse(
      JSON.stringify(validProfile, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))
    );
    corrupted.rewardPreferences.defaultValuations['HDFC Millennia Points'].amountMinor =
      '12.34.56';
    const result = parseUserProfile(corrupted);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) => e.includes('plain integer string') || e.includes('amountMinor'))
      ).toBe(true);
    }
  });

  it('rejects a negative remainingValue on a voucher (exploit: negative money arithmetic)', () => {
    const corrupted: UserProfile = {
      ...validProfile,
      vouchers: [
        {
          id: 'v1',
          merchantId: 'amazon',
          title: 'Test voucher',
          initialValue: { amountMinor: 1000n, currency: 'INR' },
          remainingValue: { amountMinor: -50n, currency: 'INR' },
          expiryDate: '2099-01-01T00:00:00.000Z',
          singleUse: true,
        },
      ],
    };
    const result = parseUserProfile(corrupted);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('non-negative'))).toBe(true);
    }
  });

  it('rejects money above the magnitude cap (F6 alignment)', () => {
    const corrupted: UserProfile = {
      ...validProfile,
      vouchers: [
        {
          id: 'v1',
          merchantId: 'amazon',
          title: 'Test voucher',
          initialValue: { amountMinor: 10n ** 20n, currency: 'INR' },
          remainingValue: { amountMinor: 10n ** 20n, currency: 'INR' },
          expiryDate: '2099-01-01T00:00:00.000Z',
          singleUse: true,
        },
      ],
    };
    const result = parseUserProfile(corrupted);
    expect(result.ok).toBe(false);
  });

  it('rejects an unknown payment method type instead of passing it through', () => {
    const corrupted = {
      ...validProfile,
      paymentMethods: [{ type: 'CRYPTO_WALLET', wallet: { name: 'x' } }],
    };
    const result = parseUserProfile(corrupted);
    expect(result.ok).toBe(false);
  });

  it('never throws on arbitrary garbage input', () => {
    for (const garbage of [null, undefined, 42, 'profile', [], { version: 'one' }]) {
      expect(() => parseUserProfile(garbage)).not.toThrow();
      expect(parseUserProfile(garbage).ok).toBe(false);
    }
  });
});

describe('validateProfileIntegrity — referential checks', () => {
  it('flags a voucher whose remaining value exceeds its initial value', () => {
    const corrupted: UserProfile = {
      ...validProfile,
      vouchers: [
        {
          id: 'v1',
          merchantId: 'amazon',
          title: 'Inflated voucher',
          initialValue: { amountMinor: 100n, currency: 'INR' },
          remainingValue: { amountMinor: 500n, currency: 'INR' },
          expiryDate: '2099-01-01T00:00:00.000Z',
          singleUse: true,
        },
      ],
    };
    const violations = validateProfileIntegrity(corrupted);
    expect(violations.some((v) => v.includes('exceeds initial value'))).toBe(true);
  });

  it('flags duplicate card ids', () => {
    const corrupted: UserProfile = {
      ...validProfile,
      paymentMethods: [
        { type: 'CREDIT_CARD', card: hdfcMillenniaCard },
        { type: 'CREDIT_CARD', card: { ...hdfcMillenniaCard } },
      ],
    };
    const violations = validateProfileIntegrity(corrupted);
    expect(violations.some((v) => v.includes('Duplicate payment method id'))).toBe(true);
  });

  it('returns no violations for a consistent profile', () => {
    expect(validateProfileIntegrity(validProfile)).toEqual([]);
  });
});
