import { Money, OptimizationPreferences } from '@payments-optimizer/domain';
import { UserVoucher } from '../domain/types.js';

/**
 * Safely converts a BigInt representing cents/minimum currency unit to a number.
 * For values exceeding Number.MAX_SAFE_INTEGER, truncates to 2 decimal places.
 * @param amountMinor - BigInt amount in minimum currency units (e.g., paise, cents)
 * @returns Number amount in major currency units (e.g., rupees, dollars)
 */
function safeBigIntToNumber(amountMinor: bigint): number {
  if (
    amountMinor > BigInt(Number.MAX_SAFE_INTEGER) ||
    amountMinor < -BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    console.warn(
      `BigInt value ${amountMinor.toString()} exceeds safe integer range, truncating to 2 decimal places`
    );
    // Divide by 100 first to reduce magnitude, then convert
    return Number(amountMinor / 100n);
  }
  return Number(amountMinor) / 100;
}

export interface OpportunityScoreInput {
  immediateSavings: Money;
  rewardValue: Money;
  appliedVouchers: Array<Pick<UserVoucher, 'expiryDate'>>;
  isPartnerPromoApplied: boolean;
  alternativeCardPromoSavings?: Money;
  complexityStepsCount: number;
  now?: number;
}

export interface OpportunityScoreResult {
  score: number;
  immediateSavingsVal: number;
  rewardValueVal: number;
  urgencyPremiumVal: number;
  membershipValueVal: number;
  opportunityCostVal: number;
  complexityPenaltyVal: number;
}

export class OpportunityScorer {
  calculateScore(
    input: OpportunityScoreInput,
    prefs: OptimizationPreferences
  ): OpportunityScoreResult {
    const now = input.now ?? Date.now();

    const immediateSavingsVal = safeBigIntToNumber(input.immediateSavings.amountMinor);
    const rewardValueVal = safeBigIntToNumber(input.rewardValue.amountMinor);

    // 1. Urgency Premium for expiring vouchers
    let urgencyPremiumVal = 0;
    for (const v of input.appliedVouchers) {
      const expiryMs = new Date(v.expiryDate).getTime();
      const daysLeft = (expiryMs - now) / (24 * 60 * 60 * 1000);
      if (daysLeft <= 1) {
        urgencyPremiumVal += 200; // High urgency: expires within 24 hours
      } else if (daysLeft <= 3) {
        urgencyPremiumVal += 150; // Urgent: expires within 3 days
      } else if (daysLeft <= 7) {
        urgencyPremiumVal += 50; // Moderate urgency: expires within 7 days
      }
    }

    // 2. Membership Value (if partner promo or member perk is leveraged)
    const membershipValueVal = input.isPartnerPromoApplied ? 50 : 0;

    // 3. Opportunity Cost (Penalty for burning long-expiry voucher if alternative promo is available)
    let opportunityCostVal = 0;
    if (input.appliedVouchers.length > 0 && input.alternativeCardPromoSavings) {
      const altSavingsVal = safeBigIntToNumber(input.alternativeCardPromoSavings.amountMinor);
      // If vouchers have > 14 days and alternative promo captures >= 80% savings
      const hasLongExpiry = input.appliedVouchers.every((v) => {
        const daysLeft = (new Date(v.expiryDate).getTime() - now) / (24 * 60 * 60 * 1000);
        return daysLeft > 14;
      });

      if (hasLongExpiry && altSavingsVal > 0) {
        opportunityCostVal = altSavingsVal * 0.4; // 40% opportunity cost penalty for early voucher burn
      }
    }

    // 4. Complexity Penalty (e.g. ₹25 per extra manual step)
    const complexityPenaltyVal = input.complexityStepsCount * 25;

    // Weighted composite score
    const urgencyWeight = prefs.urgencyWeight ?? 1.0;
    const score =
      prefs.immediateSavingsWeight * immediateSavingsVal +
      prefs.rewardValueWeight * rewardValueVal +
      urgencyWeight * urgencyPremiumVal +
      membershipValueVal -
      opportunityCostVal -
      prefs.simplicityWeight * (complexityPenaltyVal / 10);

    return {
      score,
      immediateSavingsVal,
      rewardValueVal,
      urgencyPremiumVal,
      membershipValueVal,
      opportunityCostVal,
      complexityPenaltyVal,
    };
  }
}
