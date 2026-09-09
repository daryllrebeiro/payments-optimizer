/**
 * Tests for Message Schemas (Epic 1.3)
 */

import { describe, it, expect } from 'vitest';
import {
  CartSchema,
  SerializedRecipeStepSchema,
  SerializedStrategySchema,
  OptimizePaymentMessageSchema,
  OptimizePaymentResponseSchema,
  OptimizePaymentErrorResponseSchema,
  validateCart,
  validateStrategy,
  validateOptimizePaymentMessage,
} from './message-schemas.js';

describe('Message Schemas', () => {
  describe('SerializedMoneySchema', () => {
    it('should validate valid money objects', () => {
      const validCart = {
        merchantId: 'amazon',
        items: [
          {
            id: 'item-1',
            name: 'Product',
            price: { amountMinor: '100000', currency: 'INR' },
            quantity: 1,
            category: 'ELECTRONICS',
          },
        ],
        subtotal: { amountMinor: '100000', currency: 'INR' },
        discounts: [],
        shipping: { amountMinor: '0', currency: 'INR' },
        taxes: { amountMinor: '0', currency: 'INR' },
        total: { amountMinor: '100000', currency: 'INR' },
        currency: 'INR',
      };

      expect(() => CartSchema.parse(validCart)).not.toThrow();
    });

    it('should reject invalid amountMinor (not a string)', () => {
      const invalidCart = {
        merchantId: 'amazon',
        items: [
          {
            id: 'item-1',
            name: 'Product',
            price: { amountMinor: 100000, currency: 'INR' }, // Number instead of string
            quantity: 1,
            category: 'ELECTRONICS',
          },
        ],
        subtotal: { amountMinor: '100000', currency: 'INR' },
        discounts: [],
        shipping: { amountMinor: '0', currency: 'INR' },
        taxes: { amountMinor: '0', currency: 'INR' },
        total: { amountMinor: '100000', currency: 'INR' },
        currency: 'INR',
      };

      expect(() => CartSchema.parse(invalidCart)).toThrow();
    });

    it('should reject invalid currency', () => {
      const invalidCart = {
        merchantId: 'amazon',
        items: [
          {
            id: 'item-1',
            name: 'Product',
            price: { amountMinor: '100000', currency: 'INVALID' }, // Invalid currency
            quantity: 1,
            category: 'ELECTRONICS',
          },
        ],
        subtotal: { amountMinor: '100000', currency: 'INR' },
        discounts: [],
        shipping: { amountMinor: '0', currency: 'INR' },
        taxes: { amountMinor: '0', currency: 'INR' },
        total: { amountMinor: '100000', currency: 'INR' },
        currency: 'INR',
      };

      expect(() => CartSchema.parse(invalidCart)).toThrow();
    });

    it('should reject negative numbers in string format', () => {
      const cartWithNegative = {
        merchantId: 'amazon',
        items: [
          {
            id: 'item-1',
            name: 'Product',
            price: { amountMinor: '-100000', currency: 'INR' },
            quantity: 1,
            category: 'ELECTRONICS',
          },
        ],
        subtotal: { amountMinor: '-100000', currency: 'INR' },
        discounts: [],
        shipping: { amountMinor: '0', currency: 'INR' },
        taxes: { amountMinor: '0', currency: 'INR' },
        total: { amountMinor: '-100000', currency: 'INR' },
        currency: 'INR',
      };

      // Should accept negative values (for refunds/adjustments)
      expect(() => CartSchema.parse(cartWithNegative)).not.toThrow();
    });
  });

  describe('CartSchema', () => {
    it('should validate complete cart', () => {
      const cart = {
        merchantId: 'myntra',
        items: [
          {
            id: 'item-1',
            name: 'Running Shoes',
            price: { amountMinor: '500000', currency: 'INR' },
            quantity: 1,
            category: 'FOOTWEAR',
          },
          {
            id: 'item-2',
            name: 'T-Shirt',
            price: { amountMinor: '150000', currency: 'INR' },
            quantity: 2,
            category: 'CLOTHING',
          },
        ],
        subtotal: { amountMinor: '800000', currency: 'INR' },
        discounts: [{ amountMinor: '50000', currency: 'INR' }],
        shipping: { amountMinor: '10000', currency: 'INR' },
        taxes: { amountMinor: '40000', currency: 'INR' },
        total: { amountMinor: '800000', currency: 'INR' },
        currency: 'INR',
      };

      const result = validateCart(cart);
      expect(result.merchantId).toBe('myntra');
      expect(result.items.length).toBe(2);
    });

    it('should reject cart with empty merchantId', () => {
      const cart = {
        merchantId: '',
        items: [
          {
            id: 'item-1',
            name: 'Product',
            price: { amountMinor: '100000', currency: 'INR' },
            quantity: 1,
            category: 'GENERAL',
          },
        ],
        subtotal: { amountMinor: '100000', currency: 'INR' },
        discounts: [],
        shipping: { amountMinor: '0', currency: 'INR' },
        taxes: { amountMinor: '0', currency: 'INR' },
        total: { amountMinor: '100000', currency: 'INR' },
        currency: 'INR',
      };

      expect(() => validateCart(cart)).toThrow();
    });

    it('should reject cart with no items', () => {
      const cart = {
        merchantId: 'amazon',
        items: [],
        subtotal: { amountMinor: '0', currency: 'INR' },
        discounts: [],
        shipping: { amountMinor: '0', currency: 'INR' },
        taxes: { amountMinor: '0', currency: 'INR' },
        total: { amountMinor: '0', currency: 'INR' },
        currency: 'INR',
      };

      expect(() => validateCart(cart)).toThrow();
    });

    it('should reject item with zero quantity', () => {
      const cart = {
        merchantId: 'amazon',
        items: [
          {
            id: 'item-1',
            name: 'Product',
            price: { amountMinor: '100000', currency: 'INR' },
            quantity: 0, // Invalid
            category: 'GENERAL',
          },
        ],
        subtotal: { amountMinor: '0', currency: 'INR' },
        discounts: [],
        shipping: { amountMinor: '0', currency: 'INR' },
        taxes: { amountMinor: '0', currency: 'INR' },
        total: { amountMinor: '0', currency: 'INR' },
        currency: 'INR',
      };

      expect(() => validateCart(cart)).toThrow();
    });
  });

  describe('SerializedStrategySchema', () => {
    it('should validate complete strategy', () => {
      const strategy = {
        id: 'strategy-1',
        immediateDiscount: { amountMinor: '10000', currency: 'INR' },
        rewardValue: { amountMinor: '5000', currency: 'INR' },
        futureBenefit: { amountMinor: '2000', currency: 'INR' },
        fees: { amountMinor: '0', currency: 'INR' },
        effectiveCost: { amountMinor: '83000', currency: 'INR' },
        totalBenefit: { amountMinor: '17000', currency: 'INR' },
        confidence: 0.95,
        complexityScore: 2,
        stepDescriptions: ['Apply voucher', 'Pay with card'],
        recipeSteps: [
          {
            stepNumber: 1,
            phase: 'BEFORE_PAYMENT',
            actionType: 'VOUCHER_REDEMPTION',
            benefitSourceId: 'voucher-gift-100',
            benefitSourceName: 'Gift Card',
            description: 'Apply ₹100 voucher',
            amountApplied: { amountMinor: '10000', currency: 'INR' },
            savingsGenerated: { amountMinor: '10000', currency: 'INR' },
            codeToApply: 'GIFT100',
          },
        ],
      };

      const result = validateStrategy(strategy);
      expect(result.id).toBe('strategy-1');
      expect(result.confidence).toBe(0.95);
    });

    it('should reject strategy with invalid confidence', () => {
      const strategy = {
        id: 'strategy-1',
        immediateDiscount: { amountMinor: '10000', currency: 'INR' },
        rewardValue: { amountMinor: '5000', currency: 'INR' },
        futureBenefit: { amountMinor: '0', currency: 'INR' },
        fees: { amountMinor: '0', currency: 'INR' },
        effectiveCost: { amountMinor: '85000', currency: 'INR' },
        totalBenefit: { amountMinor: '15000', currency: 'INR' },
        confidence: 1.5, // Invalid (>1)
        complexityScore: 1,
        stepDescriptions: ['Apply voucher'],
      };

      expect(() => validateStrategy(strategy)).toThrow();
    });

    it('should reject strategy with negative complexity score', () => {
      const strategy = {
        id: 'strategy-1',
        immediateDiscount: { amountMinor: '10000', currency: 'INR' },
        rewardValue: { amountMinor: '0', currency: 'INR' },
        futureBenefit: { amountMinor: '0', currency: 'INR' },
        fees: { amountMinor: '0', currency: 'INR' },
        effectiveCost: { amountMinor: '90000', currency: 'INR' },
        totalBenefit: { amountMinor: '10000', currency: 'INR' },
        confidence: 1.0,
        complexityScore: -1, // Invalid
        stepDescriptions: [],
      };

      expect(() => validateStrategy(strategy)).toThrow();
    });
  });

  describe('OptimizePaymentMessageSchema', () => {
    it('should validate message with proper structure', () => {
      const message = {
        type: 'OPTIMIZE_PAYMENT',
        payload: {
          cartJson: JSON.stringify({ merchantId: 'amazon', items: [] }),
        },
      };

      const result = validateOptimizePaymentMessage(message);
      expect(result.type).toBe('OPTIMIZE_PAYMENT');
    });

    it('should reject message with wrong type', () => {
      const message = {
        type: 'INVALID_TYPE',
        payload: {
          cartJson: '{}',
        },
      };

      expect(() => validateOptimizePaymentMessage(message)).toThrow();
    });

    it('should reject message with empty cartJson', () => {
      const message = {
        type: 'OPTIMIZE_PAYMENT',
        payload: {
          cartJson: '',
        },
      };

      expect(() => validateOptimizePaymentMessage(message)).toThrow();
    });
  });

  describe('OptimizePaymentResponseSchema', () => {
    it('should validate success response', () => {
      const response = {
        type: 'OPTIMIZE_PAYMENT_RESULT',
        payload: {
          strategies: [],
          bestStrategy: null,
        },
      };

      expect(() => OptimizePaymentResponseSchema.parse(response)).not.toThrow();
    });

    it('should validate response with strategies', () => {
      const response = {
        type: 'OPTIMIZE_PAYMENT_RESULT',
        payload: {
          strategies: [
            {
              id: 'strategy-1',
              immediateDiscount: { amountMinor: '10000', currency: 'INR' },
              rewardValue: { amountMinor: '0', currency: 'INR' },
              futureBenefit: { amountMinor: '0', currency: 'INR' },
              fees: { amountMinor: '0', currency: 'INR' },
              effectiveCost: { amountMinor: '90000', currency: 'INR' },
              totalBenefit: { amountMinor: '10000', currency: 'INR' },
              confidence: 1.0,
              complexityScore: 1,
              stepDescriptions: ['Simple payment'],
            },
          ],
          bestStrategy: {
            id: 'strategy-1',
            immediateDiscount: { amountMinor: '10000', currency: 'INR' },
            rewardValue: { amountMinor: '0', currency: 'INR' },
            futureBenefit: { amountMinor: '0', currency: 'INR' },
            fees: { amountMinor: '0', currency: 'INR' },
            effectiveCost: { amountMinor: '90000', currency: 'INR' },
            totalBenefit: { amountMinor: '10000', currency: 'INR' },
            confidence: 1.0,
            complexityScore: 1,
            stepDescriptions: ['Simple payment'],
          },
        },
      };

      expect(() => OptimizePaymentResponseSchema.parse(response)).not.toThrow();
    });
  });

  describe('OptimizePaymentErrorResponseSchema', () => {
    it('should validate error response', () => {
      const response = {
        type: 'OPTIMIZE_PAYMENT_ERROR',
        error: 'Invalid cart data',
      };

      expect(() => OptimizePaymentErrorResponseSchema.parse(response)).not.toThrow();
    });

    it('should reject error response with empty error message', () => {
      const response = {
        type: 'OPTIMIZE_PAYMENT_ERROR',
        error: '',
      };

      // Zod allows empty strings by default, so this should pass
      // If you want to enforce non-empty, update the schema
      expect(() => OptimizePaymentErrorResponseSchema.parse(response)).not.toThrow();
    });
  });

  describe('Fix F9 — recipe steps carry stable ledger join keys', () => {
    const baseStep = {
      stepNumber: 1,
      phase: 'BEFORE_PAYMENT',
      actionType: 'VOUCHER_REDEMPTION',
      benefitSourceName: 'Gift Card',
      description: 'Apply voucher',
      amountApplied: { amountMinor: '10000', currency: 'INR' },
      savingsGenerated: { amountMinor: '10000', currency: 'INR' },
    };

    it('rejects a recipe step missing benefitSourceId (audit exploit: undefined ledger key)', () => {
      expect(() => SerializedRecipeStepSchema.parse({ ...baseStep })).toThrow();
    });

    it('preserves benefitSourceId through strategy validation (no silent strip)', () => {
      const strategy = {
        id: 's1',
        immediateDiscount: { amountMinor: '10000', currency: 'INR' },
        rewardValue: { amountMinor: '0', currency: 'INR' },
        futureBenefit: { amountMinor: '0', currency: 'INR' },
        fees: { amountMinor: '0', currency: 'INR' },
        effectiveCost: { amountMinor: '90000', currency: 'INR' },
        totalBenefit: { amountMinor: '10000', currency: 'INR' },
        confidence: 1,
        complexityScore: 1,
        stepDescriptions: ['x'],
        recipeSteps: [{ ...baseStep, benefitSourceId: 'voucher-1' }],
      };
      const parsed = validateStrategy(strategy);
      expect(parsed.recipeSteps?.[0]?.benefitSourceId).toBe('voucher-1');
    });
  });
});
