/**
 * Benchmarks for RulesEngine evaluation functions
 */

import { checkEligibility, calculateBenefit } from '@payments-optimizer/rules-engine';
import { amazonCart, hdfcInstantDiscountOffer, amazonCartUSD, chaseOffers } from '@payments-optimizer/test-fixtures';

export function createRulesEngineBenchmarks() {
  const benchmarks: Array<{ name: string; fn: () => void }> = [];

  const offers = [hdfcInstantDiscountOffer, chaseOffers];

  // Simple: check eligibility for single offer
  benchmarks.push({
    name: 'RulesEngine.checkEligibility (single offer)',
    fn: () => {
      checkEligibility(amazonCart, hdfcInstantDiscountOffer.conditions);
    },
  });

  // Medium: check eligibility for multiple offers
  benchmarks.push({
    name: 'RulesEngine.checkEligibility (multiple offers)',
    fn: () => {
      for (const offer of offers) {
        checkEligibility(amazonCart, offer.conditions);
        checkEligibility(amazonCartUSD, offer.conditions);
      }
    },
  });

  // Benefit calculation
  benchmarks.push({
    name: 'RulesEngine.calculateBenefit (single offer)',
    fn: () => {
      calculateBenefit(amazonCart, hdfcInstantDiscountOffer.benefit);
    },
  });

  // Complex: eligibility + benefit calculation
  benchmarks.push({
    name: 'RulesEngine.evaluate (eligibility + benefit)',
    fn: () => {
      for (const offer of offers) {
        if (checkEligibility(amazonCart, offer.conditions)) {
          calculateBenefit(amazonCart, offer.benefit);
        }
        if (checkEligibility(amazonCartUSD, offer.conditions)) {
          calculateBenefit(amazonCartUSD, offer.benefit);
        }
      }
    },
  });

  return benchmarks;
}
