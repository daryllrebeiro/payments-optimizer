import { describe, it, expect, vi } from 'vitest';
import { Clock, SystemClock, TestClock, getClock, setClock, resetClock, createTestClock, createSystemClock } from './clock.js';

describe('Clock', () => {
  afterEach(() => {
    resetClock();
  });

  describe('SystemClock', () => {
    it('returns current time', () => {
      const clock = new SystemClock();
      const before = Date.now();
      const now = clock.now();
      const after = Date.now();
      expect(now).toBeGreaterThanOrEqual(before);
      expect(now).toBeLessThanOrEqual(after);
    });

    it('returns Date object', () => {
      const clock = new SystemClock();
      const date = clock.date();
      expect(date).toBeInstanceOf(Date);
      expect(date.getTime()).toBeCloseTo(Date.now(), -2);
    });

    it('returns ISO string', () => {
      const clock = new SystemClock();
      const iso = clock.toISO();
      expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('createSystemClock creates SystemClock', () => {
      const clock = createSystemClock();
      expect(clock).toBeInstanceOf(SystemClock);
    });
  });

  describe('TestClock', () => {
    it('starts at given time (number)', () => {
      const clock = new TestClock(1000000);
      expect(clock.now()).toBe(1000000);
    });

    it('starts at given time (Date)', () => {
      const clock = new TestClock(new Date('2026-01-01T00:00:00Z'));
      expect(clock.now()).toBe(new Date('2026-01-01T00:00:00Z').getTime());
    });

    it('starts at given time (string)', () => {
      const clock = new TestClock('2026-01-01T00:00:00Z');
      expect(clock.now()).toBe(new Date('2026-01-01T00:00:00Z').getTime());
    });

    it('starts at current time when no arg', () => {
      const before = Date.now();
      const clock = new TestClock();
      const after = Date.now();
      expect(clock.now()).toBeGreaterThanOrEqual(before);
      expect(clock.now()).toBeLessThanOrEqual(after);
    });

    it('returns Date object', () => {
      const clock = new TestClock(1000000);
      const date = clock.date();
      expect(date).toBeInstanceOf(Date);
      expect(date.getTime()).toBe(1000000);
    });

    it('returns ISO string', () => {
      const clock = new TestClock('2026-01-01T00:00:00Z');
      expect(clock.toISO()).toBe('2026-01-01T00:00:00.000Z');
    });

    it('advance adds milliseconds', () => {
      const clock = new TestClock(1000);
      clock.advance(500);
      expect(clock.now()).toBe(1500);
    });

    it('setTime with number', () => {
      const clock = new TestClock(1000);
      clock.setTime(5000);
      expect(clock.now()).toBe(5000);
    });

    it('setTime with Date', () => {
      const clock = new TestClock(1000);
      clock.setTime(new Date('2026-06-15T12:00:00Z'));
      expect(clock.now()).toBe(new Date('2026-06-15T12:00:00Z').getTime());
    });

    it('setTime with string', () => {
      const clock = new TestClock(1000);
      clock.setTime('2026-06-15T12:00:00Z');
      expect(clock.now()).toBe(new Date('2026-06-15T12:00:00Z').getTime());
    });

    it('reset sets to current time', () => {
      const clock = new TestClock(1000);
      clock.reset();
      const now = Date.now();
      expect(clock.now()).toBeGreaterThanOrEqual(now - 10);
      expect(clock.now()).toBeLessThanOrEqual(now + 10);
    });

    it('advanceSeconds', () => {
      const clock = new TestClock(0);
      clock.advanceSeconds(5);
      expect(clock.now()).toBe(5000);
    });

    it('advanceMinutes', () => {
      const clock = new TestClock(0);
      clock.advanceMinutes(2);
      expect(clock.now()).toBe(120000);
    });

    it('advanceHours', () => {
      const clock = new TestClock(0);
      clock.advanceHours(1);
      expect(clock.now()).toBe(3600000);
    });

    it('advanceDays', () => {
      const clock = new TestClock(0);
      clock.advanceDays(1);
      expect(clock.now()).toBe(86400000);
    });

    it('createTestClock creates TestClock', () => {
      const clock = createTestClock(12345);
      expect(clock).toBeInstanceOf(TestClock);
      expect(clock.now()).toBe(12345);
    });
  });

  describe('Global clock', () => {
    it('getClock returns SystemClock by default', () => {
      resetClock();
      const clock = getClock();
      expect(clock).toBeInstanceOf(SystemClock);
    });

    it('setClock replaces global clock', () => {
      const testClock = new TestClock(12345);
      setClock(testClock);
      expect(getClock()).toBe(testClock);
    });

    it('resetClock restores SystemClock', () => {
      const testClock = new TestClock(12345);
      setClock(testClock);
      resetClock();
      expect(getClock()).toBeInstanceOf(SystemClock);
    });

    it('createSystemClock creates SystemClock', () => {
      const clock = createSystemClock();
      expect(clock).toBeInstanceOf(SystemClock);
    });
  });
});