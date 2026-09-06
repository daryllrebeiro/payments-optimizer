/**
 * Benchmarks for UnifiedBenefitOptimizer.optimize()
 */

import { UnifiedBenefitOptimizer } from '@payments-optimizer/benefits';
import {
  amazonCart,
  amazonCartUSD,
  hdfcMillenniaCard,
  sbiCashbackCard,
  chaseSapphireCard,
} from '@payments-optimizer/test-fixtures';
import type { UserProfile } from '@payments-optimizer/domain';

export function createBenefitOptimizerBenchmarks() {
  const benchmarks: Array<{ name: string; fn: () => void }> = [];

  // Create test profiles with varying complexity
  const simpleProfile: UserProfile = {
    version: 1,
    currency: 'INR',
    paymentMethods: [
      {
        type: 'CREDIT_CARD',
        card: hdfcMillenniaCard,
      },
    ],
    vouchers: [],
    memberships: [],
    rewardPreferences: {
      defaultValuations: {
        'HDFC Millennia Points': { amountMinor: BigInt(50), currency: 'INR' },
      },
    },
    optimizationPreferences: {
      immediateSavingsWeight: 0.4,
      rewardValueWeight: 0.3,
      milestoneWeight: 0.1,
      simplicityWeight: 0.1,
      riskWeight: 0.1,
    },
  };

  const mediumProfile: UserProfile = {
    version: 1,
    currency: 'INR',
    paymentMethods: [
      {
        type: 'CREDIT_CARD',
        card: hdfcMillenniaCard,
      },
      {
        type: 'CREDIT_CARD',
        card: sbiCashbackCard,
      },
    ],
    vouchers: [],
    memberships: [],
    rewardPreferences: {
      defaultValuations: {
        'HDFC Millennia Points': { amountMinor: BigInt(50), currency: 'INR' },
        'SBI Cashback Program': { amountMinor: BigInt(100), currency: 'INR' },
      },
    },
    optimizationPreferences: {
      immediateSavingsWeight: 0.4,
      rewardValueWeight: 0.3,
      milestoneWeight: 0.1,
      simplicityWeight: 0.1,
      riskWeight: 0.1,
    },
  };

  const largeProfile: UserProfile = {
    version: 1,
    currency: 'USD',
    paymentMethods: [
      {
        type: 'CREDIT_CARD',
        card: hdfcMillenniaCard,
      },
      {
        type: 'CREDIT_CARD',
        card: sbiCashbackCard,
      },
      {
        type: 'CREDIT_CARD',
        card: chaseSapphireCard,
      },
    ],
    vouchers: [],
    memberships: [],
    rewardPreferences: {
      defaultValuations: {
        'HDFC Millennia Points': { amountMinor: BigInt(50), currency: 'INR' },
        'SBI Cashback Program': { amountMinor: BigInt(100), currency: 'INR' },
        'Chase Ultimate Rewards': { amountMinor: BigInt(1), currency: 'USD' },
      },
    },
    optimizationPreferences: {
      immediateSavingsWeight: 0.4,
      rewardValueWeight: 0.3,
      milestoneWeight: 0.1,
      simplicityWeight: 0.1,
      riskWeight: 0.1,
    },
  };

  const optimizer = new UnifiedBenefitOptimizer();

  benchmarks.push({
    name: 'UnifiedBenefitOptimizer.optimize (1 card, INR cart)',
    fn: () => {
      optimizer.optimize(amazonCart, simpleProfile);
    },
  });

  benchmarks.push({
    name: 'UnifiedBenefitOptimizer.optimize (2 cards, INR cart)',
    fn: () => {
      optimizer.optimize(amazonCart, mediumProfile);
    },
  });

  benchmarks.push({
    name: 'UnifiedBenefitOptimizer.optimize (3 cards, USD cart)',
    fn: () => {
      optimizer.optimize(amazonCartUSD, largeProfile);
    },
  });

  return benchmarks;
}
