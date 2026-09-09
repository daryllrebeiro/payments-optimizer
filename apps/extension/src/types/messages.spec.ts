/**
 * Fix F16 regression tests — namespaced BigInt wire encoding.
 *
 * Exploit scenario from the audit: the legacy ^-?\d+n$ string convention
 * silently coerced any string field whose natural value looked like a
 * BigInt literal (a product named "100n", a coupon code "200n") into a
 * BigInt during deserialization. The namespaced structural encoding
 * ({"__type":"bigint","value":"..."}) cannot collide with a natural value.
 */
import { describe, it, expect } from 'vitest';
import { serializeCart, deserializeCart, serializeStrategy } from './messages.js';
import type { Cart } from '@payments-optimizer/domain';

function makeCart(overrides: Partial<Cart> = {}): Cart {
  return {
    merchantId: 'amazon',
    items: [
      {
        id: 'item-1',
        name: 'Widget',
        price: { amountMinor: 10000n, currency: 'INR' },
        quantity: 1,
      },
    ],
    subtotal: { amountMinor: 10000n, currency: 'INR' },
    discounts: [],
    shipping: { amountMinor: 0n, currency: 'INR' },
    taxes: { amountMinor: 0n, currency: 'INR' },
    total: { amountMinor: 10000n, currency: 'INR' },
    currency: 'INR',
    ...overrides,
  };
}

describe('F16 — BigInt wire encoding round-trips', () => {
  it('a string field with the literal value "100n" stays a string', () => {
    // Exploit: the old regex-based reviver converted this to BigInt(100).
    const cart = makeCart({
      items: [
        {
          id: 'sku-100n',
          name: '100n',
          price: { amountMinor: 10000n, currency: 'INR' },
          quantity: 1,
        },
      ],
    });

    const roundTripped = deserializeCart(serializeCart(cart));
    expect(typeof roundTripped.items[0]!.name).toBe('string');
    expect(roundTripped.items[0]!.name).toBe('100n');
    expect(typeof roundTripped.items[0]!.id).toBe('string');
    expect(roundTripped.items[0]!.id).toBe('sku-100n');
  });

  it('actual BigInt money fields are revived as BigInt', () => {
    const cart = makeCart();
    const roundTripped = deserializeCart(serializeCart(cart));
    expect(typeof roundTripped.total.amountMinor).toBe('bigint');
    expect(roundTripped.total.amountMinor).toBe(10000n);
  });

  it('the wire format uses the structural marker, not bare strings', () => {
    // The serialized form must not contain a bare "10000n"-style literal
    // (the collision-prone legacy convention); it must carry the marker.
    const json = serializeCart(makeCart());
    expect(json).toContain('"__type":"bigint"');
    expect(json).not.toMatch(/"\d+n"/);
  });

  it('round-trip preserves the full cart exactly (deep equality)', () => {
    const cart = makeCart();
    const roundTripped = deserializeCart(serializeCart(cart));
    expect(roundTripped).toEqual(cart);
  });

  it('serializeStrategy emits string money (storage-safe)', () => {
    const strategy = {
      id: 's1',
      steps: [],
      immediateDiscount: { amountMinor: 500n, currency: 'INR' },
      rewardValue: { amountMinor: 0n, currency: 'INR' },
      futureBenefit: { amountMinor: 0n, currency: 'INR' },
      fees: { amountMinor: 0n, currency: 'INR' },
      effectiveCost: { amountMinor: 9500n, currency: 'INR' },
      totalBenefit: { amountMinor: 500n, currency: 'INR' },
      confidence: 0.9,
      complexityScore: 2,
    } as unknown as import('@payments-optimizer/domain').PaymentStrategy;

    const serialized = serializeStrategy(strategy);
    expect(serialized.immediateDiscount.amountMinor).toBe('500');
    expect(typeof serialized.immediateDiscount.amountMinor).toBe('string');
  });
});
