/**
 * Tests for Circuit Breaker
 * Epic 1.5: Verify state transitions and failure handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CircuitBreakerOpenError } from './errors.js';
import {
  CircuitBreaker,
  CircuitState,
  createCircuitBreaker,
  type CircuitBreakerConfig,
} from './circuit-breaker.js';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;
  const config: CircuitBreakerConfig = {
    name: 'test-breaker',
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 1000,
  };

  beforeEach(() => {
    breaker = new CircuitBreaker(config);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Configuration validation', () => {
    it('should reject invalid failureThreshold', () => {
      expect(() => {
        new CircuitBreaker({ ...config, failureThreshold: 0 });
      }).toThrow('failureThreshold must be positive');
    });

    it('should reject invalid successThreshold', () => {
      expect(() => {
        new CircuitBreaker({ ...config, successThreshold: -1 });
      }).toThrow('successThreshold must be positive');
    });

    it('should reject invalid timeout', () => {
      expect(() => {
        new CircuitBreaker({ ...config, timeout: 0 });
      }).toThrow('timeout must be positive');
    });
  });

  describe('Initial state', () => {
    it('should start in CLOSED state', () => {
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should have zero metrics initially', () => {
      const metrics = breaker.getMetrics();
      expect(metrics.failures).toBe(0);
      expect(metrics.successes).toBe(0);
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.rejectedRequests).toBe(0);
    });
  });

  describe('Successful requests', () => {
    it('should remain CLOSED after successful requests', async () => {
      const successFn = vi.fn().mockResolvedValue('success');

      await breaker.execute(successFn);
      await breaker.execute(successFn);

      expect(breaker.getState()).toBe(CircuitState.CLOSED);
      expect(successFn).toHaveBeenCalledTimes(2);
    });

    it('should track success metrics', async () => {
      const successFn = vi.fn().mockResolvedValue('success');

      await breaker.execute(successFn);
      await breaker.execute(successFn);

      const metrics = breaker.getMetrics();
      expect(metrics.successes).toBe(2);
      expect(metrics.consecutiveSuccesses).toBe(2);
      expect(metrics.totalRequests).toBe(2);
      expect(metrics.lastSuccessTime).toBeDefined();
    });
  });

  describe('Failure handling', () => {
    it('should track failure metrics', async () => {
      const failFn = vi.fn().mockRejectedValue(new Error('API error'));

      await expect(breaker.execute(failFn)).rejects.toThrow('API error');

      const metrics = breaker.getMetrics();
      expect(metrics.failures).toBe(1);
      expect(metrics.consecutiveFailures).toBe(1);
      expect(metrics.lastFailureTime).toBeDefined();
    });

    it('should remain CLOSED below failure threshold', async () => {
      const failFn = vi.fn().mockRejectedValue(new Error('API error'));

      // Fail 2 times (threshold is 3)
      await expect(breaker.execute(failFn)).rejects.toThrow();
      await expect(breaker.execute(failFn)).rejects.toThrow();

      expect(breaker.getState()).toBe(CircuitState.CLOSED);
      expect(failFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('State transitions: CLOSED → OPEN', () => {
    it('should transition to OPEN after hitting failure threshold', async () => {
      const failFn = vi.fn().mockRejectedValue(new Error('API error'));

      // Fail 3 times (threshold)
      await expect(breaker.execute(failFn)).rejects.toThrow('API error');
      await expect(breaker.execute(failFn)).rejects.toThrow('API error');
      await expect(breaker.execute(failFn)).rejects.toThrow('API error');

      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });

    it('should fail fast when OPEN', async () => {
      const failFn = vi.fn().mockRejectedValue(new Error('API error'));

      // Open the circuit
      await expect(breaker.execute(failFn)).rejects.toThrow();
      await expect(breaker.execute(failFn)).rejects.toThrow();
      await expect(breaker.execute(failFn)).rejects.toThrow();

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Next request should fail fast without calling function
      await expect(breaker.execute(failFn)).rejects.toThrow(CircuitBreakerOpenError);
      expect(failFn).toHaveBeenCalledTimes(3); // Not called on 4th attempt
    });

    it('should track rejected requests', async () => {
      const failFn = vi.fn().mockRejectedValue(new Error('API error'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failFn)).rejects.toThrow();
      }

      // Attempt while open
      await expect(breaker.execute(failFn)).rejects.toThrow(CircuitBreakerOpenError);

      const metrics = breaker.getMetrics();
      expect(metrics.rejectedRequests).toBe(1);
      expect(metrics.totalRequests).toBe(4);
    });
  });

  describe('State transitions: OPEN → HALF_OPEN', () => {
    it('should transition to HALF_OPEN after timeout', async () => {
      const failFn = vi.fn().mockRejectedValue(new Error('API error'));
      const successFn = vi.fn().mockResolvedValue('success');

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failFn)).rejects.toThrow();
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Advance time past timeout
      vi.advanceTimersByTime(1001);

      // Next request should transition to HALF_OPEN
      await breaker.execute(successFn);

      expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);
    });

    it('should not transition before timeout expires', async () => {
      const failFn = vi.fn().mockRejectedValue(new Error('API error'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failFn)).rejects.toThrow();
      }

      // Advance time but not enough
      vi.advanceTimersByTime(500);

      // Should still be OPEN and reject
      await expect(breaker.execute(failFn)).rejects.toThrow(CircuitBreakerOpenError);
      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('State transitions: HALF_OPEN → CLOSED', () => {
    it('should close after success threshold in HALF_OPEN', async () => {
      const failFn = vi.fn().mockRejectedValue(new Error('API error'));
      const successFn = vi.fn().mockResolvedValue('success');

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failFn)).rejects.toThrow();
      }

      // Wait for timeout
      vi.advanceTimersByTime(1001);

      // Succeed threshold times (2) to close
      await breaker.execute(successFn);
      expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

      await breaker.execute(successFn);
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should reset consecutive failure count when closing', async () => {
      const failFn = vi.fn().mockRejectedValue(new Error('API error'));
      const successFn = vi.fn().mockResolvedValue('success');

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failFn)).rejects.toThrow();
      }

      vi.advanceTimersByTime(1001);

      // Close the circuit
      await breaker.execute(successFn);
      await breaker.execute(successFn);

      const metrics = breaker.getMetrics();
      expect(metrics.consecutiveFailures).toBe(0);
      expect(metrics.consecutiveSuccesses).toBe(0); // Reset after closing
    });
  });

  describe('State transitions: HALF_OPEN → OPEN', () => {
    it('should reopen immediately on failure in HALF_OPEN', async () => {
      const failFn = vi.fn().mockRejectedValue(new Error('API error'));
      const successFn = vi.fn().mockResolvedValue('success');

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failFn)).rejects.toThrow();
      }

      vi.advanceTimersByTime(1001);

      // Transition to HALF_OPEN with one success
      await breaker.execute(successFn);
      expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

      // Fail once - should immediately reopen
      await expect(breaker.execute(failFn)).rejects.toThrow('API error');
      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('Reset functionality', () => {
    it('should reset all state and metrics', async () => {
      const failFn = vi.fn().mockRejectedValue(new Error('API error'));

      // Generate some state
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failFn)).rejects.toThrow();
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      breaker.reset();

      expect(breaker.getState()).toBe(CircuitState.CLOSED);
      const metrics = breaker.getMetrics();
      expect(metrics.failures).toBe(0);
      expect(metrics.successes).toBe(0);
      expect(metrics.totalRequests).toBe(0);
    });
  });

  describe('Manual state control', () => {
    it('should force OPEN state', () => {
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
      breaker.forceOpen();
      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });

    it('should force CLOSED state', async () => {
      const failFn = vi.fn().mockRejectedValue(new Error('API error'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failFn)).rejects.toThrow();
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      breaker.forceClosed();
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe('Mixed success/failure scenarios', () => {
    it('should reset consecutive failures on success', async () => {
      const failFn = vi.fn().mockRejectedValue(new Error('API error'));
      const successFn = vi.fn().mockResolvedValue('success');

      // Fail twice
      await expect(breaker.execute(failFn)).rejects.toThrow();
      await expect(breaker.execute(failFn)).rejects.toThrow();

      let metrics = breaker.getMetrics();
      expect(metrics.consecutiveFailures).toBe(2);

      // Succeed once - resets consecutive failures
      await breaker.execute(successFn);

      metrics = breaker.getMetrics();
      expect(metrics.consecutiveFailures).toBe(0);
      expect(metrics.consecutiveSuccesses).toBe(1);
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe('createCircuitBreaker helper', () => {
    it('should create breaker with defaults', () => {
      const breaker = createCircuitBreaker('my-api');
      const metrics = breaker.getMetrics();

      expect(breaker.getState()).toBe(CircuitState.CLOSED);
      expect(metrics.state).toBe(CircuitState.CLOSED);
    });

    it('should accept config overrides', () => {
      const breaker = createCircuitBreaker('my-api', {
        failureThreshold: 10,
        successThreshold: 5,
        timeout: 30000,
      });

      expect(breaker).toBeDefined();
    });
  });

  describe('Error message details', () => {
    it('should include circuit name in error message', async () => {
      const failFn = vi.fn().mockRejectedValue(new Error('API error'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failFn)).rejects.toThrow();
      }

      // Try to execute while open
      await expect(breaker.execute(failFn)).rejects.toThrow(/test-breaker/);
    });

    it('should include next attempt time in error message', async () => {
      const failFn = vi.fn().mockRejectedValue(new Error('API error'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failFn)).rejects.toThrow();
      }

      // Try to execute while open
      await expect(breaker.execute(failFn)).rejects.toThrow(/Next attempt at/);
    });
  });
});
