# PaymentsOptimizer - Architectural Review & Strategic Roadmap

**Reviewed By**: Principal Software Architect & Staff Software Engineer  
**Review Date**: September 7, 2026
**Project Version**: v1.0.0-rc (post-Phase 1)
**Maturity Stage**: Active Beta → Production Candidate (build currently red)
**Basis**: Live verification against HEAD `850506f` (post-Phase-1 audit + fixes in progress)

> **Note**: This document supersedes the September 5 review. That version described Phase 1 work (beam search, transaction coordinator, serializer, etc.) as *future* debt. All ten Phase 1 epics have since been **implemented** (see `PHASES_COMPLETED.md` and `docs/PHASE_1_AUDIT.md`). This review reflects the actual current state: Phase 1 features delivered, but **typecheck is failing (~50 errors) and 4 tests red**, so the build gate is not green. Verified via `pnpm typecheck` and `pnpm test` on 2026-09-07.

---

## 1. Executive Summary & Health Assessment

### Overall System Maturity

| Dimension | Grade | Assessment (verified 2026-09-07) |
|-----------|-------|----------------------------------|
| **Architecture** | A− | Strict layered direction (Presentation → Application → Domain → Infrastructure) per `PaymentsOptimizer_Production_Architecture_Plan.md` §7. Clean workspace boundaries (domain / benefits / rules-engine / optimizer / storage / security / profile). Domain layer holds zero Chrome/IndexedDB/DOM dependencies. |
| **Code Quality** | **C+ (regressed)** | TypeScript `strict` + `exactOptionalPropertyTypes` is enabled, but the Domain package currently fails `tsc --noEmit` with ~50 errors (`exactOptionalPropertyTypes` mismatches, implicit-`any` in specs, missing `.js` extensions under `node16` resolution). Core feature code is strong; the *green-field* Epic 1.9 (logger/telemetry) and some spec files were merged before typecheck passed. |
| **Maintainability** | B+ | Exceptional documentation: 2 ADRs, 8 epic implementation reports, an audit + fix plan, production architecture plan (~2850 lines). Risk: docs claim "100% passing" while the actual suite shows red — doc/code drift. |
| **Performance** | A | Beam-search stacking (Epic 1.1) measured 0.58ms avg / 2.34ms worst vs a <100ms P95 target (~42× headroom). IndexedDB indexed reads (Epic 1.4). Deterministic BigInt arithmetic. Not yet validated under real multi-tab/browser load. |
| **Test Coverage** | B− | 353 tests: 346 pass, 4 fail, 3 skipped (measured). The failures are concentrated in `logger.spec.ts` (context-format assertions, child-logger output). Coverage *percentage* is not yet wired into CI. |

**Overall Health Score**: **81/100 (B)**
**Production Readiness**: 🟡 **Conditional** — Solvable within ~1–2 days. Blockers are typecheck failures and 4 failing tests, all isolated to Epic 1.9/1.10 surface area.

---

### Architectural Philosophy

**Core Strengths**:

1. **Deterministic Financial Core (strategic moat)** — All money is `bigint` minor units; all money-math is pure functions. AI is explicitly quarantined to *explanation only*, never computation (`PaymentsOptimizer_Production_Architecture_Plan.md` §3.3, §44–45). This yields reproducible, debuggable, legally-defensible results.

2. **True Local-First Privacy** — Profile, cards (name/issuer/last-4 only), vouchers, history all stay on-device in IndexedDB. No PAN/CVV/OTP ever stored (§37, §14). Telemetry is **off by default** and opt-in (§64). This is a durable product differentiator, not a bolt-on.

3. **Defensive Boundary Validation** — Content-script/DOM data is treated as hostile and validated with Zod schemas at the message boundary (§41–43). The new `DomainSerializer` (Epic 1.3) adds schema-versioned, type-safe serialization of `BigInt`/`Date` across the service-worker ↔ content-script channel.

4. **Disciplined Resilience Patterns** — `Result<T,E>` + 15 typed `DomainError`s (Epic 1.6), 3-state `CircuitBreaker` for the offer API (Epic 1.5), `TransactionCoordinator` with LIFO rollback for voucher-burn + savings-write atomicity (Epic 1.2), and `Clock` injection for deterministic time (Epic 1.8).

**Fundamental Structural Risks**:

1. **Quality Gate Erosion** — Phase 1 code was committed with failing typecheck/tests (the audit itself flags this: "No pre-commit type checking"). Without enforcement, the discipline that produced great patterns won't survive velocity.

2. **Strict-Mode Shock** — `exactOptionalPropertyTypes: true` + `moduleResolution: node16` are good defaults but were adopted *after* code was written, producing ~50 surfacing errors. The risk is teams loosening the config rather than fixing the code.

3. **Chrome MV3 Lifecycle Fragility** — Service worker can be killed at any time. Phase 1 added compensation/rollback, but there is still no **durable task queue** for background work (telemetry flush, savings aggregation). Retries/in-flight work can be lost on worker kill.

---

### Primary Bottlenecks

The original three bottlenecks (combinatorial explosion, missing cache, no observability) are **resolved or materially addressed** in Phase 1:

- ✅ **Combinatorial explosion** → solved by beam search (Epic 1.1), 42× faster than target.
- ✅ **Observability** → structured `Logger` with PII redaction + privacy-first `Telemetry` (Epic 1.9).

The **current** top-3 constraints, verified against HEAD:

#### 1. **Build Gate Is Red** (P0 — blocks everything)
`pnpm typecheck` fails in `@payments-optimizer/domain` with ~50 errors. Categories:
- `TS2375`/`TS2322`/`TS2532`: `exactOptionalPropertyTypes: true` — optional fields typed `T | undefined` are passed where the config type declares `T` only (`logger.ts:190/275`, `offer-api-client.ts:230`).
- `TS2835`: ESM `node16` requires explicit `.js` extensions on relative imports (`logger.ts:13–15`, `telemetry.ts:13–14`, `result.spec.ts:18`, `message-schemas`, etc.).
- `TS7006`: implicit-`any` lambda params in `result.spec.ts`.

**Impact**: The extension cannot ship; CI `test → typecheck` fails before `build`. Everything else is academic until this goes green.

#### 2. **Doc/Test Integrity Drift** (P0)
`PHASES_COMPLETED.md` reports "357/358 passing, 99.4%". Live run shows **346 pass / 4 fail / 3 skip of 353**. The failures are real (logger context-format assertions, child-logger output). When internal status docs overstate health, reviewers and stakeholders lose trust in the numbers.

#### 3. **No Durable Background Execution for MV3** (P1)
`chrome.alarms`/in-memory work is lost when the MV3 service worker is killed. Savings aggregation, telemetry flush, and offer refresh have no persistent, resumable queue. Phase 1 improved *atomicity of writes* but not *survivability of scheduled work*.

---

## 2. In-Depth Engineering Review

### Design Patterns & Modularity

**Assessment**: ★★★★★ (5/5) — architecture is the strongest aspect.

- **Clean Layering**: `Presentation → Application → Domain → Infrastructure` enforced. Domain is dependency-free (no Chrome/IndexedDB/DOM/HTTP imports).
- **Correct Pattern Choices**: Repository (`StorageRepository`), Strategy (`OptimizationStrategy`/`UnifiedBenefitOptimizer`), Registry (`MerchantRegistry`, `PluginRegistry`), Factory (`test-fixtures`), Monad (`Result<T,E>`), State Machine (`CircuitBreaker`), Saga (`TransactionCoordinator`), and Clock injection.
- **Type-Safe Boundaries**: Branded `Money` currency types prevent cross-currency mixing at compile time.

**Resolved since last review** (was a weakness): the manual `serializeStrategy()` BigInt handling has been replaced by a centralized `DomainSerializer` with schema versioning + Zod validation (Epic 1.3).

**Remaining concern**:
- **Cross-cutting infrastructure lives in `domain`** — `logger.ts`, `telemetry.ts`, `circuit-breaker.ts`, `result.ts`, `clock.ts` are excellent but are *observability/resilience infra*, not domain logic. This concentrates churn in the most-imported package and is exactly where the current typecheck errors landed. **Recommendation**: extract to `@payments-optimizer/observability` and `@payments-optimizer/resilience` leaf packages in Phase 2 (see §5).

