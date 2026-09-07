/**
 * Circuit Breaker Pattern Implementation
 * Epic 1.5: Prevents cascading failures from external API timeouts
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Failure threshold exceeded, requests fail fast
 * - HALF_OPEN: Testing if service recovered, limited requests pass through
 */

import { CircuitBreakerOpenError } from './errors.js';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  /** Failure threshold before opening circuit (default: 5) */
  failureThreshold: number;
  /** Success threshold to close from half-open (default: 2) */
  successThreshold: number;
  /** Timeout in ms before attempting to close (default: 60000) */
  timeout: number;
  /** Name for logging and metrics */
  name: string;
}

export interface CircuitBreakerMetrics {
  state: CircuitState;
  failures: number;
  successes: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailureTime: number | undefined;
  lastSuccessTime: number | undefined;
  totalRequests: number;
  rejectedRequests: number;
}

/**
 * Circuit Breaker implementation with automatic state transitions
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private lastFailureTime: number | undefined = undefined;
  private lastSuccessTime: number | undefined = undefined;
  private nextAttemptTime: number | undefined = undefined;
  private totalRequests = 0;
  private rejectedRequests = 0;

  constructor(private config: CircuitBreakerConfig) {
    if (config.failureThreshold <= 0) {
      throw new Error('failureThreshold must be positive');
    }
    if (config.successThreshold <= 0) {
      throw new Error('successThreshold must be positive');
    }
    if (config.timeout <= 0) {
      throw new Error('timeout must be positive');
    }
  }

  /**
   * Execute a function with circuit breaker protection
   * @param fn - Async function to execute
   * @returns Promise resolving to function result or error
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    // Check if circuit is open and still in timeout period
    if (this.state === CircuitState.OPEN) {
      if (this.nextAttemptTime && Date.now() < this.nextAttemptTime) {
        this.rejectedRequests++;
        throw new CircuitBreakerOpenError(
          `Circuit breaker "${this.config.name}" is OPEN. Next attempt at ${new Date(
            this.nextAttemptTime
          ).toISOString()}`,
          this.config.name,
          new Date(this.nextAttemptTime)
        );
      }
      // Timeout expired, transition to half-open
      this.transitionToHalfOpen();
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful request
   */
  private onSuccess(): void {
    this.lastSuccessTime = Date.now();
    this.successCount++;
    this.consecutiveSuccesses++;
    this.consecutiveFailures = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.consecutiveSuccesses >= this.config.successThreshold) {
        this.transitionToClosed();
      }
    }
  }

  /**
   * Handle failed request
   */
  private onFailure(): void {
    this.lastFailureTime = Date.now();
    this.failureCount++;
    this.consecutiveFailures++;
    this.consecutiveSuccesses = 0;

    if (
      this.state === CircuitState.CLOSED &&
      this.consecutiveFailures >= this.config.failureThreshold
    ) {
      this.transitionToOpen();
    } else if (this.state === CircuitState.HALF_OPEN) {
      // Any failure in half-open immediately reopens circuit
      this.transitionToOpen();
    }
  }

  /**
   * Transition to CLOSED state (normal operation)
   */
  private transitionToClosed(): void {
    this.state = CircuitState.CLOSED;
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.nextAttemptTime = undefined;
    console.log(
      `[CircuitBreaker:${this.config.name}] Transitioned to CLOSED (healthy)`
    );
  }

  /**
   * Transition to OPEN state (failing fast)
   */
  private transitionToOpen(): void {
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = Date.now() + this.config.timeout;
    console.warn(
      `[CircuitBreaker:${this.config.name}] Transitioned to OPEN (failing fast). Next attempt at ${new Date(
        this.nextAttemptTime
      ).toISOString()}`
    );
  }

  /**
   * Transition to HALF_OPEN state (testing recovery)
   */
  private transitionToHalfOpen(): void {
    this.state = CircuitState.HALF_OPEN;
    this.consecutiveSuccesses = 0;
    console.log(
      `[CircuitBreaker:${this.config.name}] Transitioned to HALF_OPEN (testing recovery)`
    );
  }

  /**
   * Get current circuit breaker state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit breaker metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failures: this.failureCount,
      successes: this.successCount,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalRequests: this.totalRequests,
      rejectedRequests: this.rejectedRequests,
    };
  }

  /**
   * Reset circuit breaker to initial state (useful for testing)
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;
    this.nextAttemptTime = undefined;
    this.totalRequests = 0;
    this.rejectedRequests = 0;
  }

  /**
   * Force circuit to OPEN state (useful for testing/maintenance)
   */
  forceOpen(): void {
    this.transitionToOpen();
  }

  /**
   * Force circuit to CLOSED state (useful for testing/recovery)
   */
  forceClosed(): void {
    this.transitionToClosed();
  }
}

/**
 * Create a circuit breaker with default configuration
 */
export function createCircuitBreaker(
  name: string,
  overrides?: Partial<Omit<CircuitBreakerConfig, 'name'>>
): CircuitBreaker {
  const config: CircuitBreakerConfig = {
    name,
    failureThreshold: overrides?.failureThreshold ?? 5,
    successThreshold: overrides?.successThreshold ?? 2,
    timeout: overrides?.timeout ?? 60000, // 1 minute
  };

  return new CircuitBreaker(config);
}
