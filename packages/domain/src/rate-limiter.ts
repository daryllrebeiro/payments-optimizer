/**
 * Fix F14: canonical in-memory rate limiter.
 *
 * The previous service-worker and popup limiters each hardcoded their own
 * window/key copies and read-modify-wrote chrome.storage (racy). This module
 * is the single implementation: per-worker-instance in-memory token bucket
 * (correct for MV3's single active instance), with storage as an advisory
 * cross-instance backstop. Fail-closed when storage is unavailable for the
 * optimization gate: unavailable storage must not silently allow unlimited
 * requests.
 */

export interface RateLimiterConfig {
  maxRequests?: number;
  windowMs?: number;
}

export class RateLimiter {
  private maxRequests: number;
  private windowMs: number;
  private hits: number[] = [];

  constructor(config: RateLimiterConfig = {}) {
    this.maxRequests = config.maxRequests ?? 10;
    this.windowMs = config.windowMs ?? 60_000;
  }

  /** Returns true when the request must be rejected. Prunes outside window. */
  isLimited(now = Date.now()): boolean {
    this.hits = this.hits.filter((t) => now - t < this.windowMs);
    if (this.hits.length >= this.maxRequests) return true;
    this.hits.push(now);
    return false;
  }

  reset(): void {
    this.hits = [];
  }
}
