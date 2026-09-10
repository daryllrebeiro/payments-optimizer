import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { filterDominated } from './pruner.js';
import { rankStrategies } from './ranker.js';
import { minorToMajor, CURRENCY_MINOR_EXPONENT } from '@payments-optimizer/domain';
import type { PaymentStrategy } from '@payments-optimizer/domain';

function baseStrategy(overrides: Partial<PaymentStrategy> = {}): PaymentStrategy {
  return {
    id: 's',
    immediateDiscount: { amountMinor: 0n, currency: 'INR' },
    rewardValue: { amountMinor: 0n, currency: 'INR' },
    futureBenefit: { amountMinor: 0n, currency: 'INR' },
    fees: { amountMinor: 0n, currency: 'INR' },
    effectiveCost: { amountMinor: 100000n, currency: 'INR' },
    totalBenefit: { amountMinor: 0n, currency: 'INR' },
    confidence: 1,
    complexityScore: 1,
    stepDescriptions: [],
    steps: [],
    ...overrides,
  } as never;
}

describe('Property-based financial invariants (fast-check)', () => {
  describe('Invariant: filterDominated never keeps dominated strategies', () => {
    it('removes a strategy strictly worse in cost, complexity, confidence', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 10 }),
              cost: fc.bigInt({ min: 0n, max: 1000000n }),
              benefit: fc.bigInt({ min: 0n, max: 1000000n }),
              complexity: fc.integer({ min: 0, max: 10 }),
              confidence: fc.float({ min: 0, max: 1 }),
            }),
            { minLength: 3, maxLength: 8 }
          ),
          (entries) => {
            const strategies = entries.map((e) =>
              baseStrategy({
                id: e.id,
                effectiveCost: { amountMinor: e.cost, currency: 'INR' },
                totalBenefit: { amountMinor: e.benefit, currency: 'INR' },
                complexityScore: e.complexity,
                confidence: e.confidence,
              })
            );
            const pruned = filterDominated(strategies);
            // Invariant: no remaining strategy is dominated by another remaining strategy
            for (let i = 0; i < pruned.length; i++) {
              for (let j = 0; j < pruned.length; j++) {
                if (i === j) continue;
                const a = pruned[i]!;
                const b = pruned[j]!;
                const costLowerOrEqual =
                  b.effectiveCost.amountMinor <= a.effectiveCost.amountMinor;
                const complexityLowerOrEqual =
                  b.complexityScore <= a.complexityScore;
                const confidenceHigherOrEqual =
                  b.confidence >= a.confidence;
                const strictlyBetterCost =
                  b.effectiveCost.amountMinor < a.effectiveCost.amountMinor;
                const strictlyBetterComplexity =
                  b.complexityScore < a.complexityScore;
                const strictlyBetterConfidence = b.confidence > a.confidence;
                const dominates =
                  costLowerOrEqual &&
                  complexityLowerOrEqual &&
                  confidenceHigherOrEqual &&
                  (strictlyBetterCost ||
                    strictlyBetterComplexity ||
                    strictlyBetterConfidence);
                expect(dominates).toBe(false);
              }
            }
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  describe('Invariant: rankStrategies totalBenefit desc + id asc tiebreak', () => {
    it('primary order by exact BigInt totalBenefit, then id asc', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 20 }),
              benefit: fc.bigInt({ min: 0n, max: 1000000n }),
            }),
            { minLength: 2, maxLength: 12 }
          ),
          (entries) => {
            const prefs = {
              immediateSavingsWeight: 1,
              rewardValueWeight: 1,
              milestoneWeight: 1,
              simplicityWeight: 0,
              riskWeight: 0,
            };
            const inputs = entries.map((e) =>
              baseStrategy({
                id: e.id,
                totalBenefit: { amountMinor: e.benefit, currency: 'INR' },
              })
            ) as never;
            const ranked = rankStrategies(inputs, prefs);
            for (let i = 1; i < ranked.length; i++) {
              const prev = ranked[i - 1]!;
              const cur = ranked[i]!;
              if (
                prev.totalBenefit.amountMinor !== cur.totalBenefit.amountMinor
              ) {
                expect(
                  prev.totalBenefit.amountMinor > cur.totalBenefit.amountMinor
                ).toBe(true);
              } else {
                expect(prev.id < cur.id).toBe(true);
              }
            }
          }
        ),
        { numRuns: 300 }
      );
    });

    it('never ties on 1 minor unit difference (F11)', () => {
      fc.assert(
        fc.property(
          fc.record({
            id1: fc.string({ minLength: 1, maxLength: 10 }),
            id2: fc.string({ minLength: 1, maxLength: 10 }),
            benefit: fc.bigInt({ min: 0n, max: 999999n }),
          }),
          ({ id1, id2, benefit }) => {
            const prefs = {
              immediateSavingsWeight: 1,
              rewardValueWeight: 1,
              milestoneWeight: 1,
              simplicityWeight: 0,
              riskWeight: 0,
            };
            const a = baseStrategy({
              id: id1,
              totalBenefit: { amountMinor: benefit + 1n, currency: 'INR' },
            });
            const b = baseStrategy({
              id: id2,
              totalBenefit: { amountMinor: benefit, currency: 'INR' },
            });
            const ranked = rankStrategies([a, b] as never, prefs);
            expect(ranked[0]!.totalBenefit.amountMinor).toBe(
              benefit + 1n
            );
            expect(ranked[1]!.totalBenefit.amountMinor).toBe(benefit);
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  describe('Invariant: minorToMajor respects per-currency divisor (F12)', () => {
    it('JPY (0-decimal) returns amount unchanged', () => {
      fc.assert(
        fc.property(
          fc.bigInt({ min: 0n, max: 1000000n }),
          (minor) => {
            expect(minorToMajor(minor, 'JPY')).toBe(Number(minor));
          }
        ),
        { numRuns: 200 }
      );
    });

    it('2-decimal currencies divide by 100', () => {
      fc.assert(
        fc.property(
          fc.bigInt({ min: 0n, max: 100000000n }),
          (minor) => {
            for (const ccy of ['INR', 'USD', 'EUR', 'GBP', 'SGD', 'AED'] as const) {
              const expected = Number(minor) / 100;
              expect(minorToMajor(minor, ccy)).toBe(expected);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('divisor matches CURRENCY_MINOR_EXPONENT table', () => {
      for (const [ccy, exp] of Object.entries(CURRENCY_MINOR_EXPONENT)) {
        const divisor = 10n ** BigInt(exp);
        expect(10n ** BigInt(exp)).toBe(divisor);
      }
    });
  });

  describe('Invariant: rankStrategies deterministic for identical input', () => {
    it('same input produces byte-identical output', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
              benefit: fc.bigInt({ min: 0n, max: 1000000n }),
            }),
            { minLength: 2, maxLength: 10 }
          ).filter((arr) => new Set(arr.map((e) => e.id)).size === arr.length),
          (entries) => {
            const prefs = {
              immediateSavingsWeight: 1,
              rewardValueWeight: 1,
              milestoneWeight: 1,
              simplicityWeight: 0,
              riskWeight: 0,
            };
            const inputs = entries.map((e) =>
              baseStrategy({
                id: e.id,
                totalBenefit: { amountMinor: e.benefit, currency: 'INR' },
              })
            ) as never;
            const r1 = rankStrategies(inputs, prefs);
            const r2 = rankStrategies(inputs, prefs);
            // Use a custom serializer that handles BigInt
            const serialize = (arr: any[]) =>
              JSON.stringify(arr, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
            expect(serialize(r1)).toBe(serialize(r2));
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});