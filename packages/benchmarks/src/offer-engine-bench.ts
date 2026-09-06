/**
 * Benchmarks for offer stacking operations
 */

import { hdfcInstantDiscountOffer, chaseOffers, amazonCart } from '@payments-optimizer/test-fixtures';
import { checkEligibility, calculateBenefit } from '@payments-optimizer/rules-engine';

export function createOfferEngineBenchmarks() {
  const benchmarks: Array<{ name: string; fn: () => void }> = [];

  const offers = [hdfcInstantDiscountOffer, chaseOffers];

  benchmarks.push({
    name: 'Offer stacking (check eligibility and calculate benefits)',
    fn: () => {
      for (const offer of offers) {
        if (checkEligibility(amazonCart, offer.conditions)) {
          calculateBenefit(amazonCart, offer.benefit);
        }
      }
    },
  });

  return benchmarks;
}
