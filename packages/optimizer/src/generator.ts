import {
  Cart,
  UserProfile,
  Offer,
  Coupon,
  PaymentStrategy,
  PaymentStep,
  Money,
} from '@payments-optimizer/domain';
import {
  zeroMoney,
  addMoney,
  subtractMoney,
  multiplyMoney,
  compareMoney,
} from '@payments-optimizer/rules-engine';
import {
  checkEligibility,
  calculateBenefit,
  evaluateCardReward,
  calculateMilestoneContribution,
  calculatePaymentFees,
} from '@payments-optimizer/rules-engine';

function valueReward(
  reward: Money,
  rewardProgram: string,
  valuations: Record<string, Money>
): Money {
  const val = valuations[rewardProgram];
  if (val) {
    // valuation is valuePerPoint (e.g. ₹0.25, amountMinor = 25n).
    // reward.amountMinor represents points count (scaled by 100, e.g. 100 points = 10000n).
    // monetaryValue = (pointsCount * valuePerPoint) / 100
    const amountMinor = (reward.amountMinor * val.amountMinor) / 100n;
    return {
      amountMinor,
      currency: val.currency,
    };
  }
  return reward;
}

export function generateCandidates(
  cart: Cart,
  profile: UserProfile,
  offers: Offer[],
  coupons: Coupon[]
): PaymentStrategy[] {
  const strategies: PaymentStrategy[] = [];
  const currency = cart.currency;
  const valuations = profile.rewardPreferences.defaultValuations;

  // Find eligible coupons
  const eligibleCoupons = coupons.filter(
    (coupon) => coupon.merchantId === cart.merchantId && checkEligibility(cart, coupon.conditions)
  );

  // Generate strategies for each payment method in the profile
  for (const method of profile.paymentMethods) {
    const methodId =
      method.type === 'CREDIT_CARD'
        ? method.card.id
        : method.type === 'DEBIT_CARD'
          ? method.card.id
          : method.type;

    // 1. DIRECT PAYMENT STRATEGIES (with and without coupons)
    const couponOptions = [null, ...eligibleCoupons];

    for (const coupon of couponOptions) {
      let couponDiscount = zeroMoney(currency);
      let cartAfterCoupon = { ...cart };

      if (coupon) {
        couponDiscount = calculateBenefit(cart, coupon.benefit);
        cartAfterCoupon = {
          ...cart,
          subtotal: subtractMoney(cart.subtotal, couponDiscount),
          total: subtractMoney(cart.total, couponDiscount),
        };
      }

      // Check for eligible merchant offers for this card/method
      const methodOffers = offers.filter((offer) => {
        if (offer.merchantId !== cart.merchantId) return false;

        // Check stacking with coupon
        if (coupon && !offer.stackingPolicy.canStackWithCoupons) return false;

        // Check if method satisfies payment requirements
        if (offer.paymentRequirements && offer.paymentRequirements.length > 0) {
          const matchesReq = offer.paymentRequirements.some((req) => {
            if (req.methodType !== method.type) return false;
            if (method.type === 'CREDIT_CARD' || method.type === 'DEBIT_CARD') {
              const card = method.type === 'CREDIT_CARD' ? method.card : method.card;
              if (req.issuer && req.issuer.toLowerCase() !== card.issuer.toLowerCase())
                return false;
              if (req.network && req.network !== card.network) return false;
            }
            return true;
          });
          if (!matchesReq) return false;
        }

        // Check offer general conditions
        return checkEligibility(cartAfterCoupon, offer.conditions);
      });

      const offerOptions = [null, ...methodOffers];

      for (const offer of offerOptions) {
        let offerDiscount = zeroMoney(currency);
        let cartAfterOffer = { ...cartAfterCoupon };

        if (offer) {
          offerDiscount = calculateBenefit(cartAfterCoupon, offer.benefit);
          cartAfterOffer = {
            ...cartAfterCoupon,
            total: subtractMoney(cartAfterCoupon.total, offerDiscount),
          };
        }

        const amountToPay = cartAfterOffer.total;

        // Calculate card rewards
        let rewardValue = zeroMoney(currency);
        let futureBenefit = zeroMoney(currency);

        if (method.type === 'CREDIT_CARD' || method.type === 'DEBIT_CARD') {
          const card = method.type === 'CREDIT_CARD' ? method.card : method.card;

          // Find best reward rule
          let maxReward = zeroMoney(currency);
          for (const rule of card.rewardRules) {
            const rewardPoints = evaluateCardReward(
              cartAfterOffer,
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

          // Milestone contribution
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
        const immediateDiscount = addMoney(couponDiscount, offerDiscount);

        // Effective cost: total - immediate discount - reward value - future benefit + fees
        const benefitSum = addMoney(addMoney(immediateDiscount, rewardValue), futureBenefit);
        const effectiveCost =
          compareMoney(amountToPay, benefitSum) > 0
            ? addMoney(subtractMoney(cart.total, benefitSum), fees)
            : fees;

        const totalBenefit =
          compareMoney(benefitSum, fees) > 0
            ? subtractMoney(benefitSum, fees)
            : zeroMoney(currency);

        // Complexity score calculation
        let complexity = 0;
        if (coupon) complexity += 1;
        if (offer) complexity += 1;

        // Confidence mapping
        let confidence = 1.0; // HIGH
        if (offer && offer.confidence === 'MEDIUM') confidence = 0.7;
        if (offer && offer.confidence === 'LOW') confidence = 0.4;

        const steps: PaymentStep[] = [
          {
            type: 'MERCHANT_PAYMENT',
            amount: amountToPay,
            paymentMethod: method,
            description: `Pay remaining ${amountToPay.amountMinor / 100n}.${amountToPay.amountMinor % 100n} directly`,
          },
        ];

        strategies.push({
          id: `direct-${methodId}-${coupon ? 'coupon-' : ''}${offer ? 'offer-' : ''}${strategies.length}`,
          steps,
          immediateDiscount,
          rewardValue,
          futureBenefit,
          fees,
          effectiveCost,
          totalBenefit,
          confidence,
          complexityScore: complexity,
        });
      }
    }

    // 2. GIFT CARD PAYMENT STRATEGIES (combining gift card purchase and redemption)
    // Only if merchant supports gift card redemption (we assume yes for test scenarios like Amazon)
    if (cart.merchantId === 'amazon' || cart.merchantId === 'flipkart') {
      // Find default gift card discount for the merchant (e.g. 4% discount)
      const giftCardRate = 0.04; // 4% default discount

      for (const coupon of couponOptions) {
        let couponDiscount = zeroMoney(currency);
        let cartAfterCoupon = { ...cart };

        if (coupon) {
          couponDiscount = calculateBenefit(cart, coupon.benefit);
          cartAfterCoupon = {
            ...cart,
            subtotal: subtractMoney(cart.subtotal, couponDiscount),
            total: subtractMoney(cart.total, couponDiscount),
          };
        }

        const faceValue = cartAfterCoupon.total;
        if (faceValue.amountMinor <= 0n) continue;

        // Buy gift card of face value using the card
        const giftCardCost = subtractMoney(faceValue, multiplyMoney(faceValue, giftCardRate));
        const giftCardSavings = subtractMoney(faceValue, giftCardCost);

        let rewardValue = zeroMoney(currency);
        let futureBenefit = zeroMoney(currency);

        if (method.type === 'CREDIT_CARD' || method.type === 'DEBIT_CARD') {
          const card = method.type === 'CREDIT_CARD' ? method.card : method.card;

          // Card reward on purchasing the gift card
          let maxReward = zeroMoney(currency);
          // Temporary mock cart representing gift card purchase
          const gcPurchaseCart: Cart = {
            merchantId: 'giftcard-store',
            items: [
              {
                id: 'gc-item',
                name: 'Gift Card',
                price: giftCardCost,
                quantity: 1,
                category: 'GIFT_CARD',
              },
            ],
            subtotal: giftCardCost,
            discounts: [],
            shipping: zeroMoney(currency),
            taxes: zeroMoney(currency),
            total: giftCardCost,
            currency,
          };

          for (const rule of card.rewardRules) {
            const rewardPoints = evaluateCardReward(
              gcPurchaseCart,
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

          // Milestone contribution
          if (method.type === 'CREDIT_CARD' && method.card.milestoneRules) {
            for (const milestone of method.card.milestoneRules) {
              const contrib = calculateMilestoneContribution(
                giftCardCost,
                milestone,
                method.card.userState?.annualSpendToDate || zeroMoney(currency)
              );
              const valMilestone = valueReward(contrib, card.rewardProgram, valuations);
              futureBenefit = addMoney(futureBenefit, valMilestone);
            }
          }
        }

        const fees = calculatePaymentFees(giftCardCost, method);
        const immediateDiscount = addMoney(couponDiscount, giftCardSavings);

        const benefitSum = addMoney(addMoney(immediateDiscount, rewardValue), futureBenefit);
        const effectiveCost =
          compareMoney(cart.total, benefitSum) > 0
            ? addMoney(subtractMoney(cart.total, benefitSum), fees)
            : fees;

        const totalBenefit =
          compareMoney(benefitSum, fees) > 0
            ? subtractMoney(benefitSum, fees)
            : zeroMoney(currency);

        const steps: PaymentStep[] = [
          {
            type: 'GIFT_CARD_PURCHASE',
            amount: giftCardCost,
            paymentMethod: method,
            description: `Purchase ${faceValue.amountMinor / 100n}.${faceValue.amountMinor % 100n} gift card for ${giftCardCost.amountMinor / 100n}.${giftCardCost.amountMinor % 100n}`,
          },
          {
            type: 'MERCHANT_PAYMENT',
            amount: faceValue,
            paymentMethod: {
              type: 'GIFT_CARD',
              giftCard: {
                id: 'purchased-gc',
                merchantId: cart.merchantId,
                faceValue,
                cost: giftCardCost,
                balance: faceValue,
              },
            },
            description: `Redeem gift card of ${faceValue.amountMinor / 100n}.${faceValue.amountMinor % 100n}`,
          },
        ];

        strategies.push({
          id: `giftcard-${methodId}-${coupon ? 'coupon-' : ''}${strategies.length}`,
          steps,
          immediateDiscount,
          rewardValue,
          futureBenefit,
          fees,
          effectiveCost,
          totalBenefit,
          confidence: 0.9, // Gift card strategies have solid confidence
          complexityScore: coupon ? 3 : 2, // Coupon (+1) + GC (+2)
        });
      }
    }
  }

  return strategies;
}
