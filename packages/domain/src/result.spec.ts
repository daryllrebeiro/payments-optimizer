/**
 * Tests for Result<T, E> type and helpers
 * Epic 1.6: Structured Errors, Result-Type Standardization
 */

import { describe, it, expect } from 'vitest';
import {
  ok,
  err,
  Result,
  DomainError,
  tryCatch,
  tryCatchAsync,
  combine,
  combineAll,
  isDomainError,
  toDomainError,
} from './result.js';

describe('Result', () => {
  describe('Ok variant', () => {
    it('should create Ok with value', () => {
      const result = ok(42);
      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);
      expect(result.unwrap()).toBe(42);
    });

    it('should throw when calling unwrapErr on Ok', () => {
      const result = ok(42);
      expect(() => result.unwrapErr()).toThrow('Called unwrapErr on Ok variant');
    });

    it('should return value with unwrapOr', () => {
      const result = ok(42);
      expect(result.unwrapOr(100)).toBe(42);
    });

    it('should map values', () => {
      const result = ok(5);
      const mapped = result.map((x) => x * 2);
      expect(mapped.isOk()).toBe(true);
      expect(mapped.unwrap()).toBe(10);
    });

    it('should not apply mapErr on Ok', () => {
      const result = ok(42);
      const mapped = result.mapErr((e: Error) => new Error('Should not be called'));
      expect(mapped.isOk()).toBe(true);
      expect(mapped.unwrap()).toBe(42);
    });

    it('should chain with andThen', () => {
      const divide = (x: number): Result<number, Error> => {
        if (x === 0) return err(new Error('Division by zero'));
        return ok(10 / x);
      };

      const result = ok<number, Error>(5);
      const chained = result.andThen(divide);
      expect(chained.isOk()).toBe(true);
      expect(chained.unwrap()).toBe(2);
    });

    it('should replace with and()', () => {
      const result1 = ok(1);
      const result2 = ok(2);
      const result3 = result1.and(result2);
      expect(result3.unwrap()).toBe(2);
    });

    it('should short-circuit with or()', () => {
      const result1 = ok(1);
      const result2 = ok(2);
      const result3 = result1.or(result2);
      expect(result3.unwrap()).toBe(1);
    });

    it('should convert to Promise that resolves', async () => {
      const result = ok(42);
      const value = await result.toPromise();
      expect(value).toBe(42);
    });

    it('should match on ok pattern', () => {
      const result = ok(42);
      const output = result.match({
        ok: (v) => v * 2,
        err: () => 0,
      });
      expect(output).toBe(84);
    });
  });

  describe('Err variant', () => {
    it('should create Err with error', () => {
      const error = new Error('Something went wrong');
      const result = err(error);
      expect(result.isOk()).toBe(false);
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe(error);
    });

    it('should throw when calling unwrap on Err', () => {
      const result = err(new Error('Failed'));
      expect(() => result.unwrap()).toThrow('Called unwrap on Err variant');
    });

    it('should return default with unwrapOr', () => {
      const result = err<number, Error>(new Error('Failed'));
      expect(result.unwrapOr(100)).toBe(100);
    });

    it('should not apply map on Err', () => {
      const result = err<number, Error>(new Error('Failed'));
      const mapped = result.map((x) => x * 2);
      expect(mapped.isErr()).toBe(true);
      expect(mapped.unwrapErr().message).toBe('Failed');
    });

    it('should apply mapErr', () => {
      const result = err<number, Error>(new Error('Original'));
      const mapped = result.mapErr((e) => new Error(`Wrapped: ${e.message}`));
      expect(mapped.isErr()).toBe(true);
      expect(mapped.unwrapErr().message).toBe('Wrapped: Original');
    });

    it('should short-circuit with andThen', () => {
      const result = err<number, Error>(new Error('Failed'));
      const chained = result.andThen((x) => ok(x * 2));
      expect(chained.isErr()).toBe(true);
      expect(chained.unwrapErr().message).toBe('Failed');
    });

    it('should short-circuit with and()', () => {
      const result1 = err<number, Error>(new Error('Failed'));
      const result2 = ok(2);
      const result3 = result1.and(result2);
      expect(result3.isErr()).toBe(true);
      expect(result3.unwrapErr().message).toBe('Failed');
    });

    it('should replace with or()', () => {
      const result1 = err<number, Error>(new Error('Failed'));
      const result2 = ok(42);
      const result3 = result1.or(result2);
      expect(result3.isOk()).toBe(true);
      expect(result3.unwrap()).toBe(42);
    });

    it('should convert to Promise that rejects', async () => {
      const error = new Error('Failed');
      const result = err<number, Error>(error);
      await expect(result.toPromise()).rejects.toThrow('Failed');
    });

    it('should match on err pattern', () => {
      const result = err<number, Error>(new Error('Failed'));
      const output = result.match({
        ok: () => '0',
        err: (e) => e.message,
      });
      expect(output).toBe('Failed');
    });
  });

  describe('tryCatch', () => {
    it('should return Ok for successful function', () => {
      const result = tryCatch(
        () => 42,
        (e) => new Error(String(e))
      );
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(42);
    });

    it('should return Err for throwing function', () => {
      const result = tryCatch(
        () => {
          throw new Error('Boom');
        },
        (e) => new Error(`Caught: ${(e as Error).message}`)
      );
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().message).toBe('Caught: Boom');
    });
  });

  describe('tryCatchAsync', () => {
    it('should return Ok for successful async function', async () => {
      const result = await tryCatchAsync(
        async () => Promise.resolve(42),
        (e) => new Error(String(e))
      );
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(42);
    });

    it('should return Err for rejecting async function', async () => {
      const result = await tryCatchAsync(
        async () => Promise.reject(new Error('Boom')),
        (e) => new Error(`Caught: ${(e as Error).message}`)
      );
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().message).toBe('Caught: Boom');
    });
  });

  describe('combine', () => {
    it('should combine all Ok results into array', () => {
      const results = [ok(1), ok(2), ok(3)];
      const combined = combine(results);
      expect(combined.isOk()).toBe(true);
      expect(combined.unwrap()).toEqual([1, 2, 3]);
    });

    it('should return first Err if any result is Err', () => {
      const results = [ok(1), err(new Error('Failed')), ok(3)];
      const combined = combine(results);
      expect(combined.isErr()).toBe(true);
      expect(combined.unwrapErr().message).toBe('Failed');
    });

    it('should return Ok for empty array', () => {
      const combined = combine([]);
      expect(combined.isOk()).toBe(true);
      expect(combined.unwrap()).toEqual([]);
    });
  });

  describe('combineAll', () => {
    it('should combine all Ok results', () => {
      const results = [ok(1), ok(2), ok(3)];
      const combined = combineAll(results);
      expect(combined.isOk()).toBe(true);
      expect(combined.unwrap()).toEqual([1, 2, 3]);
    });

    it('should collect all errors', () => {
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');
      const results = [ok(1), err(error1), ok(3), err(error2)];
      const combined = combineAll(results);
      expect(combined.isErr()).toBe(true);
      const errors = combined.unwrapErr();
      expect(errors).toHaveLength(2);
      expect(errors[0]).toBe(error1);
      expect(errors[1]).toBe(error2);
    });

    it('should return Ok if no errors', () => {
      const results = [ok(1), ok(2)];
      const combined = combineAll(results);
      expect(combined.isOk()).toBe(true);
      expect(combined.unwrap()).toEqual([1, 2]);
    });
  });

  describe('DomainError', () => {
    it('should create DomainError with code and context', () => {
      const error = new DomainError('Something failed', 'VALIDATION_ERROR', {
        field: 'email',
        value: 'invalid',
      });

      expect(error.message).toBe('Something failed');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.context).toEqual({ field: 'email', value: 'invalid' });
      expect(error.name).toBe('DomainError');
    });

    it('should serialize to JSON', () => {
      const error = new DomainError('Test error', 'TEST_ERROR', { foo: 'bar' });
      const json = error.toJSON();

      expect(json.name).toBe('DomainError');
      expect(json.message).toBe('Test error');
      expect(json.code).toBe('TEST_ERROR');
      expect(json.context).toEqual({ foo: 'bar' });
      expect(json.stack).toBeDefined();
    });

    it('should work with isDomainError type guard', () => {
      const error = new DomainError('Test', 'TEST');
      expect(isDomainError(error)).toBe(true);
      expect(isDomainError(new Error('Regular'))).toBe(false);
      expect(isDomainError('string')).toBe(false);
      expect(isDomainError(null)).toBe(false);
    });
  });

  describe('toDomainError', () => {
    it('should pass through DomainError unchanged', () => {
      const original = new DomainError('Original', 'TEST');
      const converted = toDomainError(original);
      expect(converted).toBe(original);
    });

    it('should convert regular Error to DomainError', () => {
      const original = new Error('Regular error');
      original.name = 'CustomError';
      const converted = toDomainError(original);

      expect(converted).toBeInstanceOf(DomainError);
      expect(converted.message).toBe('Regular error');
      expect(converted.code).toBe('UNKNOWN_ERROR');
      expect(converted.context?.originalName).toBe('CustomError');
    });

    it('should convert non-Error values to DomainError', () => {
      const converted = toDomainError('Something went wrong');
      expect(converted).toBeInstanceOf(DomainError);
      expect(converted.message).toBe('Something went wrong');
      expect(converted.code).toBe('UNKNOWN_ERROR');
    });

    it('should handle null and undefined', () => {
      const convertedNull = toDomainError(null);
      expect(convertedNull.message).toBe('null');

      const convertedUndefined = toDomainError(undefined);
      expect(convertedUndefined.message).toBe('undefined');
    });
  });

  describe('Result chaining patterns', () => {
    it('should chain multiple operations', () => {
      const parse = (s: string): Result<number, Error> => {
        const num = parseInt(s, 10);
        return isNaN(num) ? err(new Error('Not a number')) : ok(num);
      };

      const double = (n: number): Result<number, Error> => ok(n * 2);

      const result = parse('21').andThen(double);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(42);

      const badResult = parse('not a number').andThen(double);
      expect(badResult.isErr()).toBe(true);
    });

    it('should provide railway-oriented programming', () => {
      type User = { id: number; name: string };

      const validateId = (id: number): Result<number, Error> =>
        id > 0 ? ok(id) : err(new Error('Invalid ID'));

      const fetchUser = (id: number): Result<User, Error> => ok({ id, name: 'Alice' });

      const formatUser = (user: User): Result<string, Error> => ok(`User ${user.id}: ${user.name}`);

      const result = validateId(123).andThen(fetchUser).andThen(formatUser);

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe('User 123: Alice');

      // Invalid path
      const badResult = validateId(-1).andThen(fetchUser).andThen(formatUser);
      expect(badResult.isErr()).toBe(true);
      expect(badResult.unwrapErr().message).toBe('Invalid ID');
    });
  });
});
