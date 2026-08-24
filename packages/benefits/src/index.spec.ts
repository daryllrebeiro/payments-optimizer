import { describe, it, expect } from 'vitest';
import {
  PublicBenefitCatalog,
  VoucherInventoryManager,
  BenefitStackingEngine,
  UnifiedBenefitOptimizer,
  ProactiveAlertsEngine,
} from './index.js';
import { Cart, UserProfile } from '@payments-optimizer/domain';
import { sbiCashbackCard, hdfcMillenniaCard } from '@payments-optimizer/test-fixtures';

describe('Benefits & Membership Intelligence Subsystem', () => {
  const mockProfile: UserProfile = {
    version: 1,
    currency: 'INR',
    paymentMethods: [
      { type: 'CREDIT_CARD', card: sbiCashbackCard },
      { type: 'CREDIT_CARD', card: hdfcMillenniaCard },
    ],
    memberships: [
      {
        id: 'mem-accor-1',
        programId: 'accor-all',
        programName: 'Accor ALL',
        tier: 'Platinum',
      },
      {
        id: 'mem-prime-1',
        programId: 'amazon-prime',
        programName: 'Amazon Prime',
        tier: 'Prime',
      },
    ],
    vouchers: [
      {
        id: 'myntra-voucher-500',
        merchantId: 'myntra',
        title: 'Myntra ₹500 Gift Voucher',
        code: 'MYN500GIFT',
        initialValue: { amountMinor: 50000n, currency: 'INR' },
        remainingValue: { amountMinor: 50000n, currency: 'INR' },
        expiryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days left
        singleUse: false,
      },
    ],
    rewardPreferences: {
      defaultValuations: {
        'sbi-cashback': { amountMinor: 100n, currency: 'INR' }, // 1 pt = ₹1
        'hdfc-rewards': { amountMinor: 25n, currency: 'INR' }, // 1 pt = ₹0.25
      },
    },
    optimizationPreferences: {
      immediateSavingsWeight: 1,
      rewardValueWeight: 1,
      milestoneWeight: 0,
      simplicityWeight: 0.5,
      riskWeight: 0,
      urgencyWeight: 1.0,
    },
  };

  const sampleMyntraCart: Cart = {
    merchantId: 'myntra',
    items: [
      {
        id: 'item-1',
        name: 'Running Shoes',
        price: { amountMinor: 500000n, currency: 'INR' }, // ₹5,000
        quantity: 1,
        category: 'FOOTWEAR',
      },
    ],
    subtotal: { amountMinor: 500000n, currency: 'INR' },
    discounts: [],
    shipping: { amountMinor: 0n, currency: 'INR' },
    taxes: { amountMinor: 0n, currency: 'INR' },
    total: { amountMinor: 500000n, currency: 'INR' },
    currency: 'INR',
  };

  describe('Phase 11 & 14: BenefitGraph and Public Catalog', () => {
    it('should traverse DAG to find partner perks for active memberships', () => {
      const catalog = new PublicBenefitCatalog();
      const userPrograms = ['accor-all'];
      const benefits = catalog.getBenefitsForMerchant('myntra', userPrograms);

      expect(benefits.length).toBe(1);
      expect(benefits[0]?.id).toBe('accor-myntra-partner');
      expect(benefits[0]?.partnerName).toBe('Myntra');
    });

    it('should return empty list if user does not hold the required membership', () => {
      const catalog = new PublicBenefitCatalog();
      const userPrograms = ['unrelated-program'];
      const benefits = catalog.getBenefitsForMerchant('myntra', userPrograms);

      expect(benefits.length).toBe(0);
    });
  });

  describe('Phase 13: Voucher Inventory Manager', () => {
    it('should filter eligible vouchers and handle partial & full burn', () => {
      const manager = new VoucherInventoryManager(mockProfile.vouchers);
      const eligible = manager.getEligibleVouchers(sampleMyntraCart);
      expect(eligible.length).toBe(1);
      expect(eligible[0]?.id).toBe('myntra-voucher-500');

      // Burn ₹500 voucher on ₹5,000 cart
      const burnResult = manager.applyVoucher(eligible[0]!, sampleMyntraCart.total);
      expect(burnResult.amountBurned.amountMinor).toBe(50000n); // ₹500
      expect(burnResult.remainingCartTotal.amountMinor).toBe(450000n); // ₹4,500
      expect(burnResult.voucherResidualBalance.amountMinor).toBe(0n);
    });

    it('should detect vouchers expiring soon', () => {
      const manager = new VoucherInventoryManager(mockProfile.vouchers);
      const expiring = manager.getExpiringSoon(3);
      expect(expiring.length).toBe(1);
      expect(expiring[0]?.daysLeft).toBeLessThanOrEqual(2);
    });
  });

  describe('Phase 15 & 16: Benefit Stacking & Multi-Step Combinations', () => {
    it('should generate valid stacking combinations (Voucher + Partner Perk)', () => {
      const catalog = new PublicBenefitCatalog();
      const partnerBenefits = catalog.getBenefitsForMerchant('myntra', ['accor-all']);

      const stackingEngine = new BenefitStackingEngine(mockProfile.vouchers);
      const combos = stackingEngine.generateStackingCombinations(
        sampleMyntraCart,
        mockProfile,
        partnerBenefits
      );

      // We expect: Base, Voucher Only, Partner Only, and Stacked (Voucher + Partner)
      expect(combos.length).toBeGreaterThanOrEqual(4);

      const stackedCombo = combos.find(
        (c) => c.vouchersApplied.length > 0 && c.partnerBenefitApplied !== undefined
      );
      expect(stackedCombo).toBeDefined();
      if (stackedCombo) {
        expect(stackedCombo.voucherSavings.amountMinor).toBe(50000n); // ₹500
        // 10% of ₹4,500 = ₹450
        expect(stackedCombo.partnerSavings.amountMinor).toBe(45000n);
        // Residual: ₹5,000 - ₹500 - ₹450 = ₹4,050
        expect(stackedCombo.residualCartTotal.amountMinor).toBe(405000n);
        expect(stackedCombo.recipeSteps.length).toBe(2);
      }
    });
  });

  describe('Phase 17 & 18: Unified Optimizer & Opportunity Scoring', () => {
    it('should produce complete multi-step strategy with recipe and opportunity score', () => {
      const optimizer = new UnifiedBenefitOptimizer();
      const strategies = optimizer.optimize(sampleMyntraCart, mockProfile);

      expect(strategies.length).toBeGreaterThan(0);
      const topStrategy = strategies[0]!;

      // Top strategy should be the stacked voucher + partner + SBI Cashback card
      expect(topStrategy.recipeSteps.length).toBeGreaterThanOrEqual(3);
      expect(topStrategy.voucherSavings.amountMinor).toBe(50000n); // ₹500
      expect(topStrategy.partnerSavings.amountMinor).toBe(45000n); // ₹450
      // SBI Cashback 5% on ₹4,050 = ₹202.50 (20250 minor units)
      expect(topStrategy.cardSavings.amountMinor).toBe(20250n);

      // Total benefit: 500 + 450 + 202.50 = 1152.50
      expect(topStrategy.totalBenefit.amountMinor).toBe(115250n);
      // Effective cost: 5000 - 1152.50 = 3847.50
      expect(topStrategy.effectiveCost.amountMinor).toBe(384750n);
      expect(topStrategy.opportunityScore).toBeGreaterThan(0);
      expect(topStrategy.urgencyBonus.amountMinor).toBeGreaterThan(0n);
    });
  });

  describe('Phase 19: Proactive Merchant Alerts', () => {
    it('should generate active partner alerts and expiring voucher alerts', () => {
      const alertsEngine = new ProactiveAlertsEngine();
      const alerts = alertsEngine.generateAlerts('myntra', mockProfile, sampleMyntraCart);

      expect(alerts.length).toBeGreaterThanOrEqual(2);
      const partnerAlert = alerts.find((a) => a.type === 'PARTNER_BENEFIT');
      const expiringAlert = alerts.find((a) => a.type === 'EXPIRING_VOUCHER');

      expect(partnerAlert).toBeDefined();
      expect(partnerAlert?.title).toContain('partner perk');
      expect(expiringAlert).toBeDefined();
      expect(expiringAlert?.title).toContain('expires');
    });
  });
});
