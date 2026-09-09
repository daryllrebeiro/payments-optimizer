# Epic 1.6: Structured Errors, Result-Type Standardization

**Status:** ✅ Complete  
**Priority:** P1/P2 (Correctness/Developer Experience)  
**Test Coverage:** 69 tests (39 Result + 30 Errors)

## Overview

Implemented a comprehensive type-safe error handling system with `Result<T, E>` pattern and structured error classes. This provides compile-time guarantees for error handling, eliminates unhandled exceptions, and standardizes error representation across the codebase.

## Implementation Details

### Core Components

#### 1. Result<T, E> Type (`packages/domain/src/result.ts`)

- **Variants:** `Ok<T, E>` for success, `Err<T, E>` for failure
- **Inspired By:** Rust's `Result` type, functional programming patterns
- **Type Safety:** Forces explicit error handling at compile time
- **Railway-Oriented Programming:** Enables chainable error handling
- **Methods:**
  - `isOk()` / `isErr()`: Type guards for discriminated unions
  - `unwrap()` / `unwrapOr()`: Extract values safely
  - `map()` / `mapErr()`: Transform success/error values
  - `andThen()`: Chain Result-returning operations (flatMap)
  - `and()` / `or()`: Combine Results
  - `match()`: Exhaustive pattern matching
  - `toPromise()`: Convert to Promise for async boundaries

#### 2. Helper Functions

- **`ok(value)`**: Create success Result
- **`err(error)`**: Create failure Result
- **`tryCatch(fn, mapError)`**: Wrap throwing functions
- **`tryCatchAsync(fn, mapError)`**: Wrap async functions
- **`combine(results)`**: Fail-fast combination (first error wins)
- **`combineAll(results)`**: Collect all errors

#### 3. Structured Error Classes (`packages/domain/src/errors.ts`)

All errors extend `DomainError` base class with:

- **Unique error code** for programmatic handling
- **Contextual data** for debugging and logging
- **Type safety** for exhaustive error matching
- **JSON serialization** for logging/transmission

**Error Hierarchy:**

| Error Class                 | Code                    | Use Case                        |
| --------------------------- | ----------------------- | ------------------------------- |
| `ValidationError`           | `VALIDATION_ERROR`      | Input validation failures       |
| `NotFoundError`             | `NOT_FOUND`             | Resource doesn't exist          |
| `InsufficientResourceError` | `INSUFFICIENT_RESOURCE` | Not enough quota/balance        |
| `TimeoutError`              | `TIMEOUT`               | Operation exceeded time limit   |
| `NetworkError`              | `NETWORK_ERROR`         | HTTP/network failures           |
| `CircuitBreakerOpenError`   | `CIRCUIT_BREAKER_OPEN`  | Service temporarily unavailable |
| `SerializationError`        | `SERIALIZATION_ERROR`   | Ser/deser failures              |
| `StorageError`              | `STORAGE_ERROR`         | IndexedDB operation failures    |
| `TransactionError`          | `TRANSACTION_ERROR`     | Multi-step operation failures   |
| `MigrationError`            | `MIGRATION_ERROR`       | Database migration failures     |
| `ConfigurationError`        | `CONFIGURATION_ERROR`   | Invalid configuration           |
| `AuthorizationError`        | `AUTHORIZATION_ERROR`   | Permission denied               |
| `BusinessLogicError`        | `BUSINESS_LOGIC_ERROR`  | Business rule violations        |
| `ConflictError`             | `CONFLICT`              | Resource conflict/duplicate     |
| `RateLimitError`            | `RATE_LIMIT_EXCEEDED`   | Too many requests               |

#### 4. Type Guards

- Each error class has a corresponding type guard (e.g., `isValidationError()`)
- Enables exhaustive error handling with TypeScript discriminated unions
- Safe downcasting for error-specific context

### Design Decisions

