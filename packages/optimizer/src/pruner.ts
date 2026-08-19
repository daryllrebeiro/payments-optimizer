import { PaymentStrategy } from '@payments-optimizer/domain';

/**
 * Filter out dominated strategies.
 * 
 * Strategy A dominates B if:
 * 1. A's effectiveCost is equal or lower than B's.
 * 2. A's complexityScore is equal or lower than B's.
 * 3. A's confidence is equal or higher than B's.
 * AND A is strictly better than B in at least one of these three metrics.
 * 
 * Performance Optimization:
 * By sorting by effectiveCost ascending first, we can process strategies sequentially.
 * A strategy processed later (higher cost) can never dominate an already accepted strategy
 * with a strictly lower cost. Thus, we only need to compare each candidate against
 * already accepted non-dominated strategies.
 */
export function filterDominated(strategies: PaymentStrategy[]): PaymentStrategy[] {
  const len = strategies.length;
  if (len <= 1) return [...strategies];

  // Sort by effectiveCost ascending
  const sorted = [...strategies].sort((a, b) => {
    const diff = a.effectiveCost.amountMinor - b.effectiveCost.amountMinor;
    return diff < 0n ? -1 : diff > 0n ? 1 : 0;
  });

  const result: PaymentStrategy[] = [];

  for (let i = 0; i < len; i++) {
    const candidate = sorted[i]!;
    let isDominated = false;

    // Check if candidate is dominated by any already accepted strategy
    const resultLen = result.length;
    for (let j = 0; j < resultLen; j++) {
      const other = result[j]!;

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

      if (dominates) {
        isDominated = true;
        break; // Early exit!
      }
    }

    if (!isDominated) {
      // Check if this candidate dominates any already accepted strategies with the SAME cost
      let j = 0;
      while (j < result.length) {
        const other = result[j]!;
        if (candidate.effectiveCost.amountMinor === other.effectiveCost.amountMinor) {
          const candidateDominates =
            candidate.complexityScore <= other.complexityScore &&
            candidate.confidence >= other.confidence &&
            (candidate.complexityScore < other.complexityScore || candidate.confidence > other.confidence);

          if (candidateDominates) {
            result.splice(j, 1); // Remove dominated other
            continue;
          }
        }
        j++;
      }

      result.push(candidate);
    }
  }

  return result;
}