---

### Data Architecture & Persistence

**Assessment**: ★★★★½ (4.5/5)

**Strengths (all verified in-tree)**:
- **IndexedDB + Repository abstraction** — domain never touches IDB directly (§35).
- **Currency safety** — `BigInt` minor units, branded currency types; no float money.
- **Optional AES-256-GCM export encryption** with PBKDF2 key derivation (§36).
- **Indexes now in place** (Epic 1.4): migration V2 adds `by_merchant_timestamp` (compound), `by_timestamp`, `by_merchant`; `SavingsRepository` has an intelligent query router. O(log n + k) vs O(n) scan.
- **Migration runner** (Epic 1.7): forward/backward migrations with rollback; used by the V2 index migration.

**Remaining gaps**:

1. **No cross-store atomicity beyond the operation set** — the `TransactionCoordinator` models app-level saga rollback, but IndexedDB itself is transactional per-store; multi-store operations rely on the coordinator's compensating actions. Keep tests proving a mid-transaction kill restores consistency.

2. **No data sharding yet** — fine at current volume, but savings history will grow unbounded. Decision deferred to ADR-005 (time-based sharding), see §6.

3. **Checksum/integrity for imported profiles** — export is encrypted; ensure import path validates schema + checksum before activation (§61, §47). Close this in the security hardening quick-wins (§4).

---

### Error Handling & Fault Tolerance

**Assessment**: ★★★★☆ (4/5)

**Strengths (implemented in Phase 1)**:
- **Result type everywhere** (Epic 1.6): `Result<T,E>` with `Ok`/`Err`, `andThen`/`map`/`mapErr`, `tryCatch`, `combine`, plus 15 typed `DomainError` subclasses with codes and `recoverable` flags.
- **Circuit breaker** (Epic 1.5): `CLOSED → OPEN → HALF_OPEN` with a health/metrics API; `OfferApiClient` adds timeout + retry and falls back to empty arrays so it never throws on external failure.
- **Boundary validation**: Zod schemas validate every inbound extension message (Epic 1.3 message schemas).
- **Rate limiting** in the service worker (10 req/min) for message abuse.

**Remaining gaps**:

1. **Circuit-breaker skip coverage** — one timeout/AbortController test is skipped due to mock-timer interaction. The most important resilience behavior (real timeout) is under-tested. Fix by driving the breaker with the injected `Clock` (Epic 1.8) instead of retrying real timers.

2. **`exactOptionalPropertyTypes` friction** — several errors are *type-level* symptoms of optional-field design (e.g., `OfferApiConfig.circuitBreaker`, `LogEntry.correlationId`). Adopt one convention: prefer `correlationId?: string` **or** `correlationId: string | undefined` consistently, and thread that convention through `DomainError.toJSON()` and the telemetry/serializer boundaries.

3. **Silent-failure surface is reduced but not eliminated** — savings/save paths persist; ensure each `Result.failure` returned to the UI surfaces a non-blocking banner rather than console-only. Add a small UI-level integration test for the failure path.

---

### Observability & Diagnostics

**Assessment**: ★★★☆☆ (3/5) — implemented but not yet trustworthy (its own tests fail).

**Now in place** (Epic 1.9):
- **Structured `Logger`** — JSON + human-readable output, log levels, correlation IDs, context.
- **Automatic PII redaction** — passwords, tokens, emails, card numbers scrubbed before output.
- **Privacy-first `Telemetry`** — off by default, opt-in only, local-only mode supported, event queue with batching/sampling.
- **Diagnostics UI** already exists (`apps/extension/src/popup/Diagnostics.tsx`).

**Why it isn't 5/5**:
- **4 of the failing tests are in `logger.spec.ts`** — context formatting (`action=login`) and child-logger assertions fail. Observability you can't trust is worse than none: it gives false confidence during an incident.
- **No export/flush durability** — telemetry events queue in memory; an MV3 service-worker kill drops them. Needs the durable task queue (ADR-003).
- **No performance-budget enforcement in CI** — budgets exist as targets (§51) but are not asserted by CI.

**Near-term instrumentations to keep it honest**:
- Emit a structured, redacted event on `optimization_completed` with `durationMs`, `merchantId` (hashed), `strategyCount`, and an `errorCode` on failure — all opt-in.
- Add a `logBuffer` sink that writes ERROR-level entries to a capped IndexedDB store so the Diagnostics pane can show recent failures without shipping PII anywhere.

---

### Testing & Quality Assurance

**Assessment**: ★★★☆☆ (3/5) — strong volume, broken surface, un-enforced gates.

**Strengths**:
- **353 tests** across 27 files; `Vitest` + `happy-dom`; `fast-check` available for property tests; `Playwright` for E2E (specs exist under `tests/e2e/`).
- **`test-fixtures`** package for reusable cards/merchants/edge cases (multi-currency covered).
- **Benchmark harness** (`tools/benchmark`, `packages/benchmarks`) for the stacking engine.
- **CI** runs `install → typecheck → lint → test → build` in two jobs (`.github/workflows/ci.yml`).

**Verified gaps (measured 2026-09-07)**:

1. **4 failing tests / 3 skipped** — `logger.spec.ts` context-format + child-logger assertions fail; 3 skips are polyfill/timer edge cases. Also, the older `createMoney`/`createCart` "missing helper" failure from the audit appears resolved by in-progress uncommitted edits (`stacking-engine.spec.ts` is dirty in the working tree).

2. **CI cannot actually catch this** — although CI runs `typecheck` and `test`, these failures are on `main`. That means either (a) the failing specs aren't run in the CI matrix, or (b) merges happened without the gate passing. Either way the gate is not a *blocking* gate in practice. **Fix**: make `pnpm typecheck` and `pnpm test` required, add a pre-commit hook (Husky), and require green before merge.

3. **Coverage % not measured in CI** — `@vitest/coverage-v8` is installed; coverage is a local command. Enforce a threshold (≥85%) and fail below it.

4. **Property-based tests exist but are underused** — for a financial engine, add `fast-check` invariants now (discounts never increase effective cost; caps never exceeded; expired offers never add benefit; determinism on identical input). See §5 Phase 1.

5. **Mutation testing not wired** — `@stryker-mutator` would verify these financial tests actually detect wrong rates/caps/operators. Defer to Phase 2.

---

## 3. Critical Modifications & Technical Debt Remediation

This table reflects the **actual, currently-verifiable** debt (not the already-completed Phase 1 items).

| Priority | Category | Component / Module | Issue / Technical Debt | Impact If Ignored | Recommended Fix |
|----------|----------|--------------------|------------------------|-------------------|-----------------|
| **P0** | Build | `packages/domain/src/*.ts` | `exactOptionalPropertyTypes` violations & implicit-any in logger/telemetry/offer-api/result (~50 errors) | `pnpm typecheck` red; CI blocks; cannot ship | Resolve `exactOptionalPropertyTypes`: mark fields `?: T` **or** `T \| undefined` consistently; annotate spec lambdas |
| **P0** | Build | `packages/domain/src/*` | `node16` ESM: missing `.js` extensions on relative imports | Emits runtime/module errors under Node16 resolution | Add `.js` extensions to all relative imports in `domain` |
| **P0** | Tests | `packages/domain/src/logger.spec.ts` | 4 failing tests (context format, child logger) | Observability untrustworthy; docs lie about health | Fix assertions to match actual formatter; re-run |
| **P0** | Process | Repo-wide | Typecheck/test reached `main` red; no pre-commit gate | Debt will recur; "green build" is not a real invariant | Add Husky pre-commit (`pnpm build && pnpm test`); make CI checks required |
| **P1** | Reliability | `apps/extension` (service worker) | No durable task queue for background work; MV3 worker kill drops retries/telemetry/aggregation | Lost telemetry, missed aggregation, silent offer-refresh failure | Implement IndexedDB-backed durable task queue + `chrome.alarms` (ADR-003) |
| **P1** | Correctness | `packages/storage/transaction-coordinator.ts` | Generic `Operation<T>[]` too narrow for heterogeneous ops (audit §2) | Compile errors / forced `any` at call sites | Refactor `executeAll(op: Operation<any>[])` with per-op variance, keep rollback typing |
| **P1** | Security | Export/import path | Imported profile not checksum-verified before activation | Tampered export could be activated | Verify `schemaVersion` + checksum before activation; fail closed |
| **P2** | Hygiene | `packages/domain` | Cross-cutting infra (logger, telemetry, circuit-breaker, result, clock) lives in `domain` | Churn in the most-imported package; bloated public API | Extract `@payments-optimizer/observability` + `@payments-optimizer/resilience` leaf packages (Phase 2) |
| **P2** | Tests | `packages/domain/src/circuit-breaker.spec.ts` | Timeout test skipped due to mock-timer interaction | Core resilience path under-tested | Drive with injected `Clock` (Epic 1.8) rather than real timers |
| **P2** | DX | `apps/extension` | No service-worker HMR | Slow iterate (reload loop) | SW HMR via Vite plugin + `chrome.runtime.reload()` signal |

