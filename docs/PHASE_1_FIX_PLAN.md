# Phase 1 - Critical Fix Plan
**Priority**: 🔴 URGENT  
**Estimated Time**: 8-12 hours  
**Target**: Production-ready state

---

## Critical Issues Summary

| Issue | Severity | Impact | Effort | Priority |
|-------|----------|--------|--------|----------|
| Build failing (TypeScript errors) | 🔴 Critical | Cannot deploy | 4-6h | P0 |
| 19 test failures (missing helpers) | 🔴 Critical | Test suite broken | 2-4h | P0 |
| 7 logger test failures | 🟡 Medium | Minor edge cases | 2-3h | P1 |
| No pre-commit type checking | 🟡 Medium | Prevention | 2-3h | P1 |

---

## Fix #1: TypeScript Compilation Errors (P0)

### Problem
`packages/storage/src/operations.spec.ts` and `transaction-coordinator.spec.ts` have type mismatches.

### Root Cause
`TransactionCoordinator.executeAll()` has generic constraint `Operation<T>[]` but tests pass heterogeneous arrays:
```typescript
executeAll([
  new BurnVoucherOperation(...),      // Operation<VoucherBurnRollbackData>
  new SaveSavingsOperation(...),      // Operation<string>
  new UpdateProfileOperation(...)     // Operation<void>
]);
```

### Solution

**Option A: Union Type (Recommended)**
```typescript
// transaction-coordinator.ts
async executeAll<T1, T2, T3>(
  operations: (Operation<T1> | Operation<T2> | Operation<T3>)[]
): Promise<Result<void[], DomainError>>

// Or simpler:
async executeAll(
  operations: Operation<any>[]
): Promise<Result<void[], DomainError>>
```

**Option B: Separate Test Scenarios**
Split tests to use homogeneous operation arrays (single type per test).

### Files to Change
1. `packages/storage/src/transaction-coordinator.ts` (line ~50)
2. `packages/storage/src/operations.spec.ts` (lines 339, 385, 440)
3. `packages/storage/src/transaction-coordinator.spec.ts` (line 274)

### Verification
```bash
npm run build
# Should exit with code 0
```

---

## Fix #2: Stacking Engine Test Failures (P0)

### Problem
19 tests failing: `TypeError: createMoney is not a function`

### Root Cause
`packages/benefits/src/stacking/stacking-engine.spec.ts` imports:
```typescript
import { createMoney, createCart } from '@payments-optimizer/domain';
```

But these functions don't exist in domain package.

### Solution A: Export from test-fixtures (Recommended)

**Step 1**: Create helper functions in `packages/test-fixtures/src/fixtures.ts`
```typescript
// Add to fixtures.ts
export function createMoney(amount: number, currency: string): Money {
  return {
    amountMinor: BigInt(Math.round(amount * 100)),
    currency: currency as Currency,
  };
}

export function createCart(
  merchantId: string,
  items: Array<{ id: string; name: string; price: Money; quantity: number }>,
  currency: string
): Cart {
  const subtotal = items.reduce((sum, item) => ({
    amountMinor: sum.amountMinor + item.price.amountMinor * BigInt(item.quantity),
    currency: currency as Currency,
  }), { amountMinor: 0n, currency: currency as Currency });

  return {
    merchantId,
    items,
    subtotal,
    discounts: [],
    shipping: { amountMinor: 0n, currency: currency as Currency },
    taxes: { amountMinor: 0n, currency: currency as Currency },
    total: subtotal,
    currency: currency as Currency,
  };
}
```

**Step 2**: Update import in `stacking-engine.spec.ts`
```typescript
import {
  createMoney,
  createCart,
} from '@payments-optimizer/test-fixtures';
```

### Solution B: Implement locally

Add helper functions directly in `stacking-engine.spec.ts` before the test suite.

### Verification
```bash
npm test -- stacking-engine.spec.ts
# All 19 tests should pass
```

---

## Fix #3: Logger Test Failures (P1)

### Problem
7 minor test failures in `packages/domain/src/logger.spec.ts`:
- Timing issues with async log handlers
- PII redaction edge cases

### Root Cause
1. Mock timing not syncing with async operations
2. Edge cases in PII regex patterns

