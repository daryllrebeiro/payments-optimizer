/**
 * Tests for structured error classes
 * Epic 1.6: Structured Errors, Result-Type Standardization
 */

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
  ErrorCode,
  isValidationError,
  isNotFoundError,
  isNetworkError,
  isTimeoutError,
} from './errors';

describe('Structured Errors', () => {
  describe('ValidationError', () => {
    it('should create with field and value context', () => {
      const error = new ValidationError('Email is invalid', 'email', 'not-an-email');

      expect(error.message).toBe('Email is invalid');
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.field).toBe('email');
      expect(error.value).toBe('not-an-email');
      expect(error.name).toBe('ValidationError');
    });

    it('should work without field and value', () => {
      const error = new ValidationError('General validation error');
      expect(error.message).toBe('General validation error');
      expect(error.field).toBeUndefined();
      expect(error.value).toBeUndefined();
    });

    it('should be detected by type guard', () => {
      const error = new ValidationError('Test');
      expect(isValidationError(error)).toBe(true);
      expect(isValidationError(new Error('Regular'))).toBe(false);
    });
  });

  describe('NotFoundError', () => {
    it('should create with resource type and ID', () => {
      const error = new NotFoundError('User not found', 'User', '123');

      expect(error.message).toBe('User not found');
      expect(error.code).toBe(ErrorCode.NOT_FOUND);
      expect(error.resourceType).toBe('User');
      expect(error.resourceId).toBe('123');
      expect(error.context).toEqual({ resourceType: 'User', resourceId: '123' });
    });

    it('should be detected by type guard', () => {
      const error = new NotFoundError('Not found', 'Item', '456');
      expect(isNotFoundError(error)).toBe(true);
    });
  });

  describe('InsufficientResourceError', () => {
    it('should create with numeric amounts', () => {
      const error = new InsufficientResourceError('Not enough balance', 'AccountBalance', 100, 50);

      expect(error.message).toBe('Not enough balance');
      expect(error.code).toBe(ErrorCode.INSUFFICIENT_RESOURCE);
      expect(error.resourceType).toBe('AccountBalance');
      expect(error.required).toBe(100);
      expect(error.available).toBe(50);
    });

    it('should work with BigInt amounts', () => {
      const error = new InsufficientResourceError(
        'Not enough voucher balance',
        'VoucherBalance',
        BigInt(10000),
        BigInt(5000)
      );

      expect(error.required).toBe(BigInt(10000));
      expect(error.available).toBe(BigInt(5000));
    });
  });

  describe('TimeoutError', () => {
    it('should create with timeout and operation details', () => {
      const error = new TimeoutError('Operation timed out', 5000, 'fetchOffers');

      expect(error.message).toBe('Operation timed out');
      expect(error.code).toBe(ErrorCode.TIMEOUT);
      expect(error.timeoutMs).toBe(5000);
      expect(error.operation).toBe('fetchOffers');
    });

    it('should be detected by type guard', () => {
      const error = new TimeoutError('Timeout', 1000, 'test');
      expect(isTimeoutError(error)).toBe(true);
    });
  });

  describe('NetworkError', () => {
    it('should create with all details', () => {
      const cause = new Error('Connection refused');
      const error = new NetworkError('Failed to fetch', 'https://api.example.com', 500, cause);

      expect(error.message).toBe('Failed to fetch');
      expect(error.code).toBe(ErrorCode.NETWORK_ERROR);
      expect(error.url).toBe('https://api.example.com');
      expect(error.statusCode).toBe(500);
      expect(error.cause).toBe(cause);
    });

    it('should work with minimal details', () => {
      const error = new NetworkError('Network error');
      expect(error.url).toBeUndefined();
      expect(error.statusCode).toBeUndefined();
      expect(error.cause).toBeUndefined();
    });

    it('should be detected by type guard', () => {
      const error = new NetworkError('Network failed');
      expect(isNetworkError(error)).toBe(true);
    });
  });

  describe('CircuitBreakerOpenError', () => {
    it('should create with circuit name and next attempt time', () => {
      const nextAttempt = new Date('2026-09-07T10:00:00Z');
      const error = new CircuitBreakerOpenError('Circuit is open', 'offer-api', nextAttempt);

      expect(error.message).toBe('Circuit is open');
      expect(error.code).toBe(ErrorCode.CIRCUIT_BREAKER_OPEN);
      expect(error.circuitName).toBe('offer-api');
      expect(error.nextAttemptAt).toBe(nextAttempt);
    });

    it('should work without next attempt time', () => {
      const error = new CircuitBreakerOpenError('Circuit open', 'test-circuit');
      expect(error.nextAttemptAt).toBeUndefined();
    });
  });

  describe('SerializationError', () => {
    it('should create for serialization', () => {
      const error = new SerializationError('Failed to serialize', 'serialize', 'User');

      expect(error.message).toBe('Failed to serialize');
      expect(error.code).toBe(ErrorCode.SERIALIZATION_ERROR);
      expect(error.operation).toBe('serialize');
      expect(error.dataType).toBe('User');
    });

    it('should create for deserialization', () => {
      const error = new SerializationError('Failed to deserialize', 'deserialize', 'Cart');
      expect(error.operation).toBe('deserialize');
      expect(error.dataType).toBe('Cart');
    });
  });

  describe('StorageError', () => {
    it('should create with all details', () => {
      const cause = new Error('Database locked');
      const error = new StorageError('Failed to write', 'write', 'users', cause);

      expect(error.message).toBe('Failed to write');
      expect(error.code).toBe(ErrorCode.STORAGE_ERROR);
      expect(error.operation).toBe('write');
      expect(error.storeName).toBe('users');
      expect(error.cause).toBe(cause);
    });

    it('should support all operation types', () => {
      const readErr = new StorageError('Read failed', 'read');
      expect(readErr.operation).toBe('read');

      const writeErr = new StorageError('Write failed', 'write');
      expect(writeErr.operation).toBe('write');

      const deleteErr = new StorageError('Delete failed', 'delete');
      expect(deleteErr.operation).toBe('delete');

      const initErr = new StorageError('Init failed', 'init');
      expect(initErr.operation).toBe('init');
    });
  });

  describe('TransactionError', () => {
    it('should create with operation context', () => {
      const cause = new Error('Operation failed');
      const error = new TransactionError('Transaction failed', 'burnVoucher', cause, [
        'saveProfile',
        'updateBalance',
      ]);

      expect(error.message).toBe('Transaction failed');
      expect(error.code).toBe(ErrorCode.TRANSACTION_ERROR);
      expect(error.operationId).toBe('burnVoucher');
      expect(error.cause).toBe(cause);
      expect(error.completedOperations).toEqual(['saveProfile', 'updateBalance']);
    });
  });

  describe('MigrationError', () => {
    it('should create for up migration', () => {
      const cause = new Error('Schema change failed');
      const error = new MigrationError('Migration v2 failed', 2, 'up', cause);

      expect(error.message).toBe('Migration v2 failed');
      expect(error.code).toBe(ErrorCode.MIGRATION_ERROR);
      expect(error.version).toBe(2);
      expect(error.direction).toBe('up');
      expect(error.cause).toBe(cause);
    });

    it('should create for down migration', () => {
      const error = new MigrationError('Rollback failed', 3, 'down');
      expect(error.direction).toBe('down');
      expect(error.version).toBe(3);
    });
  });

  describe('ConfigurationError', () => {
    it('should create with config details', () => {
      const error = new ConfigurationError('Invalid timeout', 'api.timeout', '5000');

      expect(error.message).toBe('Invalid timeout');
      expect(error.code).toBe(ErrorCode.CONFIGURATION_ERROR);
      expect(error.configKey).toBe('api.timeout');
      expect(error.configValue).toBe('5000');
    });
  });

  describe('AuthorizationError', () => {
    it('should create with action and resource', () => {
      const error = new AuthorizationError('Access denied', 'delete', 'user:123');

      expect(error.message).toBe('Access denied');
      expect(error.code).toBe(ErrorCode.AUTHORIZATION_ERROR);
      expect(error.action).toBe('delete');
      expect(error.resource).toBe('user:123');
    });
  });

  describe('BusinessLogicError', () => {
    it('should create with rule name', () => {
      const error = new BusinessLogicError('Cannot stack vouchers', 'voucher-stacking-limit');

      expect(error.message).toBe('Cannot stack vouchers');
      expect(error.code).toBe(ErrorCode.BUSINESS_LOGIC_ERROR);
      expect(error.rule).toBe('voucher-stacking-limit');
    });
  });

  describe('ConflictError', () => {
    it('should create with conflict details', () => {
      const error = new ConflictError(
        'Resource already exists',
        'User',
        '123',
        'Email already registered'
      );

      expect(error.message).toBe('Resource already exists');
      expect(error.code).toBe(ErrorCode.CONFLICT);
      expect(error.resourceType).toBe('User');
      expect(error.resourceId).toBe('123');
      expect(error.conflictReason).toBe('Email already registered');
    });
  });

  describe('RateLimitError', () => {
    it('should create with rate limit details', () => {
      const error = new RateLimitError('Too many requests', 100, 60000, 30000);

      expect(error.message).toBe('Too many requests');
      expect(error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
      expect(error.limit).toBe(100);
      expect(error.windowMs).toBe(60000);
      expect(error.retryAfterMs).toBe(30000);
    });

    it('should work without retry after', () => {
      const error = new RateLimitError('Rate limited', 10, 1000);
      expect(error.retryAfterMs).toBeUndefined();
    });
  });

  describe('Error serialization', () => {
    it('should serialize to JSON with all context', () => {
      const error = new ValidationError('Invalid input', 'email', 'bad@');
      const json = error.toJSON();

      expect(json.name).toBe('ValidationError');
      expect(json.message).toBe('Invalid input');
      expect(json.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(json.context).toEqual({ field: 'email', value: 'bad@' });
      expect(json.stack).toBeDefined();
    });

    it('should serialize complex error with nested context', () => {
      const error = new NetworkError('Request failed', 'https://api.test.com', 503, {
        retries: 3,
        lastError: 'Connection timeout',
      });

      const json = error.toJSON();
      expect(json.code).toBe(ErrorCode.NETWORK_ERROR);
      expect(json.context).toEqual({
        url: 'https://api.test.com',
        statusCode: 503,
        cause: { retries: 3, lastError: 'Connection timeout' },
      });
    });
  });

  describe('Error codes enum', () => {
    it('should contain all error codes', () => {
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
});
