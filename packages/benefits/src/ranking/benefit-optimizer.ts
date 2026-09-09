import {
  Cart,
  UserProfile,
  Money,
  Offer,
  PaymentStep,
  StrategyRecipeStep,
  UnifiedTransactionStrategy,
} from '@payments-optimizer/domain';
import {
  zeroMoney,
  addMoney,
  subtractMoney,
  compareMoney,
  evaluateCardReward,
  calculateMilestoneContribution,
  calculatePaymentFees,
} from '@payments-optimizer/rules-engine';
import { PublicBenefitCatalog } from '../catalog/public-catalog.js';
import { BenefitStackingEngine } from '../stacking/stacking-engine.js';
import { OpportunityScorer } from '../opportunity/opportunity-scorer.js';

/**
 * Converts reward points/miles to their monetary value based on user's valuation preferences.
 *
 * @param reward - The reward amount in points/miles
 * @param rewardProgram - Name of the reward program (e.g., 'Chase Ultimate Rewards')
 * @param valuations - User's valuation mapping for different reward programs
 * @returns Monetary value of the rewards in the user's preferred currency
 *
 * @example
 * ```typescript
 * const reward = { amountMinor: 10000n, currency: 'USD' }; // 100 points
 * const valuations = { 'Chase Ultimate Rewards': { amountMinor: 1n, currency: 'USD' } };
 * const value = valueReward(reward, 'Chase Ultimate Rewards', valuations);
 * // Returns { amountMinor: 100n, currency: 'USD' } - 100 points worth $1.00
 * ```
 */
function valueReward(
  reward: Money,
  rewardProgram: string,
  valuations: Record<string, Money>
): Money {
  const val = valuations[rewardProgram];
  if (val) {
    const amountMinor = (reward.amountMinor * val.amountMinor) / 100n;
    return {
      amountMinor,
      currency: val.currency,
    };
  }
  return reward;
}

/**
 * Unified benefit optimizer that combines vouchers, partner benefits, card rewards,
 * and milestone tracking to generate optimal payment strategies.
 *
 * This is the main optimization engine that:
 * - Discovers relevant partner benefits from the catalog
 * - Generates stacking combinations of vouchers and perks
 * - Evaluates payment methods for residual cart totals
 * - Calculates immediate savings, rewards, and future benefits
 * - Scores strategies using opportunity scoring algorithm
 *
 * @example
 * ```typescript
 * const optimizer = new UnifiedBenefitOptimizer();
 * const strategies = optimizer.optimize(cart, userProfile);
 * const bestStrategy = strategies[0]; // Sorted by opportunity score
 * console.log(`Total benefit: ${bestStrategy.totalBenefit.amountMinor / 100n}`);
 * ```
 */
export class UnifiedBenefitOptimizer {
  private catalog: PublicBenefitCatalog;
  private opportunityScorer = new OpportunityScorer();

  /**
   * Creates a new UnifiedBenefitOptimizer instance.
   *
   * @param catalog - Optional PublicBenefitCatalog instance. If not provided, creates a new one.
   */
  constructor(catalog?: PublicBenefitCatalog) {
    this.catalog = catalog || new PublicBenefitCatalog();
  }