1. **Result<T, E> Over Exceptions**
   - **Rationale:** Exceptions are invisible in type signatures, easy to forget to handle
   - **Benefit:** Compile-time safety, explicit error paths, no silent failures
   - **Rejected:** Throwing exceptions (requires runtime discipline, no type safety)

2. **Monadic Interface (andThen/map)**
   - **Rationale:** Enables railway-oriented programming, clean error propagation
   - **Benefit:** Reduces boilerplate, clear success/failure paths
   - **Rejected:** Callback-based error handling (pyramid of doom)

3. **Structured Error Classes vs Error Codes**
   - **Rationale:** Type safety, context preservation, IDE autocomplete
   - **Benefit:** Exhaustive matching, rich error context, debuggability
   - **Rejected:** String error codes only (lose type safety, no context)

4. **DomainError Base Class**
   - **Rationale:** Common interface for all domain errors, serialization support
   - **Benefit:** Consistent error handling, logging, telemetry integration
   - **Rejected:** No base class (inconsistent error shapes)

## Usage Examples

### Basic Result Usage

```typescript
import { Result, ok, err, ValidationError } from '@payments-optimizer/domain';

function divide(a: number, b: number): Result<number, ValidationError> {
  if (b === 0) {
    return err(new ValidationError('Division by zero', 'divisor', b));
  }
  return ok(a / b);
}

const result = divide(10, 2);
if (result.isOk()) {
  console.log(result.value); // 5 (type-safe access)
} else {
  console.error(result.error); // ValidationError
}
```

### Railway-Oriented Programming

```typescript
import { ok, err, NotFoundError, ValidationError } from '@payments-optimizer/domain';

type User = { id: number; email: string };

function validateId(id: number): Result<number, ValidationError> {
  return id > 0 ? ok(id) : err(new ValidationError('Invalid ID'));
}

function fetchUser(id: number): Result<User, NotFoundError> {
  // ... fetch from database
  return ok({ id, email: 'user@example.com' });
}

function formatUser(user: User): Result<string, never> {
  return ok(`User ${user.id}: ${user.email}`);
}

// Chain operations - short-circuits on first error
const result = validateId(123).andThen(fetchUser).andThen(formatUser);

// Pattern matching for exhaustive handling
const output = result.match({
  ok: (formatted) => formatted,
  err: (error) => `Error: ${error.message}`,
});
```

### Combining Multiple Results

```typescript
import { combine, combineAll } from '@payments-optimizer/domain';

// Fail-fast: returns first error
const results1 = [ok(1), ok(2), err(new Error('Failed'))];
const combined1 = combine(results1); // Err

// Collect all errors
const results2 = [ok(1), err(new Error('E1')), err(new Error('E2'))];
const combined2 = combineAll(results2); // Err([E1, E2])
```

### Wrapping Throwing Code

```typescript
import { tryCatch, toDomainError } from '@payments-optimizer/domain';

const result = tryCatch(
  () => JSON.parse(input),
  (error) => new SerializationError('Failed to parse JSON', 'deserialize', 'unknown')
);
```

### Structured Error Context

```typescript
import { InsufficientResourceError } from '@payments-optimizer/domain';

function burnVoucher(id: string, amount: bigint): Result<void, InsufficientResourceError> {
  const balance = getBalance(id);
  if (balance < amount) {
    return err(
      new InsufficientResourceError(
        'Insufficient voucher balance',
        'VoucherBalance',
        amount, // required
        balance // available
      )
    );
  }
  // ... burn voucher
  return ok(undefined);
}

// Error has rich context for debugging
const result = burnVoucher('v123', BigInt(10000));
if (result.isErr()) {
  const error = result.error;
  console.log(error.code); // 'INSUFFICIENT_RESOURCE'
  console.log(error.required); // 10000n
  console.log(error.available); // e.g., 5000n
  console.log(error.toJSON()); // Serialize for logging
}
```

## Migration Path

### Phase 1: Core Infrastructure (✅ Complete)

