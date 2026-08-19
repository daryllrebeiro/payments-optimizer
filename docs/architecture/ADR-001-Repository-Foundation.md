# ADR-001: Repository Foundation

## Status

Accepted

## Context

We need to establish a solid foundation repository structure for PaymentsOptimizer.
The requirements specify a local-first, privacy-first personal payment optimization engine that must eventually support multiple presentation interfaces (Chrome extension, CLI, and possibly mobile applications).
The core business logic (domain, rules-engine, optimizer) should remain purely decoupled from presentation logic (React, browser API, Chrome APIs, and databases).

## Decision

We chose a **TypeScript monorepo using pnpm workspaces**.

1. **pnpm workspaces**: Provides efficient dependency resolution, hard-linking of `node_modules` to minimize disk usage, and native workspace resolution.
2. **TypeScript**: Provides compile-time safety and self-documenting data shapes (which is crucial for financial domain contracts).
3. **Vitest**: Used as the unit testing framework for its speed, simplicity, and built-in TypeScript/ESM support.
4. **Playwright**: Used as the integration/E2E testing framework, especially to test content script integrations with sandboxed browser extensions.
5. **ESLint 9 Flat Config + Prettier**: Standardizes linting rules and code style guidelines uniformly across the monorepo.
6. **Strict Folder Structure**:
   - `packages/domain`: Pure data models and structures.
   - `packages/rules-engine`: Financial arithmetic and rules validation.
   - `packages/optimizer`: Generating and ranking payment paths.
   - `packages/test-fixtures`: Standardized sets of mock cards, merchants, and rules for test coverage.
   - `apps/extension`: The presentation interface code.

## Consequences

- Clean boundary enforcement between domain business rules and extension UI interfaces.
- The core optimization modules are fully portable and could be packaged for CLI tools, mobile wrappers, or other platforms.
- High test coverage and fast execution loops.
