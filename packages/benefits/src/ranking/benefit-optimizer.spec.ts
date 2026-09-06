import { describe, it, expect } from 'vitest';
import { UnifiedBenefitOptimizer } from './benefit-optimizer.js';
import type { Cart, UserProfile } from '@payments-optimizer/domain';
import { sbiCashbackCard, hdfcMillenniaCard } from '@payments-optimizer/test-fixtures';

describe('UnifiedBenefitOptimizer - Snapshot Testing', () => {
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
    ],
    vouchers: [],
    rewardPreferences: {
      defaultValuations: {
        'sbi-cashback': { amountMinor: 100n, currency: 'INR' },
        'hdfc-rewards': { amountMinor: 25n, currency: 'INR' },
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

  const sampleCart: Cart = {
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

  it('should match snapshot for optimization results', () => {
    const optimizer = new UnifiedBenefitOptimizer();
    const strategies = optimizer.optimize(sampleCart, mockProfile);

    expect(strategies).toHaveLength(4);
    expect(strategies[0]).toMatchInlineSnapshot(`
      Object {
        "cardSavings": Object {
          "amountMinor": 22500n,
          "currency": "INR",
        },
        "complexityScore": 3,
        "confidence": 1,
        "effectiveCost": Object {
          "amountMinor": 427500n,
          "currency": "INR",
        },
        "fees": Object {
          "amountMinor": 0n,
          "currency": "INR",
        },
        "futureBenefit": Object {
          "amountMinor": 0n,
          "currency": "INR",
        },
        "id": "unified-sbi-cashback-no_voucher-accor-myntra-partner-2",
        "immediateDiscount": Object {
          "amountMinor": 50000n,
          "currency": "INR",
        },
        "opportunityScore": 771.25,
        "partnerSavings": Object {
          "amountMinor": 50000n,
          "currency": "INR",
        },
        "recipeSteps": Array [
          Object {
            "actionType": "PARTNER_OFFER",
            "amountApplied": Object {
              "amountMinor": 500000n,
              "currency": "INR",
            },
            "benefitSourceId": "accor-myntra-partner",
            "benefitSourceName": "Myntra",
            "description": "Activate Accor ALL Member Perk at Myntra",
            "instructions": "Ensure your Myntra / accor-all membership is linked",
            "phase": "BEFORE_PAYMENT",
            "savingsGenerated": Object {
              "amountMinor": 50000n,
              "currency": "INR",
            },
            "stepNumber": 1,
          },
          Object {
            "actionType": "INSTANT_DISCOUNT",
            "amountApplied": Object {
              "amountMinor": 450000n,
              "currency": "INR",
            },
            "benefitSourceId": "sbi-cashback",
            "benefitSourceName": "SBI Cashback Card",
            "description": "Pay remaining 4500.0 with SBI Cashback Card",
            "instructions": "Select SBI Cashback Card at payment gateway",
            "phase": "AT_PAYMENT",
            "savingsGenerated": Object {
              "amountMinor": 0n,
              "currency": "INR",
            },
            "stepNumber": 2,
          },
          Object {
            "actionType": "REWARD_POINTS",
            "amountApplied": Object {
              "amountMinor": 450000n,
              "currency": "INR",
            },
            "benefitSourceId": "sbi-cashback",
            "benefitSourceName": "SBI Cashback Program",
            "description": "Earn ~225 in rewards value",
            "instructions": "Points will reflect in your SBI Cashback Program account",
            "phase": "POST_PAYMENT",
            "savingsGenerated": Object {
              "amountMinor": 22500n,
              "currency": "INR",
            },
            "stepNumber": 3,
          },
        ],
        "rewardValue": Object {
          "amountMinor": 22500n,
          "currency": "INR",
        },
        "steps": Array [
          Object {
            "amount": Object {
              "amountMinor": 450000n,
              "currency": "INR",
            },
            "description": "Pay remaining spend with sbi-cashback",
            "paymentMethod": Object {
              "card": Object {
                "annualFee": Object {
                  "amountMinor": 99900n,
                  "currency": "INR",
                },
                "id": "sbi-cashback",
                "issuer": "SBI",
                "network": "VISA",
                "productName": "Cashback Card",
                "rewardProgram": "SBI Cashback Program",
                "rewardRules": Array [
                  Object {
                    "id": "sbi-cashback-online",
                    "maximumReward": Object {
                      "amountMinor": 500000n,
                      "currency": "INR",
                    },
                    "period": "MONTHLY",
                    "rate": 0.05,
                    "rewardType": "CASHBACK",
                  },
                ],
                "userState": Object {
                  "annualSpendToDate": Object {
                    "amountMinor": 2000000n,
                    "currency": "INR",
                  },
                  "currentStatementSpend": Object {
                    "amountMinor": 0n,
                    "currency": "INR",
                  },
                  "isAvailable": true,
                  "monthlySpendToDate": Object {
                    "amountMinor": 0n,
                    "currency": "INR",
                  },
                },
              },
              "type": "CREDIT_CARD",
            },
            "type": "MERCHANT_PAYMENT",
          },
        ],
        "totalBenefit": Object {
          "amountMinor": 72500n,
          "currency": "INR",
        },
        "urgencyBonus": Object {
          "amountMinor": 0n,
          "currency": "INR",
        },
        "voucherSavings": Object {
          "amountMinor": 0n,
          "currency": "INR",
        },
      }
    `);
  });
});
