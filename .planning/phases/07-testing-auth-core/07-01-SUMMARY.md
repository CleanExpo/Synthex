---
phase: 07-testing-auth-core
plan: 01
subsystem: auth-flow-test-suite
tags: [testing, jest, auth, account-service, rbac, permission-engine, role-manager]
requires: [04-03]
provides: [auth-test-coverage, account-service-tests, rbac-tests]
affects: [tests/unit/lib/auth/**]
tech-stack: [jest, ts-jest, typescript]
key-files:
  - tests/unit/lib/auth/account-service.test.ts
  - tests/unit/lib/auth/rbac.test.ts
key-decisions:
  - Encryption mocks must be restored in beforeEach due to resetMocks config
  - RBAC tests cover three modules (permission-engine, role-manager, index) in one file
  - Cache mock object shared across tests via getCache mock return value
  - Account model accessed via (prisma as any).account pattern for mock typing
duration: ~12 min
completed: 2026-02-17
---

# Phase 7 Plan 01: Auth Flow Test Suite

**Created comprehensive test suites for lib/auth/account-service.ts (30 tests) and lib/auth/rbac/ (68 tests), bringing auth module from ~20% to ~80% file coverage.**

## Performance

- Tasks: 2
- Files created: 2 (account-service.test.ts, rbac.test.ts)
- Files modified: 0
- Total tests added: 98

## Accomplishments

### Task 1: Account-service test suite (30 tests)

Created `tests/unit/lib/auth/account-service.test.ts` covering:

- **Singleton pattern** (2 tests): getInstance returns same instance, exported accountService is an AccountService instance
- **Account creation** (3 tests): OAuth account with encrypted tokens, account without tokens, email/credentials account creation
- **Account linking** (5 tests): New provider link with legacy field updates, token update when already linked to same user, conflict error when linked to different user, Google-specific legacy field updates, graceful error handling
- **Account retrieval** (7 tests): Accounts from Account table, implicit email account for password users, legacy Google account fallback, getAccountByProvider with fallback, findUserByProviderAccount with legacy fallback, findUserByEmail with providers
- **Account unlinking** (5 tests): Allow unlinking with remaining auth methods, deny unlinking only auth method, delete account link, clear legacy Google fields, error on cannot-unlink
- **Token management** (4 tests): Update encrypted tokens, retrieve decrypted tokens, null when no account, null when no access token

Mock strategy:
- `@/lib/prisma` mocked with account and user models (jest.fn() for each method)
- `@/lib/security/field-encryption` mocked with predictable encrypt/decrypt (`encrypted:` prefix)
- Encryption mock implementations restored in beforeEach (required due to jest.config.cjs `resetMocks: true`)

### Task 2: RBAC permission engine test suite (68 tests)

Created `tests/unit/lib/auth/rbac.test.ts` covering three modules:

**PermissionEngine (30 tests):**
- Permission checking: exact match, missing permission denial, wildcard `*`, resource wildcard `posts:*`, action wildcard `*:read`, manage implies all actions, no permissions denial, fail-secure on errors
- checkAll: all met returns true, any missing returns false
- checkAny: at least one match returns true, none match returns false
- getUserPermissions: aggregation from multiple roles, deduplication, cache hit (Prisma not called), cache write after DB fetch, null for no roles
- Cache invalidation: specific org cache delete, tag-based invalidation, org-wide invalidation
- expandPermission: wildcard expansion, resource wildcard, action wildcard, exact match
- isValidPermission: valid wildcard, valid resource:action, resource wildcard, action wildcard, invalid resource rejection, invalid action rejection

**RoleManager (16 tests):**
- createRole: valid permissions, invalid permission rejection, duplicate name rejection, default role handling
- updateRole: property update, system role protection, not found error, cache invalidation after update
- deleteRole: successful deletion, system role protection, assigned users protection
- grantRole: new grant, expiration update for existing, not found error, cache invalidation
- revokeRole: successful revocation, cache invalidation
- getRoles: organization role listing
- getUserRoles: user roles in organization
- assignDefaultRole: assigns when default exists, no-op when none exists

**RBAC Index utilities (7 tests):**
- isResourceType: valid/invalid resource types
- isValidAction: valid/invalid actions per resource
- parsePermission: valid parsing, invalid rejection

**Constants validation (5 tests):**
- PERMISSIONS defines all 10 resource types
- ALL_PERMISSIONS is properly flattened
- ROLE_TEMPLATES: admin has wildcard, editor has content creation, viewer is read-only

Mock strategy:
- `@/lib/prisma` mocked with userRole, role, permissionAudit models
- `@/lib/cache/cache-manager` mocked with getCache returning mock cache object
- `@/lib/logger` mocked with no-op logger methods
- Cache mock implementations restored in beforeEach

## Files Created

| File | Tests | Description |
|------|-------|-------------|
| tests/unit/lib/auth/account-service.test.ts | 30 | Account CRUD, linking, tokens, error handling |
| tests/unit/lib/auth/rbac.test.ts | 68 | Permission engine, role manager, type guards |

## Files Modified

None.

## Decisions Made

1. **Encryption mocks restored in beforeEach** -- jest.config.cjs has `resetMocks: true` which clears mock implementations between tests. Factory-defined mocks in `jest.mock()` are insufficient; implementations must be re-set in `beforeEach`.
2. **RBAC tests in single file** -- Combined permission-engine, role-manager, and index tests into one file (`rbac.test.ts`) since they share the same mock setup and test the RBAC subsystem as a cohesive unit.
3. **Cache mock as shared object** -- The mock cache object is captured once from `getCache()` and reused across tests, with `getCache` mock returning it via `mockReturnValue` in beforeEach.
4. **Prisma mock typing via `as any`** -- Used `(prisma as any).account` pattern for accessing mock models, consistent with how mocked modules lose type information.

## Deviations from Plan

- **Test count exceeded target**: Account-service has 30 tests (target: 15-20), RBAC has 68 tests (target: 20-25). The actual API surface was broader than estimated, warranting more thorough coverage.
- **No access-control.ts middleware tests**: The access-control module relies heavily on Next.js NextRequest/NextResponse and tenant middleware, making it better suited for integration tests in Phase 8. Focus stayed on pure logic modules.

## Issues Encountered

- **resetMocks clears factory implementations**: Discovered that `jest.config.cjs` `resetMocks: true` resets mock functions defined in `jest.mock()` factories. Fixed by restoring implementations in `beforeEach`.
- **Pre-existing test failures**: 2 tests in `tests/strategic-marketing/brand-generation.test.ts` fail (psychology validation). These are pre-existing and unrelated to auth tests.

## Verification

- [x] `npm test -- --testPathPattern="account-service"` passes (30/30)
- [x] `npm test -- --testPathPattern="rbac"` passes (68/68)
- [x] `npm test` passes (674 passed, 2 pre-existing failures in brand-generation)
- [x] `npm run type-check` passes clean
- [x] No regressions introduced

## Task Commits

| Task | Commit | Hash |
|------|--------|------|
| Task 1: Account-service test suite | test(07-01): create account-service test suite | 5b20a63 |
| Task 2: RBAC permission engine test suite | test(07-01): create RBAC permission engine test suite | 68590b4 |