### Solution

**Timing Issues**:
```typescript
// Use vi.waitFor() instead of immediate assertions
it('should handle async operations', async () => {
  logger.info('test');
  
  // Before (fails):
  expect(mockHandler).toHaveBeenCalled();
  
  // After (works):
  await vi.waitFor(() => {
    expect(mockHandler).toHaveBeenCalled();
  });
});
```

**PII Edge Cases**:
```typescript
// Add more comprehensive regex patterns
const PII_PATTERNS = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  phone: /\b(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
};
```

### Files to Change
1. `packages/domain/src/logger.spec.ts` (async timing fixes)
2. `packages/domain/src/logger.ts` (PII regex improvements)

### Verification
```bash
npm test -- logger.spec.ts
# All tests should pass
```

---

## Fix #4: Pre-Commit Type Checking (P1)

### Problem
Type errors reaching main branch because no pre-commit validation.

### Solution: Git Hook

**Option A: Using Husky (Recommended)**
```bash
npm install --save-dev husky
npx husky init
```

Create `.husky/pre-commit`:
```bash
#!/bin/sh
npm run build
if [ $? -ne 0 ]; then
  echo "❌ Build failed. Commit rejected."
  exit 1
fi

npm test
if [ $? -ne 0 ]; then
  echo "❌ Tests failed. Commit rejected."
  exit 1
fi
```

**Option B: Manual Git Hook**
Create `.git/hooks/pre-commit`:
```bash
#!/bin/sh
npm run build && npm test
```

### Verification
```bash
# Make a change
echo "// test" >> packages/domain/src/test.ts

# Try to commit
git add .
git commit -m "test"
# Should run build + tests before committing
```

---

## Fix Timeline

### Day 1 (4-6 hours)
- ✅ Fix TypeScript compilation errors (Fix #1)
- ✅ Fix stacking engine test failures (Fix #2)
- ✅ Verify build passes
- ✅ Verify test pass rate = 100%

### Day 2 (4-6 hours)
- ✅ Fix logger test failures (Fix #3)
- ✅ Add pre-commit hooks (Fix #4)
- ✅ Re-run full test suite
- ✅ Update audit report with results

---

## Acceptance Criteria

### Build Health
- [ ] `npm run build` exits with code 0
- [ ] No TypeScript compilation errors
- [ ] All packages build successfully

### Test Health
- [ ] `npm test` exits with code 0
- [ ] 358/358 tests passing (100%)
- [ ] 0 tests skipped (or documented reasons)
- [ ] 0 tests failing

### Code Quality
- [ ] Pre-commit hooks installed
- [ ] Type checking runs before commit
- [ ] Tests run before commit
- [ ] Documentation updated

### Production Readiness
- [ ] Build passes ✅
- [ ] Tests pass ✅
- [ ] Hooks installed ✅
- [ ] Audit re-run ✅
- [ ] Phase 1 COMPLETE ✅

---

## Quick Start Commands

```bash
# Fix #1: TypeScript errors
npm run build 2>&1 | grep "error TS"
# Fix the errors, then:
npm run build

# Fix #2: Test failures
npm test -- stacking-engine.spec.ts
# Implement createMoney/createCart helpers

# Fix #3: Logger tests
npm test -- logger.spec.ts
# Fix timing and PII issues

# Fix #4: Pre-commit hooks
npm install --save-dev husky
npx husky init
# Create .husky/pre-commit with build + test

# Final verification
npm run build && npm test
# All green? Phase 1 complete! 🎉
```

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Fix breaks other tests | Medium | High | Run full suite after each fix |
| Type changes break API | Low | Medium | Keep Operation interface backward compatible |
| Pre-commit slows workflow | Medium | Low | Make hooks fast (<30s) |
| Missing edge cases | Low | Medium | Add comprehensive test coverage |

---

## Success Metrics

After fixes:
- ✅ Build time: <60s
- ✅ Test time: <30s
- ✅ Test pass rate: 100%
- ✅ Type errors: 0
- ✅ Skipped tests: 0 (or documented)
- ✅ Production readiness: ✅ READY

---

**Next**: Execute fixes in order, verify after each step, update audit report.
