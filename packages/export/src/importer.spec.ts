/**
 * Fix F18 regression tests — validated imports.
 *
 * Encodes the audit's "imported profile bomb" scenarios: a file that
 * passes JSON parsing but contains internally inconsistent or malformed
 * data must be rejected with a structured error, never partially written,
 * and never throw an uncaught exception anywhere in the stack.
 */
import { describe, it, expect } from 'vitest';
import { importStrategy, importFromCSV } from './importer.js';

const validStrategyJson = JSON.stringify({
  version: '0.6.0',
  strategies: [
    {
      id: 'strategy-1',
      steps: [],
      immediateDiscount: { amountMinor: '500', currency: 'INR' },
      rewardValue: { amountMinor: '100', currency: 'INR' },
      totalBenefit: { amountMinor: '600', currency: 'INR' },
      confidence: 0.9,
    },
  ],
});

describe('importStrategy — structured validation', () => {
  it('accepts a valid import', () => {
    const result = importStrategy(validStrategyJson);
    expect(result.ok).toBe(true);
  });

  it('rejects invalid JSON with a structured error (no throw)', () => {
    expect(() => importStrategy('{not json')).not.toThrow();
    const result = importStrategy('{not json');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('Invalid JSON'))).toBe(true);
    }
  });

  it('rejects a non-numeric amountMinor ("12.34.56") with a structured error', () => {
    const hostile = JSON.stringify({
      version: '0.6.0',
      strategies: [
        {
          id: 's1',
          steps: [],
          immediateDiscount: { amountMinor: '12.34.56', currency: 'INR' },
          rewardValue: { amountMinor: '100', currency: 'INR' },
          totalBenefit: { amountMinor: '600', currency: 'INR' },
          confidence: 0.9,
        },
      ],
    });
    const result = importStrategy(hostile);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('amountMinor'))).toBe(true);
    }
  });

  it('rejects negative amounts', () => {
    const hostile = JSON.stringify({
      version: '0.6.0',
      strategies: [
        {
          id: 's1',
          steps: [],
          immediateDiscount: { amountMinor: '-500', currency: 'INR' },
          rewardValue: { amountMinor: '100', currency: 'INR' },
          totalBenefit: { amountMinor: '600', currency: 'INR' },
          confidence: 0.9,
        },
      ],
    });
    const result = importStrategy(hostile);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('amountMinor'))).toBe(true);
    }
  });

  it('rejects mixed currencies within one strategy (referential integrity)', () => {
    const inconsistent = JSON.stringify({
      version: '0.6.0',
      strategies: [
        {
          id: 's1',
          steps: [],
          immediateDiscount: { amountMinor: '500', currency: 'USD' },
          rewardValue: { amountMinor: '100', currency: 'INR' },
          totalBenefit: { amountMinor: '600', currency: 'INR' },
          confidence: 0.9,
        },
      ],
    });
    const result = importStrategy(inconsistent);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('mixed currencies'))).toBe(true);
    }
  });

  it('rejects duplicate strategy ids', () => {
    const hostile = JSON.stringify({
      version: '0.6.0',
      strategies: [
        {
          id: 's1',
          steps: [],
          immediateDiscount: { amountMinor: '500', currency: 'INR' },
          rewardValue: { amountMinor: '100', currency: 'INR' },
          totalBenefit: { amountMinor: '600', currency: 'INR' },
          confidence: 0.9,
        },
        {
          id: 's1',
          steps: [],
          immediateDiscount: { amountMinor: '700', currency: 'INR' },
          rewardValue: { amountMinor: '100', currency: 'INR' },
          totalBenefit: { amountMinor: '800', currency: 'INR' },
          confidence: 0.9,
        },
      ],
    });
    const result = importStrategy(hostile);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('duplicate strategy id'))).toBe(true);
    }
  });

  it('never throws on arbitrary garbage input', () => {
    for (const garbage of ['', 'null', '42', '"a string"', '[]', '{}']) {
      expect(() => importStrategy(garbage)).not.toThrow();
    }
  });
});

describe('importFromCSV — no NaN poisoning, real currency column', () => {
  it('accepts a valid CSV and parses amounts exactly (no float error)', () => {
    const csv = [
      'id,immediateDiscount,rewardValue,totalBenefit,confidence,currency',
      's1,150.50,10.05,160.55,0.9,INR',
    ].join('\n');
    const result = importFromCSV(csv);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.strategies[0]!.immediateDiscount.amountMinor).toBe('15050');
      expect(result.data.strategies[0]!.rewardValue.amountMinor).toBe('1005');
      expect(result.data.strategies[0]!.totalBenefit.amountMinor).toBe('16055');
      expect(result.data.strategies[0]!.immediateDiscount.currency).toBe('INR');
    }
  });

  it('rejects a non-numeric amount cell with a structured error, not a TypeError', () => {
    // Exploit scenario: bare BigInt(Math.round(NaN)) previously threw an
    // uncaught TypeError. Now: structured rejection.
    const csv = [
      'id,immediateDiscount,rewardValue,totalBenefit,confidence,currency',
      's1,abc,10.05,160.55,0.9,INR',
    ].join('\n');
    expect(() => importFromCSV(csv)).not.toThrow();
    const result = importFromCSV(csv);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('immediateDiscount') && e.includes('row 2'))).toBe(true);
    }
  });

  it('rejects an invalid confidence value', () => {
    const csv = [
      'id,immediateDiscount,rewardValue,totalBenefit,confidence,currency',
      's1,150.50,10.05,160.55,1.5,INR',
    ].join('\n');
    const result = importFromCSV(csv);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('confidence'))).toBe(true);
    }
  });

  it('reads the currency column instead of hardcoding INR', () => {
    const csv = [
      'id,immediateDiscount,rewardValue,totalBenefit,confidence,currency',
      's1,150.50,10.05,160.55,0.9,USD',
    ].join('\n');
    const result = importFromCSV(csv);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.strategies[0]!.immediateDiscount.currency).toBe('USD');
    }
  });

  it('rejects an unsupported currency', () => {
    const csv = [
      'id,immediateDiscount,rewardValue,totalBenefit,confidence,currency',
      's1,150.50,10.05,160.55,0.9,XYZ',
    ].join('\n');
    const result = importFromCSV(csv);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('unsupported currency'))).toBe(true);
    }
  });
});
