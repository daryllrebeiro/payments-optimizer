import { describe, it, expect, beforeEach } from 'vitest';
import { BenefitStackingEngine } from './stacking-engine.js';
import { Cart, UserProfile } from '@payments-optimizer/domain';
import { UserVoucher } from '../domain/types.js';

describe('BenefitStackingEngine - Beam Search', () => {
  const baseCart: Cart = {
    merchantId: 'amazon',
    items: [
      {
        id: 'item-1',
        name: 'Product 1',
        price: { amountMinor: 1000000n, currency: 'INR' }, // ₹10,000
        quantity: 1,
        category: 'ELECTRONICS',
      },
    ],
    subtotal: { amountMinor: 1000000n, currency: 'INR' },
    discounts: [],
    shipping: { amountMinor: 0n, currency: 'INR' },
    taxes: { amountMinor: 0n, currency: 'INR' },
    total: { amountMinor: 1000000n, currency: 'INR' },
    currency: 'INR',
  };

  const mockProfile: UserProfile = {
    version: 1,
    currency: 'INR',
    paymentMethods: [],
    memberships: [],
    vouchers: [],
    rewardPreferences: {
      defaultValuations: {},
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

  describe('Small voucher sets (≤5 vouchers) - Exact power set', () => {
    it('should handle zero vouchers', () => {
      const engine = new BenefitStackingEngine([]);
      const combos = engine.generateStackingCombinations(baseCart, mockProfile, []);

      // Only base option (no vouchers, no partner benefits)
      expect(combos.length).toBe(1);
      expect(combos[0]?.vouchersApplied.length).toBe(0);
      expect(combos[0]?.residualCartTotal.amountMinor).toBe(1000000n);
    });

    it('should handle single voucher', () => {
      const vouchers: UserVoucher[] = [
        {
          id: 'v1',
          merchantId: 'amazon',
          title: 'Voucher ₹500',
          code: 'V500',
          initialValue: { amountMinor: 50000n, currency: 'INR' },
          remainingValue: { amountMinor: 50000n, currency: 'INR' },
          expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          singleUse: false,
        },
      ];

      const engine = new BenefitStackingEngine(vouchers);
      const combos = engine.generateStackingCombinations(baseCart, mockProfile, []);

      // Base + Single voucher
      expect(combos.length).toBeGreaterThanOrEqual(2);

      const withVoucher = combos.find(c => c.vouchersApplied.length === 1);
      expect(withVoucher).toBeDefined();
      expect(withVoucher?.voucherSavings.amountMinor).toBe(50000n);
      expect(withVoucher?.residualCartTotal.amountMinor).toBe(950000n);
    });

    it('should combine multiple vouchers for small sets (≤5)', () => {
      const vouchers: UserVoucher[] = [
        {
          id: 'v1',
          merchantId: 'amazon',
          title: 'Voucher ₹500',
          code: 'V500',
          initialValue: { amountMinor: 50000n, currency: 'INR' },
          remainingValue: { amountMinor: 50000n, currency: 'INR' },
          expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          singleUse: false,
        },
        {
          id: 'v2',
          merchantId: 'amazon',
          title: 'Voucher ₹300',
          code: 'V300',
          initialValue: { amountMinor: 30000n, currency: 'INR' },
          remainingValue: { amountMinor: 30000n, currency: 'INR' },
          expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          singleUse: false,
        },
        {
          id: 'v3',
          merchantId: 'amazon',
          title: 'Voucher ₹200',
          code: 'V200',
          initialValue: { amountMinor: 20000n, currency: 'INR' },
          remainingValue: { amountMinor: 20000n, currency: 'INR' },
          expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          singleUse: false,
        },
      ];

      const engine = new BenefitStackingEngine(vouchers);
      const combos = engine.generateStackingCombinations(baseCart, mockProfile, []);

      // Should generate all combinations: base + 7 non-empty subsets (2^3 - 1)
      // = 1 base + 3 singles + 3 pairs + 1 triple = 8 combinations minimum
      expect(combos.length).toBeGreaterThanOrEqual(8);

      // Find the combination with all three vouchers
      const allThree = combos.find(c => c.vouchersApplied.length === 3);
      expect(allThree).toBeDefined();
      expect(allThree?.voucherSavings.amountMinor).toBe(100000n); // 500 + 300 + 200
      expect(allThree?.residualCartTotal.amountMinor).toBe(900000n); // 10,000 - 1,000
      expect(allThree?.recipeSteps.length).toBe(3);
    });

    it('should respect minimum spend conditions', () => {
      const vouchers: UserVoucher[] = [
        {
          id: 'v1',
          merchantId: 'amazon',
          title: 'Voucher ₹500 (min ₹2000)',
          code: 'V500',
          initialValue: { amountMinor: 50000n, currency: 'INR' },
          remainingValue: { amountMinor: 50000n, currency: 'INR' },
          expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          singleUse: false,
          minimumSpend: { amountMinor: 200000n, currency: 'INR' }, // ₹2,000
        },
      ];

      const smallCart: Cart = {
        ...baseCart,
        total: { amountMinor: 100000n, currency: 'INR' }, // ₹1,000
        subtotal: { amountMinor: 100000n, currency: 'INR' },
      };

      const engine = new BenefitStackingEngine(vouchers);
      const combos = engine.generateStackingCombinations(smallCart, mockProfile, []);

      // Only base option (voucher not eligible)
      const withVoucher = combos.find(c => c.vouchersApplied.length > 0);
      expect(withVoucher).toBeUndefined();
    });

    it('should filter out expired vouchers', () => {
      const vouchers: UserVoucher[] = [
        {
          id: 'v1',
          merchantId: 'amazon',
          title: 'Expired Voucher',
          code: 'VEXP',
          initialValue: { amountMinor: 50000n, currency: 'INR' },
          remainingValue: { amountMinor: 50000n, currency: 'INR' },
          expiryDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Expired yesterday
          singleUse: false,
        },
      ];

      const engine = new BenefitStackingEngine(vouchers);
      const combos = engine.generateStackingCombinations(baseCart, mockProfile, []);

      // Only base option (expired voucher filtered out)
      const withVoucher = combos.find(c => c.vouchersApplied.length > 0);
      expect(withVoucher).toBeUndefined();
    });
  });

  describe('Large voucher sets (>5 vouchers) - Beam search', () => {
    function generateVouchers(count: number): UserVoucher[] {
      return Array.from({ length: count }, (_, i) => ({
        id: `v${i + 1}`,
        merchantId: 'amazon',
        title: `Voucher ₹${(i + 1) * 100}`,
        code: `V${(i + 1) * 100}`,
        initialValue: { amountMinor: BigInt((i + 1) * 10000), currency: 'INR' },
        remainingValue: { amountMinor: BigInt((i + 1) * 10000), currency: 'INR' },
        expiryDate: new Date(Date.now() + (30 - i) * 24 * 60 * 60 * 1000).toISOString(),
        singleUse: false,
      }));
    }

    it('should use beam search for 20 vouchers and complete in reasonable time', () => {
      const vouchers = generateVouchers(20);
      const engine = new BenefitStackingEngine(vouchers, 5);

      const startTime = performance.now();
      const combos = engine.generateStackingCombinations(baseCart, mockProfile, []);
      const duration = performance.now() - startTime;

      // Should complete in <100ms (performance requirement)
      expect(duration).toBeLessThan(100);

      // Should produce results (base + beam candidates)
      expect(combos.length).toBeGreaterThan(1);

      // Should find at least one multi-voucher combination
      const multiVoucher = combos.find(c => c.vouchersApplied.length >= 2);
      expect(multiVoucher).toBeDefined();
    });

    it('should prioritize higher-value vouchers in beam search', () => {
      const vouchers = generateVouchers(10);
      const engine = new BenefitStackingEngine(vouchers, 3); // Small beam for testing

      const combos = engine.generateStackingCombinations(baseCart, mockProfile, []);

      // Find combinations with multiple vouchers
      const multiVoucherCombos = combos.filter(c => c.vouchersApplied.length >= 2);
      expect(multiVoucherCombos.length).toBeGreaterThan(0);

      // Highest-value voucher (v10 = ₹1000) should appear in top combinations
      const withHighestValue = multiVoucherCombos.some(c =>
        c.vouchersApplied.some(v => v.id === 'v10')
      );
      expect(withHighestValue).toBe(true);
    });

    it('should respect configurable beam width', () => {
      const vouchers = generateVouchers(10);

      // Narrow beam (should be faster, potentially less optimal)
      const narrowEngine = new BenefitStackingEngine(vouchers, 2);
      const narrowCombos = narrowEngine.generateStackingCombinations(baseCart, mockProfile, []);

      // Wide beam (should explore more)
      const wideEngine = new BenefitStackingEngine(vouchers, 10);
      const wideCombos = wideEngine.generateStackingCombinations(baseCart, mockProfile, []);

      // Both should produce results
      expect(narrowCombos.length).toBeGreaterThan(1);
      expect(wideCombos.length).toBeGreaterThan(1);

      // Wide beam should explore more or equal combinations
      expect(wideCombos.length).toBeGreaterThanOrEqual(narrowCombos.length);
    });

    it('should add urgency bonus for expiring vouchers', () => {
      const urgentVoucher: UserVoucher = {
        id: 'urgent',
        merchantId: 'amazon',
        title: 'Urgent Voucher ₹200',
        code: 'VURGENT',
        initialValue: { amountMinor: 20000n, currency: 'INR' },
        remainingValue: { amountMinor: 20000n, currency: 'INR' },
        expiryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days
        singleUse: false,
      };

      const normalVoucher: UserVoucher = {
        id: 'normal',
        merchantId: 'amazon',
        title: 'Normal Voucher ₹300',
        code: 'VNORMAL',
        initialValue: { amountMinor: 30000n, currency: 'INR' },
        remainingValue: { amountMinor: 30000n, currency: 'INR' },
        expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
        singleUse: false,
      };

      const vouchers = [...generateVouchers(8), urgentVoucher, normalVoucher];
      const engine = new BenefitStackingEngine(vouchers, 5);

      const combos = engine.generateStackingCombinations(baseCart, mockProfile, []);

      // Urgent voucher should appear in top combinations due to urgency bonus
      const withUrgent = combos.filter(c =>
        c.vouchersApplied.some(v => v.id === 'urgent')
      );
      expect(withUrgent.length).toBeGreaterThan(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle vouchers that fully cover the cart', () => {
      const vouchers: UserVoucher[] = [
        {
          id: 'large',
          merchantId: 'amazon',
          title: 'Large Voucher ₹15,000',
          code: 'VLARGE',
          initialValue: { amountMinor: 1500000n, currency: 'INR' },
          remainingValue: { amountMinor: 1500000n, currency: 'INR' },
          expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          singleUse: false,
        },
      ];

      const engine = new BenefitStackingEngine(vouchers);
      const combos = engine.generateStackingCombinations(baseCart, mockProfile, []);

      const withLarge = combos.find(c => c.vouchersApplied.length === 1);
      expect(withLarge).toBeDefined();
      expect(withLarge?.voucherSavings.amountMinor).toBe(1000000n); // Only cart total used
      expect(withLarge?.residualCartTotal.amountMinor).toBe(0n); // Fully covered
    });

    it('should handle all vouchers with zero remaining value', () => {
      const vouchers: UserVoucher[] = [
        {
          id: 'empty',
          merchantId: 'amazon',
          title: 'Empty Voucher',
          code: 'VEMPTY',
          initialValue: { amountMinor: 50000n, currency: 'INR' },
          remainingValue: { amountMinor: 0n, currency: 'INR' }, // Fully used
          expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          singleUse: false,
        },
      ];

      const engine = new BenefitStackingEngine(vouchers);
      const combos = engine.generateStackingCombinations(baseCart, mockProfile, []);

      // Only base option (no eligible vouchers)
      const withVoucher = combos.find(c => c.vouchersApplied.length > 0);
      expect(withVoucher).toBeUndefined();
    });

    it('should handle wrong merchant vouchers', () => {
      const vouchers: UserVoucher[] = [
        {
          id: 'flipkart',
          merchantId: 'flipkart', // Different merchant
          title: 'Flipkart Voucher',
          code: 'VFLIP',
          initialValue: { amountMinor: 50000n, currency: 'INR' },
          remainingValue: { amountMinor: 50000n, currency: 'INR' },
          expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          singleUse: false,
        },
      ];

      const engine = new BenefitStackingEngine(vouchers);
      const combos = engine.generateStackingCombinations(baseCart, mockProfile, []);

      // Only base option (wrong merchant)
      const withVoucher = combos.find(c => c.vouchersApplied.length > 0);
      expect(withVoucher).toBeUndefined();
    });
  });

  describe('Backward compatibility', () => {
    it('should maintain behavior compatibility with existing tests for ≤5 vouchers', () => {
      // This test ensures existing single-voucher behavior is preserved
      const vouchers: UserVoucher[] = [
        {
          id: 'myntra-voucher-500',
          merchantId: 'myntra',
          title: 'Myntra ₹500 Gift Voucher',
          code: 'MYN500GIFT',
          initialValue: { amountMinor: 50000n, currency: 'INR' },
          remainingValue: { amountMinor: 50000n, currency: 'INR' },
          expiryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          singleUse: false,
        },
      ];

      const myntraCart: Cart = {
        merchantId: 'myntra',
        items: [
          {
            id: 'item-1',
            name: 'Running Shoes',
            price: { amountMinor: 500000n, currency: 'INR' },
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

      const engine = new BenefitStackingEngine(vouchers);
      const combos = engine.generateStackingCombinations(myntraCart, mockProfile, []);

      // Should have base + single voucher options
      expect(combos.length).toBeGreaterThanOrEqual(2);

      const withVoucher = combos.find(c => c.vouchersApplied.length === 1);
      expect(withVoucher).toBeDefined();
      expect(withVoucher?.voucherSavings.amountMinor).toBe(50000n);
      expect(withVoucher?.residualCartTotal.amountMinor).toBe(450000n);
    });
  });
});
