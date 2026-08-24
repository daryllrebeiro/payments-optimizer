# PaymentsOptimizer

PaymentsOptimizer is a **privacy-first, local-first personal purchase and benefits optimization engine** that determines the absolute best sequence of instruments to use before, during, and after checkout for online purchases.

Rather than only asking _"Which credit card should I use?"_, PaymentsOptimizer answers:

> **"Given everything I have access to (memberships, partner affiliations, stored vouchers, coupons, loyalty points, cards, and payment methods), what is the optimal sequence of actions before, during, and after checkout to minimize cost and maximize value?"**

---

## Key Principles

1. **Privacy-First & Local-First**: Sensitive personal profile data, connected memberships, owned vouchers, credit card states, and transaction histories reside purely on the user's device (in encrypted local storage). No financial profile or wallet data is transmitted to external servers.
2. **Deterministic Financial Core**: Rule evaluation, voucher burns, partner discounts, reward valuations, and stacking arithmetic execute on a strict deterministic financial engine using integer arithmetic (minor currency units via `bigint`). AI is used only for natural language explanations, never for computing monetary outcomes.
3. **Benefits & Membership Intelligence**: Seamlessly synthesizes 4 distinct benefit tiers into an actionable, step-by-step checkout recipe:
   - **A. Membership Inherent Perks**: Inherent member rates and shipping benefits (e.g., Amazon Prime, Swiggy One, Accor ALL, Marriott Bonvoy).
   - **B. Partner Benefits**: Cross-brand value exchange discovered via a Directed Acyclic Graph (e.g., _Accor ALL membership $\to$ 10% instant discount at Myntra_).
   - **C. Stored Value & Vouchers**: Stateful user-owned inventory tracking balances, partial/full burns, and expiration dates.
   - **D. Promotional & Card Offers**: Merchant instant discounts, bank campaigns, and card reward point multipliers.
4. **Transparent Calculation Traces**: Every strategy produces an auditable, step-by-step trace showing base price, voucher burns, partner discounts, card rewards, and final effective net cost.

---

## Monorepo Architecture

This project is structured as a TypeScript monorepo using **pnpm workspaces**:

```
payments-optimizer/
├── apps/
│   └── extension/          # Production MV3 Chrome extension with React UI, Benefits Wallet & AI Explain
├── packages/
│   ├── domain/             # Core TypeScript interfaces, schemas, and type definitions
│   ├── benefits/           # Benefits & Membership Intelligence, BenefitGraph DAG, and Stacking Engine
│   ├── rules-engine/       # Financial arithmetic (bigint) and rule evaluation conditions
│   ├── optimizer/          # Card strategy generator, Pareto dominance pruner, and ranker
│   ├── offer-engine/       # Public data manager and Zod validation schemas
│   ├── merchant-detector/  # URL/domain extraction and merchant resolver
│   ├── security/           # Client-side encryption (AES-GCM) & key derivation (PBKDF2)
│   ├── storage/            # Storage abstractions, migrator, IndexedDB & In-Memory repositories
│   ├── profile/            # User profile, memberships, vouchers, and card managers
│   └── test-fixtures/      # Standardized mock cards, programs, offers, coupons, and carts
├── tools/
│   ├── benchmark/          # CLI test harness, latency performance metrics, and trace audits
│   ├── build-data/         # Data compiler
│   └── validate-data/      # Schema validation tools
└── docs/                   # Architecture logs, ADRs, threat models, and design docs
```

### Core Workspace Packages