  /**
   * Optimizes payment strategy for a given cart and user profile.
   *
   * Generates all possible benefit stacking combinations and evaluates each payment method
   * to find the strategies that maximize savings and rewards.
   *
   * @param cart - Shopping cart with items, totals, and merchant information
   * @param profile - User's profile including payment methods, vouchers, and preferences
   * @param _additionalOffers - Optional additional offers (currently unused, reserved for future use)
   * @param now - Current timestamp for expiry calculations (defaults to Date.now())
   * @returns Array of strategies sorted by opportunity score (best first)
   *
   * @example
   * ```typescript
   * const cart: Cart = {
   *   merchantId: 'amazon',
   *   items: [{ id: '1', name: 'Laptop', price: { amountMinor: 99999n, currency: 'USD' }, quantity: 1 }],
   *   total: { amountMinor: 99999n, currency: 'USD' },
   *   currency: 'USD'
   * };
   *
   * const profile: UserProfile = {
   *   version: 1,
   *   currency: 'USD',
   *   paymentMethods: [{ type: 'CREDIT_CARD', card: myCard }],
   *   rewardPreferences: { defaultValuations: {} },
   *   optimizationPreferences: { ... }
   * };
   *
   * const strategies = optimizer.optimize(cart, profile);
   * ```
   */
  optimize(
    cart: Cart,
    profile: UserProfile,
    _additionalOffers: Offer[] = [],
    now = Date.now()
  ): UnifiedTransactionStrategy[] {
    const currency = cart.currency;
    const valuations = profile.rewardPreferences.defaultValuations;
    const userPrograms = profile.memberships?.map((m) => m.programId) || [];

    // 1. Discover public partner benefits for this merchant
    const partnerBenefits = this.catalog.getBenefitsForMerchant(cart.merchantId, userPrograms);

    // 2. Generate stacking combinations (Vouchers + Partner Perks)
    const stackingEngine = new BenefitStackingEngine(profile.vouchers || []);
    const combinations = stackingEngine.generateStackingCombinations(
      cart,
      profile,
      partnerBenefits
    );

    const strategies: UnifiedTransactionStrategy[] = [];

    // 3. For each stacking combination, evaluate payment methods for the residual cart total
    for (const combo of combinations) {
      const residualCart: Cart = {
        ...cart,
        items: cart.items.map((item) => {
          if (cart.total.amountMinor === 0n) return { ...item, price: zeroMoney(currency) };
          const scaledMinor =
            (item.price.amountMinor * combo.residualCartTotal.amountMinor) / cart.total.amountMinor;
          return {
            ...item,
            price: { amountMinor: scaledMinor, currency },
          };
        }),
        subtotal: combo.residualCartTotal,
        total: combo.residualCartTotal,
      };

      for (const method of profile.paymentMethods) {
        const methodId =
          method.type === 'CREDIT_CARD' || method.type === 'DEBIT_CARD'
            ? method.card.id
            : method.type;

        let rewardValue = zeroMoney(currency);
        let futureBenefit = zeroMoney(currency);
        const amountToPay = residualCart.total;

        if (
          amountToPay.amountMinor > 0n &&
          (method.type === 'CREDIT_CARD' || method.type === 'DEBIT_CARD')
        ) {
          const card = method.card;
          let maxReward = zeroMoney(currency);

          for (const rule of card.rewardRules) {
            const rewardPoints = evaluateCardReward(
              residualCart,
              rule,
              card.exclusions,
              card.userState?.monthlySpendToDate
            );
            const valReward = valueReward(rewardPoints, card.rewardProgram, valuations);
            if (valReward.amountMinor > maxReward.amountMinor) {
              maxReward = valReward;
            }
          }
          rewardValue = maxReward;

          if (method.type === 'CREDIT_CARD' && method.card.milestoneRules) {
            for (const milestone of method.card.milestoneRules) {
              const contrib = calculateMilestoneContribution(
                amountToPay,
                milestone,
                method.card.userState?.annualSpendToDate || zeroMoney(currency)
              );
              const valMilestone = valueReward(contrib, card.rewardProgram, valuations);
              futureBenefit = addMoney(futureBenefit, valMilestone);
            }
          }
        }

        const fees = calculatePaymentFees(amountToPay, method);
        const immediateDiscount = addMoney(combo.voucherSavings, combo.partnerSavings);

        // Effective cost: total cart - immediate discount - reward value - future benefit + fees
        const benefitSum = addMoney(addMoney(immediateDiscount, rewardValue), futureBenefit);
        const effectiveCost =
          compareMoney(cart.total, benefitSum) > 0
            ? addMoney(subtractMoney(cart.total, benefitSum), fees)
            : fees;

        const totalBenefit =
          compareMoney(benefitSum, fees) > 0
            ? subtractMoney(benefitSum, fees)
            : zeroMoney(currency);

        // Build recipe steps
        const recipeSteps: StrategyRecipeStep[] = [...combo.recipeSteps];
        let stepNum = recipeSteps.length + 1;

        if (amountToPay.amountMinor > 0n) {
          const methodName =
            method.type === 'CREDIT_CARD'
              ? `${method.card.issuer} ${method.card.productName}`
              : method.type === 'DEBIT_CARD'
                ? `${method.card.issuer} Debit Card`
                : method.type;

          recipeSteps.push({
            stepNumber: stepNum++,
            phase: 'AT_PAYMENT',
            actionType: 'INSTANT_DISCOUNT',
            benefitSourceId: methodId,
            benefitSourceName: methodName,
            description: `Pay remaining ${amountToPay.amountMinor / 100n}.${amountToPay.amountMinor % 100n} with ${methodName}`,
            amountApplied: amountToPay,
            savingsGenerated: zeroMoney(currency),
            instructions: `Select ${methodName} at payment gateway`,
          });
        }

        if (rewardValue.amountMinor > 0n) {
          const card =
            method.type === 'CREDIT_CARD' || method.type === 'DEBIT_CARD' ? method.card : null;
          recipeSteps.push({
            stepNumber: stepNum++,
            phase: 'POST_PAYMENT',
            actionType: 'REWARD_POINTS',
            benefitSourceId: methodId,
            benefitSourceName: card ? card.rewardProgram : 'Rewards',
            description: `Earn ~${rewardValue.amountMinor / 100n} in rewards value`,
            amountApplied: amountToPay,
            savingsGenerated: rewardValue,
            instructions: `Points will reflect in your ${card?.rewardProgram || 'rewards'} account`,
          });
        }

        // Calculate Opportunity Score
        const scoreResult = this.opportunityScorer.calculateScore(
          {
            immediateSavings: immediateDiscount,
            rewardValue,
            appliedVouchers: combo.vouchersApplied,
            isPartnerPromoApplied: !!combo.partnerBenefitApplied,
            complexityStepsCount: recipeSteps.length,
            now,
          },
          profile.optimizationPreferences
        );

        const urgencyBonus: Money = {
          amountMinor: BigInt(Math.round(scoreResult.urgencyPremiumVal * 100)),
          currency,
        };

        const paymentSteps: PaymentStep[] = [
          {
            type: 'MERCHANT_PAYMENT',
            amount: amountToPay,
            paymentMethod: method,
            description: `Pay remaining spend with ${methodId}`,
          },
        ];

        strategies.push({
          id: `unified-${methodId}-${combo.vouchersApplied.map((v) => v.id).join('_') || 'no_voucher'}-${combo.partnerBenefitApplied?.id || 'no_partner'}-${strategies.length}`,
          steps: paymentSteps,
          recipeSteps,
          voucherSavings: combo.voucherSavings,
          partnerSavings: combo.partnerSavings,
          cardSavings: rewardValue,
          immediateDiscount,
          rewardValue,
          futureBenefit,
          fees,
          effectiveCost,
          totalBenefit,
          opportunityScore: scoreResult.score,
          urgencyBonus,
          confidence: 1.0,
          complexityScore: recipeSteps.length,
        });
      }
    }

    // Sort by Opportunity Score descending
    return strategies.sort((a, b) => b.opportunityScore - a.opportunityScore);
  }
}
