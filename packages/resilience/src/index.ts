/**
 * @payments-optimizer/resilience
 * Core resilience primitives: circuit breaker, rate limiter, result types, clock, errors
 */

export { CircuitBreaker, CircuitState, createCircuitBreaker } from './circuit-breaker.js';
export type { CircuitBreakerConfig, CircuitBreakerMetrics } from './circuit-breaker.js';
export { RateLimiter } from './rate-limiter.js';
export type { RateLimiterConfig } from './rate-limiter.js';
export { Ok, Err, ok, err, tryCatch, tryCatchAsync, combine, combineAll, toDomainError } from './result.js';
export type { Result } from './result.js';
export { SystemClock, TestClock, getClock, setClock, resetClock, createTestClock, createSystemClock } from './clock.js';
export type { Clock } from './clock.js';
export {
  ValidationError,
  NotFoundError,
  InsufficientResourceError,
  TimeoutError,
  NetworkError,
  CircuitBreakerOpenError,
  SerializationError,
  StorageError,
  TransactionError,
  MigrationError,
  ConfigurationError,
  AuthorizationError,
  BusinessLogicError,
  ConflictError,
  RateLimitError,
  ErrorCode,
  isValidationError,
  isNotFoundError,
  isInsufficientResourceError,
  isTimeoutError,
  isNetworkError,
  isCircuitBreakerOpenError,
  isSerializationError,
  isStorageError,
  isTransactionError,
  isMigrationError,
  isConfigurationError,
  isAuthorizationError,
  isBusinessLogicError,
  isConflictError,
  isRateLimitError,
  isDomainError,
  DomainError,
} from './errors.js';