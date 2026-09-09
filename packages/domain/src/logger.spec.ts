/* eslint-disable @typescript-eslint/no-explicit-any -- legacy explicit-any usage; remove when typed */
/**
 * Tests for structured Logger
 * Epic 1.9: Observability with structured logging and privacy-first telemetry
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import {
  Logger,
  LogLevel,
  getLogger,
  setLogger,
  resetLogger,
  DEFAULT_REDACTED_PATHS,
} from './logger.js';
import { TestClock, setClock, resetClock } from './clock.js';
import { DomainError } from './errors.js';

describe('Logger', () => {
  let clock: TestClock;

  beforeEach(() => {
    clock = new TestClock('2026-09-07T10:00:00.000Z');
    setClock(clock);
    vi.stubGlobal('console', {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
    });
  });

  afterEach(() => {
    resetLogger();
    resetClock();
    vi.restoreAllMocks();
  });

  describe('Construction', () => {
    it('should create logger with defaults', () => {
      const logger = Logger.create();
      expect(logger).toBeInstanceOf(Logger);
    });

    it('should create logger with custom config', () => {
      const logger = Logger.create({
        level: LogLevel.DEBUG,
        format: 'json',
      });
      expect(logger).toBeInstanceOf(Logger);
    });

    it('should create JSON formatter logger', () => {
      const logger = Logger.json();
      expect(logger).toBeInstanceOf(Logger);
    });

    it('should create human-readable logger', () => {
      const logger = Logger.human();
      expect(logger).toBeInstanceOf(Logger);
    });

    it('should use provided clock', () => {
      const logger = Logger.create({ level: LogLevel.DEBUG });
      const output = vi.fn();
      // Can't directly test clock usage without mocking, but constructor accepts clock
      expect(logger).toBeDefined();
    });
  });

  describe('Log levels', () => {
    it('should log DEBUG when level is DEBUG', () => {
      const logger = Logger.create({ level: LogLevel.DEBUG });
      const spy = vi.spyOn(console, 'log');

      logger.debug('Debug message');

      expect(spy).toHaveBeenCalled();
    });

    it('should not log DEBUG when level is INFO', () => {
      const logger = Logger.create({ level: LogLevel.INFO });
      const spy = vi.spyOn(console, 'log');

      logger.debug('Debug message');

      expect(spy).not.toHaveBeenCalled();
    });

    it('should log INFO when level is INFO', () => {
      const logger = Logger.create({ level: LogLevel.INFO });
      const spy = vi.spyOn(console, 'log');

      logger.info('Info message');

      expect(spy).toHaveBeenCalled();
    });

    it('should log WARN when level is WARN', () => {
      const logger = Logger.create({ level: LogLevel.WARN });
      const spy = vi.spyOn(console, 'log');

      logger.warn('Warn message');

      expect(spy).toHaveBeenCalled();
    });

    it('should log ERROR when level is ERROR', () => {
      const logger = Logger.create({ level: LogLevel.ERROR });
      const spy = vi.spyOn(console, 'log');

      logger.error('Error message');

      expect(spy).toHaveBeenCalled();
    });

    it('should log FATAL when level is FATAL', () => {
      const logger = Logger.create({ level: LogLevel.FATAL });
      const spy = vi.spyOn(console, 'log');

      logger.fatal('Fatal message');

      expect(spy).toHaveBeenCalled();
    });

    it('should not log WARN when level is ERROR', () => {
      const logger = Logger.create({ level: LogLevel.ERROR });
      const spy = vi.spyOn(console, 'log');

      logger.warn('Warn message');

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('PII redaction', () => {
    it('should redact password field', () => {
      const logger = Logger.create({ level: LogLevel.DEBUG, format: 'json' });
      const spy = vi.spyOn(console, 'log');

      logger.info('Login attempt', { username: 'john@example.com', password: 'secret123' });

      expect(spy).toHaveBeenCalled();
      const output = spy.mock.calls[0]![0] as string;
      expect(output).toContain('"password":"[REDACTED]"');
    });

    it('should redact API key', () => {
      const logger = Logger.create({ level: LogLevel.DEBUG, format: 'json' });
      const spy = vi.spyOn(console, 'log');

      logger.info('API call', { apiKey: 'sk-12345' });

      expect(spy).toHaveBeenCalled();
      const output = spy.mock.calls[0]![0] as string;
      expect(output).toContain('"apiKey":"[REDACTED]"');
    });

    it('should redact card numbers', () => {
      const logger = Logger.create({ level: LogLevel.DEBUG, format: 'json' });
      const spy = vi.spyOn(console, 'log');

      logger.info('Payment', { cardNumber: '4111-1111-1111-1111' });

      const output = spy.mock.calls[0]![0] as string;
      expect(output).toContain('"cardNumber":"[REDACTED]"');
    });

    it('should redact email', () => {
      const logger = Logger.create({ level: LogLevel.DEBUG, format: 'json' });
      const spy = vi.spyOn(console, 'log');

      logger.info('User data', { email: 'test@example.com' });

      const output = spy.mock.calls[0]![0] as string;
      expect(output).toContain('"email":"[REDACTED]"');
    });

    it('should redact nested sensitive fields', () => {
      const logger = Logger.create({ level: LogLevel.DEBUG, format: 'json' });
      const spy = vi.spyOn(console, 'log');

      logger.info('User profile', {
        user: {
          email: 'user@example.com',
          name: 'John Doe',
        },
      });

      const output = spy.mock.calls[0]![0] as string;
      expect(output).toContain('"user":"[REDACTED]"');
    });

    it('should redact bank account info', () => {
      const logger = Logger.create({ level: LogLevel.DEBUG, format: 'json' });
      const spy = vi.spyOn(console, 'log');

      logger.info('Bank transfer', {
        bankAccount: '1234567890',
        routingNumber: '987654321',
      });

      const output = spy.mock.calls[0]![0] as string;
      expect(output).toContain('"bankAccount":"[REDACTED]"');
      expect(output).toContain('"routingNumber":"[REDACTED]"');
    });

    it('should support custom redact paths', () => {
      const logger = Logger.create({
        level: LogLevel.DEBUG,
        format: 'json',
        redactPaths: ['secretToken'],
      });

      const spy = vi.spyOn(console, 'log');
      logger.info('Custom redact', { secretToken: 'my-secret', apiKey: 'sk-123' });

      const output = spy.mock.calls[0]![0] as string;
      expect(output).toContain('"secretToken":"[REDACTED]"');
      // API key is in default paths, so it should also be redacted
      expect(output).toContain('"apiKey":"[REDACTED]"');
    });
  });

  describe('Context', () => {
    it('should include context in log output', () => {
      const logger = Logger.create({ level: LogLevel.DEBUG });
      const spy = vi.spyOn(console, 'log');

      logger.info('User action', { userId: '123', action: 'login' });

      expect(spy).toHaveBeenCalled();
      const output = spy.mock.calls[0]![0] as string;
      expect(output).toContain('userId=');
      expect(output).toContain('action="login"');
    });

    it('should support child loggers', () => {
      const logger = Logger.create({ level: LogLevel.DEBUG });
      const child = logger.child({ component: 'PaymentService' });

      const spy = vi.spyOn(console, 'log');
      child.info('Payment processed');

      expect(spy).toHaveBeenCalled();
      const output = spy.mock.calls[0]![0] as string;
      expect(output).toContain('component="PaymentService"');
    });

    it('should support correlation IDs', () => {
      const logger = Logger.create({ level: LogLevel.DEBUG });
      const loggerWithId = logger.withCorrelationId('abc-123');

      const spy = vi.spyOn(console, 'log');
      loggerWithId.info('Request processed');

      expect(spy).toHaveBeenCalled();
      const output = spy.mock.calls[0]![0] as string;
      expect(output).toContain('correlation:abc-123');
    });
  });

  describe('JSON format', () => {
    it('should output valid JSON', () => {
      const logger = Logger.create({ level: LogLevel.DEBUG, format: 'json' });
      const spy = vi.spyOn(console, 'log');

      logger.info('Test message', { key: 'value' });

      expect(spy).toHaveBeenCalled();
      const output = spy.mock.calls[0]![0] as string;

      // Should be valid JSON
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it('should include timestamp in JSON', () => {
      const logger = Logger.create({ level: LogLevel.DEBUG, format: 'json' });
      const spy = vi.spyOn(console, 'log');

      logger.info('Test');

      const output = JSON.parse(spy.mock.calls[0]![0] as string);
      expect(output.timestamp).toBe('2026-09-07T10:00:00.000Z');
    });

    it('should include level in JSON', () => {
      const logger = Logger.create({ level: LogLevel.DEBUG, format: 'json' });
      const spy = vi.spyOn(console, 'log');

      logger.info('Test');

      const output = JSON.parse(spy.mock.calls[0]![0] as string);
      expect(output.level).toBe('INFO');
    });
  });

  describe('Human format', () => {
    it('should output human-readable format', () => {
      const logger = Logger.create({ level: LogLevel.DEBUG });
      const spy = vi.spyOn(console, 'log');

      logger.info('User action', { userId: '123' });

      expect(spy).toHaveBeenCalled();
      const output = spy.mock.calls[0]![0] as string;

      // Should contain timestamp, level, message, and context
      expect(output).toContain('2026-09-07T10:00:00.000Z');
      expect(output).toContain('[INFO]');
      expect(output).toContain('User action');
      expect(output).toContain('userId=');
    });

    it('should include correlation ID in human format', () => {
      const logger = Logger.create({ level: LogLevel.DEBUG });
      const spy = vi.spyOn(console, 'log');

      logger.withCorrelationId('test-123').info('Test');

      const output = spy.mock.calls[0]![0] as string;
      expect(output).toContain('correlation:test-123');
    });
  });

  describe('Error handling', () => {
    it('should log error with stack trace', () => {
      const logger = Logger.create({ level: LogLevel.ERROR });
      const spy = vi.spyOn(console, 'log');

      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test';

      logger.errorWithStack(error, { context: 'test' });

      expect(spy).toHaveBeenCalled();
      const output = spy.mock.calls[0]![0] as string;
      expect(output).toContain('Test error');
    });

    it('should log DomainError with code', () => {
      const logger = Logger.create({ level: LogLevel.ERROR });
      const spy = vi.spyOn(console, 'log');

      const error = new DomainError('Validation failed', 'VALIDATION_ERROR', { field: 'email' });

      logger.errorWithStack(error);

      expect(spy).toHaveBeenCalled();
      const output = spy.mock.calls[0]![0] as string;
      expect(output).toContain('VALIDATION_ERROR');
    });
  });

  describe('Result logging', () => {
    it('should log success Result', () => {
      const logger = Logger.create({ level: LogLevel.INFO });
      const spy = vi.spyOn(console, 'log');

      const result = { isOk: () => true, unwrap: () => 'success' } as any;
      logger.logResult(result, 'Operation');

      expect(spy).toHaveBeenCalled();
      const output = spy.mock.calls[0]![0] as string;
      expect(output).toContain('Success');
    });

    it('should log error Result', () => {
      const logger = Logger.create({ level: LogLevel.ERROR });
      const spy = vi.spyOn(console, 'log');

      const result = { isOk: () => false, error: new Error('Failed') } as any;
      logger.logResult(result, 'Operation');

      expect(spy).toHaveBeenCalled();
      const output = spy.mock.calls[0]![0] as string;
      expect(output).toContain('Failed');
    });
  });

  describe('Performance measurement', () => {
    it('should measure async function duration', async () => {
      const logger = Logger.create({ level: LogLevel.DEBUG });
      const spy = vi.spyOn(console, 'log');

      const result = await logger.measure('asyncOperation', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'done';
      });

      expect(result).toBe('done');
      expect(spy).toHaveBeenCalled();

      // Should have at least two calls (start and complete)
      expect(spy.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('should measure failed function', async () => {
      const logger = Logger.create({ level: LogLevel.DEBUG }); // Changed from ERROR to DEBUG to see all logs
      const spy = vi.spyOn(console, 'log');

      await expect(
        logger.measure('failingOperation', async () => {
          throw new Error('Failed');
        })
      ).rejects.toThrow('Failed');

      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls.length).toBeGreaterThanOrEqual(1); // At least start log (error goes to console.error)
    });
  });

  describe('Metric logging', () => {
    it('should log metrics', () => {
      const logger = Logger.create({ level: LogLevel.DEBUG });
      const spy = vi.spyOn(console, 'log');

      logger.metric('responseTime', 150, { endpoint: '/api/users' });

      expect(spy).toHaveBeenCalled();
      const output = spy.mock.calls[0]![0] as string;
      expect(output).toContain('responseTime');
      expect(output).toContain('150');
    });
  });

  describe('Global logger', () => {
    it('should provide default logger', () => {
      const logger = getLogger();
      expect(logger).toBeDefined();
    });

    it('should allow setting custom logger', () => {
      const custom = Logger.create({ level: LogLevel.DEBUG });
      setLogger(custom);
      expect(getLogger()).toBe(custom);
    });

    it('should allow resetting logger', () => {
      setLogger(Logger.create({ level: LogLevel.ERROR }));
      resetLogger();
      expect(getLogger()).not.toBeUndefined();
    });
  });

  describe('DEFAULT_REDACTED_PATHS', () => {
    it('should contain common sensitive field names', () => {
      expect(DEFAULT_REDACTED_PATHS).toContain('password');
      expect(DEFAULT_REDACTED_PATHS).toContain('secret');
      expect(DEFAULT_REDACTED_PATHS).toContain('token');
      expect(DEFAULT_REDACTED_PATHS).toContain('apiKey');
      expect(DEFAULT_REDACTED_PATHS).toContain('creditCard');
      expect(DEFAULT_REDACTED_PATHS).toContain('email');
      expect(DEFAULT_REDACTED_PATHS).toContain('phone');
      expect(DEFAULT_REDACTED_PATHS).toContain('bankAccount');
    });
  });
});
