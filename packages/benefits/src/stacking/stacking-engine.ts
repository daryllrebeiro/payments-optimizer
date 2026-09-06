import { Cart, UserProfile, Money } from '@payments-optimizer/domain';
import { zeroMoney, subtractMoney, calculateBenefit, compareMoney, addMoney } from '@payments-optimizer/rules-engine';
import {
  UserVoucher,
  PartnerBenefit,
  StackingCombinationResult,
  StrategyRecipeStep,
} from '../domain/types.js';
import { VoucherInventoryManager } from '../inventory/voucher-manager.js';
import { BenefitEligibilityEngine } from '../eligibility/eligibility-engine.js';

/**
 * Default beam width for beam search optimization.
 * Controls how many top candidates are kept at each step.
 */
const DEFAULT_BEAM_WIDTH = 5;

/**
 * Represents a partial voucher combination being explored.
 */
interface BeamCandidate {
  vouchers: UserVoucher[];
  totalSavings: Money;
  remainingCartTotal: Money;
  recipeSteps: StrategyRecipeStep[];
}

export class BenefitStackingEngine {
  private voucherManager: VoucherInventoryManager;
  private eligibilityEngine = new BenefitEligibilityEngine();
  private beamWidth: number;
  
  /**
   * Memoization cache for voucher combination sub-problems.
   * Key: sorted voucher IDs joined with '|', Value: best result for that combination
   */
  private memoCache = new Map<string, BeamCandidate>();

  constructor(userVouchers: UserVoucher[] = [], beamWidth: number = DEFAULT_BEAM_WIDTH) {
    this.voucherManager = new VoucherInventoryManager(userVouchers);
    this.beamWidth = beamWidth;
  }

  /**
   * Sorts vouchers by their expected savings contribution.
   * Higher value and urgency (near expiry) are prioritized.
   */
  private sortByValue(vouchers: UserVoucher[], cart: Cart): UserVoucher[] {
    const now = Date.now();
    return vouchers.slice().sort((a, b) => {
      // Primary sort: by remaining value (descending)
      const valueDiff = Number(b.remainingValue.amountMinor - a.remainingValue.amountMinor);
      if (valueDiff !== 0) return valueDiff;

      // Secondary sort: by urgency (expiring sooner comes first)
      const aExpiry = new Date(a.expiryDate).getTime();
      const bExpiry = new Date(b.expiryDate).getTime();
      const aDaysLeft = (aExpiry - now) / (24 * 60 * 60 * 1000);
      const bDaysLeft = (bExpiry - now) / (24 * 60 * 60 * 1000);
      
      return aDaysLeft - bDaysLeft;
    });
  }

  /**
   * Scores a beam candidate based on total savings and urgency.
   * Used to select top-k candidates in beam search.
   */
  private scoreCandidate(candidate: BeamCandidate, cart: Cart): number {
    // Base score is total savings
    let score = Number(candidate.totalSavings.amountMinor);

    // Add urgency bonus for vouchers expiring soon
    const now = Date.now();
    const urgencyThreshold = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
    
    for (const voucher of candidate.vouchers) {
      const expiryMs = new Date(voucher.expiryDate).getTime();
      const timeLeft = expiryMs - now;
      
      if (timeLeft > 0 && timeLeft <= urgencyThreshold) {
        // Urgency bonus: scale inversely with days left (max 10% of voucher value)
        const urgencyFactor = 1 - (timeLeft / urgencyThreshold);
        const bonus = Number(voucher.remainingValue.amountMinor) * 0.1 * urgencyFactor;
        score += bonus;
      }
    }

    return score;
  }

