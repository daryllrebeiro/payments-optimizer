import { PaymentStrategy } from '@payments-optimizer/domain';

/**
 * Strategy A dominates B if:
 * 1. A's effectiveCost is equal or lower than B's.
 * 2. A's complexityScore is equal or lower than B's.
 * 3. A's confidence is equal or higher than B's.
 * AND A is strictly better than B in at least one of these three metrics.
 */
export function filterDominated(strategies: PaymentStrategy[]): PaymentStrategy[] {
  return strategies.filter((candidate) => {
    const isDominated = strategies.some((other) => {
      if (other.id === candidate.id) return false;

      const costLowerOrEqual =
        other.effectiveCost.amountMinor <= candidate.effectiveCost.amountMinor;
      const complexityLowerOrEqual = other.complexityScore <= candidate.complexityScore;
      const confidenceHigherOrEqual = other.confidence >= candidate.confidence;

      const strictlyBetterCost =
        other.effectiveCost.amountMinor < candidate.effectiveCost.amountMinor;
      const strictlyBetterComplexity = other.complexityScore < candidate.complexityScore;
      const strictlyBetterConfidence = other.confidence > candidate.confidence;

      const dominates =
        costLowerOrEqual &&
        complexityLowerOrEqual &&
        confidenceHigherOrEqual &&
        (strictlyBetterCost || strictlyBetterComplexity || strictlyBetterConfidence);

      return dominates;
    });

    return !isDominated;
  });
}
