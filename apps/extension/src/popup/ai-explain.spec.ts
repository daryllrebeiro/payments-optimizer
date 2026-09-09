/**
 * Task 0.10 — AI explanation is gated on an explicit, valid API key.
 *
 * Locks in the audit's "Checked and Found Sound" item #10: the egress path
 * is user-initiated and refuses to run without a key. (The explicit-click
 * wiring lives in Dashboard.tsx; the enforced precondition is that no
 * network call can happen without a validated key, which is what this test
 * pins down.)
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateAIExplanation, isValidApiKey } from './ai-explain.js';
import type { SerializedStrategy } from '../types/messages.js';

const strategy: SerializedStrategy = {
  id: 'strategy-1',
  immediateDiscount: { amountMinor: '500', currency: 'INR' },
  rewardValue: { amountMinor: '100', currency: 'INR' },
  futureBenefit: { amountMinor: '0', currency: 'INR' },
  fees: { amountMinor: '0', currency: 'INR' },
  effectiveCost: { amountMinor: '9500', currency: 'INR' },
  totalBenefit: { amountMinor: '600', currency: 'INR' },
  confidence: 0.9,
  complexityScore: 2,
  stepDescriptions: ['Use card A', 'Apply coupon B'],
};

const input = {
  merchantId: 'amazon',
  cartTotal: '10000',
  currency: 'INR',
  bestStrategy: strategy,
  alternatives: [strategy],
};

describe('Task 0.10 — AI explanation gating', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refuses an empty key without any network call', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await expect(generateAIExplanation(input, '')).rejects.toThrow('API Key is missing');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refuses a malformed key without any network call', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await expect(generateAIExplanation(input, 'not-a-valid-key')).rejects.toThrow(
      'Invalid API Key format'
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('validates the Gemini key format', () => {
    expect(isValidApiKey('AIza' + 'a'.repeat(35))).toBe(true);
    expect(isValidApiKey('short')).toBe(false);
    expect(isValidApiKey('AIza' + 'a'.repeat(34))).toBe(false);
  });
});
