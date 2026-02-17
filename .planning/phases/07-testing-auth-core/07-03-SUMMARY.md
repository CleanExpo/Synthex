---
phase: 07-testing-auth-core
plan: 03
subsystem: testing
tags: [jest, social, platform-services, factory]
requires: [07-02]
provides: [platform-factory-test-coverage, platform-service-test-coverage]
affects: [tests/unit/lib/social/factory.test.ts, tests/unit/lib/social/platform-services.test.ts]
tech-stack: [jest, ts-jest, typescript]
key-files:
  - tests/unit/lib/social/factory.test.ts
  - tests/unit/lib/social/platform-services.test.ts
key-decisions:
  - TwitterSyncService uses twitter-api-v2 SDK not raw fetch -- mock module with persistent client object to survive resetMocks
  - Instagram createPost calls getInstagramAccountId before media check -- must mock fetch for IG account ID even in media-validation tests
  - Facebook reuses InstagramService verified via instanceof check in factory tests
  - Cross-service contract tests verify all 14 PlatformService interface methods on each service
duration: ~8 min
completed: 2026-02-17
---

# Phase 7 Plan 03: Platform Service Tests

**Created test suites for the platform service factory (28 tests) and representative platform services (38 tests), completing Phase 7 with 230 total new tests across auth, social, and core services.**

## Performance

- Tasks: 2/2
- Files created: 2 (factory.test.ts, platform-services.test.ts)
- Files modified: 0
- Total tests added: 66
- Duration: ~8 min

## Accomplishments

### Task 1: Platform service factory test suite (28 tests)

Created `tests/unit/lib/social/factory.test.ts` covering:

- **Factory creation for all 9 platforms** (10 tests): createPlatformService returns correct service class for twitter, linkedin, instagram, facebook, tiktok, youtube, pinterest, reddit, threads. Facebook reuses InstagramService. All 9 return non-null.
- **Factory with invalid input** (2 tests): Unknown platform returns null, empty string returns null.
- **PLATFORM_INFO configuration** (4 tests): All 9 platforms present, syncSupported: true for all, name/icon/color populated with valid values, no undefined/null entries.
- **isPlatformSupported()** (4 tests): True for all 9 platforms, false for unknown platforms, false for empty string, case-sensitive (uppercase fails).
- **Service initialization** (6 tests): Credentials stored (isConfigured true), token expiry detection (expired vs non-expired vs missing expiresAt), tokenRefreshCallback option, custom tokenRefreshThresholdMs option.
- **SUPPORTED_PLATFORMS constant** (2 tests): Contains exactly 9 platforms, correct order.

Commit: `bb5d3d2` — `test(07-03): create platform service factory test suite`

### Task 2: Representative platform service tests (38 tests)

Created `tests/unit/lib/social/platform-services.test.ts` covering:

**TwitterSyncService (9 tests):**
- syncProfile: maps SDK response to SyncProfileResult, failure when unconfigured, SDK error returns graceful failure
- createPost: text-only tweet creation, failure when unconfigured
- deletePost: successful deletion with correct postId, false on error
- getPostMetrics: maps public_metrics correctly, null when unconfigured

**InstagramService (7 tests):**
- syncProfile: maps Graph API response with getInstagramAccountId lookup
- createPost: two-step container+publish flow verified (3 fetch calls), requires media
- deletePost: returns false (API unsupported)
- Error handling: Graph API error response, network error graceful failure

**RedditService (11 tests):**
- syncProfile: maps /api/v1/me response, cleans icon_img URL
- createPost: form-encoded URLSearchParams body (not JSON), correct Content-Type header, requires subreddit, requires title
- User-Agent: Synthex/1.0 on both GET and POST requests
- deletePost: adds t3_ prefix, no double-prefix, returns true/false
- Error handling: network error graceful failure

**Cross-service contract (11 tests):**
- Interface: all 14 PlatformService methods exist on Twitter, Instagram, Reddit
- Token expiry: isTokenExpired true/false, getTokenExpiryMs returns -1/0
- Credentials: isConfigured true with token, false without init, false with empty token

Commit: `52646e1` — `test(07-03): create representative platform service tests`

## Files Created

| File | Tests | Purpose |
|------|-------|---------|
| tests/unit/lib/social/factory.test.ts | 28 | Factory, PLATFORM_INFO, isPlatformSupported |
| tests/unit/lib/social/platform-services.test.ts | 38 | Twitter, Instagram, Reddit services + cross-service |

## Decisions

1. **TwitterSyncService uses twitter-api-v2 SDK**: Unlike Instagram and Reddit (raw fetch), Twitter uses the `twitter-api-v2` package. Mock strategy uses a persistent client object returned from mocked constructor to survive `resetMocks: true`.
2. **Instagram media check ordering**: `createPost` calls `getInstagramAccountId()` before checking media requirement. Tests must mock the IG account ID fetch even when testing the "no media" error path.
3. **Cross-service contract verification**: Rather than testing every method on every service, we verify the interface exists (typeof checks) and test behavior on 3 representative services covering different API patterns.

## Deviations

None. Plan executed as specified.

## Issues Encountered

1. **resetMocks clears module-level mock implementations**: Initial approach with `jest.fn().mockImplementation()` at module scope was cleared by Jest's `resetMocks: true`. Fixed by using a persistent plain object for the Twitter mock client.
2. **TwitterApiV2Settings import**: The `twitter-service.ts` file accesses `TwitterApiV2Settings.debug` at module load time. The mock must include this property or import fails with "Cannot set properties of undefined".

## Phase 7 Final Test Coverage Summary

| Module | Files | Tests Before Phase 7 | Tests After Phase 7 |
|--------|-------|---------------------|---------------------|
| lib/auth/ (jwt, pkce) | 2 | 54 | 54 (unchanged) |
| lib/auth/ (account, rbac) | 2 | 0 | 98 (07-01) |
| lib/social/ | 3 | 0 | 108 (42 in 07-02, 66 in 07-03) |
| lib/prisma.ts | 1 | 0 | 24 (07-02) |
| **Total new tests (Phase 7)** | **8** | | **230** |

Full test suite: 806 passing, 2 pre-existing failures (brand-generation flaky test, unrelated).

## Next Phase Readiness

Phase 7 complete. Ready for Phase 8 (Testing -- API Contracts).
