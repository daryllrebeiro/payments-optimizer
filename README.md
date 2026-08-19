# PaymentsOptimizer

PaymentsOptimizer is a **privacy-first, local-first personal payment optimization engine** that determines the absolute best way for an individual to pay for an online purchase.

By evaluating a user's local payment methods (credit cards, debit cards, wallets, UPI) against merchant offers, coupons, and complex reward structures (including milestone rules, spending caps, and point valuations), it outputs a list of ranked payment strategies with fully transparent, auditable calculation traces.

---

## Key Principles

1. **Privacy-First & Local-First**: Sensitive personal profile data, credit card states, and transaction histories reside purely on the user's device (e.g., in local storage via IndexedDB). No financial data is sent to external servers.
2. **Deterministic Calculations**: The rules engine is a strict, deterministic financial engine using high-precision integer math (using minor currency units via `bigint`) to avoid floating-point inaccuracies. AI is used only for natural language explanations, never for computing monetary values.
3. **Transparent Auditing**: Every strategy contains a complete, step-by-step trace showing exactly how the final effective cost was calculated.

---

## Monorepo Architecture

This project is structured as a TypeScript monorepo using **pnpm workspaces**:

```
payments-optimizer/
├── apps/
│   └── extension/          # Planned Chrome extension (presentation & page injection)
├── packages/
│   ├── domain/             # Core TypeScript interfaces, schemas, and type definitions
│   ├── rules-engine/       # Financial arithmetic (bigint) and rule evaluation conditions
│   ├── optimizer/          # Strategy generator (direct / gift cards), pruner, and ranker
│   ├── security/           # Client-side encryption (AES-GCM) & key derivation (PBKDF2)
│   ├── storage/            # Storage abstractions, migrator, IndexedDB & In-Memory repositories
│   ├── profile/            # User profile, preferences, and payment method managers
│   └── test-fixtures/      # Standardized mock cards, offers, coupons, and spend states
├── tools/
│   ├── benchmark/          # CLI test harness for strategy simulation & trace audits
│   ├── build-data/         # Planned data compiler
│   └── validate-data/      # Planned schema validation tools
└── docs/                   # Architecture logs, ADRs, threat models, and design docs
```

### Core Workspace Packages

- **[`@payments-optimizer/domain`](file:///c:/Users/Lenovo%20Laptop/dev/payments-optimizer/packages/domain)**: Houses the central data models (`Cart`, `UserProfile`, `CreditCard`, `Offer`, `Coupon`, `PaymentStrategy`).
- **[`@payments-optimizer/rules-engine`](file:///c:/Users/Lenovo%20Laptop/dev/payments-optimizer/packages/rules-engine)**: Handles currency arithmetic (addition, subtraction, scaling) and eligibility checks (e.g., spend caps, category MCC rules).
- **[`@payments-optimizer/optimizer`](file:///c:/Users/Lenovo%20Laptop/dev/payments-optimizer/packages/optimizer)**: Combines direct card benefits and gift card purchases/redemption options into potential candidates, filters dominated strategies (Pareto optimization), and scores options based on user preferences.
- **[`@payments-optimizer/security`](file:///c:/Users/Lenovo%20Laptop/dev/payments-optimizer/packages/security)**: Protects stored user profiles by using native Web Crypto APIs to derive secure keys from passphrases and encrypt data locally.
- **[`@payments-optimizer/storage`](file:///c:/Users/Lenovo%20Laptop/dev/payments-optimizer/packages/storage)**: Provides a generic repository interface with a complete migration-capable IndexedDB implementation for browser environments and an in-memory fallback for CLI or testing.
- **[`@payments-optimizer/profile`](file:///c:/Users/Lenovo%20Laptop/dev/payments-optimizer/packages/profile)**: Coordinates saving, loading, and modifying user profiles, payment methods, and reward preference states.

---

## Getting Started

### Prerequisites

- **Node.js**: Version 20 or higher
- **pnpm**: Version 10 or higher

### Installation & Build

Install dependencies and compile all TypeScript workspaces:

```bash
# Install all dependencies across workspaces
pnpm install

# Approve build scripts for required dependencies (like esbuild) if prompted
pnpm approve-builds

# Compile all TS workspace projects
pnpm run build
```

---

## Development Workspace CLI Scripts

All core development commands are managed from the root package script definitions:

- `pnpm run build` — Compiles all packages in dependency-order.
- `pnpm run typecheck` — Runs TypeScript compiler checks across all workspaces in dry-mode.
- `pnpm run test` — Executes all unit and integration tests using **Vitest**.
- `pnpm run test:watch` — Launches the Vitest test runner in watch mode.
- `pnpm run test:coverage` — Runs tests and generates a code coverage report.
- `pnpm run lint` — Standardizes repository code quality using **ESLint 9 Flat Config**.
- `pnpm run format` — Validates formatting compliance via **Prettier**.
- `pnpm run format:write` — Automatically formats codebase in-place using **Prettier**.
- `pnpm run milestone1` — Runs the CLI test harness (`benchmark-tool`) to simulate a purchase optimization trace.

---

## Simulating the Optimization Engine (CLI Test Harness)

To see the optimization engine in action, you can run the benchmark CLI tool:

```bash
pnpm run milestone1
```

This simulates an online purchase of **₹20,000** at Amazon using a user profile with three credit cards (HDFC Millennia, SBI Cashback, and Axis Atlas) and a ₹2,500 Amazon coupon.

### Sample CLI Output

```text
========================================================
PaymentsOptimizer --- First Milestone CLI Test Harness
========================================================

Merchant: AMAZON
Purchase Amount: ₹20000

Generated strategies: 14
Pruned strategies (after dominance filtering): 4

🏆 BEST STRATEGY RECOMMENDATION
--------------------------------------------------------
Strategy ID: direct-hdfc-millennia-coupon-offer-3
Effective Cost: ₹16500
Immediate Savings: ₹2500
Reward Value: ₹1000
Future Milestone Value: ₹0
Fees: ₹0
Complexity Score: 2
Confidence: 100%

📋 PAYMENT STEPS
  Step 1: [MERCHANT_PAYMENT] Pay remaining 17500.0 directly

📊 CALCULATION TRACE AUDIT
--------------------------------------------------------
  Base Price                         : +₹20000
  Immediate Discounts & Coupons      : ₹-2500
  Card Cashback / Rewards Value      : ₹-1000
--------------------------------------------------------
  Final Effective Cost               :  ₹16500

========================================================
```

---

## Architecture Decision Records (ADRs)

For deeper insight into foundational decisions, refer to:

- [ADR-001: Repository Foundation](file:///c:/Users/Lenovo%20Laptop/dev/payments-optimizer/docs/architecture/ADR-001-Repository-Foundation.md)
