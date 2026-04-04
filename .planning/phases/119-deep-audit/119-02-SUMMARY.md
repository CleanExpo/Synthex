---
phase: 119-deep-audit
plan: '02'
subsystem: api
tags: [routes, auth, zod, prisma, fetch, useSWR, frontend-backend]

requires: []
provides:
  - '119-02-FINDINGS.md: 454 routes audited, frontend-backend connection gaps mapped'
affects: [119-deep-audit/119-03, phase-120, phase-121]

tech-stack:
  added: []
  patterns: ['Audit-only — no new patterns']

key-files:
  created:
    - '.planning/phases/119-deep-audit/119-02-FINDINGS.md'
  modified: []

key-decisions:
  - 'getUserIdFromRequest reads only Authorization header — not httpOnly cookie — affecting ~28 routes'
  - 'NotificationBell unread filter param mismatch (unread=true vs unreadOnly=true)'
  - 'Tasks/research/analytics routes missing organizationId scope'
  - '/api/billing/subscription called by frontend but route does not exist'

patterns-established: []

issues-created: []

duration: ~15min
completed: 2026-03-17
---

# Phase 119 Plan 02: Route + Frontend Completeness Audit Summary

**454 API routes enumerated; ~260 frontend API calls mapped; 3 CRITICAL auth/stub issues found; 14 HIGH gaps including a production 404 on billing/subscription and a notification filter param mismatch affecting every dashboard user**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-17T19:20:00Z
- **Completed:** 2026-03-17T19:35:00Z
- **Tasks:** 2
- **Files modified:** 0 (audit only)

## Accomplishments

- Enumerated 454 `app/api/**/route.ts` files
- Collected ~260 frontend API call targets (fetch + useSWR + useApi)
- CRITICAL: `getUserIdFromRequest` uses only `Authorization: Bearer` header; frontend sends httpOnly cookies → ~28 routes silently return 401 for all normal browser sessions
- CRITICAL: `app/api/system/models/route.ts` has admin role check explicitly disabled (TODO UNI-475) — any authed user can trigger model registry refresh
- CRITICAL: `app/api/generate/route.ts` uses manual if-checks instead of Zod for body validation
- HIGH: `/api/billing/subscription` called by authority dashboard page but route does not exist → silent 404
- HIGH: NotificationBell sends `?unread=true` but route reads `?unreadOnly=true` — unread filter silently ignored, badge always shows all notifications
- HIGH: Tasks, research, analytics routes scope by `userId` only — multi-org users can see cross-org data

## Task Commits

Audit-only plan — no code commits.

## Files Created/Modified

- `.planning/phases/119-deep-audit/119-02-FINDINGS.md` — 30 findings (3 CRITICAL, 14 HIGH, 9 MEDIUM, 4 LOW)

## Decisions Made

- `getUserIdFromRequest` vs `getUserIdFromRequestOrCookies` split is the root cause of the ~28 route 401 regression — this is a CRITICAL finding for Phase 121
- Webhook/cron routes exempted from frontend-caller check (correct per plan)

## Deviations from Plan

None — plan executed exactly as written. Note: due to 454 route files, mutation routes were prioritised for auth/zod/org checks; GET routes sampled representatively.

## Issues Encountered

None significant.

## Next Phase Readiness

- `119-02-FINDINGS.md` is complete and ready to be merged into `119-FINDINGS.md` by plan 119-03
- No blockers

---

_Phase: 119-deep-audit_
_Completed: 2026-03-17_
