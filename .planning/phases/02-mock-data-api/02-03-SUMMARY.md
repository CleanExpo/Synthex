---
phase: 02-mock-data-api
plan: 03
subsystem: api
tags: [content-library, trending, mock-removal, empty-state, prisma]

requires:
  - phase: 02-mock-data-api
    provides: Empty-state pattern established (02-01), AI error pattern established (02-02)

provides:
  - Content library endpoints return proper 501/empty state (no ContentLibrary model in schema)
  - Trending endpoint uses deterministic engagement-based calculations (no Math.random)
  - getDefaultTrendingTopics() hardcoded data removed entirely

affects: [02-05, 03-01]

tech-stack:
  added: []
  patterns: [501-not-implemented-for-missing-model, deterministic-trend-calculation]

key-files:
  created: []
  modified:
    - app/api/library/content/route.ts
    - app/api/library/content/[contentId]/route.ts
    - app/api/trending/route.ts

key-decisions:
  - "No ContentLibrary model exists in schema — endpoints return 501/empty state instead of fake CRUD"
  - "Trending calculateChange() uses deterministic engagement thresholds, not Math.random()"
  - "Error responses replace fake data fallbacks on trending endpoint"

patterns-established:
  - "Missing model pattern: return 501 with clear message about feature not being configured"
  - "Deterministic metrics: derive change percentages from real engagement ratios"

issues-created: []

duration: ~6 min
completed: 2026-02-16
---

# Phase 2 Plan 03: Fix Content Library and Trending Endpoints Summary

**Replaced placeholder arrays and stubbed 404s in content library with proper 501/empty states, removed Math.random() trend simulation and hardcoded default topics from trending endpoint.**

## Performance
- Task 1: ~3 min
- Task 2: ~3 min
- Total: ~6 min
- Tasks: 2/2 completed
- Files modified: 3

## Accomplishments
- Content library GET returns proper empty state with hint message (no ContentLibrary model in schema)
- Content library POST/GET/PATCH/DELETE return 501 with "not yet configured" message
- Removed fake content creation using `Date.now()` IDs
- Removed all commented-out Prisma code blocks from [contentId] route
- Trending `calculateChange()` now uses deterministic engagement-to-post ratio thresholds
- Removed `getDefaultTrendingTopics()` and its 8 hardcoded fake trending topics
- Trending error handler returns 500 error instead of fake data
- Trending successful response wrapped in consistent `{ data: ... }` format

## Task Commits

1. **Task 1: Implement proper empty states for content library endpoints** - `c0c2251` (fix)
   - GET returns `{ data: [], message: "Content library is not yet configured..." }` with pagination
   - POST returns 501 with clear "not available" message
   - [contentId] GET/PATCH/DELETE return 501 instead of stubbed 404
   - Removed dead code: createContentSchema, updateContentSchema, unused imports
2. **Task 2: Replace trending endpoint mock data with real calculations** - `6c7eea1` (fix)
   - calculateChange() uses deterministic thresholds (50/25/8/2/0) based on engagement ratio
   - getDefaultTrendingTopics() removed entirely
   - Empty/error states return proper responses, not fake data
   - Successful response wrapped in `{ data: sortedTopics }`

## Files Created/Modified
- `app/api/library/content/route.ts` - Proper empty state (GET), 501 (POST), dead code removed
- `app/api/library/content/[contentId]/route.ts` - 501 for all handlers, commented-out code removed
- `app/api/trending/route.ts` - Deterministic calculations, fake defaults removed, proper error handling

## Decisions Made
- **No ContentLibrary model exists** — checked full Prisma schema. Closest models (Post, CalendarPost, Quote) serve different purposes. Endpoints return 501 "not configured" which is accurate and honest. When a ContentLibrary model is added later, these endpoints are ready to wire up.
- **Deterministic trend calculation** — replaced random ranges (Math.random() * 30 + 20) with fixed thresholds based on engagement ratio. This ensures consistent, reproducible results.
- **501 vs 404 for missing model** — chose 501 (Not Implemented) over 404 because the endpoints exist and are reachable, but the backing feature isn't implemented yet. This is semantically correct.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Dead Code] Removed unused imports and schemas**
- **Found during:** Task 1
- **Issue:** After removing fake creation logic, `prisma`, `z`, `createContentSchema`, `updateContentSchema`, and `NextResponse` imports became unused
- **Fix:** Removed all unused imports and schemas
- **Files modified:** Both library/content routes
- **Committed in:** c0c2251 (part of Task 1 commit)

**2. [Rule 1 - Dead Code] Removed commented-out Prisma code blocks**
- **Found during:** Task 1
- **Issue:** [contentId]/route.ts had large commented-out Prisma query blocks serving as "documentation" of future intent
- **Fix:** Removed all commented-out code. The NOTE in the file header explains the model doesn't exist.
- **Files modified:** app/api/library/content/[contentId]/route.ts
- **Committed in:** c0c2251 (part of Task 1 commit)

**3. [Rule 3 - Blocker] Prefixed unused context parameters**
- **Found during:** Task 1
- **Issue:** After removing commented-out code, `context` parameters in [contentId] handlers became unused, which would cause TypeScript lint warnings
- **Fix:** Prefixed with `_context` to indicate intentionally unused (required by Next.js dynamic route signature)
- **Files modified:** app/api/library/content/[contentId]/route.ts
- **Committed in:** c0c2251 (part of Task 1 commit)

---

**Total deviations:** 3 auto-fixed (dead code x2, unused param), 0 deferred
**Impact on plan:** All auto-fixes necessary cleanup. No scope creep.

## Issues Encountered
None.

## Next Step
Ready for 02-04-PLAN.md (Fix monitoring, SEO, and integration stubs)

---
*Phase: 02-mock-data-api*
*Completed: 2026-02-16*
*Commits: c0c2251, 6c7eea1*
