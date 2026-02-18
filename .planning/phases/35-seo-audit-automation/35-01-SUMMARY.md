---
phase: 35-seo-audit-automation
plan: "01"
subsystem: seo
tags: [prisma, cron, email, pagespeed, scheduled-audits, regression-detection]

# Dependency graph
requires:
  - phase: 31
    provides: SEOAudit model, PageSpeed API pattern
provides:
  - ScheduledAuditTarget model
  - CRUD API for scheduled audit targets
  - Cron job for automated audits
  - Regression detection with email alerts
affects: [35-02-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [cron-with-email-alerts, regression-detection]

key-files:
  created:
    - prisma/schema.prisma (ScheduledAuditTarget model)
    - app/api/seo/scheduled-audits/route.ts
    - app/api/seo/scheduled-audits/[id]/route.ts
    - lib/seo/audit-scheduler.ts
    - app/api/cron/seo-audits/route.ts
  modified:
    - vercel.json (new cron entry)

key-decisions:
  - "Professional+ subscription required for scheduled audits"
  - "Daily cron at 3 AM UTC (after health-score at 2 AM)"
  - "Sequential audit processing to respect PageSpeed API rate limits"

patterns-established:
  - "Regression detection: compare new score vs lastScore, trigger at alertThreshold%"
  - "Cron email alerts: follow weekly-digest pattern with buildAlertEmail template"

issues-created: []

# Metrics
duration: 12min
completed: 2026-02-18
---

# Phase 35 Plan 01: Scheduled SEO Audit Infrastructure Summary

**ScheduledAuditTarget model with CRUD API, daily cron job with regression detection and email alerts**

## Performance

- **Duration:** 12 min
- **Started:** 2026-02-18T16:20:00Z
- **Completed:** 2026-02-18T16:32:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added ScheduledAuditTarget Prisma model with frequency, alertThreshold, lastRunAt/lastScore tracking
- Created 5 API endpoints for scheduled audit target management (POST, GET list, GET single, PATCH, DELETE)
- Built audit scheduler service with PageSpeed API integration and regression detection
- Implemented cron job that processes due targets, detects score drops, and sends email alerts
- Added cron entry to vercel.json (daily at 3 AM UTC)

## Task Commits

Each task was committed atomically:

1. **Task 1: ScheduledAuditTarget Model + CRUD API** - `c86a77e` (feat)
2. **Task 2: Cron Job + Regression Detection + Email Alerts** - `8c5c601` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `prisma/schema.prisma` - Added ScheduledAuditTarget model with User relation
- `app/api/seo/scheduled-audits/route.ts` - POST/GET endpoints for target list
- `app/api/seo/scheduled-audits/[id]/route.ts` - GET/PATCH/DELETE for single target
- `lib/seo/audit-scheduler.ts` - getTargetsDueForAudit, runScheduledAudit, detectRegression, buildAlertEmail
- `app/api/cron/seo-audits/route.ts` - Cron job with CRON_SECRET auth
- `vercel.json` - Added cron entry for /api/cron/seo-audits at 0 3 * * *

## Decisions Made

- **Subscription gating:** Professional+ required for scheduled audits (same as other SEO features)
- **Cron timing:** 3 AM UTC daily, after health-score (2 AM) to spread load
- **Sequential processing:** Process targets one-by-one with 1s delay to respect PageSpeed API rate limits
- **Alert threshold default:** 10% score drop triggers email alert

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Database not reachable during development (expected) — schema validated via `npx prisma validate`, `db push` deferred to deployment

## Next Phase Readiness

- Infrastructure complete for plan 35-02
- Ready for: useScheduledAudits hook, useAuditHistory hook, 3-tab dashboard page
- No blockers

---
*Phase: 35-seo-audit-automation*
*Completed: 2026-02-18*
