# PaymentsOptimizer - Architectural Review & Strategic Roadmap

**Reviewed By**: Principal Software Architect & Staff Software Engineer
**Review Date**: September 9, 2026
**Project Version**: v1.0.0-rc (post-remediation)
**Maturity Stage**: Active Beta → Production Candidate
**Basis**: Live verification against `origin/main` at `842a920` — `pnpm -r typecheck` green across all workspaces, `pnpm test` **37 files / 455 passed / 2 skipped / 0 failed**. This document supersedes the September 7 review (written at `b62180f`, 386 tests); the delta is the 23-finding adversarial-remediation sequence (`6b816ee`, `62c2f4a`, `c9878db`, `e87957b`, `842a920`) plus the F19–F23 spec amendments in `docs/audit-remediation-F19-F23.md`.

> **How to read this**: every claim cites a file and line verified in-tree on the review date. No aspirational statements — if it is not imported, tested, and gated in CI, it is listed as debt, not as done.

---

## 1. Executive Summary & Health Assessment

### Overall System Maturity

| Dimension           | Grade                      | Assessment (verified 2026-09-09, `842a920`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Architecture**    | A−                         | Strict layering holds: `apps/extension` (presentation/application) → `packages/optimizer`, `packages/benefits` (application) → `packages/domain`, `packages/offer-engine`, `packages/rules-engine` (domain, dependency-free) → `packages/storage`, `packages/security` (infrastructure). No domain file imports Chrome, IndexedDB, DOM, or HTTP. The extension now consumes the library resilience layer instead of hand-rolled equivalents (`service-worker.ts` imports `validateMessage`, `RateLimiter` from domain and `SavingsRepository`, `DurableTaskQueue` from storage). |
| **Code Quality**    | B+ (recovered, ratcheting) | `tsconfig.base.json` enforces `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `NodeNext` ESM. `typecheck` is green. Residual risk is legacy `// eslint-disable @typescript-eslint/no-explicit-any` headers (test-only `as any` remains in `service-worker.spec.ts`; production source uses typed `as unknown as` only at three narrow trust-boundary constructions).                                                                                                                                                                                         |
| **Maintainability** | A−                         | 18 workspace packages with single-responsibility READMEs, 4 conformance suites that fail the build on architectural drift (`tests/conformance/`), per-epic docs plus `docs/audit-remediation-F19-F23.md`. New contributors can trace any guarantee from doc → source → test in two hops.                                                                                                                                                                                                                                                                                         |
| **Performance**     | A                          | Beam-search stacking (`stacking-engine.ts`) holds 0.58ms avg / 2.34ms worst vs the 100ms budget; the 100k-voucher bound test (`pipeline-soundness.spec.ts:79`) completes inside a 15s envelope; savings queries are O(log n + k) via `by_merchant_timestamp` / `by_timestamp` / `by_merchant` indexes. Not yet validated under real multi-tab browser load.                                                                                                                                                                                                                      |
| **Test Coverage**   | A−                         | **455 passed / 2 skipped / 0 failed across 37 files** (up from 386/27). Coverage floor enforced in `vitest.config.ts` (statements 60, branches 78, functions 65) and in CI (`test` → `test:coverage` → `build`). Depth toward the ≥85% statements target is the remaining lever — the floor is deliberately set below baseline so it ratchets upward.                                                                                                                                                                                                                            |

**Overall Health Score**: **91/100 (A−)** — up from 88 once the 23-finding remediation landed with a green gate.
**Production Readiness**: 🟢 **Ready for guarded rollout** (feature-flagged, dogfooded) — functional gates pass, persistence and privacy findings are closed with kill-mid-write and redaction tests. Remaining pre-GA work is operational: branch-protection enforcement, bundle allowlist check, and multi-tab/distributed-burn validation (see §3 P1).

### Architectural Philosophy

**Core Strengths**:

1. **Deterministic financial core (strategic moat)** — All money is `bigint` minor units (`Money { amountMinor: bigint, currency }`, `domain/src/index.ts:85-88`). Ordering decisions use exact BigInt comparison first (`ranker.ts:48-55`: `totalBenefit` BigInt → float score → `id`), and display conversion routes through the per-currency divisor (`minorToMajor`, `index.ts:60-62`; `CURRENCY_MINOR_EXPONENT` with `JPY: 0` at `index.ts:46-54`). AI is quarantined to explanation-only (`ai-explain.ts:114-120` system instruction; `Dashboard.tsx:37-76` explicit click gate; `ai-explain.spec.ts` asserts no `fetch` without a valid key). Results are reproducible, debuggable, legally defensible.
2. **True local-first privacy** — Profile, vouchers, and history stay on-device in IndexedDB. `Telemetry` defaults to `enabled ?? false` (`telemetry.ts:107`) and redacts at `record()` time before queueing (`redactProperties`/`hashId`/`bucketAmount`, `telemetry.ts:129-211`), verified pre-flush by spec (`telemetry.spec.ts:180-198`). No PAN/CVV/OTP is stored anywhere; card data is name/issuer/last-4 only.
3. **Defensive boundary validation** — DOM/page data is treated as hostile: `preValidateCartJson` enforces 64KB / 17-digit caps before any BigInt-reviving parse (`service-worker.ts:329-351`), `validateMessage` rejects at the listener head (`service-worker.ts:362-371`), and `DomainSerializer` uses the collision-safe `{"__type":"bigint","value":"…"}` encoding (`serialization.ts:84-109`) shared by `types/messages.ts:88-94`.
4. **Disciplined resilience patterns** — `Result<T,E>` + typed `DomainError`s, 3-state `CircuitBreaker`, `TransactionCoordinator.executeAtomically` with LIFO rollback (`transaction-coordinator.ts:99-215`), canonical `RateLimiter` (`rate-limiter.ts:18-39`, wired into the service worker gate at `service-worker.ts:105-125,269-308`), `Clock` injection, and the MV3-surviving `DurableTaskQueue` write-ahead path (`durable-task-queue.ts:85-155`; `drainDurableQueue` on startup + 1-minute `alarms` tick, `service-worker.ts:130-179`).

**Fundamental Structural Risks**:

1. **Three divergent `SavingsEntry` shapes still coexist** — domain (`Money` bigint, `index.ts:484-494`), storage persisted shape (string `amountMinor`, `savings-repository.ts:14-36`), and `packages/savings` legacy shape (`savings/src/types.ts`). The runtime paths are reconciled (raw canonical shape + single writer + conformance guard), but the type-level duplication is a drift magnet. This is P1 debt, not a ship-blocker.
2. **Cross-cutting infrastructure lives in `domain`** — `telemetry.ts`, `rate-limiter.ts`, `circuit-breaker.ts`, `result.ts`, `clock.ts`, `logger.ts` are observability/resilience infrastructure, not domain logic. Every churn there re-verifies the most-imported package. Extraction to leaf packages is the correct Phase 2 move.
3. **MV3 lifecycle + multi-tab coordination remain partially proven** — single-instance durability is tested (kill-mid-write round-trip, `durable-task-queue.spec.ts`), but cross-tab double-spend (two tabs burning the same voucher) has no distributed lock yet, and real-browser multi-tab load has not been measured.

### Primary Bottlenecks

1. **Coverage depth below the 85% statements target** (P1) — The gate passes (floor 60/78/65) and the suite is large (455 tests), but `vitest.config.ts:27` still excludes `apps/extension/` from coverage and several UI/storage-query paths are exercised only at unit level. Raising the floor without adding Playwright failure-path specs would turn the gate decorative.
2. **No distributed voucher-burn coordination** (P1) — `TransactionCoordinator` gives per-instance atomicity with compensating rollback, but IndexedDB is transactional per-store and there is no cross-tab lock. At current single-user volume this is acceptable; it becomes the top correctness risk the moment background + popup + two tabs contend on the same voucher.
3. **Savings-history growth is unbounded** (P2, deferred by design) — Indexes make reads O(log n + k), but there is no partitioning, rollup, or retention policy. The pre-decision exists (time-based sharding by year + `aggregates` rollup, ADR-005 below); implementation is correctly deferred until ~10k entries, but the migration that will need it should be scaffolded before the ledger grows into it.

---

## 2. In-Depth Engineering Review

### Design Patterns & Modularity

**Assessment**: ★★★★★ (5/5) — the strongest dimension. Verified in-tree:

- **Layering is real, not aspirational.** `apps/extension/src/background/service-worker.ts:14-30` imports application (`optimizer`, `benefits`), domain (`domain`, `offer-engine`), and infrastructure (`storage`) in one direction. `packages/domain` imports nothing workspace-internal except its own siblings (`logger.js`, `clock.js`). The `storage` circular import (`index.ts` ↔ `savings-repository.ts`) was extracted to `base-repository.ts` and stays fixed.
- **Pattern choices are correct and consistent**: Repository (`SavingsRepository`, `IndexedDbRepository`), Strategy (`UnifiedBenefitOptimizer`, `generateCandidates` → `filterDominated` → `rankStrategies`), Registry (`merchant-detector`, `plugins`), Monad (`Result<T,E>` with `andThen`/`map`/`mapErr`), State Machine (`CircuitBreaker` CLOSED→OPEN→HALF_OPEN), Saga with compensation (`TransactionCoordinator` LIFO rollback), Write-Ahead Log (`DurableTaskQueue` enqueue-before-work), Clock injection, and canonical Rate Limiter.
- **Boundaries are type-safe.** Branded minor-unit types prevent cross-currency mixing at compile time; `exactOptionalPropertyTypes` forces explicit `?: T` vs `T | undefined` conventions; `SerializedRecipeStepSchema` now **requires** `benefitSourceId` (`message-schemas.ts:46-61`) so Zod can no longer silently strip the ledger join key (Fix F9 regression tests at `message-schemas.spec.ts:383-417`).
- **Remaining concern**: the `packages/savings` vs `packages/storage` split is confusing — `savings/src/types.ts` and `savings/src/savings-repository.ts` duplicate shapes owned by `storage`. Consolidate or explicitly scope `savings` to pure calculation (`savings-calculator.ts`) and delete its repository twin in Phase 2.

### Data Architecture & Persistence

**Assessment**: ★★★★½ (4.5/5).

- **Single writer, single shape.** There is exactly one savings persistence path: `persistConfirmedSavings` (enqueue → `SavingsRepository.put` → complete) plus `drainDurableQueue` on wake (`service-worker.ts:114-179`). The popup reads through the same `SavingsRepository.list()` (`App.tsx:18-42`). The conformance suite fails the build if a second `indexedDB.open('payments-optimizer-savings')` appears (`architecture-wiring.spec.ts:46-58`) or if the popup bypasses the repository (`:69-72`).
- **Raw canonical record shape.** `SavingsRepository.put/get/list` override the `VersionedEntity` envelope and store raw `{id, timestamp, merchantId, …}` so V2 indexes actually cover records (`savings-repository.ts:82-134`; `savings-repository.spec.ts:63-87` asserts no `integrityHash/data/version` wrapper and index-hit parity). Migration V2 declares `by_merchant_timestamp` (compound), `by_timestamp`, `by_merchant`; the query router selects compound → timestamp → merchant → full scan (`savings-repository.ts:145-274`).
- **Currency safety at the write boundary.** `isSameCurrency` refuses cross-currency subtraction before any `BigInt` math and skips the write with a `CURRENCY_MISMATCH` diagnostic (`service-worker.ts:186-230`), pinned by `service-worker.spec.ts:279` (USD-benefit vs INR-cart writes nothing).
- **Durability, not just awaiting.** Awaiting alone does not survive MV3 kills; the write-ahead queue does. `durable-task-queue.spec.ts` proves write-ahead visibility across instances, no-duplicate completion, exponential-backoff dead-lettering, and the exact audit scenario (enqueue → kill → wake → drain → complete).
- **Gaps**: (a) no cross-store atomicity beyond the coordinator's compensations — keep the mid-transaction-kill test; (b) no sharding/retention — deferred to ADR-005, correctly; (c) `executeSaveTask` still casts `payload as never` (`service-worker.ts:126`) — replace with a `StoredSavingsEntry` type guard in Phase 1 hygiene.

### Error Handling & Fault Tolerance

**Assessment**: ★★★★☆ (4/5).

- **Structured errors end-to-end.** `Result<T,E>` + 15 `DomainError` subclasses with codes and `recoverable` flags; `PROFILE_NOT_CONFIGURED` / `PROFILE_CORRUPT` returned instead of optimizing against unvalidated data (`service-worker.ts:65-99` no-fallback path; `parseUserProfile` + `validateProfileIntegrity` in `profile-schema.ts:275-320`, wired at `service-worker.ts:85` and `App.tsx:185-277`); `CurrencyMismatchError` and `SaveError` propagate as results, not console-only warnings.
- **Circuit breaking with fallback.** `CircuitBreaker` + `OfferApiClient` (timeout + retry, never throws on external failure — returns empty offers). Health/metrics API exists. The one skipped timeout test is tracked, not hidden.
- **Rate limiting is now canonical.** `RateLimiter` (`domain/src/rate-limiter.ts`) is the single implementation; the service worker gates on the in-memory bucket first (exact per instance) with storage as advisory backstop and **fails closed** when storage is unavailable (`service-worker.ts:105-125,269-308`). The documented approximation bound (at most 2N−1 under cross-instance race) replaces the previous undocumented race.
- **Remaining gaps**: (a) `SAVINGS_CONFIRMED` response is still constructed via `as unknown as OptimizePaymentResponse` (`service-worker.ts:545`) — add a first-class `SavingsConfirmedMessage` schema instead of casting; (b) `CONFIRM_SAVINGS` builds a partial `Cart` via cast (`service-worker.ts:531-537`) — construct through `CartSchema` instead; (c) silent-failure surface is reduced but UI banner coverage for every `Result.failure` path needs one Playwright failure-path spec (Phase 1 D8–D10).

### Observability & Diagnostics

**Assessment**: ★★★★☆ (4/5) — implemented and now honest.

- **Structured `Logger`** (JSON + human-readable, levels, correlation IDs, PII redaction with whole-`user`-subtree masking) and **privacy-first `Telemetry`** (off by default `enabled ?? false`, record-time redaction via `redactPaths` + per-install-salt ID hashing + amount bucketing before queue entry, local-only mode). The F5 regression tests assert both properties against the queued object pre-flush (`telemetry.spec.ts:180-198`), not against post-flush logs.
- **Diagnostics UI exists** (`popup/Diagnostics.tsx`) and the event queue batches with sampling.
- **Why not 5/5**: (a) no ERROR-sink to a capped IndexedDB `logBuffer` store for the Diagnostics pane (in-memory logs die with the worker); (b) no CI-asserted performance budgets from `packages/benchmarks` (budgets exist as targets, not gates); (c) `optimization_completed` structured event (duration, hashed merchant, strategy count, error code) should be emitted on every run while opted in — specified, not yet instrumented.

### Testing & Quality Assurance

**Assessment**: ★★★★☆ (4/5) — suite green, trustworthy, and now architecturally guarded.

- **Scale**: 37 files / 455 passed / 2 skipped (vitest + happy-dom; `fast-check` available; Playwright present with `tests/e2e/` excluded from the unit run by config). Conformance suites (`tests/conformance/`, 4 files, 37 tests) enforce manifest permissions, CSP/`eval` absence, `onMessageExternal` absence, no `test-fixtures` in production graphs, Money/quantity validation, 100k-voucher bound, byte-identical determinism, money round-trip, migration abort, and AI gating.
- **Regression-test discipline**: every remediation fix shipped with the audit's exploit scenario encoded (F9 undefined-ledger-key rejection, F5 pre-flush redaction, F11 1-minor-unit ordering, F12 JPY divisor, F14 limiter bound, F15 concrete attribute filter, F16 `"100n"`-as-string round-trip, Task 0.4 zero-total acceptance).
- **Gaps**: (a) property-based financial invariants (`fast-check`: discounts never raise effective cost, caps never exceeded, expired offers never add benefit, determinism) are available but underused — add 5 targeted properties in Phase 1; (b) Playwright failure-path specs (save-failure banner, offline fallback, invalid-message rejection, voucher-burn rollback) do not exist yet; (c) `vitest.config.ts:27` excludes `apps/extension/` from coverage — include it once the failure-path specs land, then ratchet the floor.

---

## 3. Critical Modifications & Technical Debt Remediation

| Priority | Category      | Component / Module                                                                | Issue / Technical Debt                                                                                                                          | Impact If Ignored                                                                       | Recommended Fix                                                                                                                                                                       |
| -------- | ------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0**   | Correctness   | `packages/domain/src/message-schemas.ts`                                          | `SerializedRecipeStepSchema` omitted `benefitSourceId`; Zod stripped the ledger join key → `benefitId: undefined` on every persisted entry      | ROI aggregation and all future analytics join on garbage                                | ✅ **Fixed** (`6b816ee`): required `benefitSourceId` (+ optional `benefitId`), fixture updated, F9 regression tests; service worker derives `benefitsApplied` from `recipeSteps`      |
| **P0**   | Privacy       | `packages/domain/src/telemetry.ts`                                                | `enabled ?? true`, `redactPaths` plumbed but never applied — raw merchant IDs and exact amounts sat in the queue                                | Violates the local-first privacy contract; the zero-egress claim is false               | ✅ **Fixed** (`62c2f4a`): default `false`, record-time hashing/bucketing/`redactPaths` enforcement, `getQueuedEvents()` hook, pre-flush assertions                                    |
| **P0**   | Correctness   | `packages/optimizer/src/ranker.ts`, `packages/benefits/.../opportunity-scorer.ts` | `Number(amountMinor/100n)` floor truncation + hardcoded `/100` divisor (JPY ¥15 scored as ¥0.15); float-score sort allowed 1-minor-unit ties    | Wrong winner on near-ties; entire JPY market mispriced                                  | ✅ **Fixed** (`c9878db`): `CURRENCY_MINOR_EXPONENT`/`minorDivisor`/`minorToMajor`, BigInt-primary + `id` total-order comparator, F11/F12 tests                                        |
| **P0**   | Build hygiene | `packages/*/src/*.js`, `*.d.ts` emitted next to sources                           | Stale `tsc` artifacts shadowed source resolution (`getQueuedEvents is not a function` while the method existed)                                 | Phantom test failures; false confidence in green runs                                   | ✅ **Fixed**: deleted artifacts, `.gitignore` now covers `packages/*/src/**/*.js`, `*.d.ts`, maps, plus `.kilo/`; `dist/` was already ignored                                         |
| **P1**   | Correctness   | `apps/extension` service worker + popup                                           | `SAVINGS_CONFIRMED` and partial-`Cart` constructions via `as unknown as`; `executeSaveTask(payload as never)`                                   | Casts bypass the validation the audit just installed; next schema drift is silent again | Replace with `SavingsConfirmedMessageSchema` + `CartSchema`-constructed cart + `StoredSavingsEntry` guard; add lint rule banning `as unknown as` in `apps/extension/src` except tests |
| **P1**   | Reliability   | `apps/extension` (service worker)                                                 | No distributed voucher-burn lock; `TransactionCoordinator` is per-instance                                                                      | Two tabs can double-spend the same voucher; background + popup can contend              | `BroadcastChannel` + `chrome.storage.onChanged` bridge (ADR-004) with a burn-lease record in IndexedDB; Playwright two-tab contention spec                                            |
| **P1**   | Coverage      | `vitest.config.ts`, `tests/e2e/`                                                  | Extension excluded from coverage; no Playwright failure-path specs; `fast-check` underused                                                      | Floor ratchet stalls below 85%; error paths untested where users actually meet them     | Include `apps/extension` in coverage; add 5 `fast-check` money invariants + 4 Playwright failure specs; ratchet floor 60→70→85                                                        |
| **P1**   | Residual      | `packages/savings` vs `packages/storage`                                          | Duplicate `SavingsEntry` shapes and a second `savings-repository.ts`                                                                            | Next author edits the wrong copy; indexes/writer drift again                            | Scope `savings` to pure calculation; delete its repository twin or re-export the storage canonical type                                                                               |
| **P2**   | Hygiene       | `packages/domain`                                                                 | Observability/resilience infra (`logger`, `telemetry`, `circuit-breaker`, `rate-limiter`, `result`, `clock`) lives in the most-imported package | Every infra churn re-verifies the world; exactly where past typecheck fires clustered   | Extract `@payments-optimizer/observability` + `@payments-optimizer/resilience` leaf packages (Phase 2)                                                                                |
| **P2**   | DX            | `apps/extension/src/content/content-script.ts`, `packages/checkout-monitor`       | Fixed this round (`stripActiveDomContent` rename, concrete attribute filter, shared truncate path) — keep honest                                | If `sanitize*` naming or `data-*` wildcard returns, Task 0.2 / F15 tests catch it       | ✅ **Fixed** (`e87957b`); add ESLint `no-restricted-syntax` on `attributeFilter: ['data-*']` to prevent recurrence                                                                    |
| **P2**   | Docs          | `docs/`                                                                           | F19–F23 were code-less spec gaps                                                                                                                | Features built on undecided contracts (price source, PAN boundary, hysteresis)          | ✅ **Fixed** (`842a920`): `docs/audit-remediation-F19-F23.md` records each decision/contract; F21 ADR and F22 tooling gates are Phase 2 DoD                                           |

### Before/After: P0 — `benefitSourceId` ledger key (Fix F9)

**Before (schema silently stripped the key):**

```typescript
// packages/domain/src/message-schemas.ts
export const SerializedRecipeStepSchema = z.object({
  stepNumber: z.number().int().positive(),
  actionType: z.string(),
  benefitSourceName: z.string(), // ← no benefitSourceId
  // …
});
// service-worker persisted benefitsApplied: [] — ledger had no join key
await saveConfirmedOptimization(cart, strategy, originalTotal, []);
```

**After (schema carries the key; worker derives the ledger):**

```typescript
export const SerializedRecipeStepSchema = z.object({
  benefitId: z.string().min(1).optional(),
  benefitSourceId: z.string().min(1), // ← required; validation rejects without it
  // …
});
// service-worker CONFIRM_SAVINGS derives benefits from recipeSteps:
const benefitsFromSteps = (strategy.recipeSteps ?? []).map((s) => ({
  benefitId: s.benefitSourceId, // stable ID; names are never join keys
  benefitType: s.actionType,
  benefitSourceId: s.benefitSourceId,
  benefitSourceName: s.benefitSourceName,
  amountApplied: {
    amountMinor: BigInt(s.amountApplied.amountMinor),
    currency: s.amountApplied.currency,
  },
}));
```

### Before/After: P0 — telemetry default + record-time redaction (Fix F5)

**Before:**

```typescript
const enabled = config.enabled ?? true; // ← on unless asked off
record(event) {
  this.queueEvent({ id, timestamp, ...event }); // ← raw IDs/amounts queued
}
```

**After:**

```typescript
const enabled = config.enabled ?? false; // ← off unless opted in
record(event) {
  this.queueEvent({ id, timestamp, ...event,
    properties: this.redactProperties(event.properties ?? {}) }); // ← hashed/bucketed pre-queue
}
```

### Before/After: P0 — BigInt ordering + per-currency divisor (Fix F11/F12)

**Before:**

```typescript
return Number(amountMinor / 100n); // floor truncation
return Number(amountMinor) / 100; // JPY-blind
filtered.sort((a, b) => scoreStrategy(b) - scoreStrategy(a)); // 1-paise ties
```

**After:**

```typescript
// domain/src/index.ts
export const CURRENCY_MINOR_EXPONENT = { INR: 2, USD: 2, EUR: 2, GBP: 2, JPY: 0, SGD: 2, AED: 2 };
export const minorToMajor = (minor: bigint, ccy: Currency) =>
  Number(minor) / Number(10n ** BigInt(exponent[ccy]));
// ranker.ts — total order, never ties on 1 minor unit, deterministic on id
if (a.totalBenefit.amountMinor !== b.totalBenefit.amountMinor)
  return a.totalBenefit.amountMinor > b.totalBenefit.amountMinor ? -1 : 1;
```

---

## 4. Optimization & Enhancement Recommendations

### Performance & Scalability

1. **Three-tier public-data caching (L1→L2→L3).** `offers-bundle.json` is parsed on every service-worker cold start and duplicated per tab. Target: L1 worker memory (active merchant, ~5-min TTL, ~50KB) → L2 IndexedDB shared catalog (1-day TTL; merchant metadata 7-day) → L3 versioned public-data CDN refreshed on install/weekly. Honor local-first: L3 fetches versioned _public_ data only, never profile/cart identifiers, with content-addressed checksum rejection. Expected: cold-start parse 250ms → <50ms; per-tab duplication eliminated.
2. **Move savings aggregation off the render path.** `SavingsSummary`/`SavingsHistory` reduce over history synchronously. Pre-compute daily/merchant aggregates on the 6-hour `alarms` tick into an `aggregates` store; UI reads rollups with an invalidation timestamp. Required before the 10k-entry scale point.
3. **CI-asserted benchmark budgets.** `packages/benchmarks` + `tools/benchmark` exist but no PR asserts them. Add a CI job failing on stacking/graph/optimization budget breach (P95 <100ms for 50+ vouchers; 100k-voucher bound as the canary). The pipeline-soundness 100k test currently takes ~7.5s of the 15s envelope — healthy headroom, now lock it in.
4. **Concentrate IndexedDB access.** All IDB I/O already flows through repository abstractions; add an ESLint `no-restricted-globals` rule on bare `indexedDB` outside `packages/storage` so the layering guarantee survives review.

### Developer Experience (DX) & Tooling

1. **Keep the gate real, then ratchet it.** Husky pre-commit (`pnpm typecheck` + `pnpm test`) and CI (`typecheck` → `lint` → `format` → `test` → `test:coverage` → `build`) are green. Next, in order: (a) mark all six checks **required** in GitHub branch protection (repo-admin setting, the one unenforced step); (b) adopt `--max-warnings 0` once the legacy `any`-headers are retired file-by-file; (c) include `apps/extension/` in coverage and ratchet the floor toward 85%.
2. **Kill the cast habit with tooling.** Add `no-restricted-syntax` bans for `as any` in production sources and for `attributeFilter: ['data-*']`, plus a `ts-to-zod` generation step so message validators cannot drift from types again.
3. **Service-worker HMR.** Extension iteration is slow without it — Vite plugin sending `sw-reload` → `chrome.runtime.reload()`. Small cost, daily dividend.
4. **Stop emitting build artifacts into `src`.** Root cause of the phantom `getQueuedEvents is not a function` failure was `tsc` output next to sources shadowing module resolution. The `.gitignore` fix stops commits; add a repo-root `clean` script (`rimraf` on `**/src/*.js|*.d.ts|*.map`) and a CI check failing on their presence.

### Security & Hardening Quick-Wins

1. **CSP + bundle allowlist test.** `manifest.json` already pins `script-src 'self'` with the single `connect-src` exception (`extension-surface.spec.ts:69-82`); Task 0.2 greps zero `eval(`/`innerHTML`. Add the missing companion: a CI test grepping the **built bundle** for hardcoded endpoints and asserting allowlist membership, plus zero `test-fixture` card-data references (source-level check exists at `extension-surface.spec.ts:103`; extend to bundle).
2. **Profile import stays fail-closed.** `importer.ts` already reuses `UserProfileSchema`, enforces referential integrity (`voucher.cardId` ∈ `paymentMethods`), gates checksums, and parses CSV numerics without `parseFloat`/`BigInt(NaN)` (`importer.spec.ts` covers dangling refs, negative amounts, `"12.34.56"` cells). Keep the "reject whole import, name the record" semantics — no partial writes.
3. **Finish the `as unknown as` cleanup** (§3 P1): `SAVINGS_CONFIRMED` schema, `CartSchema`-built confirm cart, `StoredSavingsEntry` guard. Each cast removed is a future F7/F18-class finding prevented.

---

## 5. Future Engineering & Feature Roadmap

### Phase 1: Stabilization & Green-Gate Hardening (Short-Term: Weeks 1–4)

**Exit criterion**: `typecheck`, `test`, `build`, `lint`, `format` green on every PR _and required in branch protection_; coverage floor ratcheting; zero `as unknown as` in production extension sources.

- [x] **D1**: Option A wiring (library resilience layer into the extension) + architecture-conformance CI check — done (`beed1a5`, `183a37e`).
- [x] **D2**: Durable write-ahead queue + single savings writer + canonical raw shape + currency guard + confirm-gate — done (`3c06d8b`, `beed1a5`).
- [x] **D3**: F9 ledger keys, F5 privacy defaults, F11/F12 money correctness, F14–F17 hygiene, Task 0.4 zero-path — done (`6b816ee`…`e87957b`).
- [x] **D4**: F19–F23 spec amendments before feature code — done (`842a920`).
- [ ] **D5**: Branch-protection enforcement + `--max-warnings 0` adoption + `clean` script + bundle allowlist test (est. 1–2 days).
- [ ] **D6**: 5 `fast-check` money invariants (discounts never raise cost; caps never exceeded; expired offers never add benefit; determinism; score-ordering) — the highest-leverage coverage addition for a financial engine.
- [ ] **D7**: 4 Playwright failure-path specs (save-failure banner, offline fallback, invalid-message rejection, voucher-burn rollback) + include `apps/extension/` in coverage; ratchet floor to 70.
- [ ] **D8**: P1 cast cleanup (`SAVINGS_CONFIRMED` schema, `CartSchema` confirm cart, `StoredSavingsEntry` guard) + `savings` vs `storage` consolidation decision.

**Deliverables**: enforced green gate, full-response determinism proof, documented error-path behavior, 70%+ floor.

### Phase 2: Architectural Scaling & Cross-Tab Coordination (Medium-Term: Month 2–3)

**Exit criterion**: 50+ voucher profiles stay <100ms P95 (CI-asserted); multi-tab writes race-free; background work survives worker kills; `domain` freed of infrastructure.

- [ ] **Extract leaf packages**: `@payments-optimizer/observability` (logger, telemetry) and `@payments-optimizer/resilience` (circuit-breaker, rate-limiter, result, clock). Reduces churn surface in `domain`; mechanical move with re-export shims.
- [ ] **Cross-tab coordination** (ADR-004): `BroadcastChannel` tab-to-tab + `chrome.storage.onChanged` service-worker bridge; IndexedDB burn-lease for voucher double-spend prevention; two-tab Playwright contention spec.
- [ ] **Aggregation worker + rollups**: 6-hour `alarms` pre-computation into `aggregates` store (Phase 1 D7 UI reads it); sharding scaffold per ADR-005 without activating it.
- [ ] **Benchmark budgets in CI**: stacking/graph/optimization budgets asserted per PR; 100k-voucher canary tracked historically.
- [ ] **F22 tooling gates**: ESLint payment-selector ban + zero-payment-field-read integration test as hard DoD before any Smart Checkout flag leaves dogfood.
- [ ] **F21 ADR**: price-source decision + absolute-delta floor + `verifiedAt` terms dataset (blocks Price-Drop Guard implementation).

### Phase 3: Next-Generation Feature Expansion (Long-Term: Month 4–6+)

Each feature ships independently behind a default-off flag with a two-week dogfood before staged rollout. Global constraints carry forward: local-first IndexedDB by default, BigInt branded money only, `alarms`+durable-queue for all scheduled work, structured-error fail-closed semantics, deterministic `Why am I seeing this?` explainability, no autonomous payment submission.

| Feature                                            | Business / Technical Value                                                                             | Complexity  | Architectural Prerequisites                                                                                                                      |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **3.1 Card Portfolio ROI & Annual-Fee Advisor**    | Retention via keep/downgrade verdicts, fee-waiver warnings; reuses savings ledger + aggregation worker | Medium      | Phase 2 aggregates; F23 attribution rule (pro-rate by entry timestamp); `CardAnnualCost` store + migration                                       |
| **3.2 Billing-Cycle-Aware Best-Time Optimization** | Breaks near-ties with float-days/milestones; expands to timing-aware recommendations                   | Medium      | F19 total-order comparator (landed); `TimingAwareOptimizer` decorator preserving byte-identical output with no billing data                      |
| **3.3 Recurring Charge & Subscription Auditor**    | Re-optimizes repeat spend; surfaces better-card annual savings; fully local detection                  | Medium      | F20 hysteresis (0.65/0.55) + `merchantId+amount-bucket` dedup key; indexed savings + sharding path                                               |
| **3.4 Post-Purchase Price-Drop & Refund Guard**    | Protects value after checkout; surfaces card price-protection terms with provenance                    | Medium–High | F21 price-source ADR + allowlisted source; decaying durable schedule; versioned terms dataset with `verifiedAt`                                  |
| **3.5 One-Tap Smart Checkout**                     | Converts recommendations into user-approved actions; prerequisite for F13 confirm-gate scale           | High        | F22 tooling gates (ESLint + zero-read test + adapter allowlist + malformed-message DoD); F13 confirm-gate (landed); no PAN/OTP/CVV handling ever |

_Deferred Phase 3 moonshots (unchanged): AI predictive insights (on-device only, quarantined from money math), International Travel Mode (exercises the multi-currency model + F12 divisor), Savings Dashboard & Analytics (needs aggregates + sharding), Community-Verified Offers (hybrid-cloud boundary per ADR-006)._

---

## 6. Technical Decision Log (ADR Recommendations)

### ADR-003: Durable Background Execution for MV3 — **DECIDED (Option A, implemented)**

**Context**: MV3 workers are killable at any time; telemetry flush, aggregation, and offer refresh must survive termination.
**Decision**: IndexedDB-backed durable task queue (`DurableTaskQueue`: `scheduledAt`/`retries`/lease + exponential backoff + dead-letter) with `chrome.alarms` as the wake trigger; exactly one in-flight lease per task type. Awaiting alone was explicitly rejected as insufficient — the write-ahead record is what closes the finding.
**Status**: Implemented and tested (`durable-task-queue.ts`, `service-worker.ts:130-179`, kill-mid-write round-trip spec). Remaining: extend the queue to telemetry flush + offer refresh (currently savings-only `SAVE_SAVINGS_ENTRY`).

### ADR-004: Cross-Tab State Synchronization — **REQUIRED before Phase 2 burns**

**Context**: Popup, content script, and service worker must observe the same voucher/profile state across tabs.
**Options**: `BroadcastChannel` (real-time, unavailable in workers) vs `chrome.storage.onChanged` (universal, storage-scoped) vs polling (wasteful).
**Recommended**: `BroadcastChannel` tab-to-tab + `chrome.storage.onChanged` worker bridge; IndexedDB as write source-of-truth; burn-lease record for voucher double-spend prevention. Two-tab contention Playwright spec is the acceptance gate.

### ADR-005: Savings History Partitioning — **PRE-DECIDED, deferred implementation**

**Context**: Unbounded ledger growth degrades queries even with indexes.
**Recommended**: Defer until ~10k entries; pre-decided shape is time-based sharding by year with an `aggregates` rollup, keeping cross-year queries rare and explicit. Scaffold the migration path during Phase 2 aggregation work; do not activate early.

### ADR-006: Local-First vs. Hybrid Cloud + AI Egress Disclosure — **AMEND REQUIRED**

**Context**: Community offers, ML insights, and affiliate revenue pull toward servers; the moat is local-first privacy.
**Recommended**: Hybrid with a hard boundary — optimization, profile, and history stay local; only opt-in, anonymized, k-anonymous telemetry and versioned public-data fetches leave the device. **Amendment required**: list the AI-explanation endpoint (`generativelanguage.googleapis.com`, key-in-header or documented residual risk, prompt stripped of card/program names and raw merchant IDs per Fix F4) as an explicit, disclosed, opt-in exception — not an unstated gap. Either implement the k-anonymity/DP claims for real or remove those sentences until they are.

---

**Document Version**: 3.0
**Last Updated**: September 9, 2026 (`842a920`)
**Next Review**: December 9, 2026 (or on Phase 1 exit, whichever comes first)
**Success Metrics (3-month horizon)**: green gate required on every PR; coverage floor 60→85; P95 <100ms for 50+ vouchers CI-asserted; zero double-spend/data-corruption across tabs; zero telemetry egress by default with pre-flush redaction proven by tests.