- Result<T, E> type and helpers
- Structured error classes
- CircuitBreaker updated to use structured errors
- Comprehensive test coverage

### Phase 2: Storage Layer (Future)

- Update `StorageRepository` to return Result
- Update `TransactionCoordinator` to return Result
- Update `MigrationRunner` to return Result
- Migrate operations (BurnVoucher, SaveSavings, UpdateProfile)

### Phase 3: Domain Layer (Future)

- Update `DomainSerializer` to return Result
- Update validation functions to return Result
- Update message schema validation

### Phase 4: Benefits Layer (Future)

- Update optimizer to return Result
- Update benefit catalog to return Result
- Update stacking engine to return Result

## Test Coverage

### Result Tests (39 passing)

- Ok/Err variant creation and type guards
- unwrap/unwrapOr behavior
- map/mapErr transformations
- andThen chaining (flatMap)
- and/or combining
- toPromise conversion
- match pattern matching
- tryCatch/tryCatchAsync wrappers
- combine/combineAll helpers
- DomainError base class
- toDomainError conversion

### Error Tests (30 passing)

- All 15 structured error classes
- Field validation and context preservation
- Error code enum completeness
- Type guards for each error class
- JSON serialization with context
- Stack trace preservation

## Performance Characteristics

- **Result Creation:** O(1) - simple object construction
- **Result Chaining:** O(1) per operation - no overhead beyond function calls
- **Error Context:** Minimal memory overhead - only stores provided context
- **Type Safety:** Zero runtime cost - all checks compile away

## Integration Points

- **Circuit Breaker (Epic 1.5):** Already migrated to use `CircuitBreakerOpenError`
- **Transaction Coordinator (Epic 1.2):** Can adopt Result pattern for rollback operations
- **Domain Serializer (Epic 1.3):** Can return Result for validation failures
- **Storage Operations:** Natural fit for Result pattern (all DB ops can fail)
- **Observability (Epic 1.9):** Structured errors integrate seamlessly with telemetry

## Files Created

- `packages/domain/src/result.ts` - Result type and helpers (287 lines)
- `packages/domain/src/result.spec.ts` - 39 tests for Result (348 lines)
- `packages/domain/src/errors.ts` - 15 structured error classes (287 lines)
- `packages/domain/src/errors.spec.ts` - 30 tests for errors (361 lines)
- `docs/epic-1.6-structured-errors-result-type.md` - This document

## Files Modified

- `packages/domain/src/index.ts` - Added exports for result and errors
- `packages/domain/src/circuit-breaker.ts` - Import CircuitBreakerOpenError from errors.ts

## Benefits

✅ **Type Safety**: Errors are visible in function signatures, impossible to forget to handle  
✅ **Explicit Error Handling**: Every error path is explicit in code  
✅ **Rich Context**: Every error carries debugging information  
✅ **Debuggability**: Error codes, context, and stack traces for investigation  
✅ **Testability**: Errors are data, easy to test and assert on  
✅ **Composability**: Railway-oriented programming for clean error propagation  
✅ **Consistency**: All errors follow same shape, unified logging/telemetry  
✅ **Developer Experience**: IDE autocomplete, exhaustive matching, compile-time safety

## Future Enhancements

- [ ] Generate error catalog documentation from error classes
- [ ] Create error code → HTTP status code mapping for APIs
- [ ] Add error telemetry integration (Epic 1.9)
- [ ] Create error recovery strategies (retry, fallback, etc.)
- [ ] Add error rate tracking per error code
- [ ] Consider custom error formatter for user-facing messages

## References

- [Railway Oriented Programming - Scott Wlaschin](https://fsharpforfunandprofit.com/rop/)
- [Rust Result Type](https://doc.rust-lang.org/std/result/)
- [Typescript Handbook - Discriminated Unions](https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes-func.html#discriminated-unions)
- [Error Handling in Functional Languages](https://www.youtube.com/watch?v=PuPO19AjG9c)
