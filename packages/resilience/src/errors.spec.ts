import { describe, it, expect } from 'vitest';
import {
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
  DomainError,
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
  toDomainError,
} from './errors.js';

describe('Error classes', () => {
  describe('ValidationError', () => {
    it('creates error with code VALIDATION_ERROR', () => {
      const error = new ValidationError('Invalid input', 'email', 'invalid');
      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.context?.field).toBe('email');
      expect(error.context?.value).toBe('invalid');
    });

    it('works without optional fields', () => {
      const error = new ValidationError('Required field missing');
      expect(error.message).toBe('Required field missing');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.context).toEqual({ field: undefined, value: undefined });
    });
  });

  describe('NotFoundError', () => {
    it('creates error with code NOT_FOUND', () => {
      const error = new NotFoundError('Card not found', 'card', 'card-123');
      expect(error.message).toBe('Card not found');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.context?.resourceType).toBe('card');
      expect(error.context?.resourceId).toBe('card-123');
    });
  });

  describe('InsufficientResourceError', () => {
    it('creates error with code INSUFFICIENT_RESOURCE', () => {
      const error = new InsufficientResourceError('Not enough points', 'points', 1000, 500);
      expect(error.message).toBe('Not enough points');
      expect(error.code).toBe('INSUFFICIENT_RESOURCE');
      expect(error.context?.resourceType).toBe('points');
      expect(error.context?.required).toBe(1000);
      expect(error.context?.available).toBe(500);
    });
  });

  describe('TimeoutError', () => {
    it('creates error with code TIMEOUT', () => {
      const error = new TimeoutError('Request timed out', 5000, 'fetch offers');
      expect(error.message).toBe('Request timed out');
      expect(error.code).toBe('TIMEOUT');
      expect(error.context?.timeoutMs).toBe(5000);
      expect(error.context?.operation).toBe('fetch offers');
    });
  });

  describe('NetworkError', () => {
    it('creates error with code NETWORK_ERROR', () => {
      const error = new NetworkError('Connection refused', 'https://api.example.com', 503, 'ECONNREFUSED');
      expect(error.message).toBe('Connection refused');
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.context?.url).toBe('https://api.example.com');
      expect(error.context?.statusCode).toBe(503);
      expect(error.context?.cause).toBe('ECONNREFUSED');
    });

    it('works with minimal args', () => {
      const error = new NetworkError('Network failed');
      expect(error.code).toBe('NETWORK_ERROR');
    });
  });

  describe('CircuitBreakerOpenError', () => {
    it('creates error with code CIRCUIT_BREAKER_OPEN', () => {
      const nextAttempt = new Date('2026-01-01T00:00:00Z');
      const error = new CircuitBreakerOpenError('Circuit open', 'offer-api', nextAttempt);
      expect(error.message).toBe('Circuit open');
      expect(error.code).toBe('CIRCUIT_BREAKER_OPEN');
      expect(error.context?.circuitName).toBe('offer-api');
      expect(error.context?.nextAttemptAt).toBe('2026-01-01T00:00:00.000Z');
    });

    it('works without nextAttemptAt', () => {
      const error = new CircuitBreakerOpenError('Circuit open', 'test');
      expect(error.code).toBe('CIRCUIT_BREAKER_OPEN');
      expect(error.context?.circuitName).toBe('test');
      expect(error.context?.nextAttemptAt).toBeUndefined();
    });
  });

  describe('SerializationError', () => {
    it('creates error with code SERIALIZATION_ERROR', () => {
      const error = new SerializationError('Invalid JSON', 'deserialize', 'Offer');
      expect(error.message).toBe('Invalid JSON');
      expect(error.code).toBe('SERIALIZATION_ERROR');
      expect(error.context?.operation).toBe('deserialize');
      expect(error.context?.dataType).toBe('Offer');
    });
  });

  describe('StorageError', () => {
    it('creates error with code STORAGE_ERROR', () => {
      const error = new StorageError('Write failed', 'write', 'savings', 'disk full');
      expect(error.message).toBe('Write failed');
      expect(error.code).toBe('STORAGE_ERROR');
      expect(error.context?.operation).toBe('write');
      expect(error.context?.storeName).toBe('savings');
      expect(error.context?.cause).toBe('disk full');
    });
  });

  describe('TransactionError', () => {
    it('creates error with code TRANSACTION_ERROR', () => {
      const error = new TransactionError('Multi-step failed', 'txn-123', 'timeout', ['step1', 'step2']);
      expect(error.message).toBe('Multi-step failed');
      expect(error.code).toBe('TRANSACTION_ERROR');
      expect(error.context?.operationId).toBe('txn-123');
      expect(error.context?.cause).toBe('timeout');
      expect(error.context?.completedOperations).toEqual(['step1', 'step2']);
    });
  });

  describe('MigrationError', () => {
    it('creates error with code MIGRATION_ERROR', () => {
      const error = new MigrationError('Migration v2 failed', 2, 'up', 'index exists');
      expect(error.message).toBe('Migration v2 failed');
      expect(error.code).toBe('MIGRATION_ERROR');
      expect(error.context?.version).toBe(2);
      expect(error.context?.direction).toBe('up');
      expect(error.context?.cause).toBe('index exists');
    });
  });

  describe('ConfigurationError', () => {
    it('creates error with code CONFIGURATION_ERROR', () => {
      const error = new ConfigurationError('Invalid threshold', 'failureThreshold', -1);
      expect(error.message).toBe('Invalid threshold');
      expect(error.code).toBe('CONFIGURATION_ERROR');
      expect(error.context?.configKey).toBe('failureThreshold');
      expect(error.context?.configValue).toBe(-1);
    });
  });

  describe('AuthorizationError', () => {
    it('creates error with code AUTHORIZATION_ERROR', () => {
      const error = new AuthorizationError('Not allowed', 'delete', 'card-123');
      expect(error.message).toBe('Not allowed');
      expect(error.code).toBe('AUTHORIZATION_ERROR');
      expect(error.context?.action).toBe('delete');
      expect(error.context?.resource).toBe('card-123');
    });
  });

  describe('BusinessLogicError', () => {
    it('creates error with code BUSINESS_LOGIC_ERROR', () => {
      const error = new BusinessLogicError('Cannot apply expired voucher', 'voucher_expiry');
      expect(error.message).toBe('Cannot apply expired voucher');
      expect(error.code).toBe('BUSINESS_LOGIC_ERROR');
      expect(error.context?.rule).toBe('voucher_expiry');
    });
  });

  describe('ConflictError', () => {
    it('creates error with code CONFLICT', () => {
      const error = new ConflictError('Voucher already used', 'voucher', 'voucher-123', 'already redeemed');
      expect(error.message).toBe('Voucher already used');
      expect(error.code).toBe('CONFLICT');
      expect(error.context?.resourceType).toBe('voucher');
      expect(error.context?.resourceId).toBe('voucher-123');
      expect(error.context?.conflictReason).toBe('already redeemed');
    });
  });

  describe('RateLimitError', () => {
    it('creates error with code RATE_LIMIT_EXCEEDED', () => {
      const error = new RateLimitError('Too many requests', 10, 60000, 30000);
      expect(error.message).toBe('Too many requests');
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.context?.limit).toBe(10);
      expect(error.context?.windowMs).toBe(60000);
      expect(error.context?.retryAfterMs).toBe(30000);
    });
  });

  describe('DomainError base class', () => {
    it('serializes to JSON', () => {
      const error = new ValidationError('test', 'field', 'value');
      const json = error.toJSON();
      expect(json.name).toBe('ValidationError');
      expect(json.message).toBe('test');
      expect(json.code).toBe('VALIDATION_ERROR');
      expect(json.context).toEqual({ field: 'field', value: 'value' });
      expect(json.stack).toBeDefined();
    });
  });

  describe('ErrorCode enum', () => {
    it('contains all expected codes', () => {
      expect(ErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
      expect(ErrorCode.NOT_FOUND).toBe('NOT_FOUND');
      expect(ErrorCode.INSUFFICIENT_RESOURCE).toBe('INSUFFICIENT_RESOURCE');
      expect(ErrorCode.TIMEOUT).toBe('TIMEOUT');
      expect(ErrorCode.NETWORK_ERROR).toBe('NETWORK_ERROR');
      expect(ErrorCode.CIRCUIT_BREAKER_OPEN).toBe('CIRCUIT_BREAKER_OPEN');
      expect(ErrorCode.SERIALIZATION_ERROR).toBe('SERIALIZATION_ERROR');
      expect(ErrorCode.STORAGE_ERROR).toBe('STORAGE_ERROR');
      expect(ErrorCode.TRANSACTION_ERROR).toBe('TRANSACTION_ERROR');
      expect(ErrorCode.MIGRATION_ERROR).toBe('MIGRATION_ERROR');
      expect(ErrorCode.CONFIGURATION_ERROR).toBe('CONFIGURATION_ERROR');
      expect(ErrorCode.AUTHORIZATION_ERROR).toBe('AUTHORIZATION_ERROR');
      expect(ErrorCode.BUSINESS_LOGIC_ERROR).toBe('BUSINESS_LOGIC_ERROR');
      expect(ErrorCode.CONFLICT).toBe('CONFLICT');
      expect(ErrorCode.RATE_LIMIT_EXCEEDED).toBe('RATE_LIMIT_EXCEEDED');
      expect(ErrorCode.UNKNOWN_ERROR).toBe('UNKNOWN_ERROR');
    });
  });

  describe('Type guards', () => {
    it('isValidationError returns true for ValidationError', () => {
      expect(isValidationError(new ValidationError('test'))).toBe(true);
      expect(isValidationError(new NotFoundError('test', 'r', 'id'))).toBe(false);
      expect(isValidationError(new Error('test'))).toBe(false);
    });

    it('isNotFoundError returns true for NotFoundError', () => {
      expect(isNotFoundError(new NotFoundError('test', 'r', 'id'))).toBe(true);
    });

    it('isInsufficientResourceError returns true for InsufficientResourceError', () => {
      expect(isInsufficientResourceError(new InsufficientResourceError('test', 'r', 1, 0))).toBe(true);
    });

    it('isTimeoutError returns true for TimeoutError', () => {
      expect(isTimeoutError(new TimeoutError('test', 1000, 'op'))).toBe(true);
    });

    it('isNetworkError returns true for NetworkError', () => {
      expect(isNetworkError(new NetworkError('test'))).toBe(true);
    });

    it('isCircuitBreakerOpenError returns true for CircuitBreakerOpenError', () => {
      expect(isCircuitBreakerOpenError(new CircuitBreakerOpenError('test', 'name'))).toBe(true);
    });

    it('isSerializationError returns true for SerializationError', () => {
      expect(isSerializationError(new SerializationError('test', 'serialize'))).toBe(true);
    });

    it('isStorageError returns true for StorageError', () => {
      expect(isStorageError(new StorageError('test', 'write'))).toBe(true);
    });

    it('isTransactionError returns true for TransactionError', () => {
      expect(isTransactionError(new TransactionError('test', 'id'))).toBe(true);
    });

    it('isMigrationError returns true for MigrationError', () => {
      expect(isMigrationError(new MigrationError('test', 1, 'up'))).toBe(true);
    });

    it('isConfigurationError returns true for ConfigurationError', () => {
      expect(isConfigurationError(new ConfigurationError('test', 'key'))).toBe(true);
    });

    it('isAuthorizationError returns true for AuthorizationError', () => {
      expect(isAuthorizationError(new AuthorizationError('test', 'action'))).toBe(true);
    });

    it('isBusinessLogicError returns true for BusinessLogicError', () => {
      expect(isBusinessLogicError(new BusinessLogicError('test', 'rule'))).toBe(true);
    });

    it('isConflictError returns true for ConflictError', () => {
      expect(isConflictError(new ConflictError('test', 'type', 'id', 'reason'))).toBe(true);
    });

    it('isRateLimitError returns true for RateLimitError', () => {
      expect(isRateLimitError(new RateLimitError('test', 10, 1000))).toBe(true);
    });

    it('isDomainError returns true for all domain errors', () => {
      expect(isDomainError(new ValidationError('test'))).toBe(true);
      expect(isDomainError(new NotFoundError('test', 'r', 'id'))).toBe(true);
      expect(isDomainError(new Error('test'))).toBe(false);
    });

    it('toDomainError converts unknown errors', () => {
      const error = toDomainError(new Error('test'));
      expect(error).toBeInstanceOf(DomainError);
      expect(error.code).toBe('UNKNOWN_ERROR');
      expect(error.message).toBe('test');

      const error2 = toDomainError('string error');
      expect(error2).toBeInstanceOf(DomainError);
      expect(error2.code).toBe('UNKNOWN_ERROR');
      expect(error2.message).toBe('string error');

      const error3 = toDomainError({ custom: 'object' });
      expect(error3).toBeInstanceOf(DomainError);
      expect(error3.code).toBe('UNKNOWN_ERROR');
    });
  });
});