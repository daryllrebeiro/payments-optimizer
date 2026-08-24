# ADR-002: Benefits & Membership Intelligence Subsystem

## Status

Accepted (Phase 11–20)

## Context

Originally, PaymentsOptimizer evaluated _"How should I pay for this purchase?"_ by comparing direct credit/debit cards, bank offers, and basic gift-card marketplace purchases.

However, consumers hold diverse ecosystems of value instruments:

1. Memberships & Subscriptions (Amazon Prime, Swiggy One, Accor ALL, Marriott Bonvoy, Tata Neu).
2. Partner Affiliations (Accor $\to$ 10% off at Myntra).
3. Stored Value Assets (Gift vouchers, promotional coupon codes with inventory and expiration state).
4. Time-limited promotional campaigns.

Optimizing checkout required transitioning from a single-card comparator to a comprehensive multi-instrument purchase optimizer: _"What should I use before, during, and after checkout?"_

## Decision

1. **Created `@payments-optimizer/benefits` package**:
   - Implemented `BenefitGraph` DAG modeling multi-hop partner relationships.
   - Introduced `PublicBenefitCatalog` for pre-configured program and partner rates.
   - Implemented `VoucherInventoryManager` for local stateful voucher tracking with partial/full burn logic.
   - Implemented `BenefitStackingEngine` to evaluate multi-step purchase combinations (Vouchers + Partner Perks + Card Rewards).
   - Implemented `OpportunityScorer` with time-decay urgency weighting for expiring vouchers ($\le 24\text{h}, \le 3\text{d}, \le 7\text{d}$) and anti-cannibalization heuristics.
   - Implemented `UnifiedBenefitOptimizer` outputting rich `UnifiedTransactionStrategy` with `StrategyRecipeStep` chronologies.

2. **Privacy Separation**:
   - Public catalogs and graph relationships are distributed in public bundles.
   - User memberships, owned vouchers, point balances, and expiry alerts remain strictly stored locally on-device.

## Consequences

- **Positive**: Enables multi-step savings recipes (e.g. ₹500 voucher + 10% partner discount + 5% card cashback).
- **Positive**: Prevents voucher expiry loss via proactive alerts and urgency bonuses in ranking.
- **Positive**: Fully deterministic mathematical model; AI only explains the trace.
