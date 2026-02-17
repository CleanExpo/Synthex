---
phase: 04-security-hardening
plan: 01
subsystem: security
tags: [env-validation, instrumentation, startup, health-check, credential-safety]

requires:
  - phase: 01-foundation
    provides: 01-02 consolidated env files, .env.example as single source of truth

provides:
  - App validates env vars at server startup via Next.js instrumentation hook
  - Missing CRITICAL vars (DATABASE_URL, JWT_SECRET, FIELD_ENCRYPTION_KEY, OAUTH_STATE_SECRET) prevent startup
  - Missing SECRET/INTERNAL vars produce warnings, allow graceful degradation
  - Health check uses canonical EnvValidator with counts-only response (no secrets exposed)
  - Competing env validation implementations deleted (config/env.server.ts, src/env.ts)

affects: [04-02, 04-03, 07-01]

tech-stack:
  added: []
  patterns: [next-instrumentation-hook, env-fail-fast-startup]

key-files:
  created:
    - instrumentation.ts
  modified:
    - app/api/health/route.ts
  deleted:
    - config/env.server.ts
    - src/env.ts

key-decisions:
  - "instrumentation.ts uses dynamic import to keep module lightweight — no Prisma or heavy deps at startup"
  - "CRITICAL vars throw and block startup; SECRET/INTERNAL vars warn and allow graceful degradation"
  - "Health check exposes counts only (totalDefined, totalRequired, configured, errors, warnings) — never var names or values"
  - "config/env.server.ts and src/env.ts deleted — zero active imports, replaced by canonical EnvValidator"
  - "Edge Runtime skipped (env vars may be incomplete), test env skipped (.env.test has minimal vars)"

patterns-established:
  - "Next.js instrumentation hook for startup validation — register() with NEXT_RUNTIME guard"
  - "Security classification-based fail strategy: CRITICAL=throw, others=warn"

issues-created: []

duration: ~8 min
completed: 2026-02-16
---

# Phase 4 Plan 01: Startup Validation & Credential Safety Summary

**Wired the existing 911-line EnvValidator to Next.js instrumentation hook for fail-fast startup validation, consolidated 3 competing env validators down to 1, and updated health check to report env status as counts only.**

## Performance
- Task 1: ~4 min (create instrumentation.ts)
- Task 2: ~4 min (delete 2 files, update health check)
- Total: ~8 min
- Tasks: 2/2 completed
- Files: 1 created, 1 modified, 2 deleted

## Accomplishments
- Created `instrumentation.ts` at project root with Next.js `register()` hook
- EnvValidator.validate() called at server startup with classification-based error handling
- CRITICAL vars missing (DATABASE_URL, JWT_SECRET, FIELD_ENCRYPTION_KEY, OAUTH_STATE_SECRET) throw and prevent startup
- SECRET/INTERNAL vars missing produce console warnings but allow startup
- Edge Runtime guard (`NEXT_RUNTIME !== 'nodejs'`) prevents validation in edge functions
- Test environment guard (`NODE_ENV === 'test'`) skips validation with .env.test
- Deleted `config/env.server.ts` (11-line emergency bypass stub, zero imports)
- Deleted `src/env.ts` (65-line legacy validator, zero imports)
- Health check `checkEnvironment()` now uses canonical EnvValidator
- Health response includes counts only: totalDefined, totalRequired, configured, missingRequired, errors, warnings
- No env var names or values exposed in health response

## Task Commits

1. **Task 1: Wire EnvValidator to Next.js instrumentation hook** - `691f2c7` (feat)
   - 1 file: instrumentation.ts (created)
2. **Task 2: Consolidate env validation and wire health check** - `5d6a50a` (refactor)
   - 3 files: config/env.server.ts (deleted), src/env.ts (deleted), app/api/health/route.ts (modified)

## Decisions Made
- **Dynamic import in instrumentation.ts** -- Uses `await import('@/lib/security/env-validator')` to keep the instrumentation module lightweight. No Prisma or heavy deps loaded at startup.
- **Classification-based fail strategy** -- CRITICAL errors throw (preventing startup), non-critical errors warn (graceful degradation). This matches the SecurityLevel enum already in EnvValidator.
- **Counts-only health response** -- Health check never exposes env var names or values. Reports totalDefined, totalRequired, configured count, missing count, error count, warning count.
- **Delete over deprecate** -- Both competing validators had zero imports, so they were deleted rather than deprecated. No migration path needed.

## Deviations from Plan

None -- plan executed exactly as written.

## Notes
- `scripts/emergency-deploy.js` and `scripts/fix-production-site.js` reference `config/env.server.ts` as a write target (they generate the emergency bypass stub). These scripts are now referencing a deleted file. They are utility scripts not part of the normal app flow -- logged here for awareness.

## Verification Results

| Check | Result |
|-------|--------|
| npm run type-check | Pass (0 errors) |
| npm run build | Pass (compiled, no build errors) |
| instrumentation.ts exists at root | Confirmed |
| Health check uses EnvValidator | Confirmed (counts-only details) |
| No env var names in health response | Confirmed |
| No imports of config/env.server.ts | 0 matches (only script write targets) |
| No imports of src/env.ts | 0 matches |

## Next Step
Continue with 04-02: Rate limiting coverage audit.

---
*Phase: 04-security-hardening*
*Completed: 2026-02-16*
*Commits: 691f2c7, 5d6a50a*
