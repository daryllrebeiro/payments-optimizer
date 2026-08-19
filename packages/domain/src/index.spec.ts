import { describe, it, expect } from 'vitest';
import { Money, UserProfile, Cart } from './index.js';

describe('domain type validations', () => {
  it('should instantiate Money correctly with bigint', () => {
    const cash: Money = {
      amountMinor: 10050n,
      currency: 'INR',
    };
    expect(cash.amountMinor).toBe(10050n);
    expect(cash.currency).toBe('INR');
  });

  it('should support UserProfile structural integrity', () => {
    const profile: UserProfile = {
      version: 1,
      currency: 'USD',
      paymentMethods: [
        {
          type: 'WALLET',
          wallet: {
            name: 'Amazon Pay',
            balance: { amountMinor: 2500n, currency: 'USD' },
          },
        },
      ],
      rewardPreferences: {
        defaultValuations: {
          'amazon-rewards': { amountMinor: 1n, currency: 'USD' },
        },
      },
      optimizationPreferences: {
        immediateSavingsWeight: 1.0,
        rewardValueWeight: 0.5,
        milestoneWeight: 0.2,
        simplicityWeight: 0.1,
        riskWeight: 0.0,
      },
    };

    expect(profile.version).toBe(1);
    expect(profile.currency).toBe('USD');
    expect(profile.paymentMethods[0]?.type).toBe('WALLET');
  });

  it('should support Cart model types', () => {
    const cart: Cart = {
      merchantId: 'amazon',
      items: [
        { id: '1', name: 'Book', price: { amountMinor: 500n, currency: 'INR' }, quantity: 2 },
      ],
      subtotal: { amountMinor: 1000n, currency: 'INR' },
      discounts: [],
      shipping: { amountMinor: 0n, currency: 'INR' },
      taxes: { amountMinor: 50n, currency: 'INR' },
      total: { amountMinor: 1050n, currency: 'INR' },
      currency: 'INR',
    };
    expect(cart.total.amountMinor).toBe(1050n);
  });
});
