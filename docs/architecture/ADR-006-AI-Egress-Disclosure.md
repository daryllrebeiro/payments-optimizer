# ADR-006: AI-Explanation Egress — Disclosed Opt-In Exception

**Status**: Accepted (amended 2026-09-09 — fixes S-01/S-02).

The product's zero-egress claim holds for optimization, profile, and
history (all local-first). The Gemini explanation endpoint
(`generativelanguage.googleapis.com`) is an explicit, disclosed,
**opt-in exception**:

1. **Trigger**: explicit user click only (Dashboard "Explain"); no
   background/keyless calls (Task 0.10 test).
2. **Key custody (S-01)**: session-scoped (`chrome.storage.session`) by
   default; device-persisted only on explicit "remember" opt-in
   (`api-key-store.ts`); revocation clears both scopes. No key in logs.
3. **Transport residual (S-02)**: Gemini REST requires the key as a URL
   query param — no header-key alternative. Minimizations: `referrerPolicy:
   'no-referrer'`, prompt stripped to IDs + minor-unit numbers (F4 test),
   errors sanitized to status-code only. The query-key-in-history/proxy-log
   residual is accepted and disclosed here, not treated as solved.
4. **Rate/budget guard (S-06)**: shared fail-closed `RateLimiter`
   (10/min), in-memory first, storage as backstop.
