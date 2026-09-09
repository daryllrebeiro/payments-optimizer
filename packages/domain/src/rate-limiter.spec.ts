import { describe, it, expect } from 'vitest';
import { RateLimiter } from './rate-limiter.js';

describe('Fix F14 — canonical rate limiter', () => {
  it('allows maxRequests then rejects within the window', () => {
    const limiter = new RateLimiter({ maxRequests: 10, windowMs: 60_000 });
    for (let i = 0; i < 10; i++) {
      expect(limiter.isLimited(1000 + i)).toBe(false);
    }
    // 11th concurrent request at count 10 must not succeed.
    expect(limiter.isLimited(1001)).toBe(true);
  });

  it('slides the window (documented bound, no silent unlimited)', () => {
    const limiter = new RateLimiter({ maxRequests: 2, windowMs: 1000 });
    expect(limiter.isLimited(0)).toBe(false);
    expect(limiter.isLimited(10)).toBe(false);
    expect(limiter.isLimited(20)).toBe(true);
    expect(limiter.isLimited(2000)).toBe(false);
  });
});
