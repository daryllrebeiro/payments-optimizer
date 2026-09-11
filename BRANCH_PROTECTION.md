# Branch Protection Requirements

This document specifies the required branch protection rules for the `main` branch.
These must be configured in GitHub repository settings (Settings → Branches → Branch protection rules).

## Required Status Checks (all must pass before merge)

The following checks are **required** and must pass on every PR targeting `main`:

| Check Name | Description | Source |
|------------|-------------|--------|
| `typecheck` | TypeScript strict type checking across all workspaces | CI `test` job |
| `lint` | ESLint with strict rules (no warnings allowed) | CI `test` job |
| `format` | Prettier formatting check | CI `test` job |
| `test` | Full vitest suite (39 files, 473+ tests) | CI `test` job |
| `coverage` | Coverage thresholds (stmts 44%, branches 70%, funcs 60%, lines 44%) | CI `test` job |
| `build` | Production build succeeds | CI `build` job |

## Branch Protection Settings

| Setting | Value | Rationale |
|---------|-------|-----------|
| **Require a pull request before merging** | ✅ Enforced | All changes reviewed |
| **Require approvals** | 1 (minimum) | At least one reviewer |
| **Dismiss stale approvals on new commits** | ✅ Enforced | Prevents stale approvals |
| **Require review from code owners** | ✅ Enforced (if CODEOWNERS exists) | Domain expertise required |
| **Require status checks to pass before merging** | ✅ All 6 checks above | Quality gate |
| **Require branches to be up to date before merging** | ✅ Enforced | No stale merges |
| **Require linear history** | ✅ Enforced | Clean git history |
| **Require signed commits** | ⚠️ Recommended | Supply chain integrity |
| **Require conversation resolution before merging** | ✅ Enforced | All comments addressed |
| **Allow force pushes** | ❌ Disabled | History integrity |
| **Allow deletions** | ❌ Disabled | Branch safety |

## Required Contexts for Status Checks

The following status check contexts must be present and passing:
- `typecheck`
- `lint`
- `format`
- `test`
- `coverage`
- `build`

## CI Pipeline Integration

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs all required checks in the `test` and `build` jobs. Each check is a separate step, so they appear as separate status checks in GitHub PRs.

## Emergency Override

In genuine emergencies (production outage, security patch), the branch protection can be temporarily bypassed by:
1. Repository admin disables the specific check
2. Merge the emergency fix
3. Immediately re-enable the check
4. Document the bypass in the PR/commit message

This should be extremely rare and audited.

## Enforcement Date

**Target enforcement: 2026-09-15** (or next release, whichever comes first).
All 6 checks are already passing in CI as of `d242459` — this document formalizes the requirement.