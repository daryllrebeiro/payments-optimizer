import { describe, it, expect } from 'vitest';
import { PublicDataManager } from './index.js';
import { ZodError } from 'zod';

const VALID_BUNDLE = {
  schemaVersion: 1,
  dataVersion: '2026.08.19.1',
  createdAt: '2026-08-19T10:00:00Z',
  checksum: 'abc123checksum',
  cards: [
    {
      id: 'hdfc-millennia',
      issuer: 'HDFC',
      productName: 'Millennia',
      network: 'MASTERCARD',
      rewardProgram: 'HDFC Millennia Points',
      annualFee: { amountMinor: 100000, currency: 'INR' }, // coerced to bigint
      rewardRules: [
        {
          id: 'hdfc-millennia-amazon',
          rewardType: 'POINTS',
          rate: 0.05,
          merchantIds: ['amazon'],
          maximumReward: { amountMinor: '100000', currency: 'INR' }, // string coerced to bigint
        },
      ],
      userState: {
        isAvailable: true,
        currentStatementSpend: { amountMinor: 0, currency: 'INR' },
        annualSpendToDate: { amountMinor: 0, currency: 'INR' },
        monthlySpendToDate: { amountMinor: 0, currency: 'INR' },
      },
    },
  ],
  offers: [
    {
      id: 'offer-hdfc-instant',
      merchantId: 'amazon',
      title: 'HDFC Instant Discount',
      validFrom: '2026-08-01T00:00:00Z',
      validUntil: '2026-08-31T23:59:59Z',
      conditions: [
        {
          type: 'MINIMUM_SPEND',
          value: { amountMinor: 500000, currency: 'INR' },
        },
      ],
      benefit: {
        type: 'PERCENTAGE_DISCOUNT',
        value: 0.1,
        cap: { amountMinor: 150000, currency: 'INR' },
      },
      paymentRequirements: [
        {
          methodType: 'CREDIT_CARD',
          issuer: 'HDFC',
        },
      ],
      stackingPolicy: {
        canStackWithCoupons: true,
        canStackWithGiftCards: true,
      },
      source: {
        type: 'OFFICIAL',
        retrievedAt: '2026-08-19T10:00:00Z',
      },
      confidence: 'HIGH',
    },
  ],
  coupons: [
    {
      id: 'coupon-amz-1000',
      merchantId: 'amazon',
      code: 'SAVE1000',
      benefit: {
        type: 'FIXED_DISCOUNT',
        value: { amountMinor: 100000, currency: 'INR' },
      },
      conditions: [],
      validUntil: '2026-08-31T23:59:59Z',
      stackability: 'STACKABLE',
    },
  ],
};

describe('PublicDataManager & Schemas', () => {
  it('loads valid bundle successfully and coerces number/string to bigint money units', () => {
    const manager = new PublicDataManager();
    expect(manager.isLoaded()).toBe(false);

    manager.loadBundle(VALID_BUNDLE);
    expect(manager.isLoaded()).toBe(true);

    const version = manager.getVersionInfo();
    expect(version?.dataVersion).toBe('2026.08.19.1');

    const cards = manager.getCardCatalog();
    expect(cards.length).toBe(1);
    expect(cards[0]?.annualFee?.amountMinor).toBe(100000n); // BigInt!
    expect(cards[0]?.rewardRules[0]?.maximumReward?.amountMinor).toBe(100000n); // BigInt coerced from string!
  });

  it('rejects invalid bundles atomically', () => {
    const manager = new PublicDataManager();
    manager.loadBundle(VALID_BUNDLE); // load initial valid bundle

    const malformedBundle = {
      ...VALID_BUNDLE,
      schemaVersion: 'not-a-number', // invalid type
    };

    expect(() => manager.loadBundle(malformedBundle)).toThrow(ZodError);
    // Active bundle should remain unchanged
    const version = manager.getVersionInfo();
    expect(version?.schemaVersion).toBe(1);
  });

  it('queries offers and filters out expired ones based on reference time', () => {
    const manager = new PublicDataManager();
    manager.loadBundle(VALID_BUNDLE);

    // active reference time during August 2026
    const offers = manager.getOffersForMerchant('amazon', '2026-08-19T12:00:00Z');
    expect(offers.length).toBe(1);
    expect(offers[0]?.id).toBe('offer-hdfc-instant');

    // expired reference time in September 2026
    const expiredOffers = manager.getOffersForMerchant('amazon', '2026-09-01T00:00:00Z');
    expect(expiredOffers.length).toBe(0);

    // pre-valid reference time in July 2026
    const preValidOffers = manager.getOffersForMerchant('amazon', '2026-07-31T23:59:59Z');
    expect(preValidOffers.length).toBe(0);
  });

  it('queries coupons and checks validity', () => {
    const manager = new PublicDataManager();
    manager.loadBundle(VALID_BUNDLE);

    const coupons = manager.getCouponsForMerchant('amazon', '2026-08-19T12:00:00Z');
    expect(coupons.length).toBe(1);
    expect(coupons[0]?.code).toBe('SAVE1000');

    const expiredCoupons = manager.getCouponsForMerchant('amazon', '2026-09-01T00:00:00Z');
    expect(expiredCoupons.length).toBe(0);
  });
});
