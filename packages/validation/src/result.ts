export type ValidateResult<T, E = Error> = Ok<T, E> | Err<T, E>;

export class Ok<T, E = Error> {
  constructor(public value: T) {}

  isOk(): this is Ok<T, E> {
    return true;
  }

  isErr(): this is Err<T, E> {
    return false;
  }

  unwrap(): T {
    return this.value;
  }

  unwrapErr(): never {
    throw new Error('Called unwrapErr on Ok');
  }

  map<U>(fn: (value: T) => U): Ok<U, E> {
    return new Ok(fn(this.value));
  }

  mapErr<F>(_: (error: E) => F): Ok<T, F> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this as any;
  }

  andThen<U>(fn: (value: T) => ValidateResult<U, E>): ValidateResult<U, E> {
    return fn(this.value);
  }
}

export class Err<T, E = Error> {
  constructor(public error: E) {}

  isOk(): this is Ok<T, E> {
    return false;
  }

  isErr(): this is Err<T, E> {
    return true;
  }

  unwrap(): never {
    throw new Error('Called unwrap on Err');
  }

  unwrapErr(): E {
    return this.error;
  }

  map<U>(_: (value: T) => U): Err<U, E> {
    return new Err(this.error);
  }

  mapErr<F>(fn: (error: E) => F): Err<T, F> {
    return new Err(fn(this.error));
  }

  andThen<U>(_: (value: T) => ValidateResult<U, E>): ValidateResult<U, E> {
    return new Err<U, E>(this.error);
  }
}

export function ok<T, E = Error>(value: T): Ok<T, E> {
  return new Ok(value);
}

export function err<T, E = Error>(error: E): Err<T, E> {
  return new Err(error);
}