- **[`@payments-optimizer/benefits`](file:///c:/Users/Lenovo%20Laptop/dev/payments-optimizer/packages/benefits)**: Powers the Benefits & Membership Intelligence Subsystem. Contains the `BenefitGraph` DAG, `PublicBenefitCatalog`, `VoucherInventoryManager`, `BenefitEligibilityEngine`, `OpportunityScorer`, `BenefitStackingEngine`, and `UnifiedBenefitOptimizer`.
- **[`@payments-optimizer/domain`](file:///c:/Users/Lenovo%20Laptop/dev/payments-optimizer/packages/domain)**: Central data models (`Cart`, `UserProfile`, `UserMembership`, `UserVoucher`, `PartnerBenefit`, `StrategyRecipeStep`, `UnifiedTransactionStrategy`).
- **[`@payments-optimizer/rules-engine`](file:///c:/Users/Lenovo%20Laptop/dev/payments-optimizer/packages/rules-engine)**: Handles currency arithmetic (addition, subtraction, scaling) and deterministic eligibility evaluations.
- **[`@payments-optimizer/optimizer`](file:///c:/Users/Lenovo%20Laptop/dev/payments-optimizer/packages/optimizer)**: Direct card candidate generation, Pareto dominance filtering, and multi-objective preference ranking.
- **[`@payments-optimizer/profile`](file:///c:/Users/Lenovo%20Laptop/dev/payments-optimizer/packages/profile)**: Manages local user profile state, payment methods, active memberships, vouchers, and encrypted export/import.
- **[`@payments-optimizer/security`](file:///c:/Users/Lenovo%20Laptop/dev/payments-optimizer/packages/security)**: Native Web Crypto AES-GCM encryption and PBKDF2 key derivation for local storage protection.
- **[`@payments-optimizer/storage`](file:///c:/Users/Lenovo%20Laptop/dev/payments-optimizer/packages/storage)**: Generic repository interface with IndexedDB implementation and migration pipeline.

---

## Benefit Opportunity & Urgency Scoring

The engine optimizes transactions against a multi-dimensional objective function:

$$\text{OpportunityScore} = \text{ImmediateSavings} + \text{ValuatedRewards} + \text{UrgencyPremium} + \text{MembershipValue} - \text{OpportunityCost} - \text{ComplexityPenalty}$$

- **ImmediateSavings**: Instant cash discounts and voucher burns ($₹$).
- **ValuatedRewards**: Points and miles multiplied by user valuations.
- **UrgencyPremium**: Prioritizes vouchers and coupons expiring within 24 hours, 3 days, or 7 days.
- **OpportunityCost**: Heuristic penalty to prevent burning flexible, long-dated vouchers when high-value non-stackable partner promos are active.
- **ComplexityPenalty**: Minor deduction for redemption friction.

---

## Getting Started

Refer to the [**Installation & Usage Guide (HOW_TO_RUN.md)**](file:///c:/Users/Lenovo%20Laptop/dev/payments-optimizer/HOW_TO_RUN.md) for step-by-step instructions on loading the compiled extension into Google Chrome, managing memberships and stored vouchers, configuring card valuations, and running simulations.

### Prerequisites

- **Node.js**: Version 20 or higher
- **pnpm**: Version 10 or higher
- **Chromium-based Browser**: Chrome, Brave, Edge

### Installation & Build

```bash
# 1. Install all dependencies across workspaces
pnpm install

# 2. Compile all TypeScript packages and build extension
pnpm run build
```

---

## Development Workspace CLI Scripts

- `pnpm run build` — Compiles all packages in dependency order.
- `pnpm run typecheck` — Runs TypeScript compiler dry-run checks across all workspaces.
- `pnpm run test` — Executes all unit and integration test suites using **Vitest**.
- `pnpm run test:watch` — Launches Vitest in interactive watch mode.
- `pnpm run test:coverage` — Runs test suite and generates code coverage statistics.
- `pnpm run lint` — Validates code formatting and rules using **ESLint 9 Flat Config**.
- `pnpm run format` — Validates formatting compliance via **Prettier**.
- `pnpm run format:write` — Auto-formats codebase in-place using **Prettier**.
- `pnpm run milestone1` — Runs the CLI test harness (`benchmark-tool`) to simulate a purchase optimization trace.

---

## Architecture Decision Records (ADRs)

- [ADR-001: Repository Foundation](file:///c:/Users/Lenovo%20Laptop/dev/payments-optimizer/docs/architecture/ADR-001-Repository-Foundation.md)
- [ADR-002: Benefits & Membership Intelligence Subsystem](file:///c:/Users/Lenovo%20Laptop/dev/payments-optimizer/docs/architecture/ADR-002-Benefits-Membership-Intelligence.md)
