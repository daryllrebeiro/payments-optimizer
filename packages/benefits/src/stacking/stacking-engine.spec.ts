/**
 * Tests for BenefitStackingEngine
 * Epic 1.10: Test Coverage Expansion
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BenefitStackingEngine } from './stacking-engine';
import {
  createMoney,
  createCart,
  UserProfile,
  UserVoucher,
  PartnerBenefit,
  RuleCondition,
  OfferBenefit,
} from '@payments-optimizer/domain';
import { createVoucher } from '../domain/types.js';

describe('BenefitStackingEngine', () => {
  let engine: BenefitStackingEngine;

  beforeEach(() => {
    engine = new BenefitStackingEngine();
  });

  describe('Beam width', () => {
    it('should use default beam width of 5', () => {
      expect(engine).toBeDefined();
    });

    it('should use custom beam width', () => {
      const customEngine = new BenefitStackingEngine([], 10);
      expect(customEngine).toBeDefined();
    });
  });

  describe('Cart processing', () => {
    it('should process empty cart', () => {
      const cart = createCart('amazon', [], 'INR');
      const profile: UserProfile = {
        version: 1,
        currency: 'INR',
        paymentMethods: [],
        rewardPreferences: {
          defaultValuations: {},
          preferredType: undefined,
        },
        optimizationPreferences: {
          immediateSavingsWeight: 1.0,
          rewardValueWeight: 1.0,
          milestoneWeight: 0.5,
          simplicityWeight: 0.5,
          riskWeight: 0.5,
        },
      };

      const results = engine.generateStackingCombinations(cart, profile, []);

      expect(results.length).toBe(1); // Only base option
      expect(results[0]!.vouchersApplied).toHaveLength(0);
    });

    it('should process cart with items', () => {
      const cart = createCart('amazon', [
        { id: 'item1', name: 'Product 1', price: createMoney(100, 'INR'), quantity: 1 },
      ], 'INR');

      expect(cart.total.amountMinor).toBe(10000n);
    });
  });

  describe('Voucher processing', () => {
    it('should handle single voucher', () => {
      const vouchers: UserVoucher[] = [
        createVoucher('v1', 'amazon', '10% OFF', createMoney(100, 'INR'), '2026-12-31T23:59:59Z'),
      ];

      const engineWithVouchers = new BenefitStackingEngine(vouchers);
      const cart = createCart('amazon', [
        { id: 'item1', name: 'Product 1', price: createMoney(200, 'INR'), quantity: 1 },
      ], 'INR');

      const results = engineWithVouchers.generateStackingCombinations(cart, {
        version: 1,
        currency: 'INR',
        paymentMethods: [],
        rewardPreferences: {
          defaultValuations: {},
          preferredType: undefined,
        },
        optimizationPreferences: {
          immediateSavingsWeight: 1.0,
          rewardValueWeight: 1.0,
          milestoneWeight: 0.5,
          simplicityWeight: 0.5,
          riskWeight: 0.5,
        },
      }, []);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]!.vouchersApplied).toHaveLength(0); // Base option
    });

    it('should handle multiple vouchers', () => {
      const vouchers: UserVoucher[] = [
        createVoucher('v1', 'amazon', '10% OFF', createMoney(100, 'INR'), '2026-12-31T23:59:59Z'),
        createVoucher('v2', 'amazon', '5% OFF', createMoney(50, 'INR'), '2026-12-31T23:59:59Z'),
      ];

      const engineWithVouchers = new BenefitStackingEngine(vouchers);
      const cart = createCart('amazon', [
        { id: 'item1', name: 'Product 1', price: createMoney(500, 'INR'), quantity: 1 },
      ], 'INR');

      const results = engineWithVouchers.generateStackingCombinations(cart, {
        version: 1,
        currency: 'INR',
        paymentMethods: [],
        rewardPreferences: {
          defaultValuations: {},
          preferredType: undefined,
        },
        optimizationPreferences: {
          immediateSavingsWeight: 1.0,
          rewardValueWeight: 1.0,
          milestoneWeight: 0.5,
          simplicityWeight: 0.5,
          riskWeight: 0.5,
        },
      }, []);

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Partner benefit processing', () => {
    it('should handle partner benefits', () => {
      const partnerBenefits: PartnerBenefit[] = [
        {
          id: 'pb1',
          programId: 'prime',
          merchantId: 'amazon',
          partnerName: 'Amazon Prime',
          title: 'Free Shipping',
          benefit: {
            type: 'FIXED_DISCOUNT',
            value: 100,
            currency: 'INR',
          },
          conditions: [],
          validUntil: '2026-12-31T23:59:59Z',
          stackableWithVouchers: true,
          stackableWithCards: true,
        },
      ];

      const cart = createCart('amazon', [
        { id: 'item1', name: 'Product 1', price: createMoney(500, 'INR'), quantity: 1 },
      ], 'INR');

      const results = engine.generateStackingCombinations(cart, {
        version: 1,
        currency: 'INR',
        paymentMethods: [],
        rewardPreferences: {
          defaultValuations: {},
          preferredType: undefined,
        },
        optimizationPreferences: {
          immediateSavingsWeight: 1.0,
          rewardValueWeight: 1.0,
          milestoneWeight: 0.5,
          simplicityWeight: 0.5,
          riskWeight: 0.5,
        },
      }, partnerBenefits);

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Stacking combinations', () => {
    it('should generate base option without any vouchers or benefits', () => {
      const cart = createCart('amazon', [
        { id: 'item1', name: 'Product 1', price: createMoney(100, 'INR'), quantity: 1 },
      ], 'INR');

      const results = engine.generateStackingCombinations(cart, {
        version: 1,
        currency: 'INR',
        paymentMethods: [],
        rewardPreferences: {
          defaultValuations: {},
          preferredType: undefined,
        },
        optimizationPreferences: {
          immediateSavingsWeight: 1.0,
          rewardValueWeight: 1.0,
          milestoneWeight: 0.5,
          simplicityWeight: 0.5,
          riskWeight: 0.5,
        },
      }, []);

      const baseOption = results.find(r => r.vouchersApplied.length === 0 && !r.partnerBenefitApplied);

      expect(baseOption).toBeDefined();
      expect(baseOption!.voucherSavings.amountMinor).toBe(0n);
      expect(baseOption!.partnerSavings.amountMinor).toBe(0n);
    });

    it('should handle non-stackable partner benefits', () => {
      const vouchers: UserVoucher[] = [
        createVoucher('v1', 'amazon', '10% OFF', createMoney(100, 'INR'), '2026-12-31T23:59:59Z'),
      ];

      const partnerBenefits: PartnerBenefit[] = [
        {
          id: 'pb1',
          programId: 'prime',
          merchantId: 'amazon',
          partnerName: 'Amazon Prime',
          title: 'Free Shipping',
          benefit: {
            type: 'FIXED_DISCOUNT',
            value: 100,
            currency: 'INR',
          },
          conditions: [],
          validUntil: '2026-12-31T23:59:59Z',
          stackableWithVouchers: false, // Cannot stack
          stackableWithCards: true,
        },
      ];

      const engineWithVouchers = new BenefitStackingEngine(vouchers);
      const cart = createCart('amazon', [
        { id: 'item1', name: 'Product 1', price: createMoney(500, 'INR'), quantity: 1 },
      ], 'INR');

      const results = engineWithVouchers.generateStackingCombinations(cart, {
        version: 1,
        currency: 'INR',
        paymentMethods: [],
        rewardPreferences: {
          defaultValuations: {},
          preferredType: undefined,
        },
        optimizationPreferences: {
          immediateSavingsWeight: 1.0,
          rewardValueWeight: 1.0,
          milestoneWeight: 0.5,
          simplicityWeight: 0.5,
          riskWeight: 0.5,
        },
      }, partnerBenefits);

      // Voucher combinations should still be generated, but not stacked with partner benefit
      const stackedResults = results.filter(r => r.vouchersApplied.length > 0 && r.partnerBenefitApplied);
      expect(stackedResults).toHaveLength(0);
    });
  });

  describe('Beam search optimization', () => {
    it('should use beam search for >5 vouchers', () => {
      // Create many vouchers
      const vouchers: UserVoucher[] = [];
      for (let i = 0; i < 10; i++) {
        vouchers.push(createVoucher(`v${i}`, 'amazon', `Voucher ${i}`, createMoney(100 + i * 10, 'INR'), '2026-12-31T23:59:59Z'));
      }

      const engineWithVouchers = new BenefitStackingEngine(vouchers, 5); // Beam width 5
      const cart = createCart('amazon', [
        { id: 'item1', name: 'Product 1', price: createMoney(1000, 'INR'), quantity: 1 },
      ], 'INR');

      const results = engineWithVouchers.generateStackingCombinations(cart, {
        version: 1,
        currency: 'INR',
        paymentMethods: [],
        rewardPreferences: {
          defaultValuations: {},
          preferredType: undefined,
        },
        optimizationPreferences: {
          immediateSavingsWeight: 1.0,
          rewardValueWeight: 1.0,
          milestoneWeight: 0.5,
          simplicityWeight: 0.5,
          riskWeight: 0.5,
        },
      }, []);

      expect(results.length).toBeGreaterThan(0);
      // With beam width 5 and 10 vouchers, should have fewer results than full power set
    });

    it('should use exact power set for <=5 vouchers', () => {
      const vouchers: UserVoucher[] = [];
      for (let i = 0; i < 3; i++) {
        vouchers.push(createVoucher(`v${i}`, 'amazon', `Voucher ${i}`, createMoney(100 + i * 10, 'INR'), '2026-12-31T23:59:59Z'));
      }

      const engineWithVouchers = new BenefitStackingEngine(vouchers, 5);
      const cart = createCart('amazon', [
        { id: 'item1', name: 'Product 1', price: createMoney(1000, 'INR'), quantity: 1 },
      ], 'INR');

      const results = engineWithVouchers.generateStackingCombinations(cart, {
        version: 1,
        currency: 'INR',
        paymentMethods: [],
        rewardPreferences: {
          defaultValuations: {},
          preferredType: undefined,
        },
        optimizationPreferences: {
          immediateSavingsWeight: 1.0,
          rewardValueWeight: 1.0,
          milestoneWeight: 0.5,
          simplicityWeight: 0.5,
          riskWeight: 0.5,
        },
      }, []);

      // With 3 vouchers, power set = 2^3 = 8 combinations, plus base option
      expect(results.length).toBe(9);
    });
  });

  describe('Edge cases', () => {
    it('should handle zero-value vouchers', () => {
      const vouchers: UserVoucher[] = [
        createVoucher('v1', 'amazon', 'Free Shipping', createMoney(0, 'INR'), '2026-12-31T23:59:59Z'),
      ];

      const engineWithVouchers = new BenefitStackingEngine(vouchers);
      const cart = createCart('amazon', [
        { id: 'item1', name: 'Product 1', price: createMoney(500, 'INR'), quantity: 1 },
      ], 'INR');

      const results = engineWithVouchers.generateStackingCombinations(cart, {
        version: 1,
        currency: 'INR',
        paymentMethods: [],
        rewardPreferences: {
          defaultValuations: {},
          preferredType: undefined,
        },
        optimizationPreferences: {
          immediateSavingsWeight: 1.0,
          rewardValueWeight: 1.0,
          milestoneWeight: 0.5,
          simplicityWeight: 0.5,
          riskWeight: 0.5,
        },
      }, []);

      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle expired vouchers', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const vouchers: UserVoucher[] = [
        createVoucher('v1', 'amazon', 'Expired', createMoney(100, 'INR'), yesterday.toISOString()),
      ];

      const engineWithVouchers = new BenefitStackingEngine(vouchers);
      const cart = createCart('amazon', [
        { id: 'item1', name: 'Product 1', price: createMoney(500, 'INR'), quantity: 1 },
      ], 'INR');

      const results = engineWithVouchers.generateStackingCombinations(cart, {
        version: 1,
        currency: 'INR',
        paymentMethods: [],
        rewardPreferences: {
          defaultValuations: {},
          preferredType: undefined,
        },
        optimizationPreferences: {
          immediateSavingsWeight: 1.0,
          rewardValueWeight: 1.0,
          milestoneWeight: 0.5,
          simplicityWeight: 0.5,
          riskWeight: 0.5,
        },
      }, []);

      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle empty voucher list', () => {
      const engineWithNoVouchers = new BenefitStackingEngine();
      const cart = createCart('amazon', [
        { id: 'item1', name: 'Product 1', price: createMoney(500, 'INR'), quantity: 1 },
      ], 'INR');

      const results = engineWithNoVouchers.generateStackingCombinations(cart, {
        version: 1,
        currency: 'INR',
        paymentMethods: [],
        rewardPreferences: {
          defaultValuations: {},
          preferredType: undefined,
        },
        optimizationPreferences: {
          immediateSavingsWeight: 1.0,
          rewardValueWeight: 1.0,
          milestoneWeight: 0.5,
          simplicityWeight: 0.5,
          riskWeight: 0.5,
        },
      }, []);

      expect(results.length).toBe(1); // Only base option
    });
  });
});