---

### Before/After: P0 — `exactOptionalPropertyTypes` fixes

**Before (current offending pattern):**
```typescript
// packages/domain/src/logger.ts
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId: string;   // required...
}
// ...later
const entry: LogEntry = {
  timestamp, level, message,
  correlationId: maybeId,  // string | undefined  → TS2375
};
```

**After (consistent optional conventions):**
```typescript
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId?: string;        // <-- optional
  context?: Record<string, unknown>;
}

const entry: LogEntry = {
  timestamp, level, message,
  ...(maybeId !== undefined && { correlationId: maybeId }),
};
```

For `OfferApiConfig.circuitBreaker` prefer explicit-undefined:
```typescript
interface OfferApiConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
  circuitBreaker: CircuitBreakerConfig | undefined;  // explicit, satisfies exactOptionalPropertyTypes
}
```

**Rule of thumb**: use `?: T` for *absent* concepts and `T | undefined` where "explicitly not set" is meaningful.

---

### Before/After: P0 — `node16` ESM import extensions

**Before:**
```typescript
// packages/domain/src/logger.ts
import { ok, err } from './result';      // TS2835
import { SystemClock } from './clock';   // TS2835
import { DomainError } from './errors';  // TS2835
```

**After:**
```typescript
import { ok, err } from './result.js';
import { SystemClock } from './clock.js';
import { DomainError } from './errors.js';
```

Apply across `logger.ts`, `telemetry.ts`, `result.spec.ts`, `message-schemas`, etc. This is a repo-wide, mechanical fix well suited to a single focused PR.

---

## 4. Optimization & Enhancement Recommendations

### Performance & Scalability

#### 1. **Three-Tier Caching for the Public Benefit Catalog**
**Gap**: `offers-bundle.json` (plus merchant metadata) is parsed on every service-worker cold start and duplicated per tab.

**Target architecture** (L1 → L2 → L3):
```
L1: Service-worker memory (V8 heap)   — active merchant offers, TTL ~5 min, ~50 KB
L2: IndexedDB (cross-tab shared)      — full catalog, TTL 1 day; merchant data TTL 7 days
L3: Remote public-data CDN (optional) — versioned bundle, refreshed on install/weekly
```
Honor the local-first boundary: L3 fetches only versioned *public* data and never carries profile/cart identifiers (§38). Add a content-addressed version/checksum so stale bundles are atomically rejected (§47).

**Expected impact**: cold-start parse 250ms → <50ms; per-tab memory duplication eliminated via L2 sharing.

#### 2. **Durable Background Task Queue (MV3-safe)**
**Gap**: aggregation, offer refresh, and telemetry flush are not resumable if the service worker is killed mid-task.

Adopt the IndexedDB-backed queue from ADR-003 (§6) with `chrome.alarms` as the wake trigger and exponential backoff. This also gives retries for circuit-broken offer fetches a durable home.

#### 3. **Move Savings Aggregation Off the Render Path**
Current savings-summary components aggregate synchronously over history. Pre-compute daily/merchant aggregates in the background worker (6h alarm) and store them in an `aggregates` store; UI reads precomputed rollups with an invalidation timestamp.

#### 4. **Keep IndexedDB Access Concentrated**
Verify all IDB reads/writes go through the repository/savings-repository abstractions; add a lint rule (`no-restricted-globals` on `indexedDB` outside `packages/storage`) so the layering guarantee survives code review.

---

### Developer Experience (DX) & Tooling

1. **Make CI the enforcer, not the narrator**
   - Husky pre-commit: `pnpm build && pnpm test`.
   - Mark `typecheck`, `test`, `build` as **required** checks on the PR branch; add a `coverage ≥ 85%` step using the already-installed `@vitest/coverage-v8`.
   - Add `tsc --noEmit` to the extension package's own script so the whole workspace is covered.

2. **Unblock the red build first (est. 1–2 days)**
   - Mechanical PR 1: add `.js` extensions across `packages/domain`.
   - PR 2: resolve `exactOptionalPropertyTypes` mismatches using the `?: T` vs `T | undefined` convention from §3.
   - PR 3: fix the 4 `logger.spec.ts` assertions to the formatter's real output contract.
   Land each with green CI before merging the next — this restores the "gate is real" invariant.

3. **Service-Worker HMR** for the extension (Vite plugin sending a `sw-reload` signal to `chrome.runtime.reload()`).

4. **Generate runtime message validators from types** (`ts-to-zod`) so the content-script ↔ service-worker contract never drifts from the hand-written Zod schemas.

5. **Sweep the audit debt** (each small, isolated): un-skip the circuit-breaker timeout test via `TestClock`; add export/import checksum verification; resolve the `TransactionCoordinator` generic.

---

### Security & Hardening Quick-Wins

1. **CSP tightening in `manifest.json`**:
```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none';"
  }
}
```

2. **Profile import fails closed**: decrypt → validate `schemaVersion` → verify checksum → validate domain invariants → migrate → activate (§61). Any mismatch rejects the file with a structured `ImportError`.

3. **Optional-field hygiene** (directly tied to the typecheck debt): never write `field?: string` and then assign `field: maybeUndefined`. Standardize on the §3 convention — this is a *security* issue too, because `undefined` leakage is how optional state silently reaches serializers.

4. **Network allowlist test**: add a CI test that greps the built bundle for hardcoded endpoints and asserts they belong to the approved public-data allowlist (§39).

---

## 5. Future Engineering & Feature Roadmap

### Phase 1: Stabilization & Green Gate (Short-Term: Days 1–10)

**Exit criterion**: `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm lint` all green on `main`, enforced by CI.

- [ ] **D1–2**: Mechanical `.js`-extension PR + `exactOptionalPropertyTypes` fix PR (domain). Land with green CI.
- [ ] **D3**: Fix `logger.spec.ts` (4 failures); un-skip circuit-breaker timeout test via `TestClock`.
- [ ] **D4**: Add Husky pre-commit hook; mark CI checks required; add coverage ≥85% step; publish accurate test counts.
- [ ] **D5–7**: Add property-based invariants (fast-check): discount never raises effective cost; rewards never exceed caps; expired offers never add benefit; identical inputs → identical outputs; sorted-by-score invariant.
- [ ] **D8–10**: Add Playwright integration tests for the failure paths: save-failure banner, circuit-breaker offline fallback, invalid-message rejection, atomic voucher-burn rollback.

**Deliverables**: green build, trustworthy suite, enforced gates, documented error-path behavior.

---

### Phase 2: Architectural Scaling & Cross-Tab Coordination (Medium-Term: Month 2–3)

**Exit criterion**: complex profiles (50+ vouchers) stay <100ms P95; multi-tab writes are race-free; background work survives worker kills.

