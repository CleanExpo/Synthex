---
phase: 06-cron-jobs
plan: 01
subsystem: competitor-tracking-cron
tags: [cron, competitor-tracking, platform-apis, real-metrics, alert-detection]
requires: [05-01, 05-02, 05-03, 05-04, 05-05]
provides: [competitor-fetcher, real-competitor-snapshots, per-platform-alerts]
affects: [lib/social/**, app/api/competitors/track/execute/**]
tech-stack: [nextjs, typescript, fetch-api, prisma, vercel-cron]
key-files:
  - lib/social/competitor-fetcher.ts
  - app/api/competitors/track/execute/route.ts
key-decisions:
  - competitor-fetcher.ts is a lightweight standalone module — does NOT import full platform services
  - Twitter lookup uses /2/users/by/username with Bearer token
  - Instagram uses Business Discovery API (requires IG Business/Creator account)
  - YouTube uses Channels API with forHandle (modern) fallback to forUsername (legacy)
  - Facebook uses Page lookup with fan_count/followers_count
  - Reddit uses public /user/{handle}/about.json (no auth needed, User-Agent required)
  - LinkedIn, TikTok, Pinterest, Threads return graceful unsupported failure
  - Cron looks up PlatformConnection for user's access token per platform
  - Failed API fetches create snapshot with dataSource 'error' or 'unsupported' (never zeros)
  - Alert detection now per-platform with real deltas (follower >10% = warning, engagement >50% = info)
duration: ~10 min
completed: 2026-02-17
---

# Phase 6 Plan 01: Wire Competitor Tracking Cron to Real Platform APIs

**Created competitor-fetcher.ts for real platform API lookups and refactored the competitor tracking cron to replace zero-metric stubs with live data fetching.**

## Performance

- Tasks: 2
- Files created: 1 (lib/social/competitor-fetcher.ts)
- Files modified: 1 (app/api/competitors/track/execute/route.ts)

## Accomplishments

### Task 1: Create competitor metrics fetcher using platform services

- Created `lib/social/competitor-fetcher.ts` (~310 lines) with `fetchCompetitorMetrics(platform, handle, accessToken)` returning `CompetitorMetrics`.
- Implemented platform-specific fetch functions:
  1. **Twitter** -- GET `/2/users/by/username/{handle}?user.fields=public_metrics,description`. Returns followers_count, following_count, tweet_count. Requires Bearer token.
  2. **Instagram** -- Two-step: GET `/me?fields=id` to get IG user ID, then Business Discovery API at `/{igUserId}?fields=business_discovery.fields(followers_count,follows_count,media_count).username({handle})`. Requires Business/Creator account.
  3. **YouTube** -- GET `/youtube/v3/channels?part=statistics,snippet&forHandle={handle}`. Falls back to forUsername if forHandle returns no results. Works with API key or OAuth token.
  4. **Facebook** -- GET `/{handle}?fields=followers_count,fan_count,name,about`. Returns followers_count or fan_count.
  5. **Reddit** -- GET `/user/{handle}/about.json` (public, no auth). Returns subscriber count and karma as engagement proxy. Includes User-Agent header.
- Unsupported platforms (LinkedIn, TikTok, Pinterest, Threads) return `{ success: false, error: 'Platform does not support public profile lookup' }`.
- Every function handles rate limiting (429), auth errors (401), and not-found (404) with specific error messages.
- Never throws -- all errors caught and returned as CompetitorMetrics with `success: false`.

### Task 2: Wire competitor cron to use real fetcher and improve alerts

- Imported `fetchCompetitorMetrics` from `@/lib/social/competitor-fetcher`.
- Added `platformConnection` to PrismaWithCompetitors interface for token lookup.
- Created `platformHandleMap` to map platform names to TrackedCompetitor handle fields.
- For each platform handle:
  1. Looks up user's `PlatformConnection` for access token
  2. Calls `fetchCompetitorMetrics(platform, handle, accessToken)`
  3. On success: Creates CompetitorSnapshot with real metrics, `dataSource: 'api'`, calculated `followerGrowth` delta
  4. On failure: Creates snapshot with null metrics, `dataSource: 'error'` or `'unsupported'`
- **Replaced zero-metric stub creation** -- old code created snapshots with all-zero fields and `dataSource: 'pending'`. New code creates snapshots with real API data or null fields with descriptive dataSource.
- **Improved alert detection:**
  - Now checks per-platform snapshots (not just 'all')
  - Follower spike >10% triggers `severity: 'warning'` alert with platform-specific details
  - Engagement rate change >50% triggers `severity: 'info'` `strategy_change` alert
  - Alert descriptions include actual numbers (previous/current followers, percentage)
- Updated TrackingResult to use `snapshotsCreated` and `snapshotsFailed` instead of `snapshotsFound`.
- Preserved existing cron auth, error handling per-competitor, post tracking, and response format.

## Files Created

| File | Description |
|------|-------------|
| lib/social/competitor-fetcher.ts | Lightweight competitor profile lookup for 5 supported platforms |

## Files Modified

| File | Change |
|------|--------|
| app/api/competitors/track/execute/route.ts | Replaced stub snapshots with real API fetching, improved per-platform alert detection |

## Decisions Made

1. **Standalone fetcher, not platform services** -- competitor-fetcher.ts uses direct fetch() calls, not the full BasePlatformService classes. Competitor lookup is a simpler use case (public profile data) that doesn't need sync/post/delete capabilities.
2. **Reddit needs no auth** -- Public about.json endpoint works without tokens. All other supported platforms require the Synthex user's access token.
3. **YouTube supports API key fallback** -- Checks YOUTUBE_API_KEY and GOOGLE_API_KEY env vars when no OAuth token available.
4. **Failed fetches create snapshots with descriptive dataSource** -- 'error' for API failures, 'unsupported' for platforms without public lookup. Never creates zero-metric stubs.
5. **Per-platform alert detection** -- Old code checked 'all' platform snapshots (which never existed). New code checks each platform individually for real metric changes.
6. **Alert severity uses 'warning' for follower spikes** -- Plan specified 'warning' for >10% growth; engagement changes use 'info'.

## Deviations from Plan

None. Both tasks executed as specified.

## Issues Encountered

None.

## Verification

- [x] `npm run type-check` passes
- [x] `npm run build` succeeds without errors
- [x] competitor-fetcher.ts exists with fetchCompetitorMetrics function exported
- [x] Cron route imports and uses fetchCompetitorMetrics
- [x] Zero-metric stub creation replaced with real fetching
- [x] Unsupported platforms handled gracefully (no crashes)
- [x] Alert detection uses real metric deltas

## Task Commits

| Task | Commit | Hash |
|------|--------|------|
| Task 1: Create competitor metrics fetcher | feat(06-01): create competitor metrics fetcher with real platform API calls | bc7e142 |
| Task 2: Wire competitor cron to use real fetcher | feat(06-01): wire competitor cron to fetch real metrics via platform APIs | 9fd8317 |
