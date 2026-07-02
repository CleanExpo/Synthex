---
name: test-suite-reality-2026-05-29
description: Audit of test suite health as of 2026-05-29 — coverage holes, mock/prod divergence risk, skip inventory, and untested critical paths
metadata:
  type: project
---

Audit run: 2026-05-29. Branch: feat/marketing-intelligence-gsc-pipeline.

**Why:** CEO directive — determine whether tests protect production or are theatre.

**How to apply:** Use this as baseline when evaluating test coverage claims. Key gaps below must be addressed before any multi-tenant security assertion.

## Hard Numbers

- 252 test files discovered by Jest
- 3900 total tests: 3672 passed, 201 skipped, 27 todo
- 10 of 252 test suites skipped entirely
- 82 API test files mock Prisma (`jest.mock('@/lib/prisma')`)
- 664 API route files; only ~44 have dedicated API tests
- 172 skip/todo lines across the codebase

## Critical Gaps

**1. DB mock/prod divergence** (P0): 82 API test files mock Prisma. Tests pass against mock behaviour that may not match real DB. This is the exact failure mode CLAUDE.md calls out ("mock/prod divergence caused production failures"). Integration tests that hit real DB are gated behind `RUN_INTEGRATION_TESTS=true` env var — they are skipped in every normal CI run.

**2. 403 cross-org isolation not tested on core routes** (P0): campaigns, posts, analytics, subscription routes have no test that verifies User A cannot access User B's data. The pattern used is `mockResolvedValue(null)` for "not found" — this does not prove org scoping is enforced at DB query level.

**3. OAuth callback routes have zero test coverage** (P0): `app/api/auth/callback/[platform]/route.ts` and `app/api/auth/oauth/[platform]/route.ts` — no test files found. These are the token-exchange entry points for all 8 platform connections.

**4. Auto-publish failure modes are all `it.todo()`** (P1): `tests/auto-publish/failure-modes.test.ts` contains 28 todo stubs with zero implementations. Six failure modes (expired creds, rate limit, partial post failure, account deactivated, freshness validation, network timeout) are completely untested.

**5. GSC pipeline routes (recently shipped) have no dedicated tests** (P1): `app/api/cron/gsc-monitor/route.ts`, `gsc-topic-sync`, `gsc-auto-index`, `rank-snapshot` — no test files. These are the routes from the most recent commit (e79ad0a6).

**6. Admin routes untested** (P1): `app/api/admin/audit-log`, `admin/users`, `admin/vault`, `admin/upgrade-subscription` — no dedicated test files found. These are high-privilege routes.

**7. Cross-tenant RLS adversarial test requires manual opt-in** (P1): `tests/security/cross-tenant.spec.ts` only runs with `RLS_ADVERSARIAL=true`. Not in default CI.

## What Is Tested Well

- Auth flow shape/contract validation (35 tests in auth-routes)
- JWT utility functions (jwt-utils.test.ts)
- Rate limiter unit tests
- Campaigns route — 401 on unauthenticated, but uses mocked Prisma
- Stripe webhook handler logic (all mocked)
- Audit logger unit tests

## Test Quality Classification

- "Contract tests" (auth.contract.test.ts, monetization.contract.test.ts): shape-only — validate Zod schemas, not route handlers
- "Unit API tests" (campaigns.test.ts, posts.test.ts): real handler invocations but mocked DB — medium confidence
- "Integration tests" (api.test.ts, api-v2.test.ts): conditionally skipped — effectively not running
