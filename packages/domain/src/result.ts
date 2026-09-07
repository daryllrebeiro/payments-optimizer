/**
 * Result type for type-safe error handling
 * 
 * Represents either success (Ok) or failure (Err), forcing explicit error handling
 * at compile time. Inspired by Rust's Result<T, E> type.
 * 
 * @example
 * ```typescript
 * function divide(a: number, b: number): Result<number, DivisionError> {
 *   if (b === 0) {
 *     return err(new DivisionError('Cannot divide by zero'));
 *   }
 *   return ok(a / b);
 * }
 * 
 * const result = divide(10, 2);
 * if (result.isOk()) {
 *   console.log(result.value); // 5
 * } else {
 *   console.error(result.error); // DivisionError
 * }
 * ```
 */
export type Result<T, E = DomainError> = Ok<T, E> | Err<T, E>;

/**
 * Success variant of Result
 */
export class Ok<T, E = DomainError> {
  readonly ok = true;
  readonly err = false;

  constructor(public readonly value: T) {}

  isOk(): this is Ok<T, E> {
    return true;
  }

  isErr(): this is Err<T, E> {
    return false;
  }

  /**
   * Returns the contained value
   * @throws Never throws (type-safe)
   */
  unwrap(): T {
    return this.value;
  }

  /**
   * Returns the contained value or a default
   */
  unwrapOr(_defaultValue: T): T {
    return this.value;
  }

  /**
   * Not applicable for Ok variant
   * @throws Error
   */
  unwrapErr(): never {
    throw new Error('Called unwrapErr on Ok variant');
  }

  /**
   * Transform the success value
   */
  map<U>(fn: (value: T) => U): Result<U, E> {
    return ok(fn(this.value));
  }

  /**
   * No-op for Ok variant
   */
  mapErr<F>(_fn: (error: E) => F): Result<T, F> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this as any;
  }

  /**
   * Chain Result-returning operations (flatMap)
   */
  andThen<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    return fn(this.value);
  }

  /**
   * Replace Ok value with another Result
   */
  and<U>(other: Result<U, E>): Result<U, E> {
    return other;
  }

  /**
   * Short-circuit: returns this Ok
   */
  or<F>(_other: Result<T, F>): Result<T, F> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this as any;
  }

  /**
   * Convert to Promise (resolves with value)
   */
  async toPromise(): Promise<T> {
    return this.value;
  }

  /**
   * Match pattern for exhaustive handling
   */
  match<U>(patterns: { ok: (value: T) => U; err: (error: E) => U }): U {
    return patterns.ok(this.value);
  }
}

/**
 * Error variant of Result
 */
export class Err<T, E = DomainError> {
  readonly ok = false;
  readonly err = true;

  constructor(public readonly error: E) {}

  isOk(): this is Ok<T, E> {
    return false;
  }

  isErr(): this is Err<T, E> {
    return true;
  }

  /**
   * Not applicable for Err variant
   * @throws Error
   */
  unwrap(): never {
    throw new Error(`Called unwrap on Err variant: ${this.error}`);
  }

  /**
   * Returns default value since this is an error
   */
  unwrapOr(defaultValue: T): T {
    return defaultValue;
  }

  /**
   * Returns the contained error
   */
  unwrapErr(): E {
    return this.error;
  }

  /**
   * No-op for Err variant
   */
  map<U>(_fn: (value: T) => U): Result<U, E> {
    return err(this.error);
  }

  /**
   * Transform the error value
   */
  mapErr<F>(fn: (error: E) => F): Result<T, F> {
    return err(fn(this.error));
  }

  /**
   * Short-circuit: returns this Err
   */
  andThen<U>(_fn: (value: T) => Result<U, E>): Result<U, E> {
    return err(this.error);
  }

  /**
   * Short-circuit: returns this Err
   */
  and<U>(_other: Result<U, E>): Result<U, E> {
    return err(this.error);
  }

  /**
   * Replace Err with another Result
   */
  or<F>(other: Result<T, F>): Result<T, F> {
    return other;
  }

  /**
   * Convert to Promise (rejects with error)
   */
  async toPromise(): Promise<T> {
    throw this.error;
  }

  /**
   * Match pattern for exhaustive handling
   */
  match<U>(patterns: { ok: (value: T) => U; err: (error: E) => U }): U {
    return patterns.err(this.error);
  }
}

/**
 * Create a success Result
 */
export function ok<T, E = DomainError>(value: T): Ok<T, E> {
  return new Ok(value);
}

/**
 * Create an error Result
 */
export function err<T, E = DomainError>(error: E): Err<T, E> {
  return new Err(error);
}

/**
 * Wrap a potentially throwing function in a Result
 */
export function tryCatch<T, E = DomainError>(
  fn: () => T,
  mapError: (error: unknown) => E
): Result<T, E> {
  try {
    return ok(fn());
  } catch (error) {
    return err(mapError(error));
  }
}

/**
 * Wrap an async function in a Result
 */
export async function tryCatchAsync<T, E = DomainError>(
  fn: () => Promise<T>,
  mapError: (error: unknown) => E
): Promise<Result<T, E>> {
  try {
    const value = await fn();
    return ok(value);
  } catch (error) {
    return err(mapError(error));
  }
}

/**
 * Combine multiple Results into a single Result with an array of values
 * Returns Err with the first error encountered, or Ok with all values
 */
export function combine<T, E>(results: Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];
  for (const result of results) {
    if (result.isErr()) {
      return err(result.error);
    }
    values.push(result.value);
  }
  return ok(values);
}

/**
 * Combine multiple Results, collecting all errors
 * Returns Err with array of errors, or Ok with array of values
 */
export function combineAll<T, E>(results: Result<T, E>[]): Result<T[], E[]> {
  const values: T[] = [];
  const errors: E[] = [];

  for (const result of results) {
    if (result.isErr()) {
      errors.push(result.error);
    } else {
      values.push(result.value);
    }
  }

  if (errors.length > 0) {
    return err(errors);
  }
  return ok(values);
}

/**
 * Base error class for all domain errors
 */
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;

    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Serialize error for logging or transmission
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      stack: this.stack,
    };
  }
}

/**
 * Type guard for DomainError
 */
export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}

/**
 * Convert unknown error to DomainError
 */
export function toDomainError(error: unknown): DomainError {
  if (isDomainError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new DomainError(error.message, 'UNKNOWN_ERROR', {
      originalName: error.name,
      stack: error.stack,
    });
  }

  return new DomainError(String(error), 'UNKNOWN_ERROR', { originalError: error });
}
