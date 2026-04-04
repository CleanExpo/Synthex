---
phase: 05-social-platforms
plan: 05
subsystem: threads-service
tags: [social, threads, platform-service, factory-pattern, meta-graph-api, phase-complete]
requires: [02-01]
provides: [threads-service, threads-factory-integration, all-9-platforms-verified]
affects: [lib/social/**, app/api/social/threads/**]
tech-stack: [nextjs, typescript, fetch-api, meta-graph-api, threads-api]
key-files:
  - lib/social/threads-service.ts
  - lib/social/index.ts
  - app/api/social/threads/post/route.ts
key-decisions:
  - Threads uses Meta Graph API (very similar to Instagram) with base URL https://graph.threads.net/v1.0/
  - Two-step post creation (create container via /me/threads then publish via /me/threads_publish)
  - Token refresh uses th_refresh_token grant type at /refresh_access_token endpoint
  - Bearer token auth in header plus access_token query parameter (matching Meta conventions)
  - deletePost attempts DELETE /{postId} but gracefully returns false if API doesn't support it
  - syncAnalytics combines /me/threads_insights (views,likes,replies,reposts,quotes) with /me?fields=followers_count
  - All 9 platforms verified in factory -- every platform returns non-null service instance
duration: ~8 min
completed: 2026-02-16
---

# Phase 5 Plan 05: Threads Service and Factory Verification Summary

**Created ThreadsService extending BasePlatformService with all 6 interface methods, created API routes, wired into factory, and completed final verification sweep of all 9 platforms. Phase 5 complete.**

## Performance

- Tasks: 2
- Files created: 2 (lib/social/threads-service.ts, app/api/social/threads/post/route.ts)
- Files modified: 1 (lib/social/index.ts)

## Accomplishments

### Task 1: Create ThreadsService extending BasePlatformService
- Created `lib/social/threads-service.ts` (488 lines) implementing all 6 BasePlatformService methods:
  1. **syncAnalytics(days?)** -- GET `/me/threads_insights?metric=views,likes,replies,reposts,quotes&period=day&since={start}&until={end}`. Sums daily values via total_value or manual accumulation. Gets follower_count from `/me?fields=followers_count`. Returns views as impressions, likes+replies+reposts+quotes as engagements, with daily breakdown.
  2. **syncPosts(limit?, cursor?)** -- GET `/me/threads?fields=id,text,timestamp,media_url,media_type,shortcode,permalink,is_reply,reply_audience&limit={limit}&after={cursor}`. Maps each thread to SyncPostsResult with pagination via cursors.after.
  3. **syncProfile()** -- GET `/me?fields=id,username,name,threads_profile_picture_url,threads_biography`. Gets follower_count separately. Returns SyncProfileResult with Threads profile URL.
  4. **createPost(content)** -- Two-step process: (a) POST `/me/threads` with media_type (TEXT/IMAGE/VIDEO), text, optional image_url/video_url, optional reply_control. (b) POST `/me/threads_publish` with creation_id from step a. For VIDEO type, polls status until FINISHED (up to 30 attempts at 2s intervals). Returns PostResult with thread ID and URL.
  5. **deletePost(postId)** -- DELETE `/{postId}`. Returns true on success, false with warning if not supported.
  6. **getPostMetrics(postId)** -- GET `/{postId}/insights?metric=views,likes,replies,reposts,quotes`. Returns views, likes, replies, reposts, quotes as ThreadsPostMetrics.
- Implemented `refreshToken()` using Threads th_refresh_token grant type at `https://graph.threads.net/refresh_access_token`.
- Token expiry errors (code 190, subcode 463) trigger automatic refresh and retry (matching Instagram pattern).
- Full TypeScript interfaces for all Threads API response types.

### Task 2: Create Threads API routes, wire factory, verify all 9 platforms
- **app/api/social/threads/post/route.ts**: Created new route following Instagram pattern:
  - POST handler: Auth check (APISecurityChecker + getUserIdFromRequestOrCookies), Zod validation (content max 500 chars, mediaType TEXT/IMAGE/VIDEO, optional replyControl, optional scheduledAt), PlatformConnection lookup, ThreadsService initialization, post creation, database persistence (social_posts), usage tracking (usage_tracking), audit logging. Supports scheduled posts.
  - GET handler: Auth check, PlatformConnection lookup. Supports ?sync=true for live Threads API fetch with database upsert, fallback to database query.
- **lib/social/index.ts**: Added ThreadsService import and export. Factory now returns `new ThreadsService()` for `platform === 'threads'`. Added 'threads' to SUPPORTED_PLATFORMS array. Added PLATFORM_INFO entry with name='Threads', icon='threads', color='#000000', syncSupported=true.

### Factory Verification Sweep

All 9 platforms verified in `createPlatformService()`:

| Platform | Service Class | Factory | Sync | Routes |
|----------|--------------|---------|------|--------|
| Twitter | TwitterSyncService | OK | OK | OK |
| LinkedIn | LinkedInService | OK | OK | OK |
| Instagram | InstagramService | OK | OK | OK |
| Facebook | InstagramService | OK | OK | OK |
| TikTok | TikTokService | OK | OK | OK |
| YouTube | YouTubeService | OK | OK | OK |
| Pinterest | PinterestService | OK | OK | OK |
| Reddit | RedditService | OK | OK | OK |
| Threads | ThreadsService | OK | OK | OK |

- SUPPORTED_PLATFORMS contains all 9 platforms
- PLATFORM_INFO has all 9 entries with syncSupported: true
- No platform returns null from createPlatformService
- Facebook correctly reuses InstagramService (same Meta Graph API)

## Files Created

| File | Description |
|------|-------------|
| lib/social/threads-service.ts | ThreadsService class with all 6 BasePlatformService methods |
| app/api/social/threads/post/route.ts | Threads POST/GET API routes with auth, validation, persistence |

## Files Modified

| File | Change |
|------|--------|
| lib/social/index.ts | Added ThreadsService import/export, factory case, SUPPORTED_PLATFORMS entry, PLATFORM_INFO entry |

## Decisions Made

1. **fetch() for all Threads API calls** -- No SDK. Direct fetch() is consistent with all other platform services.
2. **Two-step post creation** -- Threads requires creating a container first (/me/threads) then publishing (/me/threads_publish), identical to Instagram's container pattern.
3. **Bearer token + query param** -- Threads uses both Authorization: Bearer header and access_token query parameter, matching Meta platform conventions.
4. **th_refresh_token grant type** -- Threads uses a unique grant type for token refresh, distinct from Instagram's fb_exchange_token pattern.
5. **deletePost graceful fallback** -- Attempts DELETE but returns false with warning if API doesn't support it, rather than throwing.
6. **Video polling with timeout** -- For VIDEO posts, polls container status every 2s up to 30 attempts (60s max). Returns error if processing times out.
7. **reply_control metadata** -- Supports 'everyone', 'accounts_you_follow', 'mentioned_only' passed via PostContent metadata.
8. **Follower count via separate call** -- Profile endpoint doesn't always include follower_count; fetched separately for reliability.
9. **All 9 platforms verified** -- Factory verification sweep confirms complete platform coverage.

## Deviations from Plan

None. Both tasks executed as specified.

## Issues Encountered

None.

## Verification

- [x] `npm run type-check` passes
- [x] `npm run build` succeeds without errors
- [x] ThreadsService implements all 6 BasePlatformService methods
- [x] Factory returns ThreadsService for 'threads'
- [x] API route exists at app/api/social/threads/post/route.ts
- [x] ALL 9 platforms return non-null from createPlatformService
- [x] PLATFORM_INFO has all 9 platforms with syncSupported: true

## Task Commits

| Task | Commit | Hash |
|------|--------|------|
| Task 1: Create ThreadsService extending BasePlatformService | feat(05-05): create ThreadsService extending BasePlatformService | 37c371c |
| Task 2: Create Threads routes, wire factory, verify all 9 platforms | feat(05-05): create Threads routes, wire factory, verify all 9 platforms | 9927c7b |

## Phase 5 Complete

All 5 plans in Phase 5 (Social Platform Completeness) are now complete. All 9 social platforms have working service implementations, API routes, and factory integration.
