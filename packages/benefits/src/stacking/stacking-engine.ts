import { Cart, UserProfile } from '@payments-optimizer/domain';
import { zeroMoney, subtractMoney, calculateBenefit } from '@payments-optimizer/rules-engine';
import {
  UserVoucher,
  PartnerBenefit,
  StackingCombinationResult,
  StrategyRecipeStep,
} from '../domain/types.js';
import { VoucherInventoryManager } from '../inventory/voucher-manager.js';
import { BenefitEligibilityEngine } from '../eligibility/eligibility-engine.js';

export class BenefitStackingEngine {
  private voucherManager: VoucherInventoryManager;
  private eligibilityEngine = new BenefitEligibilityEngine();

  constructor(userVouchers: UserVoucher[] = []) {
    this.voucherManager = new VoucherInventoryManager(userVouchers);
  }

  generateStackingCombinations(
    cart: Cart,
    profile: UserProfile,
    partnerBenefits: PartnerBenefit[]
  ): StackingCombinationResult[] {
    const results: StackingCombinationResult[] = [];
    const currency = cart.currency;

    const eligibleVouchers = this.voucherManager.getEligibleVouchers(cart);
    const eligiblePartnerBenefits = partnerBenefits.filter((b) =>
      this.eligibilityEngine.isBenefitEligible(b, cart, profile)
    );

    // Option A: Base (No Vouchers, No Partner Perks)
    results.push({
      vouchersApplied: [],
      voucherSavings: zeroMoney(currency),
      partnerSavings: zeroMoney(currency),
      residualCartTotal: cart.total,
      recipeSteps: [],
    });

    // Option B: Vouchers Only
    for (const voucher of eligibleVouchers) {
      const burn = this.voucherManager.applyVoucher(voucher, cart.total);
      const recipeSteps: StrategyRecipeStep[] = [
        {
          stepNumber: 1,
          phase: 'BEFORE_PAYMENT',
          actionType: 'VOUCHER_REDEMPTION',
          benefitSourceId: voucher.id,
          benefitSourceName: voucher.title,
          description: `Apply ${voucher.title} (Value: ${voucher.remainingValue.amountMinor / 100n})`,
          amountApplied: burn.amountBurned,
          savingsGenerated: burn.amountBurned,
          codeToApply: voucher.code,
          instructions: `Enter voucher code ${voucher.code || voucher.id} at checkout`,
        },
      ];

      results.push({
        vouchersApplied: [voucher],
        voucherSavings: burn.amountBurned,
        partnerSavings: zeroMoney(currency),
        residualCartTotal: burn.remainingCartTotal,
        recipeSteps,
      });
    }

    // Option C: Partner Benefits Only
    for (const benefit of eligiblePartnerBenefits) {
      const discount = calculateBenefit(cart, benefit.benefit);
      const residualCartTotal = subtractMoney(cart.total, discount);
      const recipeSteps: StrategyRecipeStep[] = [
        {
          stepNumber: 1,
          phase: 'BEFORE_PAYMENT',
          actionType: 'PARTNER_OFFER',
          benefitSourceId: benefit.id,
          benefitSourceName: benefit.partnerName,
          description: `Activate ${benefit.title}`,
          amountApplied: cart.total,
          savingsGenerated: discount,
          instructions: `Ensure your ${benefit.partnerName} / ${benefit.programId} membership is linked`,
        },
      ];

      results.push({
        vouchersApplied: [],
        voucherSavings: zeroMoney(currency),
        partnerBenefitApplied: benefit,
        partnerSavings: discount,
        residualCartTotal,
        recipeSteps,
      });
    }

    // Option D: Stacked (Voucher + Partner Benefit)
    for (const voucher of eligibleVouchers) {
      for (const benefit of eligiblePartnerBenefits) {
        if (!benefit.stackableWithVouchers) {
          continue; // Exclusion: Cannot stack with vouchers
        }

        // Sequence: Apply Voucher first, then Partner Benefit on remaining (or base cart per terms)
        const burn = this.voucherManager.applyVoucher(voucher, cart.total);
        const intermediateCart: Cart = {
          ...cart,
          total: burn.remainingCartTotal,
          subtotal: burn.remainingCartTotal,
        };

        const partnerDiscount = calculateBenefit(intermediateCart, benefit.benefit);
        const finalResidual = subtractMoney(burn.remainingCartTotal, partnerDiscount);

        const recipeSteps: StrategyRecipeStep[] = [
          {
            stepNumber: 1,
            phase: 'BEFORE_PAYMENT',
            actionType: 'VOUCHER_REDEMPTION',
            benefitSourceId: voucher.id,
            benefitSourceName: voucher.title,
            description: `Apply ${voucher.title}`,
            amountApplied: burn.amountBurned,
            savingsGenerated: burn.amountBurned,
            codeToApply: voucher.code,
            instructions: `Enter voucher code ${voucher.code || voucher.id} at checkout`,
          },
          {
            stepNumber: 2,
            phase: 'BEFORE_PAYMENT',
            actionType: 'PARTNER_OFFER',
            benefitSourceId: benefit.id,
            benefitSourceName: benefit.partnerName,
            description: `Apply ${benefit.title}`,
            amountApplied: burn.remainingCartTotal,
            savingsGenerated: partnerDiscount,
            instructions: `Ensure your ${benefit.partnerName} membership is active`,
          },
        ];

        results.push({
          vouchersApplied: [voucher],
          voucherSavings: burn.amountBurned,
          partnerBenefitApplied: benefit,
          partnerSavings: partnerDiscount,
          residualCartTotal: finalResidual,
          recipeSteps,
        });
      }
    }

    return results;
  }
}
