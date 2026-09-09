/**
 * Task 0.4 / 0.5 / 0.6 / 0.7 / 0.8 — conformance regression tests for the
 * audit's "Checked and Found Sound" list (validation, combinatorics,
 * determinism, money precision).
 *
 * Uses relative imports because this suite runs from the repo root, outside
 * any package's dependency graph.
 */
import { describe, it, expect } from 'vitest';
import { CartSchema, CartItemSchema, MoneySchema } from '../../packages/offer-engine/src/schemas.js';
import { BenefitStackingEngine } from '../../packages/benefits/src/stacking/stacking-engine.js';
import { generateCandidates } from '../../packages/optimizer/src/generator.js';
import { filterDominated } from '../../packages/optimizer/src/pruner.js';
import { rankStrategies } from '../../packages/optimizer/src/ranker.js';
import {
  amazonCart,
  hdfcMillenniaCard,
  sbiCashbackCard,
  axisAtlasCard,
  hdfcInstantDiscountOffer,
  amazonCoupon,
} from '../../packages/test-fixtures/src/index.js';
import {
  serializeStrategy,
  deserializeStrategy,
} from '../../apps/extension/src/types/messages.js';
import type {
  Cart,
  UserProfile,
  UserVoucher,
  PartnerBenefit,
  PaymentStrategy,
} from '@payments-optimizer/domain';

const bigintReplacer = (_key: string, value: unknown) =>
  typeof value === 'bigint' ? value.toString() : value;

describe('Task 0.4 — MoneySchema rejects negative amounts', () => {
  it('rejects a negative minor amount', () => {
    const result = MoneySchema.safeParse({ amountMinor: -100, currency: 'INR' });
    expect(result.success).toBe(false);
  });

  it('rejects a negative amount smuggled as a string', () => {
    const result = MoneySchema.safeParse({ amountMinor: '-100', currency: 'INR' });
    expect(result.success).toBe(false);
  });

  it('accepts a valid non-negative amount', () => {
    const result = MoneySchema.safeParse({ amountMinor: 100, currency: 'INR' });
    expect(result.success).toBe(true);
  });

  it('zero-cart path: zero total accepted and handled without crash', () => {
    const zero = MoneySchema.safeParse({ amountMinor: 0, currency: 'INR' });
    expect(zero.success).toBe(true);
  });
});

describe('Task 0.5 — cart quantity constraints', () => {
  const baseItem = {
    id: 'i1',
    name: 'Widget',
    price: { amountMinor: 100n, currency: 'INR' },
  };

  it('rejects zero quantity', () => {
    expect(CartItemSchema.safeParse({ ...baseItem, quantity: 0 }).success).toBe(false);
  });

  it('rejects negative quantity', () => {
    expect(CartItemSchema.safeParse({ ...baseItem, quantity: -2 }).success).toBe(false);
  });

  it('rejects non-integer quantity', () => {
    expect(CartItemSchema.safeParse({ ...baseItem, quantity: 1.5 }).success).toBe(false);
  });

  it('accepts a positive integer quantity', () => {
    expect(CartItemSchema.safeParse({ ...baseItem, quantity: 3 }).success).toBe(true);
  });
});

describe('Task 0.6 — beam search stays bounded at 100,000 vouchers', () => {
  it('completes within the performance envelope', () => {
    const vouchers: UserVoucher[] = Array.from({ length: 100_000 }, (_, i) => ({
      id: `v-${i}`,
      merchantId: 'amazon',
      title: `Voucher ${i}`,
      code: `CODE${i}`,
      initialValue: { amountMinor: 500n, currency: 'INR' },
      remainingValue: { amountMinor: 500n, currency: 'INR' },
      expiryDate: '2099-12-31T00:00:00.000Z',
      singleUse: true,
    }));

    const engine = new BenefitStackingEngine(vouchers, 5);
    const profile: UserProfile = {
      version: 1,
      currency: 'INR',
      paymentMethods: [{ type: 'CREDIT_CARD', card: hdfcMillenniaCard }],
      rewardPreferences: { defaultValuations: {} },
      optimizationPreferences: {
        immediateSavingsWeight: 1.0,
        rewardValueWeight: 1.0,
        milestoneWeight: 0.8,
        simplicityWeight: 0.2,
        riskWeight: 0.1,
      },
    };
    const partnerBenefits: PartnerBenefit[] = [];

    const start = Date.now();
    const results = engine.generateStackingCombinations(amazonCart, profile, partnerBenefits);
    const elapsed = Date.now() - start;

    // Base option (1) + up to beamWidth voucher combos (5) + no partner
    // benefits here — the result count must be a small constant, not a
    // function of the 100,000 input vouchers.
    expect(results.length).toBeLessThanOrEqual(6);
    // Pre-F24 this input never completed (blocked the event loop past
    // 180s with unbounded memory growth). 15s tolerates CI worker
    // contention while still failing decisively on any regression back to
    // superlinear behavior.
    expect(elapsed).toBeLessThan(15_000);
  });
});

describe('Task 0.7 — identical input produces byte-identical strategy order', () => {
  const profile: UserProfile = {
    version: 1,
    currency: 'INR',
    paymentMethods: [
      { type: 'CREDIT_CARD', card: hdfcMillenniaCard },
      { type: 'CREDIT_CARD', card: sbiCashbackCard },
      { type: 'CREDIT_CARD', card: axisAtlasCard },
    ],
    rewardPreferences: {
      defaultValuations: {
        'HDFC Millennia Points': { amountMinor: 100n, currency: 'INR' },
        'SBI Cashback Program': { amountMinor: 100n, currency: 'INR' },
        'Axis Edge Miles': { amountMinor: 100n, currency: 'INR' },
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

  const runOnce = (): string => {
    const candidates = generateCandidates(amazonCart, profile, [hdfcInstantDiscountOffer], [
      amazonCoupon,
    ]);
    const ranked = rankStrategies(filterDominated(candidates), profile.optimizationPreferences);
    return JSON.stringify(ranked, bigintReplacer);
  };

  it('produces identical JSON for two consecutive runs', () => {
    const first = runOnce();
    const second = runOnce();
    expect(second).toEqual(first);
  });
});

describe('Task 0.8 — money round-trips through storage without precision loss', () => {
  it('decimal-string persistence preserves exact minor amounts', () => {
    const strategy = {
      id: 's1',
      steps: [],
      immediateDiscount: { amountMinor: 1234567890123456789n, currency: 'INR' },
      rewardValue: { amountMinor: 1n, currency: 'INR' },
      futureBenefit: { amountMinor: 999999999999999999n, currency: 'INR' },
      fees: { amountMinor: 0n, currency: 'INR' },
      effectiveCost: { amountMinor: 42n, currency: 'INR' },
      totalBenefit: { amountMinor: 1234567890123456790n, currency: 'INR' },
      confidence: 0.9,
      complexityScore: 2,
    } as unknown as PaymentStrategy;

    const serialized = serializeStrategy(strategy);
    // Storage is a JSON string of the serialized form (what IndexedDB /
    // chrome.storage actually persist)
    const stored = JSON.stringify(serialized);
    const loaded = deserializeStrategy(JSON.parse(stored) as typeof serialized, 'INR');

    expect(loaded.immediateDiscount.amountMinor).toBe(1234567890123456789n);
    expect(loaded.rewardValue.amountMinor).toBe(1n);
    expect(loaded.futureBenefit.amountMinor).toBe(999999999999999999n);
    expect(loaded.totalBenefit.amountMinor).toBe(1234567890123456790n);
    expect(loaded.effectiveCost.amountMinor).toBe(42n);
  });
});
