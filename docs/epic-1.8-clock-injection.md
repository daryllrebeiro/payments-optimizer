# Epic 1.8: Clock Injection for Deterministic Tests

**Status:** ✅ Complete  
**Priority:** P2 (Testing/Developer Experience)  
**Test Coverage:** 36 tests

## Overview

Implemented a Clock abstraction that enables deterministic time handling in tests while using real system time in production. This eliminates flaky time-based tests and enables precise testing of time-dependent logic (expiry, timeouts, circuit breakers, rate limiting, etc.).

## Problem Statement

Time-dependent code is notoriously difficult to test:

- `Date.now()` returns different values in each test run
- `setTimeout` makes tests slow and flaky
- Time-based logic (expiry, timeouts, retries) requires waiting
- Circuit breaker recovery tests need to wait 60+ seconds
- No way to test future dates without changing system clock

## Solution: Injectable Clock Abstraction

### Core Components

#### 1. Clock Interface (`packages/domain/src/clock.ts`)

```typescript
interface Clock {
  now(): number; // Milliseconds since epoch
  date(): Date; // Current Date object
  toISO(): string; // ISO 8601 string
}
```

#### 2. SystemClock (Production)

- Uses real `Date.now()` and `new Date()`
- Default clock for production code
- No overhead - direct passthrough to system time

#### 3. TestClock (Testing)

- Controllable time progression
- Start at specific timestamp
- Advance time instantly (no waiting)
- Time travel to future/past
- Helper methods for common operations

### Test Clock API

```typescript
const clock = new TestClock('2021-01-01T00:00:00.000Z');

// Time retrieval
clock.now(); // Get timestamp
clock.date(); // Get Date object
clock.toISO(); // Get ISO string

// Time manipulation
clock.advance(5000); // Advance 5 seconds
clock.advanceSeconds(30); // Advance 30 seconds
clock.advanceMinutes(5); // Advance 5 minutes
clock.advanceHours(2); // Advance 2 hours
clock.advanceDays(7); // Advance 7 days

// Set absolute time
clock.setTime(timestamp);
clock.setTime(new Date('2022-06-15'));
clock.setTime('2022-06-15T12:00:00Z');

// Reset
clock.reset(); // Reset to current real time
```

### Global Clock Management

```typescript
// Get current clock (defaults to SystemClock)
const clock = getClock();

// Inject test clock globally
const testClock = createTestClock('2021-01-01');
setClock(testClock);

// Reset to system clock
resetClock();
```

## Design Decisions

### 1. Interface-Based Abstraction

- **Rationale:** Enables dependency injection, polymorphism
- **Benefit:** Easy to swap implementations, testable, type-safe
- **Rejected:** Global mocking of Date (fragile, affects all code)

### 2. Global Clock + Dependency Injection

- **Rationale:** Supports both patterns - global for convenience, injection for flexibility
- **Benefit:** Gradual migration, works with existing code
- **Rejected:** Pure dependency injection only (too invasive for existing code)

### 3. Instant Time Progression

- **Rationale:** Tests should be fast, no waiting for timeouts
- **Benefit:** Tests run in milliseconds instead of seconds/minutes
- **Rejected:** Real delays in tests (slow, flaky)

### 4. Helper Methods (advanceMinutes, etc.)

- **Rationale:** Common operations should be convenient
- **Benefit:** Readable test code, less mental math
- **Rejected:** Only advance(ms) (less readable)

### 5. Multiple Initialization Formats

- **Rationale:** Tests use various date formats
- **Benefit:** Flexible, works with existing test data
- **Rejected:** Single format only (less convenient)

## Usage Patterns

### Pattern 1: Inject Clock into Classes

```typescript
import { Clock, getClock } from '@payments-optimizer/domain';

class CircuitBreaker {
  constructor(private clock: Clock = getClock()) {}

  execute<T>(fn: () => T): T {
    if (this.state === 'OPEN') {
      if (this.clock.now() < this.nextAttemptTime) {
        throw new CircuitBreakerOpenError(...);
      }
      this.transitionToHalfOpen();
    }
    // ... rest of logic
  }
}

// Test
const testClock = createTestClock('2026-09-07T10:00:00Z');
const breaker = new CircuitBreaker(testClock);

// Trigger circuit open
for (let i = 0; i < 5; i++) {
  breaker.execute(() => { throw new Error('Fail'); });
}

// Circuit is open, verify fail-fast
expect(() => breaker.execute(() => 'ok')).toThrow();

// Advance past timeout
testClock.advanceMinutes(1);

// Circuit should attempt half-open
expect(() => breaker.execute(() => 'ok')).not.toThrow();
```

### Pattern 2: Global Clock for Simple Cases

```typescript
import { getClock, setClock, createTestClock } from '@payments-optimizer/domain';

function isExpired(expiryDate: Date): boolean {
  return getClock().date() > expiryDate;
}

// Test
const clock = createTestClock('2021-01-01');
setClock(clock);

expect(isExpired(new Date('2021-01-02'))).toBe(false);

clock.advanceDays(2);
expect(isExpired(new Date('2021-01-02'))).toBe(true);
```

### Pattern 3: Testing Timeouts

```typescript
async function fetchWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  clock: Clock = getClock()
): Promise<T> {
  const startTime = clock.now();
  const result = await fn();

  if (clock.now() - startTime > timeoutMs) {
    throw new TimeoutError('Request timed out', timeoutMs, 'fetch');
  }

  return result;
}

// Test - no actual waiting!
const clock = createTestClock();
const startTime = clock.now();

const promise = fetchWithTimeout(
  async () => {
    clock.advance(6000); // Simulate 6 second delay
    return 'result';
  },
  5000,
  clock
);

await expect(promise).rejects.toThrow(TimeoutError);
```

