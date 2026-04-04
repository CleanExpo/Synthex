---
phase: 11-deferred-legacy-services
plan: 01
status: complete
subsystem: legacy-cleanup
tags: [src-services, mock-data, dead-code]
key-files: [SRC-DEPENDENCIES.md]
affects: [12-deferred-components]
---

# Plan 11-01 Summary: Remove Legacy Services

## Execution Overview

**Duration:** ~15 minutes
**Commits:** 2 (chore commits)
**Files removed:** 18
**Lines deleted:** 11,984

## Task Results

### Task 1: Remove 4 confirmed dead legacy services
**Status:** Complete
**Commit:** `7c7e9be`

Removed 6 files (discovered additional .ts and .disabled variants):
- `analytics.service.js` — 100% mock data (Math.random)
- `analytics.service.ts` — Duplicate TypeScript version
- `analytics.service.ts.disabled` — Disabled variant
- `dashboard-service.ts` — Not imported, duplicated lib/api
- `competitor-analysis.js` — Broken imports to non-existent files
- `white-label.js` — Broken imports to non-existent files

### Task 2: Audit and remove other dead src/services files
**Status:** Complete
**Commit:** `3b28000`

Removed 12 additional files after audit confirmed no app/api imports:
- `ab-testing.js`
- `advanced-scheduler.js`
- `automated-reporting.js`
- `content-library.js`
- `mobile-api.js`
- `team-collaboration.js`
- `translation.js`
- `ai-content-generator.js`
- `cache.service.js` — Only used by dead dashboard.ts
- `cache.service.ts` — Only used by dead dashboard.ts
- `team-collaboration.service.ts` — Only used by dead dashboard.ts
- `lib/api/dashboard.ts` — Dead code, not imported anywhere

### Task 3: Document remaining src/ dependencies
**Status:** Complete
**Output:** `SRC-DEPENDENCIES.md`

Documented:
- 9 src/ files actively imported by app/api routes
- 21 remaining src/services/*.ts files for future audit
- Migration priorities and notes for Phase 12+

## Verification

- [x] `npm run type-check` — Pre-existing errors only, no new broken imports
- [x] All removed files were confirmed dead before deletion
- [x] SRC-DEPENDENCIES.md documents remaining dependencies
- [x] All actively-used src/ files preserved

## Unexpected Findings

1. **lib/api/dashboard.ts was dead code** — This file in lib/ was not imported anywhere and itself imported the deleted analytics.service. Removed along with its dependent services.

2. **More .ts variants existed** — The analytics.service had 3 variants (.js, .ts, .ts.disabled). All removed.

3. **21 root-level .ts files remain** — These are not imported by app/api but may be used by src/agents/ or other src/ internal subsystems. Left for future audit.

## Files Preserved (Actively Used)

| Category | File | Used By |
|----------|------|---------|
| Infrastructure | src/infrastructure/caching/cache.factory.ts | cache route |
| Infrastructure | src/infrastructure/logging/console-logger.ts | cache route |
| Middleware | src/middleware/cache-middleware.ts | 2 routes |
| Middleware | src/middleware/session.ts | 2 routes |
| Middleware | src/middleware/rate-limit.ts | 1 route |
| Middleware | src/middleware/enhanced-rate-limit.ts | 2 routes |
| Services | src/services/ai/content-variations.ts | 1 route |
| Services | src/services/content/calendar-service.ts | 2 routes |
| Services | src/services/ai/persona-training-pipeline.ts | 1 route |

## Next Steps

Phase 12 should:
1. Audit 21 remaining src/services/*.ts files for internal src/ dependencies
2. Consolidate 3 rate limiter files (rate-limit.ts, enhanced-rate-limit.ts, and lib/rate-limit.ts)
3. Wire standalone feature components to real APIs
