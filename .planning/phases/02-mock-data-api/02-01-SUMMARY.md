---
phase: 02-mock-data-api
plan: 01
subsystem: api
tags: [competitors, cron, prisma, mock-removal]

requires:
  - phase: 01-foundation
    provides: Clean codebase with accurate CLAUDE.md

provides:
  - Competitor tracking endpoints return real Prisma data (no more fake metrics)
  - Cron no longer pollutes database with Math.random() generated data
  - Empty-state pattern established for competitor endpoints

affects: [02-02, 02-03, 02-04, 02-05, 06-01]

tech-stack:
  added: []
  patterns: [empty-state-with-hint, prisma-findFirst-latest-snapshot]

key-files:
  created: []
  modified:
    - app/api/competitors/track/execute/route.ts
    - app/api/competitors/track/[id]/snapshot/route.ts
    - app/api/competitors/track/route.ts

key-decisions:
  - "Pending snapshots use dataSource: 'pending' with zero metrics (not null)"
  - "Milestone thresholds kept as configuration constants (not mock data)"
  - "Initial snapshot creation failure logged but doesn't block competitor creation"

patterns-established:
  - "Empty state: { data: [], message: 'hint' } or { data: null, message: 'hint' }"
  - "Per-platform try/catch with console.error for granular error handling"

issues-created: []

duration: ~6 min
completed: 2026-02-16
---

# Phase 2 Plan 01: Fix Competitor Tracking Mock Data Summary

**Removed generateMockMetrics() and generateMockPost() from all three competitor tracking routes, replacing Math.random()-generated fake data with real Prisma queries and proper empty states.**

## Performance
- Task 1: ~3 min
- Task 2: ~3 min
- Total: ~6 min
- Tasks: 2/2 completed
- Files modified: 3

## Accomplishments
- Eliminated the active cron that was polluting the database with fake competitor data every 30 minutes
- Replaced all mock data generators with real Prisma findFirst/findMany queries
- Established empty-state pattern with hint messages for all competitor endpoints
- Fixed silent error swallowing in initial snapshot creation

## Task Commits

1. **Task 1: Remove mock generators from cron execute route** - `3bef236` (fix)
   - Deleted generateMockMetrics() and generateMockPost() functions
   - Replaced with Prisma findFirst/findMany queries for real snapshot and post data
   - Added granular per-platform try/catch error handling
2. **Task 2: Remove mock from snapshot route, fix silent error swallowing** - `9bc30fd` (fix)
   - Deleted duplicate generateMockMetrics() from snapshot route
   - Fixed .catch(() => {}) silent error swallowing in track route
   - Added proper console.error logging for failures

## Files Created/Modified
- `app/api/competitors/track/execute/route.ts` - Removed mock generators, replaced with real Prisma queries
- `app/api/competitors/track/[id]/snapshot/route.ts` - Removed duplicate mock generator, uses real snapshots
- `app/api/competitors/track/route.ts` - Fixed silent error swallowing on initial snapshot creation

## Decisions Made
- Pending snapshots created with `dataSource: 'pending'` and zero metrics rather than null — ensures consistent schema
- Milestone detection thresholds `[1000, 5000, 10000, ...]` kept as configuration constants — these are intentional thresholds, not mock data
- Initial snapshot creation failure is logged but non-blocking — the cron will create real snapshots on the next cycle

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## Next Step
Ready for 02-02-PLAN.md (Fix content generation mock persona)

---
*Phase: 02-mock-data-api*
*Completed: 2026-02-16*
*Commits: 3bef236, 9bc30fd*
