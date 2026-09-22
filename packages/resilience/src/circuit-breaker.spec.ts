import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreaker, CircuitState, createCircuitBreaker } from './circuit-breaker.js';
import { CircuitBreakerOpenError } from './errors.js';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = createCircuitBreaker('test', {
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 1000,
    });
  });

  it('starts in CLOSED state', () => {
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('executes successful functions normally', async () => {
    const result = await breaker.execute(async () => 'success');
    expect(result).toBe('success');
    expect(breaker.getMetrics().successes).toBe(1);
  });

  it('tracks failures and opens after threshold', async () => {
    const failingFn = async () => {
      throw new Error('fail');
    };

    // First failure
    await expect(breaker.execute(failingFn)).rejects.toThrow('fail');
    expect(breaker.getMetrics().failures).toBe(1);
    expect(breaker.getState()).toBe(CircuitState.CLOSED);

    // Second failure
    await expect(breaker.execute(failingFn)).rejects.toThrow('fail');
    expect(breaker.getMetrics().failures).toBe(2);
    expect(breaker.getState()).toBe(CircuitState.CLOSED);

    // Third failure - should open
    await expect(breaker.execute(failingFn)).rejects.toThrow('fail');
    expect(breaker.getMetrics().failures).toBe(3);
    expect(breaker.getState()).toBe(CircuitState.OPEN);
  });

  it('rejects immediately when OPEN', async () => {
    const failingFn = async () => {
      throw new Error('fail');
    };

    // Open the circuit
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(async () => { throw new Error('fail'); });
      } catch {}
    }

    expect(breaker.getState()).toBe(CircuitState.OPEN);

    // Should reject immediately with CircuitBreakerOpenError
    await expect(breaker.execute(async () => 'success')).rejects.toThrow(CircuitBreakerOpenError);
  });

  it('transitions to HALF_OPEN after timeout', async () => {
    const failingFn = async () => {
      throw new Error('fail');
    };

    // Open the circuit
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(async () => { throw new Error('fail'); });
      } catch {}
    }

    expect(breaker.getState()).toBe(CircuitState.OPEN);

    // Wait for timeout
    await new Promise(resolve => setTimeout(resolve, 1100));

    // Next execution should transition to HALF_OPEN
    const result = await breaker.execute(async () => 'success');
    expect(result).toBe('success');
    expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);
  });

  it('closes after success threshold in HALF_OPEN', async () => {
    // Open the circuit
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(async () => { throw new Error('fail'); });
      } catch {}
    }

    // Wait for timeout
    await new Promise(resolve => setTimeout(resolve, 1100));

    // First success - HALF_OPEN
    await breaker.execute(async () => 'success');
    expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

    // Second success - should close
    await breaker.execute(async () => 'success');
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('reopens on failure in HALF_OPEN', async () => {
    // Open the circuit
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(async () => { throw new Error('fail'); });
      } catch {}
    }

    await new Promise(resolve => setTimeout(resolve, 1100));

    // First success
    await breaker.execute(async () => 'success');
    expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

    // Failure in HALF_OPEN - should reopen
    await expect(breaker.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
    expect(breaker.getState()).toBe(CircuitState.OPEN);
  });

  it('tracks metrics correctly', async () => {
    await breaker.execute(async () => 'success');
    await breaker.execute(async () => 'success');

    try {
      await breaker.execute(async () => { throw new Error('fail'); });
    } catch {}

    const metrics = breaker.getMetrics();
    expect(metrics.totalRequests).toBe(3);
    expect(metrics.successes).toBe(2);
    expect(metrics.failures).toBe(1);
    expect(metrics.consecutiveSuccesses).toBe(0);
    expect(metrics.consecutiveFailures).toBe(1);
  });

  it('reset restores initial state', async () => {
    // Open the circuit
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(async () => { throw new Error('fail'); });
      } catch {}
    }

    breaker.reset();
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
    expect(breaker.getMetrics().failures).toBe(0);
    expect(breaker.getMetrics().successes).toBe(0);
  });

  it('forceOpen and forceClosed work', () => {
    breaker.forceOpen();
    expect(breaker.getState()).toBe(CircuitState.OPEN);

    breaker.forceClosed();
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('throws on invalid config', () => {
    expect(() => createCircuitBreaker('test', { failureThreshold: 0 })).toThrow('failureThreshold must be positive');
    expect(() => createCircuitBreaker('test', { successThreshold: 0 })).toThrow('successThreshold must be positive');
    expect(() => createCircuitBreaker('test', { timeout: 0 })).toThrow('timeout must be positive');
  });
});

describe('CircuitBreakerOpenError', () => {
  it('includes circuit name and next attempt time in context', () => {
    const nextAttempt = new Date('2026-01-01T00:00:00Z');
    const error = new CircuitBreakerOpenError('Circuit open', 'test-circuit', nextAttempt);

    expect(error.code).toBe('CIRCUIT_BREAKER_OPEN');
    expect(error.context?.circuitName).toBe('test-circuit');
    expect(error.context?.nextAttemptAt).toBe('2026-01-01T00:00:00.000Z');
    expect(error.message).toBe('Circuit open');
  });
});