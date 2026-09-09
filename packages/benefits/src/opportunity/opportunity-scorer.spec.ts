/**
 * Tests for OpportunityScorer
 * Epic 1.10: Test Coverage Expansion
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { OpportunityScorer } from './opportunity-scorer.js';

describe('OpportunityScorer', () => {
  let scorer: OpportunityScorer;

  const defaultPrefs = {
    immediateSavingsWeight: 1.0,
    rewardValueWeight: 1.0,
    milestoneWeight: 0.5,
    simplicityWeight: 0.5,
    riskWeight: 0.5,
    urgencyWeight: 1.0,
  };

  beforeEach(() => {
    scorer = new OpportunityScorer();
  });

  describe('Basic scoring', () => {
    it('should calculate score with only immediate savings', () => {
      const input = {
        immediateSavings: { amountMinor: 1000n, currency: 'INR' as const },
        rewardValue: { amountMinor: 0n, currency: 'INR' as const },
        appliedVouchers: [],
        isPartnerPromoApplied: false,
        complexityStepsCount: 0,
      };

      const result = scorer.calculateScore(input, defaultPrefs);

      expect(result.score).toBeGreaterThan(0);
      expect(result.immediateSavingsVal).toBe(10);
    });

    it('should calculate score with only reward value', () => {
      const input = {
        immediateSavings: { amountMinor: 0n, currency: 'INR' as const },
        rewardValue: { amountMinor: 5000n, currency: 'INR' as const },
        appliedVouchers: [],
        isPartnerPromoApplied: false,
        complexityStepsCount: 0,
      };

      const result = scorer.calculateScore(input, defaultPrefs);

      expect(result.score).toBeGreaterThan(0);
      expect(result.rewardValueVal).toBe(50);
    });

    it('should combine immediate savings and reward value', () => {
      const input = {
        immediateSavings: { amountMinor: 1000n, currency: 'INR' as const },
        rewardValue: { amountMinor: 2000n, currency: 'INR' as const },
        appliedVouchers: [],
        isPartnerPromoApplied: false,
        complexityStepsCount: 0,
      };

      const result = scorer.calculateScore(input, defaultPrefs);

      expect(result.score).toBeGreaterThan(0);
    });
  });

  describe('Urgency premium', () => {
    const baseNow = new Date('2026-09-07T00:00:00.000Z').getTime();
    const HOUR_MS = 60 * 60 * 1000;
    const DAY_MS = 24 * HOUR_MS;

    it('should add high urgency premium for vouchers expiring within 24 hours', () => {
      const input = {
        immediateSavings: { amountMinor: 1000n, currency: 'INR' as const },
        rewardValue: { amountMinor: 0n, currency: 'INR' as const },
        appliedVouchers: [{ expiryDate: new Date(baseNow + 12 * HOUR_MS).toISOString() }],
        isPartnerPromoApplied: false,
        complexityStepsCount: 0,
        now: baseNow,
      };

      const result = scorer.calculateScore(input, defaultPrefs);

      expect(result.urgencyPremiumVal).toBe(200);
    });

    it('should add medium urgency premium for vouchers expiring within 3 days', () => {
      const input = {
        immediateSavings: { amountMinor: 1000n, currency: 'INR' as const },
        rewardValue: { amountMinor: 0n, currency: 'INR' as const },
        appliedVouchers: [{ expiryDate: new Date(baseNow + 2 * DAY_MS).toISOString() }],
        isPartnerPromoApplied: false,
        complexityStepsCount: 0,
        now: baseNow,
      };

      const result = scorer.calculateScore(input, defaultPrefs);

      expect(result.urgencyPremiumVal).toBe(150);
    });

    it('should add low urgency premium for vouchers expiring within 7 days', () => {
      const input = {
        immediateSavings: { amountMinor: 1000n, currency: 'INR' as const },
        rewardValue: { amountMinor: 0n, currency: 'INR' as const },
        appliedVouchers: [{ expiryDate: new Date(baseNow + 5 * DAY_MS).toISOString() }],
        isPartnerPromoApplied: false,
        complexityStepsCount: 0,
        now: baseNow,
      };

      const result = scorer.calculateScore(input, defaultPrefs);

      expect(result.urgencyPremiumVal).toBe(50);
    });

    it('should not add urgency premium for vouchers expiring after 7 days', () => {
      const input = {
        immediateSavings: { amountMinor: 1000n, currency: 'INR' as const },
        rewardValue: { amountMinor: 0n, currency: 'INR' as const },
        appliedVouchers: [{ expiryDate: new Date(baseNow + 30 * DAY_MS).toISOString() }],
        isPartnerPromoApplied: false,
        complexityStepsCount: 0,
        now: baseNow,
      };

      const result = scorer.calculateScore(input, defaultPrefs);

      expect(result.urgencyPremiumVal).toBe(0);
    });
  });

  describe('Membership value', () => {
    it('should add membership value when partner promo is applied', () => {
      const input = {
        immediateSavings: { amountMinor: 1000n, currency: 'INR' as const },
        rewardValue: { amountMinor: 0n, currency: 'INR' as const },
        appliedVouchers: [],
        isPartnerPromoApplied: true,
        complexityStepsCount: 0,
      };

      const result = scorer.calculateScore(input, defaultPrefs);

      expect(result.membershipValueVal).toBe(50);
    });
  });

  describe('Opportunity cost', () => {
    it('should calculate opportunity cost for long-expiry vouchers', () => {
      const baseNow = new Date('2026-09-07T00:00:00.000Z').getTime();
      const in30Days = new Date(baseNow + 30 * 24 * 60 * 60 * 1000);

      const input = {
        immediateSavings: { amountMinor: 1000n, currency: 'INR' as const },
        rewardValue: { amountMinor: 0n, currency: 'INR' as const },
        appliedVouchers: [{ expiryDate: in30Days.toISOString() }],
        isPartnerPromoApplied: false,
        alternativeCardPromoSavings: { amountMinor: 2000n, currency: 'INR' as const },
        complexityStepsCount: 0,
        now: baseNow,
      };

      const result = scorer.calculateScore(input, defaultPrefs);

      expect(result.opportunityCostVal).toBeGreaterThan(0);
    });
  });

  describe('Complexity penalty', () => {
    it('should apply complexity penalty for each step', () => {
      const input = {
        immediateSavings: { amountMinor: 1000n, currency: 'INR' as const },
        rewardValue: { amountMinor: 0n, currency: 'INR' as const },
        appliedVouchers: [],
        isPartnerPromoApplied: false,
        complexityStepsCount: 10,
      };

      const result = scorer.calculateScore(input, defaultPrefs);

      expect(result.complexityPenaltyVal).toBe(250);
    });
  });

  describe('Score composition', () => {
    it('should produce positive score with good inputs', () => {
      const input = {
        immediateSavings: { amountMinor: 10000n, currency: 'INR' as const },
        rewardValue: { amountMinor: 5000n, currency: 'INR' as const },
        appliedVouchers: [],
        isPartnerPromoApplied: true,
        complexityStepsCount: 0,
      };

      const result = scorer.calculateScore(input, defaultPrefs);

      expect(result.score).toBeGreaterThan(0);
    });

    it('should reduce score for complexity', () => {
      const input = {
        immediateSavings: { amountMinor: 10000n, currency: 'INR' as const },
        rewardValue: { amountMinor: 0n, currency: 'INR' as const },
        appliedVouchers: [],
        isPartnerPromoApplied: false,
        complexityStepsCount: 20,
      };

      const result = scorer.calculateScore(input, defaultPrefs);

      expect(result.score).toBeLessThan(100);
    });
  });

  describe('Edge cases', () => {
    it('should handle zero values', () => {
      const input = {
        immediateSavings: { amountMinor: 0n, currency: 'INR' as const },
        rewardValue: { amountMinor: 0n, currency: 'INR' as const },
        appliedVouchers: [],
        isPartnerPromoApplied: false,
        complexityStepsCount: 0,
      };

      const result = scorer.calculateScore(input, defaultPrefs);

      expect(result.score).toBe(0);
    });

    it('should handle very large amounts', () => {
      const input = {
        immediateSavings: { amountMinor: 100000000n, currency: 'INR' as const },
        rewardValue: { amountMinor: 50000000n, currency: 'INR' as const },
        appliedVouchers: [],
        isPartnerPromoApplied: false,
        complexityStepsCount: 0,
      };

      const result = scorer.calculateScore(input, defaultPrefs);

      expect(result.score).toBeGreaterThan(0);
    });

    it('should use custom time if provided', () => {
      const fixedTime = new Date('2026-09-07T12:00:00Z').getTime();
      const tomorrow = new Date('2026-09-08T12:00:00Z');

      const input = {
        immediateSavings: { amountMinor: 1000n, currency: 'INR' as const },
        rewardValue: { amountMinor: 0n, currency: 'INR' as const },
        appliedVouchers: [{ expiryDate: tomorrow.toISOString() }],
        isPartnerPromoApplied: false,
        complexityStepsCount: 0,
        now: fixedTime,
      };

      const result = scorer.calculateScore(input, defaultPrefs);

      expect(result.urgencyPremiumVal).toBe(200);
    });
  });
});
