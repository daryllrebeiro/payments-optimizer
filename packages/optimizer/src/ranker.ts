import {
  PaymentStrategy,
  OptimizationPreferences,
  CalculationTrace,
  CalculationStep,
  Cart,
} from '@payments-optimizer/domain';

export function scoreStrategy(strategy: PaymentStrategy, prefs: OptimizationPreferences): number {
  // Convert minor currency units to major double units for scoring
  const savingsVal = Number(strategy.immediateDiscount.amountMinor) / 100;
  const rewardVal = Number(strategy.rewardValue.amountMinor) / 100;
  const milestoneVal = Number(strategy.futureBenefit.amountMinor) / 100;

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
  return [...strategies].sort((a, b) => {
    const scoreA = scoreStrategy(a, prefs);
    const scoreB = scoreStrategy(b, prefs);
    return scoreB - scoreA; // descending order
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
