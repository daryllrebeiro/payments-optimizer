import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { addMoney, subtractMoney, multiplyMoney, compareMoney } from './arithmetic.js';
import {
  checkEligibility,
  calculateBenefit,
  evaluateCardReward,
  calculateMilestoneContribution,
  calculatePaymentFees,
} from './evaluator.js';
import {
  amazonCart,
  hdfcMillenniaCard,
  axisAtlasCard,
  amazonCoupon,
  hdfcInstantDiscountOffer,
} from '@payments-optimizer/test-fixtures';
import { Money, Cart, OfferBenefit } from '@payments-optimizer/domain';

describe('Rules Engine Math & Logic tests', () => {
  describe('BigInt Arithmetic Helpers', () => {
    it('should add money correctly', () => {
      const a: Money = { amountMinor: 100n, currency: 'INR' };
      const b: Money = { amountMinor: 50n, currency: 'INR' };
      expect(addMoney(a, b).amountMinor).toBe(150n);
    });

    it('should subtract money correctly', () => {
      const a: Money = { amountMinor: 100n, currency: 'INR' };
      const b: Money = { amountMinor: 40n, currency: 'INR' };
      expect(subtractMoney(a, b).amountMinor).toBe(60n);
    });

    it('should throw error on currency mismatch in addition', () => {
      const a: Money = { amountMinor: 100n, currency: 'INR' };
      const b: Money = { amountMinor: 40n, currency: 'USD' };
      expect(() => addMoney(a, b)).toThrow('Currency mismatch');
    });

    it('should multiply money by rate with decimal precision', () => {
      const a: Money = { amountMinor: 1000n, currency: 'INR' }; // ₹10.00
      expect(multiplyMoney(a, 0.05).amountMinor).toBe(50n); // 5% = ₹0.50 (50 paise)
      expect(multiplyMoney(a, 0.033333).amountMinor).toBe(33n); // 3.3333% = 33.333 paise (rounded to 33 paise)
    });

    it('should compare money correctly', () => {
      const a: Money = { amountMinor: 100n, currency: 'INR' };
      const b: Money = { amountMinor: 200n, currency: 'INR' };
      expect(compareMoney(a, b)).toBe(-1);
      expect(compareMoney(b, a)).toBe(1);
      expect(compareMoney(a, a)).toBe(0);
    });
  });

  describe('Evaluations & Rewards', () => {
    it('should verify coupon eligibility and calculate fixed discount', () => {
      expect(checkEligibility(amazonCart, amazonCoupon.conditions)).toBe(true);
      const discount = calculateBenefit(amazonCart, amazonCoupon.benefit);
      expect(discount.amountMinor).toBe(100000n); // ₹1,000
    });

    it('should calculate percentage discount and respect caps', () => {
      const discount = calculateBenefit(amazonCart, hdfcInstantDiscountOffer.benefit);
      expect(discount.amountMinor).toBe(150000n); // capped at ₹1,500
    });

    it('should evaluate card reward rules and respect exclusions', () => {
      const reward = evaluateCardReward(amazonCart, hdfcMillenniaCard.rewardRules[0]!);
      expect(reward.amountMinor).toBe(100000n); // Capped at ₹1,000
    });

    it('should respect spent history in card period caps', () => {
      const currentSpent: Money = { amountMinor: 80000n, currency: 'INR' }; // already earned ₹800 this month
      const reward = evaluateCardReward(
        amazonCart,
        hdfcMillenniaCard.rewardRules[0]!,
        [],
        currentSpent
      );
      expect(reward.amountMinor).toBe(20000n); // ₹200 remaining cap
    });

    it('should calculate milestone contribution (fractional & crossing)', () => {
      const spend: Money = { amountMinor: 3500000n, currency: 'INR' }; // ₹35,000
      const rule = axisAtlasCard.milestoneRules![0]!;
      const milestoneVal = calculateMilestoneContribution(
        spend,
        rule,
        axisAtlasCard.userState!.annualSpendToDate
      );
      expect(milestoneVal.amountMinor).toBe(500000n); // ₹5,000 fully unlocked

      const smallerSpend: Money = { amountMinor: 1000000n, currency: 'INR' }; // ₹10,000
      const fractionalVal = calculateMilestoneContribution(
        smallerSpend,
        rule,
        axisAtlasCard.userState!.annualSpendToDate
      );
      expect(fractionalVal.amountMinor).toBe(12500n); // ₹125 proportional progress
    });

    it('should calculate transaction fees as zero by default', () => {
      const fee = calculatePaymentFees(
        { amountMinor: 100n, currency: 'INR' },
        { type: 'CREDIT_CARD', card: hdfcMillenniaCard }
      );
      expect(fee.amountMinor).toBe(0n);
    });
  });

  describe('Property-based testing (Invariants)', () => {
    it('should always guarantee that discount amount is less than or equal to purchase subtotal', () => {
      fc.assert(
        fc.property(
          fc.bigInt({ min: 1n, max: 10000000n }),
          fc.double({ min: 0.0, max: 1.0 }),
          (subtotalMinor, rate) => {
            const cart: Cart = {
              merchantId: 'test',
              items: [],
              subtotal: { amountMinor: subtotalMinor, currency: 'INR' },
              discounts: [],
              shipping: { amountMinor: 0n, currency: 'INR' },
              taxes: { amountMinor: 0n, currency: 'INR' },
              total: { amountMinor: subtotalMinor, currency: 'INR' },
              currency: 'INR',
            };
            const benefit: OfferBenefit = {
              type: 'PERCENTAGE_DISCOUNT',
              value: rate,
            };
            const discount = calculateBenefit(cart, benefit);
            return discount.amountMinor <= subtotalMinor;
          }
        )
      );
    });
  });
});
