/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';

// Define global chrome mock BEFORE importing service-worker
let registeredListener: any = null;

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
      get: vi.fn().mockImplementation((keys: string | string[], callback?: (result: any) => void) => {
        if (callback) {
          // Chrome API callback style
          callback({});
        }
        return Promise.resolve({});
      }),
      set: vi.fn().mockImplementation((data: any, callback?: () => void) => {
        if (callback) {
          callback();
        }
        return Promise.resolve();
      }),
    },
    session: {
      set: vi.fn().mockImplementation((data: any, callback?: () => void) => {
        if (callback) {
          callback();
        }
        return Promise.resolve();
      }),
    },
  },
};

globalThis.chrome = chromeMock as any;

// Import the service worker (triggers runtime.onMessage.addListener registration)
await import('./service-worker.js');

describe('Service Worker Boundary Security Fuzzing', () => {
  beforeAll(() => {
    // Ensure the mock is set up before all tests
    vi.clearAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const sendOptimisationMessage = (payloadJson: string): Promise<any> => {
    return new Promise((resolve, reject) => {
      const msg = {
        type: 'OPTIMIZE_PAYMENT',
        payload: {
          cartJson: payloadJson,
        },
      };

      const sender = { tab: { id: 123 } };

      try {
        const keepOpen = registeredListener(msg, sender, (response: any) => {
          resolve(response);
        });

        expect(keepOpen).toBe(true);
      } catch (err) {
        reject(err);
      }
    });
  };

  it('rejects completely empty object payloads', async () => {
    const response = await sendOptimisationMessage('{}');
    expect(response.type).toBe('OPTIMIZE_PAYMENT_ERROR');
    expect(response.error).toContain('Required');
  });

  it('rejects payloads with missing total or currency fields', async () => {
    const malformed = JSON.stringify({
      merchantId: 'amazon',
      items: [],
      subtotal: { amountMinor: '1000', currency: 'INR' },
      // total is missing
    });
    const response = await sendOptimisationMessage(malformed);
    expect(response.type).toBe('OPTIMIZE_PAYMENT_ERROR');
    expect(response.error).toContain('Required');
  });

  it('rejects negative currency amount values', async () => {
    const malformed = JSON.stringify({
      merchantId: 'amazon',
      items: [
        {
          id: 'item-1',
          name: 'Negative Item',
          price: { amountMinor: '-500', currency: 'INR' }, // negative price
          quantity: 1,
        },
      ],
      subtotal: { amountMinor: '-500', currency: 'INR' },
      discounts: [],
      shipping: { amountMinor: '0', currency: 'INR' },
      taxes: { amountMinor: '0', currency: 'INR' },
      total: { amountMinor: '-500', currency: 'INR' },
      currency: 'INR',
    });
    const response = await sendOptimisationMessage(malformed);
    expect(response.type).toBe('OPTIMIZE_PAYMENT_ERROR');
  });

  it('rejects float quantity values (must be positive integers)', async () => {
    const malformed = JSON.stringify({
      merchantId: 'amazon',
      items: [
        {
          id: 'item-1',
          name: 'Float Item',
          price: { amountMinor: '500', currency: 'INR' },
          quantity: 1.5, // float quantity
        },
      ],
      subtotal: { amountMinor: '750', currency: 'INR' },
      discounts: [],
      shipping: { amountMinor: '0', currency: 'INR' },
      taxes: { amountMinor: '0', currency: 'INR' },
      total: { amountMinor: '750', currency: 'INR' },
      currency: 'INR',
    });
    const response = await sendOptimisationMessage(malformed);
    expect(response.type).toBe('OPTIMIZE_PAYMENT_ERROR');
    expect(response.error).toContain('Expected integer');
  });

  it('rejects unsupported currency codes', async () => {
    const malformed = JSON.stringify({
      merchantId: 'amazon',
      items: [],
      subtotal: { amountMinor: '1000', currency: 'INVALID' }, // invalid currency
      discounts: [],
      shipping: { amountMinor: '0', currency: 'INVALID' },
      taxes: { amountMinor: '0', currency: 'INVALID' },
      total: { amountMinor: '1000', currency: 'INVALID' },
      currency: 'INVALID',
    });
    const response = await sendOptimisationMessage(malformed);
    expect(response.type).toBe('OPTIMIZE_PAYMENT_ERROR');
  });
});
