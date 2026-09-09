# Audit Remediation — Design-Gap Spec Amendments (Fix F19–F23)

Source: Remediation Prompt §5. Spec-only fixes — no feature code is written
against these until the amendments below land. Each item records the
decision, the amended contract, and where it is enforced.

## Fix F19 — Billing-cycle tie-breaker total order
- Primary sort by exact BigInt `totalBenefit` (never floored float).
- Secondary tie-break by float-days scaled to BigInt integer millis.
- Final tie-break by strategy `id` lexicographic — total order regardless
  of input order.
- Regression: full-response JSON equality with no billing data (not just
  top recommendation). Implemented in `packages/optimizer/src/ranker.ts`
  (BigInt primary + id final) — byte-identical Task 0.7 test guards it.

## Fix F20 — Subscription detection hysteresis + dedup key
- Surface threshold asymmetric: enter detected at confidence ≥0.65, exit
  (fully remove, not gray out) at <0.55, hold state in between.
- Dedup key: `merchantId + amount-bucket`, not merchant alone. Two distinct
  amount patterns under one merchant surface as two detections.
- To be enforced in Feature 3 implementation; no code yet.

## Fix F21 — Price-data-source decision (blocking product decision)
- Decision needed before implementation: select the price-check data source
  via short ADR, or launch with a small allow-listed merchant set where the
  source is well-understood. No silent default.
- Spec additions: absolute-minimum-delta floor alongside the ~1% relative
  threshold (kills dynamic-price jitter non-alerts); mandatory
  `verifiedAt` date on every card price-protection terms entry, rendered
  in UI so stale issuer terms never present with unearned authority.

## Fix F22 — PAN boundary tooling controls (replaces structural claim)
- Drop the claim that Tier B card-data boundary is enforced structurally
  via manifest permissions (false in MV3 isolated-world content scripts).
- Replace with: (a) ESLint rule banning content-script selectors against
  payment `autocomplete` attributes / card-field name patterns; (b) CI
  integration test asserting zero reads of payment-autocomplete-tagged
  inputs across the content-script bundle; (c) explicit per-merchant-adapter
  allowlist of exact field types for label-text fallback; (d) malformed
  `APPLY_VOUCHER` / `LOCATE_COUPON_FIELD` tests as hard DoD before flag
  enables beyond dogfood.

## Fix F23 — Shared primitives before F1/F13 rebuild (locked)
- (a) One injected `Clock` consumed by every time-reasoning feature
  (service worker + popup included). (b) Profile generation counter
  incremented on every mutation, checked before displaying in-flight
  results (stale beam-search vs pre-mutation vouchers detected +
  re-validated). (c) Durable rollback journal for TransactionCoordinator
  (persisted, not memory-only) so MV3 kill mid-rollback never abandons a
  half-reverted transaction — DurableTaskQueue is the persistence home.
  (d) ROI attribution rule for Feature 1: pro-rate by active strategy at
  each savings entry timestamp, not period-end snapshot.
