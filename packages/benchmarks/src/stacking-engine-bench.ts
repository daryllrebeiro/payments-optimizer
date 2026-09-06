/**
 * Benchmarks for BenefitStackingEngine beam search implementation
 * Tests performance with varying voucher counts (Epic 1.1)
 */

import type { BenchmarkOptions } from './benchmark-harness.js';
import { BenefitStackingEngine } from '@payments-optimizer/benefits';
import type { Cart, UserProfile } from '@payments-optimizer/domain';
import type { UserVoucher } from '@payments-optimizer/benefits';

function generateVouchers(count: number, merchantId: string): UserVoucher[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `voucher-${i + 1}`,
    merchantId,
    title: `Test Voucher ₹${(i + 1) * 100}`,
    code: `V${i + 1}`,
    initialValue: { amountMinor: BigInt((i + 1) * 10000), currency: 'INR' },
    remainingValue: { amountMinor: BigInt((i + 1) * 10000), currency: 'INR' },
    expiryDate: new Date(Date.now() + (30 - i) * 24 * 60 * 60 * 1000).toISOString(),
    singleUse: false,
  }));
}

const baseCart: Cart = {
  merchantId: 'test-merchant',
  items: [
    {
      id: 'item-1',
      name: 'Test Product',
      price: { amountMinor: 1000000n, currency: 'INR' }, // ₹10,000
      quantity: 1,
      category: 'GENERAL',
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

export function createStackingEngineBenchmarks() {
  const benchmarks: Array<{ name: string; fn: () => void }> = [];

  // Baseline: 5 vouchers (exact power set)
  benchmarks.push({
    name: 'StackingEngine: 5 vouchers - Exact power set',
    fn: () => {
      const vouchers = generateVouchers(5, 'test-merchant');
      const engine = new BenefitStackingEngine(vouchers);
      engine.generateStackingCombinations(baseCart, mockProfile, []);
    },
  });

  // Stress test: 10 vouchers with beam search
  benchmarks.push({
    name: 'StackingEngine: 10 vouchers - Beam search (width=5)',
    fn: () => {
      const vouchers = generateVouchers(10, 'test-merchant');
      const engine = new BenefitStackingEngine(vouchers);
      engine.generateStackingCombinations(baseCart, mockProfile, []);
    },
  });

  // Critical: 20 vouchers (the P0 performance requirement)
  benchmarks.push({
    name: 'StackingEngine: 20 vouchers - Beam search (width=5) [P95 < 100ms target]',
    fn: () => {
      const vouchers = generateVouchers(20, 'test-merchant');
      const engine = new BenefitStackingEngine(vouchers);
      engine.generateStackingCombinations(baseCart, mockProfile, []);
    },
  });

  // Beam width comparison
  benchmarks.push({
    name: 'StackingEngine: 20 vouchers - Narrow beam (width=2)',
    fn: () => {
      const vouchers = generateVouchers(20, 'test-merchant');
      const engine = new BenefitStackingEngine(vouchers, 2);
      engine.generateStackingCombinations(baseCart, mockProfile, []);
    },
  });

  benchmarks.push({
    name: 'StackingEngine: 20 vouchers - Wide beam (width=10)',
    fn: () => {
      const vouchers = generateVouchers(20, 'test-merchant');
      const engine = new BenefitStackingEngine(vouchers, 10);
      engine.generateStackingCombinations(baseCart, mockProfile, []);
    },
  });

  // Extreme: 50 vouchers
  benchmarks.push({
    name: 'StackingEngine: 50 vouchers - Beam search (width=5)',
    fn: () => {
      const vouchers = generateVouchers(50, 'test-merchant');
      const engine = new BenefitStackingEngine(vouchers);
      engine.generateStackingCombinations(baseCart, mockProfile, []);
    },
  });

  return benchmarks;
}
