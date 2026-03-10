---
phase: 82-code-quality
plan: "02"
subsystem: api
tags: [logger, sentry, lucide-react, icons, console-error, code-quality]

# Dependency graph
requires:
  - phase: 73-security-hardening
    provides: logger utility (lib/logger.ts) with Sentry integration
provides:
  - Structured logging across all API routes (245 files migrated)
  - Icon barrel completeness (FileQuestion added)
  - P3 architecture compliance (zero direct lucide-react imports outside barrel)
affects: [observability, sentry-integration, logging-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "logger.error(message, error) for all API error handling"
    - "logger.warn(message, { error }) for non-fatal warnings"
    - "logger.info() replaces console.log"
    - "FileQuestion exported from components/icons barrel"

key-files:
  created: []
  modified:
    - components/icons/index.ts
    - app/dashboard/bio/[pageId]/not-found.tsx
    - app/dashboard/not-found.tsx
    - "~248 app/api/**/*.ts files"

key-decisions:
  - "FileQuestion re-exported directly from lucide-react in barrel (no Heroicons equivalent)"
  - "logger.warn calls with raw unknown args wrapped as { error } LogContext objects"
  - "cache/route.ts kept its local ConsoleLogger (deprecated file, no new import added)"

patterns-established:
  - "logger.error(message, error) — matches lib/logger.ts signature"
  - "logger.warn(message, { error }) — error wrapped in LogContext for warn calls"

issues-created: []

# Metrics
duration: 35min
completed: 2026-03-10
---

# Phase 82 Plan 02: Logger Migration + Icon Barrel Fix Summary

**Replaced 531+ console.error/warn/log calls with structured logger across 248 API route files; fixed FileQuestion icon barrel gap and eliminated direct lucide-react imports.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-03-10T00:00:00Z
- **Completed:** 2026-03-10T00:35:00Z
- **Tasks:** 8/8 complete
- **Files modified:** ~251 (248 API routes + 3 non-API files)

## Accomplishments

- Added `FileQuestion` re-export to `components/icons/index.ts` — closes P3 architecture gap
- Fixed both not-found pages to import from `@/components/icons` instead of `lucide-react` directly
- Migrated 245 API route files: `console.error` → `logger.error`, `console.warn` → `logger.warn`, `console.log` → `logger.info`
- Added `import { logger } from '@/lib/logger'` where missing
- Zero `console.error/warn/log` remaining in `app/api/`
- `npm run type-check` passes with zero errors after fixing 8 type issues
- Test suite: 32 failures (all pre-existing baseline, zero regressions)

## Task Commits

Each task was committed atomically:

1. **Tasks 1+2: Icon barrel + not-found fixes** - `7e5f8473` (refactor)
2. **Task 3: Group A - ab-testing routes (3 files)** - `5767219c` (refactor)
3. **Tasks 4+5: Group B+C - analytics/content/admin (29 files)** - `f55e09f4` (refactor)
4. **Task 6: Group D - integrations/reporting/research (26 files)** - `5b312f2d` (refactor)
5. **Task 7: Group E - all remaining routes (190 files)** - `6a417e4d` (refactor)
6. **Task 8 type fixes: logger type errors fixed** - `6e9f74e3` (fix)

**Plan metadata:** (docs commit — this SUMMARY)

## Files Created/Modified

- `components/icons/index.ts` — Added FileQuestion re-export from lucide-react
- `app/dashboard/bio/[pageId]/not-found.tsx` — Import path: lucide-react → @/components/icons
- `app/dashboard/not-found.tsx` — Import path: lucide-react → @/components/icons
- `app/api/**/*.ts` (245 files) — console.* → logger.* migration + import additions

## Decisions Made

- FileQuestion has no Heroicons equivalent — re-exported directly from lucide-react within the barrel. This is a contained exception within the barrel module itself, so P3 compliance is maintained from the consumer perspective.
- `app/api/cache/route.ts` is deprecated with its own ConsoleLogger — the newly added logger import was removed to avoid conflict. The local ConsoleLogger.error() signature accepts (message, error), so the migrated logger calls work correctly.
- `logger.warn` signature takes `LogContext` as 2nd param (not raw error). Calls that passed raw errors were wrapped as `{ error }` objects. Calls that passed strings were wrapped as `{ message: string }` or `{ description: string }` objects.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] logger.warn type mismatch — unknown/string not assignable to LogContext**

- **Found during:** Task 8 verification (type-check)
- **Issue:** `logger.warn(msg, error)` passes `unknown` as 2nd arg but signature expects `LogContext | undefined`. Affects 4 call sites in auth/oauth and seo/audit routes.
- **Fix:** Wrapped raw errors: `{ error }` or `{ message: error.message }` or `{ description: string }` as appropriate
- **Files modified:** `auth/oauth/google/callback/route.ts`, `seo/audit/route.ts`
- **Verification:** `npm run type-check` passes with zero errors

**2. [Rule 3 - Blocking] cache/route.ts duplicate logger identifier**

- **Found during:** Task 8 verification (type-check)
- **Issue:** `app/api/cache/route.ts` had `const logger = new ConsoleLogger()` — migration script added `import { logger }` creating a TS2440 conflict
- **Fix:** Removed the erroneously added import; local ConsoleLogger already handles the migrated calls correctly
- **Files modified:** `app/api/cache/route.ts`
- **Verification:** `npm run type-check` passes

**3. [Rule 1 - Bug] 3-argument logger.error calls with string 3rd arg**

- **Found during:** Task 8 verification (type-check)
- **Issue:** `logger.error(msg, error, description)` where description is `string`; 3rd param must be `LogContext`
- **Fix:** Wrapped strings: `{ description: errorDescription }` or conditional LogContext
- **Files modified:** `auth/callback/[platform]/route.ts`, `auth/oauth/github/callback/route.ts`, `auth/oauth/google/callback/route.ts`
- **Verification:** `npm run type-check` passes

### Note on logger.warn signature

The migration plan specified `logger.error('msg', { error })` but the actual logger signature is:
- `error(message, error?: unknown, context?: LogContext)` — raw error as 2nd arg ✓
- `warn(message, context?: LogContext)` — must be LogContext object, not raw error

The bulk migration correctly converted `console.error(msg, error)` → `logger.error(msg, error)` (correct).
`console.warn(msg, error)` → `logger.warn(msg, error)` needed fixing for 4 call sites where `error` was unknown/string.

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocker), 0 deferred
**Impact on plan:** All fixes necessary for TypeScript correctness. No scope creep.

## Issues Encountered

None beyond the type-check fixes documented in Deviations.

## Next Phase Readiness

- All 531+ console.* calls in `app/api/` replaced with structured logger
- Sentry will now capture all API errors that previously bypassed it
- P3 architecture: zero direct lucide-react imports outside the barrel
- `npm run type-check`: passes (zero errors)
- `npm test`: 32 failures (all pre-existing baseline — zero regressions)
- Ready for Phase 82 Plan 03 (if it exists) or phase transition

---
*Phase: 82-code-quality*
*Completed: 2026-03-10*
