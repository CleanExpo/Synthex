---
phase: 05-social-platforms
plan: 04
subsystem: reddit-service
tags: [social, reddit, platform-service, factory-pattern]
requires: [02-01]
provides: [reddit-service, reddit-factory-integration]
affects: [lib/social/**, app/api/social/reddit/**]
tech-stack: [nextjs, typescript, fetch-api, reddit-api]
key-files:
  - lib/social/reddit-service.ts
  - lib/social/index.ts
  - app/api/social/reddit/post/route.ts
key-decisions:
  - Use fetch() directly for Reddit API calls (consistent with all other platform services)
  - Reddit POST requests use application/x-www-form-urlencoded (URLSearchParams), NOT JSON
  - All Reddit API requests include User-Agent header (Synthex/1.0) to avoid 429s
  - Reddit posts require both title and subreddit (validated with Zod in route)
  - Delete uses t3_ prefix for post fullnames (Reddit thing type for links/posts)
  - syncAnalytics returns karma as engagement proxy (Reddit doesn't expose impressions to API)
  - Token refresh uses Basic auth matching OAuth provider pattern
  - GET route supports ?subreddits=true for listing user's subscribed subreddits
  - getSubredditRules() helper for pre-post rule validation
duration: ~8 min
completed: 2026-02-16
---

# Phase 5 Plan 04: Reddit Service Implementation Summary

**Created RedditService extending BasePlatformService with all 6 interface methods plus getSubreddits() and getSubredditRules() helpers, created new API routes, and wired into factory.**

## Performance

- Tasks: 2
- Files created: 2 (lib/social/reddit-service.ts, app/api/social/reddit/post/route.ts)
- Files modified: 1 (lib/social/index.ts)

## Accomplishments

### Task 1: Create RedditService extending BasePlatformService
- Created `lib/social/reddit-service.ts` (602 lines) implementing all 6 BasePlatformService methods:
  1. **syncAnalytics(days?)** -- GET `/api/v1/me` for account info + GET `/api/v1/me/karma` for karma breakdown by subreddit. Returns link_karma, comment_karma, total_karma as engagement proxy, subreddit_count, and user profile subscribers as followers. Reddit doesn't expose post-level analytics or impressions to third parties.
  2. **syncPosts(limit?, cursor?)** -- GET `/user/{username}/submitted?limit={limit}&after={cursor}`. Gets username from /api/v1/me first. Maps each submission's id, title, selftext, url, subreddit, score, num_comments, upvote_ratio, created_utc, permalink to SyncPostsResult. Supports pagination via 'after' token.
  3. **syncProfile()** -- GET `/api/v1/me`. Returns id, name, icon_img (cleaned of query params), link_karma, comment_karma, created_utc, subreddit profile (title, subscribers, public_description, banner_img). Maps to SyncProfileResult.
  4. **createPost(content)** -- POST `/api/submit` with form-encoded body (URLSearchParams). Supports kind='self' (text) or 'link' (URL). Requires subreddit and title from content.metadata. Optional: flair_id, flair_text, nsfw, spoiler flags. Returns PostResult with thing_id.
  5. **deletePost(postId)** -- POST `/api/del` with id=t3_{postId}. Adds t3_ prefix if not present. Returns true on success.
  6. **getPostMetrics(postId)** -- GET `/api/info?id=t3_{postId}`. Returns score, ups, downs, num_comments, upvote_ratio, view_count.
- Added `getSubreddits()` helper -- GET `/subreddits/mine/subscriber?limit=100`, returns array of {name, subscribers, type}.
- Added `getSubredditRules(subreddit)` helper -- GET `/r/{subreddit}/about/rules`, returns array of {name, description, violationReason}.
- Implemented `refreshToken()` using Reddit Basic auth (client_id:client_secret base64) to `https://www.reddit.com/api/v1/access_token`.
- Split `makeRequest` into `makeGetRequest<T>()` and `makePostRequest<T>()` because Reddit GET requests use JSON content but POST requests use form-encoded bodies (URLSearchParams). Both include User-Agent header and automatic token refresh on 401.
- Full TypeScript interfaces for all Reddit API response types.

### Task 2: Create Reddit API routes and wire factory
- **app/api/social/reddit/post/route.ts**: Created new route following Pinterest pattern:
  - POST handler: Auth check (APISecurityChecker + getUserIdFromRequestOrCookies), Zod validation requiring title (max 300) and subreddit, kind enum ('self'|'link'), PlatformConnection lookup, RedditService initialization, post creation, database persistence (social_posts), usage tracking (usage_tracking), audit logging. Supports scheduled posts (saved to scheduled_posts with subreddit/title/kind in metadata).
  - GET handler: Auth check, PlatformConnection lookup. Supports ?subreddits=true for listing subscribed subreddits, ?sync=true for live Reddit API fetch with database upsert, fallback to database query.
- **lib/social/index.ts**: Added RedditService import and export. Factory now returns `new RedditService()` for `platform === 'reddit'`. Added 'reddit' to SUPPORTED_PLATFORMS array. Added PLATFORM_INFO entry with name='Reddit', icon='reddit', color='#FF4500', syncSupported=true.

## Files Created

| File | Description |
|------|-------------|
| lib/social/reddit-service.ts | RedditService class with all 6 BasePlatformService methods + getSubreddits() + getSubredditRules() |
| app/api/social/reddit/post/route.ts | Reddit POST/GET API routes with auth, validation, persistence |

## Files Modified

| File | Change |
|------|--------|
| lib/social/index.ts | Added RedditService import/export, factory case, SUPPORTED_PLATFORMS entry, PLATFORM_INFO entry |

## Decisions Made

1. **fetch() for all Reddit API calls** -- No SDK. Direct fetch() is consistent with all other platform services (TikTok, Instagram, LinkedIn, YouTube, Pinterest).
2. **Separate GET/POST request helpers** -- Reddit uniquely requires form-encoded POST bodies (application/x-www-form-urlencoded) while GET requests use standard JSON responses. Split into makeGetRequest and makePostRequest to enforce correct content types.
3. **User-Agent header on all requests** -- Reddit rate-limits requests without a descriptive User-Agent. All requests include 'Synthex/1.0'.
4. **t3_ prefix for post operations** -- Reddit uses fullnames (t3_{id}) for identifying posts. deletePost and getPostMetrics add the prefix if not already present.
5. **Karma as engagement proxy** -- Reddit doesn't expose impressions or aggregated analytics to API consumers. Total karma is the closest metric to engagement. Link karma maps to 'likes', comment karma to 'comments'.
6. **title and subreddit REQUIRED** -- Reddit enforces both. POST route validates with Zod. createPost returns clear error if either is missing.
7. **GET route supports subreddit listing** -- ?subreddits=true returns user's subscribed subreddits for UI subreddit picker.
8. **getSubredditRules() helper** -- Enables pre-post validation against subreddit-specific rules before submission.
9. **Token refresh uses Basic auth** -- Reddit OAuth requires Base64-encoded client_id:client_secret in Authorization header, matching the existing OAuth provider pattern.

## Deviations from Plan

None. Both tasks executed as specified.

## Issues Encountered

None.

## Verification

- [x] `npm run type-check` passes
- [x] `npm run build` succeeds without errors
- [x] RedditService implements all 6 BasePlatformService methods
- [x] RedditService has getSubreddits() helper method
- [x] RedditService has getSubredditRules() helper method
- [x] Factory returns RedditService for 'reddit'
- [x] API route exists at app/api/social/reddit/post/route.ts
- [x] POST requires title and subreddit (Zod validation)
- [x] Reddit API calls use form-encoded bodies (URLSearchParams, not JSON)
- [x] All requests include User-Agent header
- [x] PLATFORM_INFO shows reddit syncSupported: true

## Task Commits

| Task | Commit | Hash |
|------|--------|------|
| Task 1: Create RedditService extending BasePlatformService | feat(05-04): create RedditService extending BasePlatformService | e6c67a2 |
| Task 2: Create Reddit API routes and wire factory | feat(05-04): create Reddit API routes and wire factory | bfa41d1 |

## Next Step

Continue with 05-05-PLAN.md: Threads service and factory verification.
