/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';

// ── F8 / F7 / F6 / F2 / F13 regression tests (audit remediation) ────────────
// Each test encodes the exploit scenario from its audit finding and asserts
// the blast radius no longer materializes.

let registeredListener: any = null;
let storageData: Record<string, any> = {};

const chromeMock = {
  runtime: {
    onMessage: {
      addListener: (listener: any) => {
        registeredListener = listener;
      },
    },
    onInstalled: {
      addListener: () => {},
    },
  },
  storage: {
    local: {
      get: vi
        .fn()
        .mockImplementation((keys: string | string[], callback?: (result: any) => void) => {
          const result: Record<string, any> = {};
          if (typeof keys === 'string') {
            result[keys] = storageData[keys];
          } else if (Array.isArray(keys)) {
            for (const k of keys) result[k] = storageData[k];
          }
          if (callback) callback(result);
          return Promise.resolve(result);
        }),
      set: vi.fn().mockImplementation((data: any, callback?: () => void) => {
        Object.assign(storageData, data);
        if (callback) callback();
        return Promise.resolve();
      }),
    },
    session: {
      set: vi.fn().mockImplementation((data: any, callback?: () => void) => {
        if (callback) callback();
        return Promise.resolve();
      }),
    },
  },
};

globalThis.chrome = chromeMock as any;

// Import the service worker (triggers runtime.onMessage.addListener registration)
await import('./service-worker.js');

import {
  hdfcMillenniaCard,
  sbiCashbackCard,
} from '../data/card-catalog.js';
import { serializeProfileForStorage } from '@payments-optimizer/domain';

const validProfile = {
  version: 1,
  currency: 'INR',
  paymentMethods: [
    { type: 'CREDIT_CARD', card: hdfcMillenniaCard },
    { type: 'CREDIT_CARD', card: sbiCashbackCard },
  ],
  rewardPreferences: {
    defaultValuations: {
      'HDFC Millennia Points': { amountMinor: 100n, currency: 'INR' },
      'SBI Cashback Program': { amountMinor: 100n, currency: 'INR' },
    },
  },
  optimizationPreferences: {
    immediateSavingsWeight: 1.0,
    rewardValueWeight: 1.0,
    milestoneWeight: 0.8,
    simplicityWeight: 0.2,
    riskWeight: 0.1,
  },
};

function validCartJson(): string {
  return JSON.stringify({
    merchantId: 'amazon',
    items: [
      { id: 'item-1', name: 'Widget', price: { amountMinor: '10000', currency: 'INR' }, quantity: 1 },
    ],
    subtotal: { amountMinor: '10000', currency: 'INR' },
    discounts: [],
    shipping: { amountMinor: '0', currency: 'INR' },
    taxes: { amountMinor: '0', currency: 'INR' },
    total: { amountMinor: '10000', currency: 'INR' },
    currency: 'INR',
  });
}

function storageShapedProfile(profile: any): any {
  return JSON.parse(
    JSON.stringify(profile, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))
  );
}

const sendOptimize = (cartJson: string): Promise<any> =>
  new Promise((resolve, reject) => {
    const msg = { type: 'OPTIMIZE_PAYMENT', payload: { cartJson } };
    try {
      registeredListener(msg, { tab: { id: 123 } }, (response: any) => resolve(response));
    } catch (err) {
      reject(err);
    }
  });

describe('F8 — no fabricated seed profile on fresh install', () => {
  beforeEach(() => {
    storageData = {};
    vi.clearAllMocks();
  });

  it('returns PROFILE_NOT_CONFIGURED instead of optimizing against fixtures', async () => {
    // Exploit scenario: fresh install, no profile in storage. Previously
    // the SW fell back to fixture cards and produced real-looking advice.
    const response = await sendOptimize(validCartJson());
    expect(response.type).toBe('OPTIMIZE_PAYMENT_ERROR');
    expect(response.error).toContain('PROFILE_NOT_CONFIGURED');
  });

  it('never writes a user-profile on its own (only the user does)', async () => {
    await sendOptimize(validCartJson());
    const setCalls = (chromeMock.storage.local.set as any).mock.calls as any[];
    const wroteProfile = setCalls.some((c) => 'user-profile' in (c[0] ?? {}));
    expect(wroteProfile).toBe(false);
  });
});