- [ ] **Extract leaf packages**: `@payments-optimizer/observability` (logger, telemetry) and `@payments-optimizer/resilience` (circuit-breaker, result, clock). Reduces churn surface in `domain`.
- [ ] **Durable task queue + alarms** (ADR-003): telemetry flush, savings aggregation, offer refresh.
- [ ] **Cross-tab coordination**: `BroadcastChannel` for state sync + `chrome.storage.onChanged` fallback (ADR-004); distributed lock for voucher burns to prevent double-spend.
- [ ] **Schema migration test harness** for every future `storage` migration (V2 index migration as the first golden case).
- [ ] **Benchmark budgets in CI**: assert stacking/graph/optimization budgets from `packages/benchmarks` on every PR.

---

### Phase 3: Next-Generation Feature Expansion (Long-Term: Month 4–6+)

#### Feature 3.1 — AI-Powered Predictive Insights
- **Business/Technical Value**: retention via proactive, spend-pattern-aware suggestions; differentiator.
- **Complexity**: High.
- **Prerequisites**: privacy-safe analytics (k-anonymity, ε=0.1 DP per ADR-006), local time-series storage, on-device inference (TF.js/WASM), and strict quarantine of AI from money math (§44).

#### Feature 3.2 — Cross-Currency "International Travel Mode"
- **Business/Technical Value**: expands TAM beyond INR markets; exercises the multi-currency domain model already in place.
- **Complexity**: Medium.
- **Prerequisites**: explicit rate tracking (source, rate, timestamp) with *no silent cross-currency comparison*, forex datasets, geolocation permission review.

#### Feature 3.3 — Savings Dashboard & Analytics
- **Business/Technical Value**: retention and share-of-wallet; feeds telemetry insights.
- **Complexity**: Medium.
- **Prerequisites**: aggregated savings store (Phase 2 item 3), sharding decision (ADR-005) before 10k+ entries.

#### Feature 3.4 — Community-Verified Offers (Privacy-First)
- **Business/Technical Value**: network effects / offer coverage moat.
- **Complexity**: High (backend + reputation + differential privacy).
- **Prerequisites**: hybrid-cloud decision (ADR-006), offer-signing for community submissions, explicit opt-in.

---

## 6. Technical Decision Log (ADR Recommendations)

The team must formally decide these before scaling. ADR-001 (repository foundation) and ADR-002 (benefits & membership intelligence) exist; the following are the next required records.

---

### ADR-003: Durable Background Execution for MV3
**Context**: MV3 service workers are killable at any time. Telemetry flush, savings aggregation, and offer refresh must survive worker termination.
**Options**: Chrome Alarms (periodic, 1-min granularity); Background Sync (one-shot, not periodic); in-memory worker queue (lost on kill).
**Recommended**: **IndexedDB-backed durable task queue** with state (`scheduledAt`, `retries`, `lease`) + `chrome.alarms` as the wake trigger; exponential backoff; no more than one in-flight lease per task type.

---

### ADR-004: Cross-Tab State Synchronization
**Context**: Popup, content script, and service worker must observe the same state (voucher burns, profile changes) across tabs.
**Options**: `BroadcastChannel` (real-time, not available in service workers); `chrome.storage.onChanged` (available everywhere, storage-scoped); polling (wasteful).
**Recommended**: **BroadcastChannel for tab-to-tab**; **`chrome.storage.onChanged` as the service-worker bridge**; treat IndexedDB as the single source of truth for writes.

---

### ADR-005: Savings History Partitioning
**Context**: Unbounded growth of `savings` entries degrades queries even with indexes.
**Options**: single store (now); time-based sharding (per-year DBs); merchant-based sharding.
**Recommended**: defer until ~10k entries/production signal, but **pre-decide now**: time-based sharding by year with an `aggregates` rollup, keeping cross-year queries rare and explicit.

---

### ADR-006: Local-First vs. Hybrid Cloud
**Context**: Community offers, ML insights, and affiliate revenue want server support; the product's moat is local-first privacy.
**Recommended**: **Hybrid with a hard privacy boundary** — optimization, profile, and history stay local; only opt-in, anonymized, k-anonymous telemetry and versioned public-data fetches leave the device. Any future cloud service must pass the §64 rule ("architecture makes accidental telemetry difficult").

---

## Conclusion

PaymentsOptimizer's architecture is genuinely strong: deterministic BigInt money-math, disciplined pattern adoption (Result, saga, circuit breaker, clock injection), clean monorepo layering, and privacy as a first-class invariant. Phase 1 delivered the right *patterns*; what remains is to make the *gate* real.

The current red build (~50 typecheck errors, 4 failing tests) is not an architecture problem — it is a **process problem** and it is **isolated and mechanical** (≈1–2 days of PRs). Fix that first; it restores trust in every other signal (CI, docs, coverage).

After the gate is green, the highest-leverage engineering investments are, in order:
1. **Green gate + enforced CI** (Days 1–10).
2. **Durable background execution + cross-tab coordination** (Month 2–3) — closes the last MV3 lifecycle gaps.
3. **Extract observability/resilience leaf packages** to protect `domain` from infrastructure churn.
4. Feature expansion (AI insights, travel mode, community offers) only after 1–3, because each depends on durable analytics and clean package boundaries.

**Success Metrics** (3-month horizon):
- `pnpm typecheck && pnpm test && pnpm build` green on every PR (enforced, not aspirational)
- Test coverage ≥85%; 0 skipped resilience tests
- P95 optimization latency <100ms for 50+ voucher profiles (CI-asserted)
- Zero voucher double-spend / data-corruption incidents across tabs
- Zero telemetry egress by default; PII redaction verified by tests

---

**Document Version**: 2.0
**Last Updated**: September 7, 2026
**Next Review**: December 7, 2026 (or immediately after the build gate is green)

---

# PaymentsOptimizer - Next 5 Features

## Production Feature Brief

This section extends the roadmap after Phase 1 stabilization and Phase 2 scaling are complete. These features are deliberately separate from the speculative Phase 3 concepts previously listed. They address recurring day-to-day problems for users of a payment-optimization tool, reuse the current local-first architecture, and can ship independently behind feature flags.

### Selection Logic

1. **Card Portfolio ROI Advisor**: users need to know whether a card is worth retaining, not only which card wins one transaction.
2. **Billing-Cycle-Aware Optimization**: timing, statement dates, and milestone deadlines materially affect value.
3. **Recurring Charge Auditor**: recurring spend is repeatedly paid without being re-optimized.
4. **Post-Purchase Price-Drop Guard**: an optimization is incomplete if the purchase becomes cheaper immediately afterward.
5. **One-Tap Smart Checkout**: a recommendation has limited value if users abandon it during checkout.

Together, these features move PaymentsOptimizer from a recommendation engine toward a local financial-assistance workflow that executes safe, user-approved actions and protects value after checkout.

### Global Constraints

1. **Local-first**: all new data, including ROI calculations, subscription detections, billing settings, and price-watch state, remains in IndexedDB by default. Network calls are public-data-only, circuit-breaker-protected, and must degrade to `feature unavailable` without breaking the core optimizer.
2. **Financial correctness**: all monetary values use existing `BigInt` branded minor-unit types. No floating-point currency logic may be introduced.
3. **Durable background work**: every scheduled job uses `chrome.alarms` plus the IndexedDB-backed `DurableTaskQueue`; no ad hoc timers or in-memory cron loops.
4. **Feature flags**: each feature is independently feature-flagged and defaults to `false` in production until acceptance tests and a two-week internal dogfood period are complete.
5. **Explainability**: every inferred subscription, ROI verdict, timing recommendation, or post-purchase alert exposes deterministic reasoning in the UI through a `Why am I seeing this?` affordance.
6. **No autonomous financial execution**: the extension may recommend, prepare, or apply a user-approved coupon. It must not submit payments, enter OTPs/CVVs, purchase gift cards, or store/transmit raw PAN data.
7. **Failure semantics**: failed network calls, stale merchant selectors, incomplete data, and expired watches must fail closed and return structured errors. They must never fabricate a successful discount, price result, or payment action.

### Common Feature Contract

Each feature below is a self-contained implementation brief with use cases, user stories, data model, deterministic logic, UX, architecture, edge cases, privacy, implementation tasks, definition of done, success metrics, and rollout controls.

