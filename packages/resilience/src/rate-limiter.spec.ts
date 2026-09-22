import { describe, it, expect } from 'vitest';
import { RateLimiter, RateLimiterConfig } from './rate-limiter.js';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({ maxRequests: 5, windowMs: 60000 });
  });

  it('allows requests up to maxRequests', () => {
    for (let i = 0; i < 5; i++) {
      expect(limiter.isLimited()).toBe(false);
    }
  });

  it('rejects requests exceeding maxRequests', () => {
    for (let i = 0; i < 5; i++) {
      expect(limiter.isLimited()).toBe(false);
    }
    // 6th request should be limited
    expect(limiter.isLimited()).toBe(true);
  });

  it('resets after window expires', () => {
    const now = Date.now();

    // Use all 5 requests
    for (let i = 0; i < 5; i++) {
      expect(limiter.isLimited(now + i * 10)).toBe(false);
    }

    // 6th request at same time should be limited
    expect(limiter.isLimited(now + 50)).toBe(true);

    // After window expires, should allow again
    expect(limiter.isLimited(now + 60000 + 10)).toBe(false);
  });

  it('respects custom windowMs', () => {
    const limiter = new RateLimiter({ maxRequests: 2, windowMs: 1000 });

    expect(limiter.isLimited(0)).toBe(false);
    expect(limiter.isLimited(100)).toBe(false);
    expect(limiter.isLimited(200)).toBe(true);

    // After 1 second, should allow again
    expect(limiter.isLimited(1100)).toBe(false);
  });

  it('uses default config when none provided', () => {
    const limiter = new RateLimiter();

    // Default: 10 requests per 60 seconds
    for (let i = 0; i < 10; i++) {
      expect(limiter.isLimited()).toBe(false);
    }
    expect(limiter.isLimited()).toBe(true);
  });

  it('reset clears all hits', () => {
    for (let i = 0; i < 5; i++) {
      expect(limiter.isLimited()).toBe(false);
    }
    expect(limiter.isLimited()).toBe(true);

    limiter.reset();
    expect(limiter.isLimited()).toBe(false);
  });

  it('handles concurrent requests correctly', () => {
    // Simulate 10 concurrent requests at the same timestamp
    const now = Date.now();
    let allowed = 0;

    for (let i = 0; i < 10; i++) {
      if (!limiter.isLimited(now)) {
        allowed++;
      }
    }

    expect(allowed).toBe(5); // maxRequests = 5
  });

  it('works with different timestamps', () => {
    const limiter = new RateLimiter({ maxRequests: 3, windowMs: 1000 });

    // First batch at t=0
    expect(limiter.isLimited(0)).toBe(false);
    expect(limiter.isLimited(100)).toBe(false);
    expect(limiter.isLimited(200)).toBe(false);
    expect(limiter.isLimited(300)).toBe(true);

    // Second batch at t=500 (within window)
    expect(limiter.isLimited(500)).toBe(true);

    // Third batch at t=2100 (window fully expired: 2100-1000=1100, all previous hits at 0,100,200 expired)
    expect(limiter.isLimited(2100)).toBe(false);
    expect(limiter.isLimited(2100)).toBe(false);
    expect(limiter.isLimited(2100)).toBe(false);
    expect(limiter.isLimited(2100)).toBe(true);
  });

  it('handles edge case: maxRequests = 1', () => {
    const limiter = new RateLimiter({ maxRequests: 1, windowMs: 1000 });

    expect(limiter.isLimited()).toBe(false);
    expect(limiter.isLimited()).toBe(true);
    expect(limiter.isLimited()).toBe(true);
  });
});