---
phase: 54-api-contract-verification
plan: 01
type: summary
subsystem: testing
provides: [organizations-contract-tests, approvals-roles-contract-tests]
affects: [54-02]
key-files:
  - tests/contract/organizations.contract.test.ts
  - tests/contract/approvals-roles.contract.test.ts
tech-stack:
  patterns: [jest-mock, zod-contract-test, route-handler-import]
---

# Phase 54 Plan 01: Organization + Approvals/Roles Contract Tests Summary

Added 42 new contract tests covering the two highest-value uncovered API route categories, bringing the total contract test count from 140 to 182 (all passing).

## Accomplishments

- Created `tests/contract/organizations.contract.test.ts` with 16 tests covering POST (input validation, auth enforcement via APISecurityChecker, 201 success response shape, 409 slug conflict) and GET (admin-only auth, paginated list response with userCount/campaignCount derived from `_count`, empty list)
- Created `tests/contract/approvals-roles.contract.test.ts` with 26 tests covering approvals GET/PATCH/DELETE (401 unauthenticated, 404 not found, 403 ownership/access, 400 Zod + business-logic validation, 200 success shapes) and roles GET/POST (401, 403 permission check, 400 Zod, 200 list with availablePermissions, 200 create with userCount:0)

## Files Created/Modified

- `tests/contract/organizations.contract.test.ts` — 16 tests
- `tests/contract/approvals-roles.contract.test.ts` — 26 tests

## Decisions Made

- Used `jest.requireMock('@/lib/prisma')` helper functions inside tests rather than top-level static imports to avoid stale references after `jest.clearAllMocks()` when `resetMocks: true` is configured in jest.config.cjs
- The approvals route (`app/api/approvals/[id]/route.ts`) uses a default import of prisma (`import prisma from '@/lib/prisma'`) while the roles route uses a named import (`import { prisma } from '@/lib/prisma'`); the mock factory handles both by exporting both `prisma` and `default` with `__esModule: true`
- Used `require()` to import route handlers (rather than dynamic `import()` in beforeEach) to avoid module re-evaluation overhead, since the mocks are registered before any route module is loaded
- Mock for `@/lib/api/response-optimizer` in the organizations test wraps real `NextResponse.json()` to preserve HTTP status codes while bypassing cache-header complexity

## Issues Encountered

- **Jest hoisting with temporal dead zone**: Initial approach of referencing outer `const mockFn = jest.fn()` variables inside the `jest.mock()` factory failed because Jest hoists `jest.mock()` calls before variable declarations are initialized. Resolved by defining all `jest.fn()` calls inside the factory and using `jest.requireMock()` accessor functions.
- **Prisma default vs named export**: The mock factory needed `{ __esModule: true, default: instance, prisma: instance }` to satisfy both import styles used across the two routes.

## Next Step

Ready for 54-02-PLAN.md