## Feature 1 - Card Portfolio ROI and Annual-Fee Advisor

### Use Cases

- Determine whether a card's realized rewards and manually recorded benefits exceed its annual fee.
- Identify cards that are unused, underperforming, or candidates for downgrade.
- Warn users when a fee-waiver threshold is mathematically unlikely to be reached before the window closes.

### User Stories

- As a multi-card user, I want a per-card scorecard showing spend, rewards, benefits, fee, and net value.
- As a user approaching a fee-waiver threshold, I want the exact amount and days remaining.
- As a user, I want the verdict explanation to be derived from the same numbers displayed in the scorecard.

### Data Model

```typescript
interface CardAnnualCost {
  cardId: string;
  annualFee: Money;
  feeWaiverThreshold?: Money;
  feeWaiverWindowStart: number;
  feeWaiverWindowEnd: number;
}

interface CardBenefitEntry {
  id: string;
  cardId: string;
  value: Money;
  category: 'lounge' | 'insurance' | 'voucher' | 'other';
  occurredAt: number;
  note?: string;
}

interface CardROISnapshot {
  cardId: string;
  periodStart: number;
  periodEnd: number;
  totalSpend: Money;
  totalRewards: Money;
  totalBenefits: Money;
  timesUsedAsOptimalStrategy: number;
  netValue: Money;
  verdict: 'keep' | 'reconsider' | 'downgrade-candidate';
  reasoning: string[];
  generatedAt: number;
}
```

### Algorithm and Logic

1. The monthly aggregation worker queries the indexed savings repository for the trailing 12 months, or the actual active period for newer cards.
2. It sums card-attributed rewards and manually entered `CardBenefitEntry` values. Benefits are never inferred from page content or telemetry.
3. It computes `netValue = rewards + benefits - annualFee`, using one currency and `BigInt` arithmetic.
4. A positive net value with at least 12 optimal uses yields `keep`; a positive net value with fewer uses yields `reconsider`; zero or negative net value yields `downgrade-candidate`.
5. Reasoning bullets are generated by the same pure function that returns the numeric scorecard, preventing narrative/math divergence.
6. Fee-waiver risk is true when `remainingThreshold > averageDailySpend * daysLeft` and `daysLeft < 30`.

### UX and Edge Cases

- Add a `Portfolio` tab with verdict chips, net value, 12-month trend, and fee-waiver progress.
- Show a banner only on a state transition to `downgrade-candidate` or fee-waiver risk; do not nag on every render.
- Cards newer than 12 months show `partial year` and prorated fee comparison.
- No-fee cards show usage and benefits without a keep/downgrade verdict.
- Removing a card stops future aggregation but preserves historical snapshots and benefits.

### Architecture and Privacy

- Reuse the Phase 2 aggregation worker and Phase 1 savings indexes; do not create a second scanner.
- Add an IndexedDB store and migration for annual-cost settings, benefit entries, and snapshots.
- Keep card IDs/nicknames local; never include card numbers or personal identifiers in logs or telemetry.

### Implementation Tasks

- [ ] Define types, repositories, migration, and feature flag `portfolio_roi_advisor`.
- [ ] Extend the aggregation worker with trailing-period and partial-year calculations.
- [ ] Implement pure verdict, proration, fee-waiver-risk, and reasoning functions.
- [ ] Add manual benefit-entry form with validation and edit/delete support.
- [ ] Build Portfolio list/detail views, trend visualization, and state-change banner.
- [ ] Add unit, migration, integration, and feature-flag tests.

### Definition of Done and Metrics

- [ ] All three verdicts, partial-year proration, no-fee behavior, and fee-waiver warnings have deterministic tests.
- [ ] Scorecard numbers and reasoning are produced by the same function.
- [ ] No card PII appears in snapshots, diagnostics, or telemetry.
- [ ] Track Portfolio-tab adoption and the rate at which users mark a downgrade candidate inactive.

### Rollout

Flag off -> internal dogfood with consent for two weeks -> 10% rollout -> review verdict/support feedback -> 100% rollout.

## Feature 2 - Billing-Cycle-Aware Best-Time Optimization

### Use Cases and User Stories

- Help users understand days until a statement and payment due date.
- Break near-ties using interest-free float or an imminent milestone.
- Explain when a slightly worse immediate discount completes a valuable milestone.

### Data Model

```typescript
interface CardBillingCycle {
  cardId: string;
  statementDay: number;
  paymentDueDay: number;
  currentCycleSpend: Money;
  milestones: Array<{
    id: string;
    threshold: Money;
    reward: Money;
    windowEnd: number;
  }>;
}

interface TimingAdjustedStrategy extends UnifiedTransactionStrategy {
  daysUntilBillDue: number;
  interestFreeFloatDays: number;
  milestoneImpact?: {
    milestoneId: string;
    closesInDays: number;
    reward: Money;
    amountStillNeeded: Money;
  };
}
```

### Algorithm and Logic

1. Users optionally enter statement and payment-due days; the app never infers them from transactions.
2. `TimingAwareOptimizer` decorates `UnifiedBenefitOptimizer`, preserving its output when no billing data exists.
3. For each candidate card, calculate days to the next statement and then to payment due using the injected `Clock` and local timezone rules.
4. Only when two candidates are within configurable `epsilon` (default 2% of cart total) may float days act as a tie-breaker.
5. Detect milestone completion as a separately labeled impact, not hidden inside a score.
6. When multiple milestones apply, show the closest-to-completion milestone and its explicit trade-off.

### UX, Architecture, and Edge Cases

- Add optional statement/due fields to card setup and a dashboard `Milestones closing soon` widget.
- Recommendation cards explain the deciding factor, including float-day difference and milestone amount.
- Missing billing data must produce byte-for-byte equivalent optimizer output to the pre-feature behavior.
- A milestone closing today remains valid through local end-of-day.
- Use `Clock` for all date arithmetic; never use direct `Date.now()` in decision logic.

### Implementation Tasks

- [ ] Add billing-cycle types, repository, migration, validation, and flag `billing_cycle_optimization`.
- [ ] Implement pure date/float/milestone calculations and `TimingAwareOptimizer` decorator.
- [ ] Add card setup fields, milestone widget, recommendation explanation, and accessibility states.
- [ ] Add regression, boundary-epsilon, timezone, and missing-data tests.

### Definition of Done, Metrics, and Rollout

- [ ] No billing data means identical output; epsilon boundaries are tested.
- [ ] Milestone overrides are never silent and always show a reason.
- [ ] Track billing-field completion and nudge follow-through.
- [ ] Ship fields first with behavior disabled, then enable for opted-in users after two weeks.

## Feature 3 - Recurring Charge and Subscription Auditor

### Use Cases and User Stories

- Detect likely recurring charges from local savings history without bank connectivity.
- Show monthly and annual recurring spend in one place.
- Identify a better card for a recurring merchant and estimate annual savings.
- Let users confirm, dismiss, or mark a subscription cancelled so the detector does not repeatedly resurface it.

### Data Model

```typescript
interface DetectedSubscription {
  id: string;
  merchantId: string;
  approximateAmount: Money;
  amountVariance: Money;
  cadence: 'weekly' | 'monthly' | 'annual' | 'irregular';
  occurrences: Array<{ timestamp: number; amount: Money; cardId: string }>;
  confidence: number;
  status: 'active' | 'user-dismissed' | 'user-confirmed-cancelled' | 'possibly-cancelled';
  currentCardId: string;
  betterCardId?: string;
  potentialAnnualSavings?: Money;
  lastEvaluatedAt: number;
}
```

### Deterministic Detection Algorithm

1. Query savings by `merchantId`; require at least three occurrences.
2. Calculate consecutive intervals and classify cadence by median interval: approximately 7, 30, or 365 days with documented tolerances.
3. Calculate confidence as `0.4` amount stability + `0.4` interval stability + `0.2` for six or more occurrences. Surface only confidence `>= 0.6`.
4. Re-run the optimizer for the observed recurring amount and compare held cards only. Never recommend a card absent from the user profile.
5. Estimate annual savings using cadence and per-occurrence improvement; preserve the source values for explainability.
6. If the expected next charge is absent after `1.5 * cadenceInterval`, transition to `possibly-cancelled` and request confirmation.

