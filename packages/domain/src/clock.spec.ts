/**
 * Tests for Clock abstraction
 * Epic 1.8: Clock Injection for Deterministic Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  Clock,
  SystemClock,
  TestClock,
  getClock,
  setClock,
  resetClock,
  createTestClock,
  createSystemClock,
} from './clock';

describe('SystemClock', () => {
  it('should return current time', () => {
    const clock = new SystemClock();
    const before = Date.now();
    const now = clock.now();
    const after = Date.now();

    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(after);
  });

  it('should return current Date', () => {
    const clock = new SystemClock();
    const date = clock.date();
    expect(date).toBeInstanceOf(Date);
    expect(Math.abs(date.getTime() - Date.now())).toBeLessThan(100); // within 100ms
  });

  it('should return ISO string', () => {
    const clock = new SystemClock();
    const iso = clock.toISO();
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('should implement Clock interface', () => {
    const clock: Clock = new SystemClock();
    expect(clock.now).toBeDefined();
    expect(clock.date).toBeDefined();
    expect(clock.toISO).toBeDefined();
  });
});

describe('TestClock', () => {
  describe('Construction', () => {
    it('should initialize with current time by default', () => {
      const before = Date.now();
      const clock = new TestClock();
      const after = Date.now();

      const now = clock.now();
      expect(now).toBeGreaterThanOrEqual(before);
      expect(now).toBeLessThanOrEqual(after);
    });

    it('should initialize with numeric timestamp', () => {
      const timestamp = 1609459200000; // 2021-01-01T00:00:00.000Z
      const clock = new TestClock(timestamp);
      expect(clock.now()).toBe(timestamp);
    });

    it('should initialize with Date object', () => {
      const date = new Date('2021-01-01T00:00:00.000Z');
      const clock = new TestClock(date);
      expect(clock.now()).toBe(date.getTime());
    });

    it('should initialize with ISO string', () => {
      const iso = '2021-01-01T00:00:00.000Z';
      const clock = new TestClock(iso);
      expect(clock.now()).toBe(new Date(iso).getTime());
    });
  });

  describe('Time retrieval', () => {
    it('should return fixed timestamp', () => {
      const timestamp = 1609459200000;
      const clock = new TestClock(timestamp);

      expect(clock.now()).toBe(timestamp);
      expect(clock.now()).toBe(timestamp); // Still same time
    });

    it('should return Date with fixed time', () => {
      const timestamp = 1609459200000;
      const clock = new TestClock(timestamp);
      const date = clock.date();

      expect(date.getTime()).toBe(timestamp);
      expect(date.toISOString()).toBe('2021-01-01T00:00:00.000Z');
    });

    it('should return ISO string', () => {
      const clock = new TestClock('2021-01-01T00:00:00.000Z');
      expect(clock.toISO()).toBe('2021-01-01T00:00:00.000Z');
    });
  });

  describe('Time manipulation', () => {
    it('should advance time by milliseconds', () => {
      const clock = new TestClock(1000);
      clock.advance(500);
      expect(clock.now()).toBe(1500);
    });

    it('should advance time multiple times', () => {
      const clock = new TestClock(1000);
      clock.advance(100);
      clock.advance(200);
      clock.advance(300);
      expect(clock.now()).toBe(1600);
    });

    it('should set time to specific timestamp', () => {
      const clock = new TestClock(1000);
      clock.setTime(5000);
      expect(clock.now()).toBe(5000);
    });

    it('should set time with Date object', () => {
      const clock = new TestClock(1000);
      const newDate = new Date('2021-06-15T12:30:45.000Z');
      clock.setTime(newDate);
      expect(clock.now()).toBe(newDate.getTime());
    });

    it('should set time with ISO string', () => {
      const clock = new TestClock(1000);
      clock.setTime('2021-06-15T12:30:45.000Z');
      expect(clock.now()).toBe(new Date('2021-06-15T12:30:45.000Z').getTime());
    });

    it('should reset to current time', () => {
      const clock = new TestClock(1000);
      clock.advance(5000);

      const before = Date.now();
      clock.reset();
      const after = Date.now();

      expect(clock.now()).toBeGreaterThanOrEqual(before);
      expect(clock.now()).toBeLessThanOrEqual(after);
    });
  });

  describe('Time helper methods', () => {
    it('should advance by seconds', () => {
      const clock = new TestClock(0);
      clock.advanceSeconds(5);
      expect(clock.now()).toBe(5000);
    });

    it('should advance by minutes', () => {
      const clock = new TestClock(0);
      clock.advanceMinutes(2);
      expect(clock.now()).toBe(120000);
    });

    it('should advance by hours', () => {
      const clock = new TestClock(0);
      clock.advanceHours(1);
      expect(clock.now()).toBe(3600000);
    });

    it('should advance by days', () => {
      const clock = new TestClock(0);
      clock.advanceDays(1);
      expect(clock.now()).toBe(86400000);
    });

    it('should combine multiple advances', () => {
      const clock = new TestClock(0);
      clock.advanceDays(1); // +86400000
      clock.advanceHours(2); // +7200000
      clock.advanceMinutes(30); // +1800000
      clock.advanceSeconds(45); // +45000
      expect(clock.now()).toBe(86400000 + 7200000 + 1800000 + 45000);
    });
  });

  describe('Practical scenarios', () => {
    it('should test expiry logic', () => {
      const clock = new TestClock('2021-01-01T00:00:00.000Z');
      const expiryDate = new Date('2021-01-02T00:00:00.000Z');

      // Not expired yet
      expect(clock.date() < expiryDate).toBe(true);

      // Advance to expiry
      clock.advanceDays(1);
      expect(clock.date().getTime()).toBe(expiryDate.getTime());

      // Now expired
      clock.advanceSeconds(1);
      expect(clock.date() > expiryDate).toBe(true);
    });

    it('should test timeout logic', () => {
      const clock = new TestClock();
      const startTime = clock.now();
      const timeout = 5000;

      // Simulate waiting
      clock.advance(3000);
      expect(clock.now() - startTime < timeout).toBe(true);

      // Timeout exceeded
      clock.advance(2001);
      expect(clock.now() - startTime > timeout).toBe(true);
    });

    it('should test retry backoff', () => {
      const clock = new TestClock(0);
      const timestamps: number[] = [];

      // Exponential backoff: 1s, 2s, 4s, 8s
      for (let i = 0; i < 4; i++) {
        timestamps.push(clock.now());
        clock.advanceSeconds(Math.pow(2, i));
      }

      expect(timestamps).toEqual([0, 1000, 3000, 7000]);
    });

    it('should test circuit breaker timeout', () => {
      const clock = new TestClock('2026-09-07T10:00:00.000Z');
      const nextAttemptTime = new Date('2026-09-07T10:01:00.000Z');

      // Circuit is open
      expect(clock.date() < nextAttemptTime).toBe(true);

      // Advance past timeout
      clock.advanceMinutes(1);
      expect(clock.date().getTime()).toBe(nextAttemptTime.getTime());

      // Circuit should attempt half-open
      expect(clock.date() >= nextAttemptTime).toBe(true);
    });
  });
});

describe('Global clock management', () => {
  afterEach(() => {
    resetClock(); // Clean up after each test
  });

  it('should default to SystemClock', () => {
    const clock = getClock();
    expect(clock).toBeInstanceOf(SystemClock);
  });

  it('should allow setting custom clock', () => {
    const testClock = new TestClock(1000);
    setClock(testClock);

    const clock = getClock();
    expect(clock.now()).toBe(1000);
  });

  it('should allow resetting to SystemClock', () => {
    const testClock = new TestClock(1000);
    setClock(testClock);

    resetClock();

    const clock = getClock();
    expect(clock).toBeInstanceOf(SystemClock);
  });

  it('should share clock across multiple calls', () => {
    const testClock = new TestClock(1000);
    setClock(testClock);

    const clock1 = getClock();
    const clock2 = getClock();

    expect(clock1).toBe(clock2);
    expect(clock1.now()).toBe(1000);
    expect(clock2.now()).toBe(1000);
  });

  it('should update globally when test clock advances', () => {
    const testClock = new TestClock(1000);
    setClock(testClock);

    testClock.advance(500);

    const clock = getClock();
    expect(clock.now()).toBe(1500);
  });
});

describe('Factory functions', () => {
  it('should create test clock with createTestClock', () => {
    const clock = createTestClock(5000);
    expect(clock).toBeInstanceOf(TestClock);
    expect(clock.now()).toBe(5000);
  });

  it('should create test clock with default time', () => {
    const before = Date.now();
    const clock = createTestClock();
    const after = Date.now();

    expect(clock.now()).toBeGreaterThanOrEqual(before);
    expect(clock.now()).toBeLessThanOrEqual(after);
  });

  it('should create system clock with createSystemClock', () => {
    const clock = createSystemClock();
    expect(clock).toBeInstanceOf(SystemClock);
  });
});

describe('Clock interface compatibility', () => {
  it('should use Clock interface polymorphically', () => {
    function processWithClock(clock: Clock): number {
      return clock.now() + 1000;
    }

    const systemClock = new SystemClock();
    const testClock = new TestClock(5000);

    expect(processWithClock(testClock)).toBe(6000);
    expect(typeof processWithClock(systemClock)).toBe('number');
  });

  it('should inject clock into classes', () => {
    class Timer {
      constructor(private clock: Clock) {}

      getElapsed(startTime: number): number {
        return this.clock.now() - startTime;
      }
    }

    const testClock = new TestClock(1000);
    const timer = new Timer(testClock);

    expect(timer.getElapsed(500)).toBe(500);

    testClock.advance(1000);
    expect(timer.getElapsed(500)).toBe(1500);
  });
});
