import { describe, it, expect } from 'vitest';
import { Result, Ok, Err, ok, err, tryCatch, tryCatchAsync, combine, combineAll } from './result.js';
import { DomainError } from './errors.js';

describe('Result', () => {
  describe('Ok', () => {
    it('wraps a value', () => {
      const result = ok(42);
      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);
      expect(result.value).toBe(42);
    });

    it('unwrap returns the value', () => {
      const result = ok('hello');
      expect(result.unwrap()).toBe('hello');
    });

    it('unwrapOr returns the value', () => {
      const result = ok('hello');
      expect(result.unwrapOr('default')).toBe('hello');
    });

    it('unwrapErr throws', () => {
      const result = ok(42);
      expect(() => result.unwrapErr()).toThrow('Called unwrapErr on Ok variant');
    });

    it('map transforms the value', () => {
      const result = ok(5);
      const mapped = result.map(x => x * 2);
      expect(mapped.isOk()).toBe(true);
      expect(mapped.unwrap()).toBe(10);
    });

    it('mapErr does nothing', () => {
      const result = ok(42);
      const mapped = result.mapErr(e => e.message);
      expect(mapped.isOk()).toBe(true);
      expect(mapped.unwrap()).toBe(42);
    });

    it('andThen chains operations', () => {
      const result = ok(5);
      const chained = result.andThen(x => ok(x * 3));
      expect(chained.isOk()).toBe(true);
      expect(chained.unwrap()).toBe(15);
    });

    it('and combines with another Ok', () => {
      const result = ok(5);
      const combined = result.and(ok(10));
      expect(combined.isOk()).toBe(true);
      expect(combined.unwrap()).toBe(10);
    });

    it('or returns itself', () => {
      const result = ok(42);
      const orResult = result.or(err(new Error('other')));
      expect(orResult.isOk()).toBe(true);
      expect(orResult.unwrap()).toBe(42);
    });

    it('toPromise resolves', async () => {
      const result = ok(42);
      await expect(result.toPromise()).resolves.toBe(42);
    });

    it('match handles ok case', () => {
      const result = ok(42);
      const matched = result.match({
        ok: v => `ok: ${v}`,
        err: e => `err: ${e}`,
      });
      expect(matched).toBe('ok: 42');
    });
  });

  describe('Err', () => {
    it('wraps an error', () => {
      const error = new Error('test error');
      const result = err(error);
      expect(result.isOk()).toBe(false);
      expect(result.isErr()).toBe(true);
      expect(result.error).toBe(error);
    });

    it('unwrap throws', () => {
      const result = err(new Error('test'));
      expect(() => result.unwrap()).toThrow('Called unwrap on Err variant');
    });

    it('unwrapOr returns default', () => {
      const result = err(new Error('test'));
      expect(result.unwrapOr('default')).toBe('default');
    });

    it('unwrapErr returns the error', () => {
      const error = new Error('test');
      const result = err(error);
      expect(result.unwrapErr()).toBe(error);
    });

    it('map does nothing', () => {
      const result = err(new Error('test'));
      const mapped = result.map(x => x * 2);
      expect(mapped.isErr()).toBe(true);
      expect(mapped.unwrapErr()).toBeInstanceOf(Error);
    });

    it('mapErr transforms the error', () => {
      const result = err(new Error('original'));
      const mapped = result.mapErr(e => new Error(`wrapped: ${e.message}`));
      expect(mapped.isErr()).toBe(true);
      expect(mapped.unwrapErr().message).toBe('wrapped: original');
    });

    it('andThen does nothing', () => {
      const result = err(new Error('test'));
      const chained = result.andThen(x => ok(x * 3));
      expect(chained.isErr()).toBe(true);
      expect(chained.unwrapErr()).toBeInstanceOf(Error);
    });

    it('and does nothing', () => {
      const result = err(new Error('test'));
      const combined = result.and(ok(42));
      expect(combined.isErr()).toBe(true);
    });

    it('or returns the other result', () => {
      const result = err(new Error('test'));
      const orResult = result.or(ok(42));
      expect(orResult.isOk()).toBe(true);
      expect(orResult.unwrap()).toBe(42);
    });

    it('toPromise rejects', async () => {
      const result = err(new Error('test'));
      await expect(result.toPromise()).rejects.toThrow('test');
    });

    it('match handles err case', () => {
      const result = err(new Error('test'));
      const matched = result.match({
        ok: v => `ok: ${v}`,
        err: e => `err: ${e.message}`,
      });
      expect(matched).toBe('err: test');
    });
  });

  describe('ok/err factory functions', () => {
    it('ok creates Ok variant', () => {
      const result = ok('hello');
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe('hello');
    });

    it('err creates Err variant', () => {
      const result = err(new Error('test'));
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().message).toBe('test');
    });
  });

  describe('tryCatch', () => {
    it('returns Ok on success', () => {
      const result = tryCatch(() => 42, e => new Error(String(e)));
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(42);
    });

    it('returns Err on throw', () => {
      const result = tryCatch(
        () => { throw new Error('fail'); },
        e => new Error(String(e))
      );
      expect(result.isErr()).toBe(true);
      // String(Error) returns "Error: message"
      expect(result.unwrapErr().message).toBe('Error: fail');
    });
  });

  describe('tryCatchAsync', () => {
    it('returns Ok on success', async () => {
      const result = await tryCatchAsync(
        async () => 42,
        e => new Error(String(e))
      );
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(42);
    });

    it('returns Err on rejection', async () => {
      const result = await tryCatchAsync(
        async () => { throw new Error('fail'); },
        e => new Error(String(e))
      );
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().message).toBe('Error: fail');
    });
  });

  describe('combine', () => {
    it('returns Ok with all values when all Ok', () => {
      const results = [ok(1), ok(2), ok(3)];
      const combined = combine(results);
      expect(combined.isOk()).toBe(true);
      expect(combined.unwrap()).toEqual([1, 2, 3]);
    });

    it('returns first Err when any Err', () => {
      const results = [ok(1), err(new Error('fail')), ok(3)];
      const combined = combine(results);
      expect(combined.isErr()).toBe(true);
      expect(combined.unwrapErr().message).toBe('fail');
    });

    it('returns Ok with empty array for empty input', () => {
      const combined = combine<number, Error>([]);
      expect(combined.isOk()).toBe(true);
      expect(combined.unwrap()).toEqual([]);
    });
  });

  describe('combineAll', () => {
    it('returns Ok with all values when all Ok', () => {
      const results = [ok(1), ok(2), ok(3)];
      const combined = combineAll(results);
      expect(combined.isOk()).toBe(true);
      expect(combined.unwrap()).toEqual([1, 2, 3]);
    });

    it('returns Err with all errors when any Err', () => {
      const results = [ok(1), err(new Error('fail1')), err(new Error('fail2')), ok(3)];
      const combined = combineAll(results);
      expect(combined.isErr()).toBe(true);
      const errors = combined.unwrapErr();
      expect(errors).toHaveLength(2);
      expect(errors[0].message).toBe('fail1');
      expect(errors[1].message).toBe('fail2');
    });

    it('returns Ok with empty array for empty input', () => {
      const combined = combineAll<number, Error>([]);
      expect(combined.isOk()).toBe(true);
      expect(combined.unwrap()).toEqual([]);
    });
  });

  describe('Result with DomainError', () => {
    it('works with DomainError', () => {
      const result = err(new Error('test'));
      expect(result.unwrapErr()).toBeInstanceOf(Error);
    });

    it('DomainError has code and context', () => {
      const error = new (class extends Error {
        constructor() {
          super('test');
          this.name = 'TestError';
        }
      })();
      const result = err(error);
      expect(result.unwrapErr()).toBeInstanceOf(Error);
    });
  });
});