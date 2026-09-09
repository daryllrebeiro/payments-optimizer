import {
  PaymentStrategy,
  OptimizationPreferences,
  CalculationTrace,
  CalculationStep,
  Cart,
  minorToMajor,
} from '@payments-optimizer/domain';

// Strategy ranking constraints
const MIN_CONFIDENCE = 0.5;
const MAX_COMPLEXITY = 8;

export function scoreStrategy(strategy: PaymentStrategy, prefs: OptimizationPreferences): number {
  // Fix F12: route through per-currency divisor (JPY is zero-decimal).
  const savingsVal = minorToMajor(
    strategy.immediateDiscount.amountMinor,
    strategy.immediateDiscount.currency
  );
  const rewardVal = minorToMajor(strategy.rewardValue.amountMinor, strategy.rewardValue.currency);
  const milestoneVal = minorToMajor(
    strategy.futureBenefit.amountMinor,
    strategy.futureBenefit.currency
  );

  const complexityVal = strategy.complexityScore;
  const riskVal = (1.0 - strategy.confidence) * 10;

  // Score = SavingsWeight * Savings + RewardWeight * RewardValue + MilestoneWeight * MilestoneValue
  //         - SimplicityWeight * Complexity - RiskWeight * Risk
  const score =
    prefs.immediateSavingsWeight * savingsVal +
    prefs.rewardValueWeight * rewardVal +
    prefs.milestoneWeight * milestoneVal -
    prefs.simplicityWeight * complexityVal -
    prefs.riskWeight * riskVal;

  return score;
}

export function rankStrategies(
  strategies: PaymentStrategy[],
  prefs: OptimizationPreferences
): PaymentStrategy[] {
  // Filter out strategies that don't meet minimum constraints
  const filtered = strategies.filter(
    (s) => s.confidence >= MIN_CONFIDENCE && s.complexityScore <= MAX_COMPLEXITY
  );

  return filtered.sort((a, b) => {
    // Fix F11/F19: primary order by exact BigInt totalBenefit so a
    // 1-minor-unit difference never ties; then float score; then id for a
    // deterministic total order regardless of input order.
    if (a.totalBenefit.amountMinor !== b.totalBenefit.amountMinor) {
      return a.totalBenefit.amountMinor > b.totalBenefit.amountMinor ? -1 : 1;
    }
    const scoreA = scoreStrategy(a, prefs);
    const scoreB = scoreStrategy(b, prefs);
    if (scoreA !== scoreB) return scoreB - scoreA; // descending order
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export function generateTrace(cart: Cart, strategy: PaymentStrategy): CalculationTrace {
  const steps: CalculationStep[] = [
    {
      description: 'Base Price',
      amountChange: cart.total,
      type: 'BASE_PRICE',
    },
  ];

  if (strategy.immediateDiscount.amountMinor > 0n) {
    steps.push({
      description: 'Immediate Discounts & Coupons',
      amountChange: {
        amountMinor: -strategy.immediateDiscount.amountMinor,
        currency: cart.currency,
      },
      type: 'DISCOUNT',
    });
  }

  if (strategy.rewardValue.amountMinor > 0n) {
    steps.push({
      description: 'Card Cashback / Rewards Value',
      amountChange: {
        amountMinor: -strategy.rewardValue.amountMinor,
        currency: cart.currency,
      },
      type: 'CASHBACK',
    });
  }

  if (strategy.futureBenefit.amountMinor > 0n) {
    steps.push({
      description: 'Milestone Progress Value',
      amountChange: {
        amountMinor: -strategy.futureBenefit.amountMinor,
        currency: cart.currency,
      },
      type: 'REWARD_POINTS',
    });
  }

  if (strategy.fees.amountMinor > 0n) {
    steps.push({
      description: 'Transaction Fees & Surcharges',
      amountChange: strategy.fees,
      type: 'FEE',
    });
  }

  return {
    steps,
    input: {
      cart,
      strategyId: strategy.id,
    },
    output: {
      effectiveCost: strategy.effectiveCost,
      totalBenefit: strategy.totalBenefit,
    },
  };
}