describe('F7 — corrupt stored profile is rejected, optimizer never invoked', () => {
  beforeEach(() => {
    storageData = {};
    vi.clearAllMocks();
  });

  it('rejects a profile with a missing card object', async () => {
    storageData['user-profile'] = storageShapedProfile({
      ...validProfile,
      paymentMethods: [{ type: 'CREDIT_CARD' }],
    });
    const response = await sendOptimize(validCartJson());
    expect(response.type).toBe('OPTIMIZE_PAYMENT_ERROR');
    expect(response.error).toContain('PROFILE_CORRUPT');
  });

  it('rejects a profile with a non-numeric amountMinor string', async () => {
    const corrupted = storageShapedProfile(validProfile);
    corrupted.rewardPreferences.defaultValuations['HDFC Millennia Points'].amountMinor =
      '12.34.56';
    storageData['user-profile'] = corrupted;
    const response = await sendOptimize(validCartJson());
    expect(response.type).toBe('OPTIMIZE_PAYMENT_ERROR');
    expect(response.error).toContain('PROFILE_CORRUPT');
  });

  it('accepts a valid storage-shaped profile and optimizes', async () => {
    storageData['user-profile'] = storageShapedProfile(validProfile);
    const response = await sendOptimize(validCartJson());
    expect(response.type).toBe('OPTIMIZE_PAYMENT_RESULT');
    expect(response.payload.strategies.length).toBeGreaterThan(0);
  });
});

describe('F6 — oversized / hostile payloads rejected before parsing', () => {
  beforeEach(() => {
    storageData = { 'user-profile': storageShapedProfile(validProfile) };
    vi.clearAllMocks();
  });

  it('rejects a payload containing a 10-million-digit numeric literal fast', async () => {
    const hostile = JSON.stringify({
      merchantId: 'amazon',
      items: [],
      subtotal: { amountMinor: '0', currency: 'INR' },
      discounts: [],
      shipping: { amountMinor: '0', currency: 'INR' },
      taxes: { amountMinor: '0', currency: 'INR' },
      total: { amountMinor: '9'.repeat(10_000_000), currency: 'INR' },
      currency: 'INR',
    });

    const start = Date.now();
    const response = await sendOptimize(hostile);
    const elapsed = Date.now() - start;

    expect(response.type).toBe('OPTIMIZE_PAYMENT_ERROR');
    expect(response.error).toContain('PAYLOAD_REJECTED');
    // The audit demands rejection in bounded time (<50ms target; CI
    // contention tolerance to 500ms — the pre-fix state never returned at all)
    expect(elapsed).toBeLessThan(500);
  });

  it('rejects a payload over 64KB before any parsing work', async () => {
    const hostile = JSON.stringify({
      merchantId: 'amazon',
      items: [],
      subtotal: { amountMinor: '0', currency: 'INR' },
      discounts: [],
      shipping: { amountMinor: '0', currency: 'INR' },
      taxes: { amountMinor: '0', currency: 'INR' },
      total: { amountMinor: '1000', currency: 'INR' },
      currency: 'INR',
      padding: 'x'.repeat(100 * 1024),
    });
    const response = await sendOptimize(hostile);
    expect(response.type).toBe('OPTIMIZE_PAYMENT_ERROR');
    expect(response.error).toContain('PAYLOAD_REJECTED');
    expect(response.error).toContain('65536');
  });

  it('service worker stays responsive after rejecting a hostile payload', async () => {
    const hostile = JSON.stringify({
      merchantId: 'amazon',
      total: { amountMinor: '9'.repeat(10_000_000), currency: 'INR' },
      currency: 'INR',
    });
    await sendOptimize(hostile);
    // A normal request immediately after must succeed — no degraded state
    const normal = await sendOptimize(validCartJson());
    expect(normal.type).toBe('OPTIMIZE_PAYMENT_RESULT');
  });
});

