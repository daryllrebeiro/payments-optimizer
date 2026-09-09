/**
 * Clock abstraction for deterministic time handling
 * Epic 1.8: Enables time-based testing without Date.now() / new Date()
 *
 * Provides:
 * - Injectable time source for production and tests
 * - Controlled time progression in tests
 * - Time travel capabilities for testing time-dependent logic
 */

/**
 * Clock interface for time operations
 */
export interface Clock {
  /**
   * Get current timestamp in milliseconds since epoch
   */
  now(): number;

  /**
   * Get current Date object
   */
  date(): Date;

  /**
   * Get ISO 8601 timestamp string
   */
  toISO(): string;
}

/**
 * System clock using real time
 * Use this in production code
 */
export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }

  date(): Date {
    return new Date();
  }

  toISO(): string {
    return new Date().toISOString();
  }
}

/**
 * Test clock with controllable time
 * Use this in tests to control time progression
 */
export class TestClock implements Clock {
  private currentTime: number;

  constructor(initialTime?: number | Date | string) {
    if (initialTime === undefined) {
      this.currentTime = Date.now();
    } else if (typeof initialTime === 'number') {
      this.currentTime = initialTime;
    } else if (initialTime instanceof Date) {
      this.currentTime = initialTime.getTime();
    } else {
      this.currentTime = new Date(initialTime).getTime();
    }
  }

  now(): number {
    return this.currentTime;
  }

  date(): Date {
    return new Date(this.currentTime);
  }

  toISO(): string {
    return new Date(this.currentTime).toISOString();
  }

  /**
   * Advance time by specified milliseconds
   */
  advance(ms: number): void {
    this.currentTime += ms;
  }

  /**
   * Set time to specific timestamp
   */
  setTime(time: number | Date | string): void {
    if (typeof time === 'number') {
      this.currentTime = time;
    } else if (time instanceof Date) {
      this.currentTime = time.getTime();
    } else {
      this.currentTime = new Date(time).getTime();
    }
  }

  /**
   * Reset to current real time
   */
  reset(): void {
    this.currentTime = Date.now();
  }

  /**
   * Helper: advance by seconds
   */
  advanceSeconds(seconds: number): void {
    this.advance(seconds * 1000);
  }

  /**
   * Helper: advance by minutes
   */
  advanceMinutes(minutes: number): void {
    this.advance(minutes * 60 * 1000);
  }

  /**
   * Helper: advance by hours
   */
  advanceHours(hours: number): void {
    this.advance(hours * 60 * 60 * 1000);
  }

  /**
   * Helper: advance by days
   */
  advanceDays(days: number): void {
    this.advance(days * 24 * 60 * 60 * 1000);
  }
}

/**
 * Global clock instance
 * Can be swapped for testing
 */
let globalClock: Clock = new SystemClock();

/**
 * Get the global clock instance
 */
export function getClock(): Clock {
  return globalClock;
}

/**
 * Set the global clock instance
 * Useful for dependency injection in tests
 */
export function setClock(clock: Clock): void {
  globalClock = clock;
}

/**
 * Reset to system clock
 */
export function resetClock(): void {
  globalClock = new SystemClock();
}

/**
 * Create a new test clock
 */
export function createTestClock(initialTime?: number | Date | string): TestClock {
  return new TestClock(initialTime);
}

/**
 * Create a new system clock
 */
export function createSystemClock(): SystemClock {
  return new SystemClock();
}
