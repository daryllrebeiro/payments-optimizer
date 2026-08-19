import { describe, it, expect } from 'vitest';
import { generateCandidates } from './generator.js';
import { filterDominated } from './pruner.js';
import { rankStrategies, generateTrace } from './ranker.js';
import {
  amazonCart,
  hdfcMillenniaCard,
  sbiCashbackCard,
  axisAtlasCard,
  amazonCoupon,
  hdfcInstantDiscountOffer,
} from '@payments-optimizer/test-fixtures';
import { UserProfile } from '@payments-optimizer/domain';

describe('Optimizer Tests', () => {
  it('should run combinatorial candidate generation', () => {
    const profile: UserProfile = {
      version: 1,
      currency: 'INR',
      paymentMethods: [
        { type: 'CREDIT_CARD', card: hdfcMillenniaCard },
        { type: 'CREDIT_CARD', card: sbiCashbackCard },
      ],
      rewardPreferences: {
        defaultValuations: {},
      },
      optimizationPreferences: {
        immediateSavingsWeight: 1.0,
        rewardValueWeight: 0.0,
        milestoneWeight: 0.0,
        simplicityWeight: 0.0,
        riskWeight: 0.0,
      },
    };

    const candidates = generateCandidates(
      amazonCart,
      profile,
      [hdfcInstantDiscountOffer],
      [amazonCoupon]
    );

    expect(candidates.length).toBeGreaterThan(0);
  });

  it('should prune dominated strategies correctly', () => {
    const mockStrategies = [
      {
        id: 'A',
        steps: [],
        immediateDiscount: { amountMinor: 500000n, currency: 'INR' as const },
        rewardValue: { amountMinor: 0n, currency: 'INR' as const },
        futureBenefit: { amountMinor: 0n, currency: 'INR' as const },
        fees: { amountMinor: 0n, currency: 'INR' as const },
        effectiveCost: { amountMinor: 1500000n, currency: 'INR' as const },
        totalBenefit: { amountMinor: 500000n, currency: 'INR' as const },
        confidence: 1.0,
        complexityScore: 0,
      },
      {
        id: 'B',
        steps: [],
        immediateDiscount: { amountMinor: 400000n, currency: 'INR' as const },
        rewardValue: { amountMinor: 0n, currency: 'INR' as const },
        futureBenefit: { amountMinor: 0n, currency: 'INR' as const },
        fees: { amountMinor: 0n, currency: 'INR' as const },
        effectiveCost: { amountMinor: 1600000n, currency: 'INR' as const },
        totalBenefit: { amountMinor: 400000n, currency: 'INR' as const },
        confidence: 0.9,
        complexityScore: 1,
      },
      {
        id: 'C',
        steps: [],
        immediateDiscount: { amountMinor: 600000n, currency: 'INR' as const },
        rewardValue: { amountMinor: 0n, currency: 'INR' as const },
        futureBenefit: { amountMinor: 0n, currency: 'INR' as const },
        fees: { amountMinor: 0n, currency: 'INR' as const },
        effectiveCost: { amountMinor: 1400000n, currency: 'INR' as const },
        totalBenefit: { amountMinor: 600000n, currency: 'INR' as const },
        confidence: 1.0,
        complexityScore: 1,
      },
    ];

    const pruned = filterDominated(mockStrategies);
    const ids = pruned.map((s) => s.id);
    expect(ids).toContain('A');
    expect(ids).toContain('C');
    expect(ids).not.toContain('B');
  });

  it('should rank strategies based on milestone value when prioritized', () => {
    const axisAtlasCardWithSpent = {
      ...axisAtlasCard,
      userState: {
        ...axisAtlasCard.userState!,
        annualSpendToDate: { amountMinor: 38000000n, currency: 'INR' as const },
      },
    };

    const profile: UserProfile = {
      version: 1,
      currency: 'INR',
      paymentMethods: [
        { type: 'CREDIT_CARD', card: hdfcMillenniaCard },
        { type: 'CREDIT_CARD', card: axisAtlasCardWithSpent },
      ],
      rewardPreferences: {
        defaultValuations: {
          'HDFC Millennia Points': { amountMinor: 100n, currency: 'INR' },
          'Axis Edge Miles': { amountMinor: 100n, currency: 'INR' },
        },
      },
      optimizationPreferences: {
        immediateSavingsWeight: 1.0,
        rewardValueWeight: 1.0,
        milestoneWeight: 2.0,
        simplicityWeight: 0.1,
        riskWeight: 0.0,
      },
    };

    const candidates = generateCandidates(
      amazonCart,
      profile,
      [hdfcInstantDiscountOffer],
      [amazonCoupon]
    );
    const pruned = filterDominated(candidates);
    const ranked = rankStrategies(pruned, profile.optimizationPreferences);

    expect(ranked[0]?.id).toContain('axis-atlas');
  });

  it('should run E2E Scenario matching Section 83 of specifications', () => {
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
        milestoneWeight: 1.0,
        simplicityWeight: 0.2,
        riskWeight: 0.1,
      },
    };

    const candidates = generateCandidates(
      amazonCart,
      profile,
      [hdfcInstantDiscountOffer],
      [amazonCoupon]
    );

    const pruned = filterDominated(candidates);
    const ranked = rankStrategies(pruned, profile.optimizationPreferences);

    expect(ranked.length).toBeGreaterThan(0);
    const topStrategy = ranked[0]!;

    const trace = generateTrace(amazonCart, topStrategy);
    expect(trace.output.effectiveCost.amountMinor).toBe(topStrategy.effectiveCost.amountMinor);
    expect(trace.steps.length).toBeGreaterThan(0);
  });
});