### UX, Architecture, and Privacy

- Add a `Subscriptions` section with total monthly/annual cost and per-merchant details.
- Actions: `Confirm`, `Already cancelled`, and `Not a subscription`; persist feedback by merchant/pattern.
- Use the indexed savings repository and Phase 2 sharding; reuse the core optimizer for card comparison.
- Detection is entirely local. Hashed merchant IDs may enter opt-in telemetry only through the existing privacy pipeline.

### Edge Cases and Implementation Tasks

- Variable grocery-like amounts should fall below confidence and remain hidden.
- A single held card must not produce a self-comparison or a fake alternative.
- Dismissed/cancelled records must not reappear without a meaningful new pattern.
- [ ] Define store, migration, repository, and flag `subscription_auditor`.
- [ ] Implement pure cadence, variance, confidence, and staleness functions.
- [ ] Implement held-card comparison and annualized savings calculation.
- [ ] Build list, detail, feedback, and stale-state UI.
- [ ] Add deterministic fixtures for clean, noisy, variable, cancelled, and single-card cases.

### Definition of Done, Metrics, and Rollout

- [ ] Detection precision tests reject noisy and amount-varying false positives.
- [ ] Feedback persists and controls future surfacing.
- [ ] Suggestions are limited to cards actually owned by the user.
- [ ] Track surfaced subscriptions, acted-on switch suggestions, and confirmed cancellations.
- [ ] Ship read-only detection first; enable card-switch suggestions only after two weeks of precision feedback.

## Feature 4 - Post-Purchase Price-Drop and Refund Guard

### Use Cases and User Stories

- Watch an explicitly selected purchase for a limited price-adjustment window.
- Notify users when the same product becomes materially cheaper.
- Surface a card's documented price-protection terms and claim deadline without inventing procedures.

### Data Model

```typescript
interface PriceWatch {
  id: string;
  merchantId: string;
  productUrlOrSku: string;
  purchasePrice: Money;
  purchaseTimestamp: number;
  watchWindowDays: number;
  lastCheckedAt?: number;
  lowestSeenPrice?: Money;
  status: 'watching' | 'drop-detected' | 'window-expired' | 'user-dismissed';
  cardProtectionTermsRef?: string;
  notificationSentAt?: number;
}
```

### Algorithm and Reliability Rules

1. Offer an explicit opt-in after a tracked purchase; do not silently watch all browsing or purchases.
2. Use `DurableTaskQueue` with decaying cadence: daily for three days, then every three days until expiry.
3. Route every external price check through the Phase 1 `CircuitBreaker` and a concrete, allow-listed data source.
4. Treat drops below a documented minimum, such as 1%, as noise; calculate claimable difference with same-currency `Money` values.
5. Read claim instructions only from versioned static card-protection terms; never generate a claim procedure.
6. On expiry, cancel future tasks. A failed fetch leaves the watch in `watching` and never produces a false `no drop` result.

### UX, Architecture, and Edge Cases

- Add opt-in prompt, `Price Watches` list, days remaining, current/lowest price, and one-shot drop notification.
- Duplicate merchant+SKU watches must be merged or rejected.
- Changed URLs/selectors fail closed and write a diagnostic error.
- Currency mismatch disables comparison with an explicit unsupported message.
- The feature requires a formal price-source decision and a maintained card-terms dataset before implementation.

### Implementation Tasks

- [ ] Write ADR and data-source spike for each supported merchant.
- [ ] Define store, migration, repository, and flag `price_drop_guard`.
- [ ] Implement durable decaying schedule and expiry cancellation.
- [ ] Build versioned price-protection terms dataset and provenance display.
- [ ] Add opt-in UI, watch list, notifications, and diagnostics.
- [ ] Add tests for failed checks, expiry, deduplication, currency mismatch, and one-shot notifications.

### Definition of Done, Metrics, and Rollout

- [ ] No task exists beyond the watch window.
- [ ] Failed checks never change status to `no drop` or fabricate a price.
- [ ] A given drop notifies exactly once.
- [ ] Track eligible opt-in rate and user-reported successful claims.
- [ ] Pilot only with a small allow-list of merchants and cards with reliable data and documented terms.

## Feature 5 - One-Tap Smart Checkout

### Scope and Security Boundary

This feature is deliberately split into two independently flagged tiers:

- **Tier A: coupon/voucher auto-apply**, default candidate for rollout on known merchant adapters.
- **Tier B: card-selection assistance**, opt-in and limited to highlighting the user's recommended native browser payment method.

The extension must never read, store, transmit, or inject raw PAN, CVV, PIN, or OTP data. Browser-native payment autofill remains the only component allowed to handle those credentials.

### Data Model

```typescript
interface CheckoutAction {
  id: string;
  merchantId: string;
  cartId: string;
  actions: Array<{
    type: 'voucher-applied' | 'coupon-field-located' | 'field-focused';
    selectorHash: string;
    timestamp: number;
    success: boolean;
    errorCode?: string;
  }>;
  userConfirmedCardHighlight: boolean;
}
```

### Algorithm and UX

1. Extend registered merchant adapters with a coupon field selector and optional label-text validation; never use generic coupon-shaped DOM heuristics on unknown sites.
2. Add Zod-validated, versioned messages `APPLY_VOUCHER` and `LOCATE_COUPON_FIELD` through the existing `DomainSerializer` boundary.
3. Tier A locates, fills, and submits the merchant's own apply action only after the user clicks `Apply for me`; show a toast with success/failure.
4. Tier B highlights the recommended native browser payment method after explicit per-checkout confirmation; extension code never accesses card data.
5. Log actions locally in `CheckoutAction` and show a `Checkout Activity` diagnostics screen.
6. If a selector is stale, multiple fields are ambiguous, or the merchant rejects the code, show a manual-copy fallback and the merchant error. Never claim success based only on DOM insertion.

### Implementation Tasks

- [ ] Add adapter selector metadata and label self-checks.
- [ ] Add and validate `APPLY_VOUCHER` and `LOCATE_COUPON_FIELD` messages.
- [ ] Implement Tier A apply flow, merchant response detection, toast, and manual fallback.
- [ ] Implement local action log and Checkout Activity screen.
- [ ] Implement Tier B native-card highlight behind separate flag `smart_checkout_card_highlight`.
- [ ] Perform dedicated security review and static scan for PAN access.
- [ ] Use separate flag `smart_checkout_autoapply` for Tier A.

### Definition of Done, Metrics, and Rollout

- [ ] Static review proves no code path handles raw card numbers.
- [ ] Stale selectors, malformed messages, ambiguous fields, and merchant rejection are tested.
- [ ] Voucher-apply success means merchant acceptance, not merely field insertion.
- [ ] Track accepted apply rate and reduction in recommended-but-unused strategies.
- [ ] Roll out Tier A to 3–5 high-traffic adapters first; keep Tier B opt-in indefinitely unless trust data justifies change.

## Cross-Feature Sequencing Notes

- Features 1 and 3 share the aggregation worker; implement one aggregation pipeline with separate projections, not parallel scanners.
- Feature 2 is the lowest-risk first shipment because it is additive and regression-testable.
- Feature 4 needs an external data-source decision early, despite being implemented later.
- Feature 5 has the highest security surface; schedule review before broad implementation.
- Risk-adjusted order: **2 -> 1 -> 3 -> 5 Tier A -> 4 -> 5 Tier B**.

---

## Detailed Phase-Based Execution Plan

This plan assumes Phase 1 stabilization and Phase 2 scaling are complete, including the green build gate, indexed/sharded savings repository, migration runner, durable task queue, cross-tab coordination, and background aggregation foundation. If any of those assumptions are false, the work must return to the stabilization gates in the earlier roadmap before feature development begins.

### Phase 0 - Readiness, Architecture, and Measurement

**Duration**: 1 week
**Objective**: Freeze contracts and prove that the platform can accept five independent feature slices without creating five incompatible persistence and scheduling systems.

