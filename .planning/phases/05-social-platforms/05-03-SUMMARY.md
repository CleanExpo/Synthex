---
phase: 05-social-platforms
plan: 03
subsystem: pinterest-service
tags: [social, pinterest, platform-service, factory-pattern]
requires: [02-01]
provides: [pinterest-service, pinterest-factory-integration]
affects: [lib/social/**, app/api/social/pinterest/**]
tech-stack: [nextjs, typescript, fetch-api, pinterest-api-v5]
key-files:
  - lib/social/pinterest-service.ts
  - lib/social/index.ts
  - app/api/social/pinterest/post/route.ts
key-decisions:
  - Use fetch() directly for Pinterest API v5 calls (consistent with TikTok/Instagram/LinkedIn/YouTube)
  - Pinterest deletePost fully implemented via DELETE /v5/pins/{id} (returns 204)
  - syncAnalytics handles 403 gracefully for personal accounts (business-only endpoint)
  - Token refresh uses Basic auth (client_id:client_secret base64) per Pinterest OAuth spec
  - boardId is REQUIRED for createPost (Pinterest pins must belong to a board)
  - GET route includes boards list in response metadata for board selection UI
  - Video pins return error — Pinterest requires pre-upload for video, not URL-based creation
duration: ~8 min
completed: 2026-02-16
---

# Phase 5 Plan 03: Pinterest Service Implementation Summary

**Created PinterestService extending BasePlatformService with all 6 interface methods plus getBoards() helper, created new API routes, and wired into factory.**

## Performance

- Tasks: 2
- Files created: 2 (lib/social/pinterest-service.ts, app/api/social/pinterest/post/route.ts)
- Files modified: 1 (lib/social/index.ts)

## Accomplishments

### Task 1: Create PinterestService extending BasePlatformService
- Created `lib/social/pinterest-service.ts` (737 lines) implementing all 6 BasePlatformService methods:
  1. **syncAnalytics(days?)** — GET `/v5/user_account/analytics` with start_date, end_date, metric_types=IMPRESSION,PIN_CLICK,OUTBOUND_CLICK,SAVE. Extracts summary_metrics and daily_metrics. Handles 403 gracefully for personal accounts (business-only endpoint). Falls back to profile data for followers/following/pin counts.
  2. **syncPosts(limit?, cursor?)** — GET `/v5/pins` with page_size and optional bookmark pagination. Maps pin id, title, description, media images (prefers originals), created_at, and pin_metrics to SyncPostsResult format.
  3. **syncProfile()** — GET `/v5/user_account`. Returns id, username, business_name, profile_image, follower_count, following_count, pin_count, board_count. Maps to SyncProfileResult.
  4. **createPost(content)** — POST `/v5/pins` with board_id (REQUIRED), title, description, link, alt_text, media_source (image_url type). board_id comes from content.metadata.boardId. Video pins return error (require pre-upload).
  5. **deletePost(postId)** — DELETE `/v5/pins/{pinId}`. Returns true on 204.
  6. **getPostMetrics(postId)** — GET `/v5/pins/{pinId}/analytics` with 30-day range and metric_types=IMPRESSION,SAVE,PIN_CLICK,OUTBOUND_CLICK. Returns summary metrics.
- Added `getBoards()` helper — GET `/v5/boards`, returns array of {id, name, privacy}.
- Implemented `refreshToken()` using Pinterest Basic auth (client_id:client_secret base64).
- Added `makeRequest<T>()` helper with automatic token refresh on 401, rate limit tracking from headers, and 204 handling for DELETE.
- Full TypeScript interfaces for all Pinterest API v5 response types.

### Task 2: Create Pinterest API routes and wire factory
- **app/api/social/pinterest/post/route.ts**: Created new route following Instagram pattern:
  - POST handler: Auth check (APISecurityChecker + getUserIdFromRequestOrCookies), Zod validation requiring boardId, PlatformConnection lookup, PinterestService initialization, pin creation, database persistence (social_posts), usage tracking (usage_tracking), audit logging. Supports scheduled posts (saved to scheduled_posts with boardId in metadata).
  - GET handler: Auth check, PlatformConnection lookup, optional sync=true param for live Pinterest API fetch with database upsert, board list in response metadata from service.getBoards(), fallback to database query.
- **lib/social/index.ts**: Added PinterestService import and export. Factory now returns `new PinterestService()` for `platform === 'pinterest'`. Added 'pinterest' to SUPPORTED_PLATFORMS array. Added PLATFORM_INFO entry with name='Pinterest', icon='pinterest', color='#E60023', syncSupported=true.

## Files Created

| File | Description |
|------|-------------|
| lib/social/pinterest-service.ts | PinterestService class with all 6 BasePlatformService methods + getBoards() |
| app/api/social/pinterest/post/route.ts | Pinterest POST/GET API routes with auth, validation, persistence |

## Files Modified

| File | Change |
|------|--------|
| lib/social/index.ts | Added PinterestService import/export, factory case, SUPPORTED_PLATFORMS entry, PLATFORM_INFO entry |

## Decisions Made

1. **fetch() for all Pinterest API calls** — No SDK. Direct fetch() is consistent with all other platform services (TikTok, Instagram, LinkedIn, YouTube).
2. **deletePost fully implemented** — Pinterest API v5 supports pin deletion via DELETE /v5/pins/{id} returning 204. Unlike TikTok which doesn't support programmatic deletion.
3. **syncAnalytics handles 403 for personal accounts** — Pinterest analytics endpoint requires a business account. Personal accounts return 403. Service catches this and returns null metrics with a warning instead of failing entirely.
4. **Token refresh uses Basic auth** — Pinterest OAuth requires Base64-encoded client_id:client_secret in Authorization header, matching the OAuth provider pattern.
5. **boardId is REQUIRED** — Pinterest pins must belong to a board. POST route validates this with Zod. createPost returns error if boardId is missing.
6. **GET route includes boards in metadata** — Both sync and non-sync responses include boards list from getBoards() so the UI can present board selection.
7. **Video pins not supported via URL** — Pinterest requires video pre-upload (not URL pull). createPost returns a clear error for video URLs rather than silently failing.

## Deviations from Plan

None. Both tasks executed as specified.

## Issues Encountered

None.

## Verification

- [x] `npm run type-check` passes
- [x] `npm run build` succeeds without errors
- [x] PinterestService implements all 6 BasePlatformService methods
- [x] PinterestService has getBoards() helper method
- [x] Factory returns PinterestService for 'pinterest'
- [x] API route exists at app/api/social/pinterest/post/route.ts
- [x] POST requires boardId (Zod validation)
- [x] PLATFORM_INFO shows pinterest syncSupported: true

## Task Commits

| Task | Commit | Hash |
|------|--------|------|
| Task 1: Create PinterestService extending BasePlatformService | feat(05-03): create PinterestService extending BasePlatformService | 92018c8 |
| Task 2: Create Pinterest API routes and wire factory | feat(05-03): create Pinterest API routes and wire factory | da44293 |

## Next Step

Continue with 05-04-PLAN.md: Reddit service implementation.
