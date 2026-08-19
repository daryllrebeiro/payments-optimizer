import {
  Money,
  Cart,
  OfferBenefit,
  RewardRule,
  MilestoneRule,
  PaymentMethod,
  RuleCondition,
  Decimal,
} from '@payments-optimizer/domain';
import { zeroMoney, multiplyMoney, minMoney } from './arithmetic.js';

export function checkEligibility(
  cart: Cart,
  conditions: RuleCondition[],
  contextDate?: string
): boolean {
  for (const cond of conditions) {
    if (cond.type === 'MINIMUM_SPEND') {
      const minSpend = cond.value as Money;
      if (cart.currency !== minSpend.currency) return false;
      if (cart.subtotal.amountMinor < minSpend.amountMinor) return false;
    }
    if (cond.type === 'MERCHANT_ELIGIBILITY') {
      const merchants = Array.isArray(cond.value) ? cond.value : [cond.value as string];
      if (!merchants.includes(cart.merchantId)) return false;
    }
    if (cond.type === 'MCC_ELIGIBILITY') {
      const allowedCategories = Array.isArray(cond.value) ? cond.value : [cond.value as string];
      const hasMatchingItem = cart.items.some(
        (item) => item.category && allowedCategories.includes(item.category)
      );
      if (!hasMatchingItem) return false;
    }
    if (cond.type === 'EXPIRY') {
      if (contextDate && typeof cond.value === 'string') {
        if (new Date(contextDate) > new Date(cond.value)) return false;
      }
    }
  }
  return true;
}

export function calculateBenefit(cart: Cart, benefit: OfferBenefit): Money {
  const currency = cart.currency;
  if (benefit.type === 'PERCENTAGE_DISCOUNT') {
    const rate = benefit.value as Decimal;
    const rawDiscount = multiplyMoney(cart.subtotal, rate);
    if (benefit.cap) {
      if (benefit.cap.currency !== currency) {
        throw new Error('Currency mismatch in benefit cap');
      }
      return minMoney(rawDiscount, benefit.cap);
    }
    return rawDiscount;
  }

  if (benefit.type === 'FIXED_DISCOUNT') {
    const discountAmount = benefit.value as Money;
    if (discountAmount.currency !== currency) {
      throw new Error('Currency mismatch in fixed discount');
    }
    return minMoney(discountAmount, cart.subtotal);
  }

  if (benefit.type === 'CASHBACK') {
    const rate = benefit.value as Decimal;
    const rawCashback = multiplyMoney(cart.total, rate);
    if (benefit.cap) {
      if (benefit.cap.currency !== currency) {
        throw new Error('Currency mismatch in benefit cap');
      }
      return minMoney(rawCashback, benefit.cap);
    }
    return rawCashback;
  }

  if (benefit.type === 'POINTS') {
    const rate = benefit.value as Decimal;
    const rawPointsValue = multiplyMoney(cart.total, rate);
    if (benefit.cap) {
      if (benefit.cap.currency !== currency) {
        throw new Error('Currency mismatch in benefit cap');
      }
      return minMoney(rawPointsValue, benefit.cap);
    }
    return rawPointsValue;
  }

  return zeroMoney(currency);
}

export function evaluateCardReward(
  cart: Cart,
  rule: RewardRule,
  exclusions?: string[],
  currentSpentInPeriod?: Money
): Money {
  const currency = cart.currency;

  if (rule.minimumSpend) {
    if (rule.minimumSpend.currency !== currency) return zeroMoney(currency);
    if (cart.total.amountMinor < rule.minimumSpend.amountMinor) return zeroMoney(currency);
  }

  if (rule.merchantIds && rule.merchantIds.length > 0) {
    if (!rule.merchantIds.includes(cart.merchantId)) return zeroMoney(currency);
  }

  if (rule.conditions && rule.conditions.length > 0) {
    if (!checkEligibility(cart, rule.conditions)) return zeroMoney(currency);
  }

  let eligibleSpendMinor = 0n;
  for (const item of cart.items) {
    if (exclusions && item.category && exclusions.includes(item.category)) {
      continue;
    }

    if (rule.category && rule.category.length > 0) {
      if (!item.category || !rule.category.includes(item.category)) {
        continue;
      }
    }

    eligibleSpendMinor += item.price.amountMinor * BigInt(item.quantity);
  }

  const eligibleSpend: Money = {
    amountMinor: eligibleSpendMinor,
    currency,
  };

  const rawReward = multiplyMoney(eligibleSpend, rule.rate);

  if (rule.maximumReward) {
    if (rule.maximumReward.currency !== currency) {
      throw new Error('Currency mismatch in maximum reward cap');
    }

    if (currentSpentInPeriod) {
      if (currentSpentInPeriod.currency !== currency) {
        throw new Error('Currency mismatch in current spent');
      }
      const remainingCap = rule.maximumReward.amountMinor - currentSpentInPeriod.amountMinor;
      const remainingCapMoney: Money = {
        amountMinor: remainingCap < 0n ? 0n : remainingCap,
        currency,
      };
      return minMoney(rawReward, remainingCapMoney);
    }

    return minMoney(rawReward, rule.maximumReward);
  }

  return rawReward;
}

export function calculateMilestoneContribution(
  spend: Money,
  rule: MilestoneRule,
  annualSpendToDate: Money
): Money {
  if (
    annualSpendToDate.currency !== spend.currency ||
    rule.targetSpend.currency !== spend.currency ||
    rule.reward.currency !== spend.currency
  ) {
    throw new Error('Currency mismatch in milestone calculation');
  }

  if (annualSpendToDate.amountMinor >= rule.targetSpend.amountMinor) {
    return zeroMoney(spend.currency);
  }

  if (annualSpendToDate.amountMinor + spend.amountMinor >= rule.targetSpend.amountMinor) {
    return rule.reward;
  }

  const contribution = (spend.amountMinor * rule.reward.amountMinor) / rule.targetSpend.amountMinor;
  return {
    amountMinor: contribution,
    currency: spend.currency,
  };
}

export function calculatePaymentFees(amount: Money, _method: PaymentMethod): Money {
  const currency = amount.currency;
  // By default, no convenience fees are applied
  return zeroMoney(currency);
}
