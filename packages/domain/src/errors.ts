/**
 * Structured error classes for domain-driven error handling
 *
 * Each error class has:
 * - A unique error code (for programmatic handling)
 * - Context data (for debugging)
 * - Type safety (for exhaustive matching)
 */

import { DomainError } from './result.js';

/**
 * Validation errors - input data doesn't meet requirements
 */
export class ValidationError extends DomainError {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: unknown
  ) {
    super(message, 'VALIDATION_ERROR', { field, value });
  }
}

/**
 * Not found errors - requested resource doesn't exist
 */
export class NotFoundError extends DomainError {
  constructor(
    message: string,
    public readonly resourceType: string,
    public readonly resourceId: string
  ) {
    super(message, 'NOT_FOUND', { resourceType, resourceId });
  }
}

/**
 * Insufficient resource errors - not enough of something to complete operation
 */
export class InsufficientResourceError extends DomainError {
  constructor(
    message: string,
    public readonly resourceType: string,
    public readonly required: number | bigint,
    public readonly available: number | bigint
  ) {
    super(message, 'INSUFFICIENT_RESOURCE', { resourceType, required, available });
  }
}

/**
 * Operation timeout errors - operation took too long
 */
export class TimeoutError extends DomainError {
  constructor(
    message: string,
    public readonly timeoutMs: number,
    public readonly operation: string
  ) {
    super(message, 'TIMEOUT', { timeoutMs, operation });
  }
}

/**
 * Network errors - communication with external service failed
 */
export class NetworkError extends DomainError {
  constructor(
    message: string,
    public readonly url?: string,
    public readonly statusCode?: number,
    public readonly cause?: unknown
  ) {
    super(message, 'NETWORK_ERROR', { url, statusCode, cause });
  }
}

/**
 * Circuit breaker open errors - service is temporarily unavailable
 */
export class CircuitBreakerOpenError extends DomainError {
  constructor(
    message: string,
    public readonly circuitName: string,
    public readonly nextAttemptAt?: Date
  ) {
    super(message, 'CIRCUIT_BREAKER_OPEN', {
      circuitName,
      nextAttemptAt: nextAttemptAt?.toISOString(),
    });
  }
}

/**
 * Serialization errors - data couldn't be serialized/deserialized
 */
export class SerializationError extends DomainError {
  constructor(
    message: string,
    public readonly operation: 'serialize' | 'deserialize',
    public readonly dataType?: string
  ) {
    super(message, 'SERIALIZATION_ERROR', { operation, dataType });
  }
}

/**
 * Storage errors - persistent storage operation failed
 */
export class StorageError extends DomainError {
  constructor(
    message: string,
    public readonly operation: 'read' | 'write' | 'delete' | 'init',
    public readonly storeName?: string,
    public readonly cause?: unknown
  ) {
    super(message, 'STORAGE_ERROR', { operation, storeName, cause });
  }
}

/**
 * Transaction errors - multi-step operation failed
 */
export class TransactionError extends DomainError {
  constructor(
    message: string,
    public readonly operationId: string,
    public readonly cause?: unknown,
    public readonly completedOperations?: string[]
  ) {
    super(message, 'TRANSACTION_ERROR', { operationId, cause, completedOperations });
  }
}

/**
 * Migration errors - database migration failed
 */
export class MigrationError extends DomainError {
  constructor(
    message: string,
    public readonly version: number,
    public readonly direction: 'up' | 'down',
    public readonly cause?: unknown
  ) {
    super(message, 'MIGRATION_ERROR', { version, direction, cause });
  }
}

/**
 * Configuration errors - invalid configuration
 */
export class ConfigurationError extends DomainError {
  constructor(
    message: string,
    public readonly configKey?: string,
    public readonly configValue?: unknown
  ) {
    super(message, 'CONFIGURATION_ERROR', { configKey, configValue });
  }
}

/**
 * Authorization errors - user not authorized to perform action
 */
export class AuthorizationError extends DomainError {
  constructor(
    message: string,
    public readonly action: string,
    public readonly resource?: string
  ) {
    super(message, 'AUTHORIZATION_ERROR', { action, resource });
  }
}

/**
 * Business logic errors - operation violates business rules
 */
export class BusinessLogicError extends DomainError {
  constructor(
    message: string,
    public readonly rule: string
  ) {
    super(message, 'BUSINESS_LOGIC_ERROR', { rule });
  }
}

/**
 * Conflict errors - operation conflicts with current state
 */
export class ConflictError extends DomainError {
  constructor(
    message: string,
    public readonly resourceType: string,
    public readonly resourceId: string,
    public readonly conflictReason: string
  ) {
    super(message, 'CONFLICT', { resourceType, resourceId, conflictReason });
  }
}

/**
 * Rate limit errors - too many requests
 */
export class RateLimitError extends DomainError {
  constructor(
    message: string,
    public readonly limit: number,
    public readonly windowMs: number,
    public readonly retryAfterMs?: number
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED', { limit, windowMs, retryAfterMs });
  }
}

/**
 * Type guards for error classes
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError;
}

export function isInsufficientResourceError(error: unknown): error is InsufficientResourceError {
  return error instanceof InsufficientResourceError;
}

export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}

export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

export function isCircuitBreakerOpenError(error: unknown): error is CircuitBreakerOpenError {
  return error instanceof CircuitBreakerOpenError;
}

export function isSerializationError(error: unknown): error is SerializationError {
  return error instanceof SerializationError;
}

export function isStorageError(error: unknown): error is StorageError {
  return error instanceof StorageError;
}

export function isTransactionError(error: unknown): error is TransactionError {
  return error instanceof TransactionError;
}

export function isMigrationError(error: unknown): error is MigrationError {
  return error instanceof MigrationError;
}

export function isConfigurationError(error: unknown): error is ConfigurationError {
  return error instanceof ConfigurationError;
}

export function isAuthorizationError(error: unknown): error is AuthorizationError {
  return error instanceof AuthorizationError;
}

export function isBusinessLogicError(error: unknown): error is BusinessLogicError {
  return error instanceof BusinessLogicError;
}

export function isConflictError(error: unknown): error is ConflictError {
  return error instanceof ConflictError;
}

export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}

/**
 * Error code enum for programmatic handling
 */
export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  INSUFFICIENT_RESOURCE = 'INSUFFICIENT_RESOURCE',
  TIMEOUT = 'TIMEOUT',
  NETWORK_ERROR = 'NETWORK_ERROR',
  CIRCUIT_BREAKER_OPEN = 'CIRCUIT_BREAKER_OPEN',
  SERIALIZATION_ERROR = 'SERIALIZATION_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',
  TRANSACTION_ERROR = 'TRANSACTION_ERROR',
  MIGRATION_ERROR = 'MIGRATION_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  BUSINESS_LOGIC_ERROR = 'BUSINESS_LOGIC_ERROR',
  CONFLICT = 'CONFLICT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Type guard for DomainError
 */
export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
// Re-export DomainError from result
export { DomainError } from './result.js';