#### Workstreams

1. **Platform readiness audit**
   - Verify `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm build`, E2E, and coverage gates are required checks.
   - Confirm `DurableTaskQueue` supports idempotency keys, retry count, lease/claim state, exponential backoff, cancellation, and dead-letter diagnostics.
   - Confirm the aggregation worker exposes a reusable projection interface rather than a feature-specific implementation.
   - Confirm all persisted records carry schema version and migration coverage.

2. **Feature-flag foundation**
   - Define a typed registry of flags with owner, default, rollout scope, expiry date, and kill-switch behavior.
   - Ensure a disabled flag prevents UI entry points, background jobs, migrations that are not needed, and outbound network work where possible.
   - Add diagnostics showing enabled flags without exposing user financial data.

3. **Shared domain contracts**
   - Standardize `Money`, `Clock`, `Result`, error codes, provenance, and explanation-trace conventions across all five features.
   - Define a common `FeatureEvaluationTrace` containing inputs, deterministic rule IDs, outputs, data freshness, and engine/data versions.
   - Define a common `FeatureJob` interface for scheduled projections and external checks.

4. **Security and privacy baseline**
   - Threat-model DOM manipulation, malicious merchant pages, malicious datasets, corrupted local records, and accidental telemetry egress.
   - Add bundle tests that reject PAN/CVV/OTP identifiers and unauthorized endpoint strings.
   - Review extension permissions before adding any capability; prefer no new permission.

5. **Observability baseline**
   - Add feature-scoped event names and redacted metrics: evaluation count, duration bucket, failure code, disabled/fallback count, and user action.
   - Keep telemetry off by default and aggregate locally until opt-in policy is applied.
   - Add dashboards or local diagnostics for job backlog, retry counts, migration version, and feature flag state.

#### Phase 0 Deliverables

- [ ] Platform readiness checklist signed off.
- [ ] Typed feature-flag registry and kill switches.
- [ ] Shared feature trace and durable-job contracts.
- [ ] ADRs approved for price data source and checkout automation boundary.
- [ ] Baseline performance, storage, and privacy tests committed.

#### Phase 0 Exit Gate

No feature begins implementation until the team can demonstrate that a disabled feature creates no user-visible behavior, no scheduled work, and no network request, and that every feature can be rolled back by flag without data loss.

---

### Phase 1 - Billing-Cycle-Aware Optimization

**Duration**: Weeks 2–4
**Priority**: First feature; lowest implementation risk and strongest regression-testability.
**Owner profile**: Optimization/domain engineer plus one UI engineer.

#### Week 2: Domain and Persistence

- [ ] Add `CardBillingCycle`, milestone, and validation schemas.
- [ ] Add migration and repository methods with strict day-of-month validation.
- [ ] Define local-timezone semantics for statement close, due date, and end-of-day milestone expiry.
- [ ] Implement pure functions for next statement date, due date, float days, milestone remaining, and epsilon comparison.
- [ ] Add `TimingAwareOptimizer` decorator without modifying the existing optimizer's candidate generation.

#### Week 3: UI and Explanation

- [ ] Add optional billing fields to card setup and editing.
- [ ] Add milestone-closing-soon projection to the dashboard.
- [ ] Add recommendation sub-line only when timing changes the displayed rationale.
- [ ] Add explicit effective-cost, immediate-savings, float, and milestone values; never hide monetary values in a subjective score.
- [ ] Add accessible labels, keyboard navigation, empty states, invalid-date states, and local-timezone copy.

#### Week 4: Verification and Dogfood

- [ ] Golden-test identical output with no billing data.
- [ ] Property-test epsilon boundary, date rollover, leap year, end-of-day, and multiple milestone cases.
- [ ] Run benchmark to prove no meaningful regression in optimization latency.
- [ ] Enable for internal dogfood, collect only opt-in aggregate behavior, and review false or confusing explanations.
- [ ] Enable 10% rollout only after two weeks of stable dogfood.

#### Phase 1 Exit Gate

- [ ] Zero behavior difference for profiles without billing-cycle data.
- [ ] P95 optimization remains under target.
- [ ] Every timing-driven recommendation includes a deterministic explanation.
- [ ] Flag rollback tested and migration remains safe when feature is disabled.

---

### Phase 2 - Portfolio ROI Advisor

**Duration**: Weeks 5–8
**Priority**: High user value; depends on stable aggregation and historical savings semantics.
**Owner profile**: Storage/analytics engineer plus UI engineer.

#### Week 5: Financial Model and Store

- [ ] Define annual-fee, fee-waiver, manual-benefit, and ROI snapshot schemas.
- [ ] Add migration with forward validation and rollback/backup behavior.
- [ ] Decide the exact attribution rule for rewards when a strategy has multiple payment steps.
- [ ] Add pure functions for prorated fee, net value, verdict, fee-waiver risk, and reasoning bullets.
- [ ] Add golden fixtures for no-fee, new card, positive ROI, negative ROI, and removed-card history.

#### Week 6: Aggregation Projection

- [ ] Extend the existing aggregation worker with a card ROI projection, not a parallel scheduler.
- [ ] Use indexed/sharded historical queries and bounded periods.
- [ ] Make projection idempotent by `(cardId, periodEnd, dataVersion)` key.
- [ ] Record calculation version so historical snapshots can be recomputed after rule changes.
- [ ] Add job retry, cancellation, and diagnostics for partial projection failures.

#### Week 7: User Inputs and UI

- [ ] Build manual benefit-entry form with amount, category, date, and optional note.
- [ ] Add Portfolio tab, detail page, trend chart, fee-waiver progress, and partial-year label.
- [ ] Add state-change-only banners with persisted notification state.
- [ ] Add export/diagnostic redaction tests for card labels and benefit notes.

#### Week 8: Verification and Dogfood

- [ ] Reconcile snapshot totals against seeded savings history.
- [ ] Test idempotent reruns and migration from empty, old, and partially populated stores.
- [ ] Verify no card PII is written to telemetry or logs.
- [ ] Dogfood with synthetic and consenting real profiles for two weeks before 10% rollout.

#### Phase 2 Exit Gate

- [ ] ROI snapshots reconcile to source savings and manual benefits.
- [ ] Reasoning and values are generated from one calculation result.
- [ ] Projection is idempotent and survives service-worker restarts.
- [ ] No repeated banner on unchanged verdict state.

---

### Phase 3 - Recurring Charge Auditor

**Duration**: Weeks 9–12
**Priority**: High value, but detection precision must be earned before recommendations are enabled.
**Owner profile**: Data/algorithm engineer plus UI engineer.

#### Week 9: Detection Engine

- [ ] Define charge observation input independent of UI/storage.
- [ ] Implement interval median, amount variance, cadence classification, confidence scoring, and staleness functions.
- [ ] Establish precision-oriented thresholds using deterministic fixture sets.
- [ ] Add negative feedback model scoped to merchant/pattern; do not silently learn global behavior.

#### Week 10: Persistence and Better-Card Evaluation

- [ ] Add subscription store, migration, status transitions, and feedback repository.
- [ ] Implement held-card-only comparison using a bounded optimizer input.
- [ ] Annualize savings using cadence and preserve calculation trace.
- [ ] Add idempotent scheduled detection projection keyed by history watermark.

#### Week 11: UI and Safety States

- [ ] Build subscription list, total recurring spend summary, and detail view.
- [ ] Add confirm, dismiss, not-a-subscription, and possibly-cancelled actions.
- [ ] Show detection evidence: occurrence count, cadence, amount range, and confidence reason.
- [ ] Ensure low-confidence detections never appear in the primary list.

#### Week 12: Precision Review

- [ ] Run seeded precision/recall evaluation against representative merchant patterns.
- [ ] Dogfood read-only detection for two weeks.
- [ ] Review false-positive rate before enabling switch-card recommendations.
- [ ] Add a kill switch that disables all detection jobs without deleting user feedback/history.

#### Phase 3 Exit Gate

