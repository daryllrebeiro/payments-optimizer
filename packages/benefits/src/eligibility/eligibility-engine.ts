import { Cart, UserProfile } from '@payments-optimizer/domain';
import { checkEligibility } from '@payments-optimizer/rules-engine';
import { PartnerBenefit } from '../domain/types.js';

export class BenefitEligibilityEngine {
  /**
   * Deterministically validates whether a PartnerBenefit applies to a cart and user.
   */
  isBenefitEligible(
    benefit: PartnerBenefit,
    cart: Cart,
    profile: UserProfile,
    now = Date.now()
  ): boolean {
    // 1. Check merchant match
    if (benefit.merchantId.toLowerCase() !== cart.merchantId.toLowerCase()) {
      return false;
    }

    // 2. Check user membership status
    const hasMembership = profile.memberships?.some((m) => m.programId === benefit.programId);
    if (!hasMembership) {
      return false;
    }

    // 3. Check expiration date if specified
    if (benefit.validUntil) {
      const validUntilMs = new Date(benefit.validUntil).getTime();
      if (validUntilMs <= now) {
        return false;
      }
    }

    // 4. Check conditions (e.g. MINIMUM_SPEND)
    if (benefit.conditions && benefit.conditions.length > 0) {
      if (!checkEligibility(cart, benefit.conditions)) {
        return false;
      }
    }

    return true;
  }
}
