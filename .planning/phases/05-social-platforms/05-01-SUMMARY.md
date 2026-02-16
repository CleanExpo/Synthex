---
phase: 05-social-platforms
plan: 01
subsystem: tiktok-service
tags: [social, tiktok, platform-service, factory-pattern]
requires: [02-01]
provides: [tiktok-service, tiktok-factory-integration]
affects: [lib/social/**, app/api/social/tiktok/**]
tech-stack: [nextjs, typescript, fetch-api, tiktok-content-posting-api-v2]
key-files:
  - lib/social/tiktok-service.ts
  - lib/social/index.ts
  - app/api/social/tiktok/post/route.ts
key-decisions:
  - Use fetch() directly for TikTok API calls (no SDK, consistent with Instagram/LinkedIn)
  - TikTok deletePost returns false with warning (API does not support programmatic deletion)
  - syncAnalytics uses user info + video list for metrics (TikTok lacks aggregated analytics API)
  - getPostMetrics uses /v2/video/query/ endpoint with video_ids filter
  - API route maps SyncPostsResult.impressions to response views field to preserve contract
  - Privacy mapping: PUBLIC->public, FRIENDS->connections, SELF->private
duration: ~8 min
completed: 2026-02-16
---

# Phase 5 Plan 01: TikTok Service Implementation Summary

**Created TikTokService extending BasePlatformService with all 6 interface methods, wired it into the platform factory, and refactored the API route to use the service layer.**

## Performance

- Tasks: 2
- Files created: 1 (lib/social/tiktok-service.ts)
- Files modified: 2 (lib/social/index.ts, app/api/social/tiktok/post/route.ts)

## Accomplishments

### Task 1: Create TikTokService extending BasePlatformService
- Created `lib/social/tiktok-service.ts` (441 lines) implementing all 6 BasePlatformService methods:
  1. **syncAnalytics(days?)** — Fetches user info stats (follower_count, following_count, likes_count, video_count) from `/v2/user/info/`, plus engagement/view metrics from `/v2/video/list/` for recent videos
  2. **syncPosts(limit?, cursor?)** — POST to `/v2/video/list/` with max_count and cursor. Maps video metadata to SyncPostsResult format
  3. **syncProfile()** — GET user info with full field set (open_id, display_name, avatar_url, bio_description, follower_count, following_count, video_count, is_verified, profile_deep_link)
  4. **createPost(content)** — POST to `/v2/post/publish/video/init/` with post_info and source_info (PULL_FROM_URL). Returns publish_id (async processing)
  5. **deletePost(postId)** — Returns false with warning log. TikTok API does not support programmatic video deletion
  6. **getPostMetrics(postId)** — POST to `/v2/video/query/` with video_ids filter. Returns likes, comments, shares, views
- Implemented `refreshToken()` using TikTok OAuth token endpoint with client_key/client_secret
- Added `makeRequest<T>()` helper with automatic token refresh on 401/expired token errors
- Full TypeScript interfaces for all TikTok API response types
- Follows established patterns: error handling via PlatformError, rate limit tracking, token management via ensureValidToken()

### Task 2: Wire TikTok into factory and update API routes
- **lib/social/index.ts**: Added TikTokService import and export. Factory now returns `new TikTokService()` for `platform === 'tiktok'` (was returning null). Updated PLATFORM_INFO tiktok.syncSupported to `true`.
- **app/api/social/tiktok/post/route.ts**: Replaced direct `makeTikTokRequest()` calls with `createPlatformService('tiktok', credentials)` factory pattern:
  - POST handler: Uses `service.createPost()` instead of direct fetch to TikTok publish/init endpoint
  - GET handler: Uses `service.syncPosts()` instead of direct fetch to TikTok video/list endpoint
  - Removed inline `makeTikTokRequest()` function and `TikTokVideo` interface (now in service)
  - Added `mapPrivacyToVisibility()` helper to map route-level privacy values to PostContent visibility
  - Preserved all existing: auth checks, validation schema, scheduled post handling, hashtag building, database persistence, usage tracking, audit logging, and API response format

## Files Created

| File | Description |
|------|-------------|
| lib/social/tiktok-service.ts | TikTokService class with all 6 BasePlatformService methods |

## Files Modified

| File | Change |
|------|--------|
| lib/social/index.ts | Added TikTokService import/export, factory case, syncSupported: true |
| app/api/social/tiktok/post/route.ts | Refactored to use service via factory instead of direct API calls |

## Decisions Made

1. **fetch() for all TikTok API calls** — No TikTok SDK installed. Direct fetch() is consistent with Instagram and LinkedIn services.
2. **deletePost returns false** — TikTok Content Posting API v2 does not support programmatic video deletion. Documented with warning log.
3. **syncAnalytics combines two endpoints** — User info provides follower/following/likes/video counts. Video list provides per-video engagement data. No aggregated analytics API available.
4. **API response contract preserved** — GET handler maps SyncPostsResult.impressions to response `views` field to maintain existing frontend compatibility.
5. **Privacy mapping added** — Route uses TikTok-native values (PUBLIC/FRIENDS/SELF); service uses generic PostContent visibility (public/connections/private).

## Deviations from Plan

None. Both tasks executed as specified.

## Issues Encountered

None.

## Verification

- [x] `npm run type-check` passes
- [x] `npm run build` succeeds without errors
- [x] TikTokService implements all 6 BasePlatformService methods
- [x] Factory returns TikTokService (not null) for 'tiktok'
- [x] API routes use service methods
- [x] PLATFORM_INFO shows tiktok syncSupported: true

## Task Commits

| Task | Commit | Hash |
|------|--------|------|
| Task 1: Create TikTokService extending BasePlatformService | feat(05-01): create TikTokService extending BasePlatformService | 3b371ff |
| Task 2: Wire TikTok into factory and update API routes | feat(05-01): wire TikTok into factory and update API routes | 261cfb0 |

## Next Step

Continue with 05-02-PLAN.md: YouTube service implementation.
