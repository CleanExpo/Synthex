---
phase: 114-vercel-production-deployment
plan: "01"
subsystem: infra
tags: [vercel, deployment, env-vars, eslint, tsconfig]

requires:
  - phase: 113-security-a11y-sweep
    provides: Clean codebase ready for production deployment

provides:
  - All required production env vars confirmed present in Vercel
  - NEXT_PUBLIC_APP_URL verified as https://synthex.social
  - Type-check passing (0 errors)
  - Lint passing (0 errors)
  - Tests at baseline (1514 passed, 11 pre-existing failures unchanged)

affects: [114-02, deployment]

tech-stack:
  added: []
  patterns:
    - ".next-analyze/, .next-alt/ excluded from tsconfig and eslint — build artifact dirs must not be type-checked or linted"

key-files:
  created: []
  modified:
    - tsconfig.json
    - eslint.config.js

key-decisions:
  - "All required production env vars already present — no missing vars to add"
  - "NEXT_PUBLIC_APP_URL confirmed as https://synthex.social (set 205d ago but correct)"
  - "Test failures (11) are pre-existing baseline, not caused by our changes"
  - "Build artifact dirs (.next-analyze, .next-alt) excluded from lint/typecheck to eliminate false positives"

patterns-established:
  - "Build artifact dirs must be excluded from both tsconfig include and eslint ignores"

issues-created: []

duration: 35min
completed: 2026-03-12
---

# Phase 114 Plan 01: Env Var Audit & Configuration Summary

**All required production env vars confirmed present; pre-deploy validation passes (type-check 0 errors, lint 0 errors, tests at baseline)**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-03-12T00:00:00Z
- **Completed:** 2026-03-12T00:35:00Z
- **Tasks:** 2 (+ 1 deviation fix)
- **Files modified:** 2

## Accomplishments

- Audited all production env vars via `vercel env ls` — all required variables present, nothing missing
- Verified `NEXT_PUBLIC_APP_URL` = `https://synthex.social` (correct)
- Fixed pre-deploy validation: type-check 0 errors, lint 0 errors, tests unchanged at baseline

## Task Commits

1. **Task 2 (deviation): Fix build artifact dirs in tsconfig + eslint** — `f9e7238b` (chore)

_No Task 1 commit — audit was read-only. No checkpoint action needed (all vars present)._

## Files Created/Modified

- `tsconfig.json` — Removed `.next-analyze/types/**/*.ts` from `include`, added `.next-analyze` to `exclude`
- `eslint.config.js` — Added `.next-alt/**`, `.next-analyze/**`, `packages/**/dist/**` to `ignores`

## Decisions Made

- **No missing env vars** — Checkpoint skipped (human-action checkpoint only needed if vars were missing)
- **NEXT_PUBLIC_APP_URL** confirmed correct via `vercel env pull`
- **Test baseline** — 11 pre-existing test failures, identical before and after our changes; not blocking
- **Stripe vars** stay as test keys — live mode swap is Phase 115 as planned

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `.next-analyze/` included in tsconfig causing 11 false type errors**

- **Found during:** Task 2 (pre-deploy validation — `npm run type-check`)
- **Issue:** `.next-analyze/types/**/*.ts` was in tsconfig `include` — generated type files from bundle analyzer were incompatible with current Next.js types
- **Fix:** Removed from `include`, added `.next-analyze` to `exclude`
- **Files modified:** `tsconfig.json`
- **Verification:** `npm run type-check` exits 0

**2. [Rule 3 - Blocking] `.next-analyze/**`, `.next-alt/**`, `packages/**/dist/**` missing from eslint ignores causing 1051 pre-existing lint errors**

- **Found during:** Task 2 (pre-deploy validation — `npm run lint`)
- **Issue:** Build artifact directories were being linted, generating thousands of false errors in minified JS files
- **Fix:** Added all three patterns to `eslint.config.js` ignores
- **Files modified:** `eslint.config.js`
- **Verification:** `npm run lint` exits 0 (0 errors, 76 warnings in seed/config files only)

---

**Total deviations:** 2 auto-fixed (both Rule 3 blocking), 0 deferred
**Impact on plan:** Both fixes necessary to unblock pre-deploy validation. No scope creep.

## Issues Encountered

None — all blockers were auto-fixed via deviation rules.

## Next Phase Readiness

- Ready for Plan 114-02: `vercel --prod` deployment
- All pre-deploy gates passed: type-check ✓, lint ✓, tests at baseline ✓
- Env vars confirmed: all required production vars present ✓

---
*Phase: 114-vercel-production-deployment*
*Completed: 2026-03-12*
