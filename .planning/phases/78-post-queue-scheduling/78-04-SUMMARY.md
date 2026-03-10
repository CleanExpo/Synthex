# Summary 78-04: Queue Notifications, Retry Logic & Schedule Health

**Linear**: SYN-44
**Status**: Complete
**Date**: 10/03/2026

---

## Tasks Completed (5/5)

### Task 1: Retry logic with exponential backoff
**File**: `app/api/cron/publish-scheduled/route.ts`

Added automatic retry for transient publish failures:
- `isRetryableError()` detects rate limits, timeouts, 5xx errors, token refresh failures
- Up to 3 retries with 5/15/60 minute exponential backoff
- Non-retryable errors (unsupported platform, empty content, no connection) fail immediately
- Retry state tracked in `metadata.retryCount`, `metadata.lastRetryError`, `metadata.lastRetryAt`
- `jsonSafe()` helper ensures metadata satisfies Prisma InputJsonValue

### Task 2: Publish/fail notifications
**File**: `app/api/cron/publish-scheduled/route.ts`

Added in-app notification creation on publish outcomes:
- `createNotification()` helper creates Notification model entries
- Notifications created on successful publish (`post_published` type)
- Notifications created on permanent failure (`post_failed` type) with retry count
- Wrapped in try/catch so notification failures never affect publishing

### Task 3: Schedule health widget
**Files**: `components/queue/schedule-health.tsx`, `components/queue/index.ts`, `app/dashboard/schedule/queue/page.tsx`

New dashboard widget showing publishing pipeline vitals:
- Primary metric: 7-day success rate with green/amber/red colour coding
- Grid: Published count, Failed count, Average delay, Retry queue / Next up
- Top 3 failure reasons with count badges
- Auto-refreshes every 60 seconds via SWR
- Integrated above QueueStats on queue page

### Task 4: Post lifecycle timeline + retry badge
**Files**: `components/calendar/PostDetailModal.tsx`, `components/calendar/CalendarTypes.ts`, `components/queue/queue-table.tsx`

Post lifecycle history tracking and display:
- Added `metadata` field to `ScheduledPost` type
- `PostLifecycleTimeline` sub-component renders vertical timeline with colour-coded dots
- Events: published (green), retry_scheduled (amber), failed_permanently (red), scheduled (cyan), created (grey)
- Timeline sorted newest-first with timestamps and error reasons
- `RetryBadge` component in queue table shows retry count on posts being retried

### Task 5: Scheduler stats API endpoint
**File**: `app/api/scheduler/stats/route.ts`

New `GET /api/scheduler/stats` endpoint:
- 7-day totals: published, failed, retrying counts
- Success rate calculation (published / completed)
- Average publish delay (scheduledAt to publishedAt)
- Top 5 failure reasons grouped and sorted by count
- Next scheduled post timestamp
- Retry queue count (scheduled posts with retryCount > 0)
- Auth: `getUserIdFromRequestOrCookies`, scoped to user's campaigns

---

## Verification

- **type-check**: PASS (zero errors)
- **Commits**: 5 (2 feat + 1 feat + 1 feat + 1 fix)

---

## Files Changed

| File | Action |
|------|--------|
| `app/api/cron/publish-scheduled/route.ts` | UPDATED: retry logic, history, notifications, jsonSafe |
| `app/api/scheduler/stats/route.ts` | NEW: health metrics endpoint |
| `components/queue/schedule-health.tsx` | NEW: publishing health widget |
| `components/queue/index.ts` | UPDATED: export ScheduleHealth |
| `components/queue/queue-table.tsx` | UPDATED: RetryBadge, RotateCcw import |
| `components/calendar/PostDetailModal.tsx` | UPDATED: PostLifecycleTimeline, RotateCcw import |
| `components/calendar/CalendarTypes.ts` | UPDATED: metadata field on ScheduledPost |
