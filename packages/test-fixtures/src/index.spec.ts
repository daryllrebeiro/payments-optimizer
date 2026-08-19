import { describe, it, expect } from 'vitest';
import { dummyMoney } from './index.js';

describe('test-fixtures sanity tests', () => {
  it('should export correct dummyMoney', () => {
    expect(dummyMoney.amountMinor).toBe(10000n);
    expect(dummyMoney.currency).toBe('INR');
  });
});