  /**
   * Selects top-k candidates from a list based on their scores.
   */
  private selectTopK(candidates: BeamCandidate[], k: number, cart: Cart): BeamCandidate[] {
    return candidates
      .map(candidate => ({
        candidate,
        score: this.scoreCandidate(candidate, cart)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map(item => item.candidate);
  }

  /**
   * Creates a cache key for a set of vouchers for memoization.
   */
  private getCacheKey(vouchers: UserVoucher[]): string {
    return vouchers
      .map(v => v.id)
      .sort()
      .join('|');
  }

  /**
   * Applies a sequence of vouchers to a cart using beam search.
   * Returns the best voucher combinations found.
   */
  private findBestVoucherCombinations(
    eligibleVouchers: UserVoucher[],
    cart: Cart
  ): BeamCandidate[] {
    if (eligibleVouchers.length === 0) {
      return [];
    }

    // Sort vouchers by value and urgency
    const sortedVouchers = this.sortByValue(eligibleVouchers, cart);

    // For small sets (≤5), consider all combinations to maintain exactness
    if (sortedVouchers.length <= 5) {
      return this.generateAllVoucherCombinations(sortedVouchers, cart);
    }

    // Beam search for larger sets
    const currency = cart.currency;
    
    // Initialize beam with empty state
    let beam: BeamCandidate[] = [{
      vouchers: [],
      totalSavings: zeroMoney(currency),
      remainingCartTotal: cart.total,
      recipeSteps: []
    }];

    // Expand beam iteratively
    for (const voucher of sortedVouchers) {
      const newCandidates: BeamCandidate[] = [];

      // For each candidate in current beam, try adding this voucher
      for (const candidate of beam) {
        // Skip if cart is already fully covered
        if (candidate.remainingCartTotal.amountMinor <= 0n) {
          newCandidates.push(candidate);
          continue;
        }

        // Check memoization cache
        const newVouchers = [...candidate.vouchers, voucher];
        const cacheKey = this.getCacheKey(newVouchers);
        
        if (this.memoCache.has(cacheKey)) {
          newCandidates.push(this.memoCache.get(cacheKey)!);
          continue;
        }

        // Try adding this voucher
        const burn = this.voucherManager.applyVoucher(voucher, candidate.remainingCartTotal);
        
        if (burn.amountBurned.amountMinor > 0n) {
          const newCandidate: BeamCandidate = {
            vouchers: newVouchers,
            totalSavings: addMoney(candidate.totalSavings, burn.amountBurned),
            remainingCartTotal: burn.remainingCartTotal,
            recipeSteps: [
              ...candidate.recipeSteps,
              {
                stepNumber: candidate.recipeSteps.length + 1,
                phase: 'BEFORE_PAYMENT',
                actionType: 'VOUCHER_REDEMPTION',
                benefitSourceId: voucher.id,
                benefitSourceName: voucher.title,
                description: `Apply ${voucher.title} (Value: ${voucher.remainingValue.amountMinor / 100n})`,
                amountApplied: burn.amountBurned,
                savingsGenerated: burn.amountBurned,
                codeToApply: voucher.code,
                instructions: `Enter voucher code ${voucher.code || voucher.id} at checkout`,
              }
            ]
          };

          // Cache this result
          this.memoCache.set(cacheKey, newCandidate);
          newCandidates.push(newCandidate);
        }

        // Also keep the option of NOT adding this voucher
        newCandidates.push(candidate);
      }

      // Select top-k candidates for next iteration
      beam = this.selectTopK(newCandidates, this.beamWidth, cart);
    }

    return beam;
  }

  /**
   * Generates all voucher combinations for small sets (≤5 vouchers).
   * This ensures exactness for small problem sizes.
   */
  private generateAllVoucherCombinations(
    vouchers: UserVoucher[],
    cart: Cart
  ): BeamCandidate[] {
    const currency = cart.currency;
    const results: BeamCandidate[] = [];

    // Generate power set (all subsets)
    const powerSetSize = 1 << vouchers.length;
    
    for (let mask = 0; mask < powerSetSize; mask++) {
      const subset: UserVoucher[] = [];
      
      for (let i = 0; i < vouchers.length; i++) {
        if (mask & (1 << i)) {
          subset.push(vouchers[i]!);
        }
      }

      // Apply vouchers in this subset sequentially
      let remainingTotal = cart.total;
      let totalSavings = zeroMoney(currency);
      const recipeSteps: StrategyRecipeStep[] = [];

      for (const voucher of subset) {
        if (remainingTotal.amountMinor <= 0n) break;

        const burn = this.voucherManager.applyVoucher(voucher, remainingTotal);
        
        if (burn.amountBurned.amountMinor > 0n) {
          totalSavings = addMoney(totalSavings, burn.amountBurned);
          remainingTotal = burn.remainingCartTotal;
          
          recipeSteps.push({
            stepNumber: recipeSteps.length + 1,
            phase: 'BEFORE_PAYMENT',
            actionType: 'VOUCHER_REDEMPTION',
            benefitSourceId: voucher.id,
            benefitSourceName: voucher.title,
            description: `Apply ${voucher.title} (Value: ${voucher.remainingValue.amountMinor / 100n})`,
            amountApplied: burn.amountBurned,
            savingsGenerated: burn.amountBurned,
            codeToApply: voucher.code,
            instructions: `Enter voucher code ${voucher.code || voucher.id} at checkout`,
          });
        }
      }

      results.push({
        vouchers: subset,
        totalSavings,
        remainingCartTotal: remainingTotal,
        recipeSteps
      });
    }

    return results;
  }

  generateStackingCombinations(
    cart: Cart,
    profile: UserProfile,
    partnerBenefits: PartnerBenefit[]
  ): StackingCombinationResult[] {
    // Clear memoization cache for each new optimization run
    this.memoCache.clear();
    
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

    // Option B: Vouchers Only (using beam search for multiple vouchers)
    const voucherCombinations = this.findBestVoucherCombinations(eligibleVouchers, cart);
    
    for (const combo of voucherCombinations) {
      // Skip the empty combination (already covered in base option)
      if (combo.vouchers.length === 0) continue;

      results.push({
        vouchersApplied: combo.vouchers,
        voucherSavings: combo.totalSavings,
        partnerSavings: zeroMoney(currency),
        residualCartTotal: combo.remainingCartTotal,
        recipeSteps: combo.recipeSteps,
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

    // Option D: Stacked (Voucher Combinations + Partner Benefit)
    // Apply partner benefits only to the top beam combinations, not all
    for (const combo of voucherCombinations) {
      // Skip empty combination
      if (combo.vouchers.length === 0) continue;

      for (const benefit of eligiblePartnerBenefits) {
        if (!benefit.stackableWithVouchers) {
          continue; // Exclusion: Cannot stack with vouchers
        }

        // Apply partner benefit to the remaining cart after vouchers
        const intermediateCart: Cart = {
          ...cart,
          total: combo.remainingCartTotal,
          subtotal: combo.remainingCartTotal,
        };

        const partnerDiscount = calculateBenefit(intermediateCart, benefit.benefit);
        const finalResidual = subtractMoney(combo.remainingCartTotal, partnerDiscount);

        // Build combined recipe steps
        const partnerStep: StrategyRecipeStep = {
          stepNumber: combo.recipeSteps.length + 1,
          phase: 'BEFORE_PAYMENT',
          actionType: 'PARTNER_OFFER',
          benefitSourceId: benefit.id,
          benefitSourceName: benefit.partnerName,
          description: `Apply ${benefit.title}`,
          amountApplied: combo.remainingCartTotal,
          savingsGenerated: partnerDiscount,
          instructions: `Ensure your ${benefit.partnerName} membership is active`,
        };

        results.push({
          vouchersApplied: combo.vouchers,
          voucherSavings: combo.totalSavings,
          partnerBenefitApplied: benefit,
          partnerSavings: partnerDiscount,
          residualCartTotal: finalResidual,
          recipeSteps: [...combo.recipeSteps, partnerStep],
        });
      }
    }

    return results;
  }
}