- [ ] Detection meets a documented precision threshold agreed by product and engineering.
- [ ] Dismissed and cancelled subscriptions remain suppressed.
- [ ] Better-card suggestions only use owned cards and include annualized math.
- [ ] Staleness never claims cancellation as fact; it asks for confirmation.

---

### Phase 4 - Smart Checkout Tier A: Voucher and Coupon Apply

**Duration**: Weeks 13–16
**Priority**: High user value, high browser-security sensitivity.
**Owner profile**: Extension/security engineer plus merchant-adapter engineer.

#### Week 13: Threat Model and Adapter Contract

- [ ] Approve dedicated checkout security review before implementation.
- [ ] Define adapter metadata for coupon fields, label signals, apply action, and merchant response detection.
- [ ] Limit capability to allow-listed merchant adapters; unknown pages always use manual copy.
- [ ] Add message schemas and serializer versions for `APPLY_VOUCHER` and `LOCATE_COUPON_FIELD`.

#### Week 14: Safe DOM Interaction

- [ ] Implement field discovery with selector plus label self-check.
- [ ] Require user click for every apply action.
- [ ] Detect merchant acceptance/rejection after submission.
- [ ] Make all DOM operations timeout-bounded and abortable.
- [ ] Return structured fallback states: not found, ambiguous, rejected, stale adapter, or applied.

#### Week 15: Activity and Recovery UX

- [ ] Add on-page toast with exact action and result.
- [ ] Add Checkout Activity screen with local redacted action history.
- [ ] Add manual-copy fallback and never claim success on insertion alone.
- [ ] Add adapter-level diagnostics for selector drift.

#### Week 16: Security Verification and Pilot

- [ ] Static scan confirms no PAN/CVV/OTP access or storage.
- [ ] Test malicious page messages, malformed payloads, selector replacement, multiple coupon fields, and merchant rejection.
- [ ] Pilot with 3–5 high-traffic adapters.
- [ ] Monitor accepted-apply rate and support incidents before expanding.

#### Phase 4 Exit Gate

- [ ] Every incoming message is schema-validated.
- [ ] No raw payment credentials are touched.
- [ ] Accepted-apply rate is measured separately from DOM-fill rate.
- [ ] Unknown/changed pages fail to manual copy without unsafe guessing.

---

### Phase 5 - Post-Purchase Price-Drop Guard

**Duration**: Weeks 17–21
**Priority**: Valuable but dependent on external price data and the strongest operational uncertainty.
**Owner profile**: Integrations engineer, data-maintenance owner, and privacy/security reviewer.

#### Week 17: External Data-Source Decision

- [ ] Complete merchant-by-merchant price-source spike.
- [ ] Document allowed endpoints, terms of use, authentication, rate limits, freshness, and failure semantics.
- [ ] Reject implementation if a source requires broad browsing history, account credentials, or prohibited scraping.
- [ ] Approve ADR with fallback and no-source behavior.

#### Week 18: Watch Domain and Scheduling

- [ ] Define `PriceWatch`, terms dataset, provenance, migration, and repository.
- [ ] Implement idempotent scheduling keys and decaying check cadence.
- [ ] Add expiry cancellation and one-shot notification state.
- [ ] Route all calls through `CircuitBreaker`, timeout, retry, and public endpoint allowlist.

#### Week 19: Terms and Comparison

- [ ] Build versioned static price-protection terms for the pilot cards.
- [ ] Implement same-currency comparison and minimum-drop threshold.
- [ ] Ensure failed fetch leaves state unchanged except diagnostics/last-attempt metadata.
- [ ] Add deduplication by merchant and SKU.

#### Week 20: UI and User Controls

- [ ] Add opt-in post-purchase prompt and explicit watch consent.
- [ ] Build Price Watches list with expiry and status.
- [ ] Add claim link/instructions only from the maintained terms dataset.
- [ ] Add dismiss, stop watching, and delete controls.

#### Week 21: Pilot and Operational Review

- [ ] Pilot with a small merchant/card allow-list.
- [ ] Verify no task survives beyond expiry and no duplicate notification occurs.
- [ ] Review network volume, false drops, stale product identifiers, and support burden.
- [ ] Keep flag off by default until operational evidence supports expansion.

#### Phase 5 Exit Gate

- [ ] Approved price source and terms provenance exist for every enabled merchant/card.
- [ ] No failed fetch produces a false result.
- [ ] Price watches are opt-in, bounded, cancellable, and locally represented.
- [ ] External dependency failure leaves the core optimizer fully functional.

---

### Phase 6 - Smart Checkout Tier B: Card-Selection Assistance

**Duration**: Weeks 22–24+
**Priority**: Last because it is trust-sensitive and must not expand credential-handling scope.
**Owner profile**: Extension/security engineer with browser-platform review.

- [ ] Confirm browser-native autofill integration does not require raw PAN access or new broad permissions.
- [ ] Define the capability as visual recommendation/highlighting only, not credential injection.
- [ ] Add explicit per-checkout confirmation and an independent flag `smart_checkout_card_highlight`.
- [ ] Add tests proving extension code cannot read or serialize payment fields.
- [ ] Add settings copy, permission explanation, activity log, and immediate disable control.
- [ ] Conduct security review and internal dogfood indefinitely before any wider rollout.

#### Phase 6 Exit Gate

- [ ] No raw card data crosses the extension boundary.
- [ ] User confirms each use.
- [ ] Browser-native payment UX remains the source of truth.
- [ ] Security review approves the implementation and rollback path.

---

## Program-Level Definition of Done

The five-feature program is complete only when all of the following are true:

- [ ] All features have independent flags, owners, migration versions, rollback procedures, and support runbooks.
- [ ] Every persisted record is versioned, validated, locally stored, and covered by migration tests.
- [ ] Every scheduled task is durable, idempotent, cancelable, retry-bounded, and visible in diagnostics.
- [ ] Every monetary output is derived from branded `BigInt` values and has a calculation trace.
- [ ] Every inference has an explainable evidence view and a user override/dismissal path.
- [ ] Network-dependent features fail closed and never degrade the core optimizer.
- [ ] Checkout functionality never handles raw PAN/CVV/OTP data.
- [ ] Test gates include unit, property, migration, integration, E2E, security, performance, and accessibility coverage where applicable.
- [ ] Each feature completes a two-week internal dogfood period before production enablement.

## Program-Level Metrics

### Reliability and Correctness

- Zero data-corruption or voucher double-spend incidents.
- 100% successful migration tests from the previous schema version.
- Zero failed network calls causing core optimization failure.
- Less than 1% scheduled-job duplicate execution after idempotency handling.

### Performance

- P95 core optimization remains below 100ms for complex profiles.
- Background projection completion within six hours of scheduled execution.
- Subscription and portfolio queries remain bounded by indexes/shards and stay below 100ms in representative datasets.
- Price checks respect merchant rate limits and configured request budgets.

### Trust and Privacy

- Zero raw payment credential occurrences in built bundles, logs, telemetry, and diagnostics.
- Feature explanation shown for 100% of surfaced verdicts, timing nudges, detections, and alerts.
- Feature-specific dismissals are respected without repeated unwanted prompts.
- Opt-in telemetry remains disabled by default and contains only approved buckets/hashes.

### Product Value

- Billing-cycle users follow or dismiss timing recommendations with measurable intent.
- Portfolio users review scorecards and act on fee/downgrade insights.
- Subscription users confirm meaningful recurring charges or act on better-card suggestions.
- Price-watch users opt in and report actionable claims.
- Checkout users achieve accepted coupon applications, not merely DOM insertion.

## Release Governance

Each feature release requires a short decision record containing:

1. Feature flag and rollback command.
2. Data schema and migration version.
3. Network endpoints and circuit-breaker policy, if any.
4. Threat model and privacy review.
5. Test evidence and known skipped tests.
6. Dogfood dates, acceptance owner, and rollout percentages.
7. Support diagnostic codes and user-facing fallback behavior.

The program should optimize for trust over feature count. A feature that produces a plausible but incorrect financial conclusion, silently touches checkout data, or repeatedly surfaces false detections is a product regression even if its happy-path conversion metric is strong.