### Pattern 4: Testing Retry Backoff

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  clock: Clock = getClock()
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;

      const delayMs = Math.pow(2, attempt) * 1000; // Exponential backoff
      const retryTime = clock.now() + delayMs;

      while (clock.now() < retryTime) {
        // In production, would await delay
        // In tests, clock.advance() bypasses this
      }
    }
  }
  throw new Error('Unreachable');
}

// Test
const clock = createTestClock(0);
const timestamps: number[] = [];

await retryWithBackoff(
  async () => {
    timestamps.push(clock.now());
    clock.advanceSeconds(Math.pow(2, timestamps.length - 1));
    throw new Error('Retry');
  },
  4,
  clock
);

expect(timestamps).toEqual([0, 1000, 3000, 7000]); // Exponential backoff verified
```

### Pattern 5: Testing Circuit Breaker Recovery

```typescript
// Without clock injection - would take 60+ seconds
test('circuit breaker recovers after timeout', async () => {
  const breaker = new CircuitBreaker();

  // Open circuit
  for (let i = 0; i < 5; i++) {
    breaker.execute(() => {
      throw new Error();
    });
  }

  // Would need to wait 60 seconds here!
  await sleep(60000);

  // Test recovery...
});

// With clock injection - instant!
test('circuit breaker recovers after timeout', () => {
  const clock = createTestClock();
  const breaker = new CircuitBreaker(clock);

  // Open circuit
  for (let i = 0; i < 5; i++) {
    breaker.execute(() => {
      throw new Error();
    });
  }

  // Instant time travel!
  clock.advanceMinutes(1);

  // Test recovery immediately
  expect(breaker.getState()).toBe('HALF_OPEN');
});
```

## Migration Path

### Phase 1: Core Infrastructure (✅ Complete)

- Clock interface and implementations
- Test clock with time control
- Global clock management
- Comprehensive tests (36 passing)

### Phase 2: Circuit Breaker (Future)

- Update CircuitBreaker to accept Clock parameter
- Update circuit breaker tests to use TestClock
- Remove setTimeout/Date.now() usage

### Phase 3: Storage Layer (Future)

- Update SavingsEntry timestamps to use Clock
- Update MigrationRunner to use Clock
- Update expiry checks to use Clock

### Phase 4: Benefits Layer (Future)

- Update voucher expiry checks
- Update membership validity checks
- Update offer validity checks

## Test Coverage

### SystemClock Tests (4 passing)

- Returns current time within acceptable range
- Returns current Date object
- Returns valid ISO 8601 string
- Implements Clock interface

### TestClock Tests (22 passing)

- **Construction** (4): numeric, Date, ISO string, default
- **Time Retrieval** (3): timestamp, Date, ISO string
- **Time Manipulation** (6): advance, setTime, reset with various formats
- **Helper Methods** (5): seconds, minutes, hours, days, combinations
- **Practical Scenarios** (4): expiry, timeout, backoff, circuit breaker

### Global Clock Management Tests (5 passing)

- Default to SystemClock
- Custom clock injection
- Reset to SystemClock
- Clock sharing across calls
- Global updates

### Factory & Interface Tests (5 passing)

- createTestClock factory
- createSystemClock factory
- Polymorphic usage
- Dependency injection

## Benefits

✅ **Deterministic Tests**: Time is controllable, no random failures  
✅ **Fast Tests**: No waiting for timeouts, instant time progression  
✅ **Time Travel**: Test future/past dates without changing system  
✅ **Readable Tests**: Helper methods make test intent clear  
✅ **Type Safe**: Clock interface enforced by TypeScript  
✅ **Zero Production Overhead**: SystemClock is passthrough to Date  
✅ **Flexible**: Supports global injection and dependency injection  
✅ **Migration Friendly**: Works alongside existing Date usage

## Performance Characteristics

- **SystemClock**: O(1) - direct passthrough to Date.now()
- **TestClock**: O(1) - simple variable reads/writes
- **No Runtime Overhead**: Interface compiles away in production
- **Memory**: Minimal - single number stored per TestClock

## Files Created

- `packages/domain/src/clock.ts` - Clock interface and implementations (175 lines)
- `packages/domain/src/clock.spec.ts` - 36 comprehensive tests (310 lines)
- `docs/epic-1.8-clock-injection.md` - This document

## Files Modified

- `packages/domain/src/index.ts` - Added clock exports

## Known Limitations

1. **Doesn't Mock setTimeout/setInterval**: Clock is for time reading, not scheduling
   - Use Vitest fake timers for timer mocking if needed
2. **Single Global Clock**: All code shares same clock when using getClock()
   - Use dependency injection for isolated tests
3. **No Timezone Support**: All times are UTC
   - Add timezone-aware clock if needed in future

## Future Enhancements

- [ ] Add Clock parameter to Circuit Breaker
- [ ] Add Clock parameter to savings timestamp generation
- [ ] Add Clock parameter to expiry checks
- [ ] Add timezone-aware clock variant
- [ ] Add clock middleware for logging actual time in tests
- [ ] Consider clock pause/resume for advanced scenarios

## Related Epics

- **Epic 1.5 (Circuit Breaker)**: Will benefit from clock injection for recovery tests
- **Epic 1.9 (Observability)**: Telemetry timestamps should use Clock
- **Epic 1.4 (Savings History)**: Timestamps should use Clock

## References

- [Dependency Injection](https://en.wikipedia.org/wiki/Dependency_injection)
- [Test Doubles](https://martinfowler.com/bliki/TestDouble.html)
- [Growing Object-Oriented Software, Guided by Tests - Clock Example](http://www.growing-object-oriented-software.com/)
- [Vitest - Mocking Timers](https://vitest.dev/api/vi.html#vi-usefaketimers)