describe('F13 — recommendations never persist savings entries', () => {
  beforeEach(() => {
    storageData = { 'user-profile': storageShapedProfile(validProfile) };
    vi.clearAllMocks();
  });

  it('an OPTIMIZE_PAYMENT response writes no savings entry', async () => {
    // Exploit scenario: page mutates the cart region every 2s; every
    // optimization previously wrote a fabricated savings entry. Now the
    // optimization path must not touch the savings store at all.
    const originalOpen = indexedDB.open;
    let savingsDbOpened = false;
    (globalThis.indexedDB as any).open = (...args: any[]) => {
      if (String(args[0]).includes('savings')) savingsDbOpened = true;
      return originalOpen.apply(indexedDB, args as [any, any]);
    };

    try {
      await sendOptimize(validCartJson());
      // Give async internals a tick
      await new Promise((r) => setTimeout(r, 50));
      expect(savingsDbOpened).toBe(false);
      // And no savings-shaped storage keys were written (only
      // recommendation caches / rate-limit bookkeeping are allowed)
      const setCalls = (chromeMock.storage.local.set as any).mock.calls as any[];
      const forbiddenKeys = ['user-profile'];
      for (const call of setCalls) {
        for (const key of Object.keys(call[0] ?? {})) {
          expect(forbiddenKeys).not.toContain(key);
          expect(key.includes('savings')).toBe(false);
        }
      }
    } finally {
      (globalThis.indexedDB as any).open = originalOpen;
    }
  });
});

describe('F2 — currency mismatch guard (unit level)', () => {
  // The full guard runs inside saveConfirmedOptimization (CONFIRM_SAVINGS
  // path). The direct exploit: a USD benefit against an INR cart must not
  // produce a persisted savings entry. Simulated via the CONFIRM_SAVINGS
  // message.
  beforeEach(() => {
    storageData = {};
    vi.clearAllMocks();
  });

  it('CONFIRM_SAVINGS with a cross-currency strategy writes nothing', async () => {
    const originalOpen = indexedDB.open;
    let savingsDbOpened = false;
    (globalThis.indexedDB as any).open = (...args: any[]) => {
      if (String(args[0]).includes('savings')) savingsDbOpened = true;
      return originalOpen.apply(indexedDB, args as [any, any]);
    };

    try {
      const msg = {
        type: 'CONFIRM_SAVINGS',
        payload: {
          merchantId: 'amazon',
          cartTotal: { amountMinor: '10000', currency: 'INR' },
          strategy: {
            id: 's1',
            immediateDiscount: { amountMinor: '0', currency: 'USD' },
            rewardValue: { amountMinor: '0', currency: 'USD' },
            futureBenefit: { amountMinor: '0', currency: 'USD' },
            fees: { amountMinor: '0', currency: 'USD' },
            effectiveCost: { amountMinor: '0', currency: 'USD' },
            totalBenefit: { amountMinor: '500', currency: 'USD' },
            confidence: 0.9,
            complexityScore: 1,
            stepDescriptions: [],
          },
          benefitsApplied: [],
        },
      };
      const response: any = await new Promise((resolve) => {
        registeredListener(msg, { tab: { id: 1 } }, resolve);
      });
      expect(response.type).toBe('SAVINGS_CONFIRMED');
      // Give async internals a tick to (not) write
      await new Promise((r) => setTimeout(r, 50));
      expect(savingsDbOpened).toBe(false);
    } finally {
      (globalThis.indexedDB as any).open = originalOpen;
    }
  });
});
