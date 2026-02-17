---
phase: 14-feature-agents
plan: 01
status: complete
subsystem: agents
tags: [agent-wiring, real-apis, analytics, prisma, platform-services]
key-files: [src/agents/specialists/platform-specialist-coordinator.ts, src/agents/specialists/social-scheduler-coordinator.ts, src/agents/specialists/trend-predictor-coordinator.ts]
affects: []
---

# Plan 14-01 Summary: Wire Specialist Coordinators to Real APIs

## Completed

Successfully connected all three specialist coordinator agents to real platform APIs and database queries, replacing mock data with actual data-driven insights.

### Task 1: Wire PlatformSpecialistCoordinator to Real Metrics

**Commit:** `781bde1`

**Changes:**
- Added imports for `prisma` and `createPlatformService` from lib/social
- Added `getHistoricalMetrics()` method to query real PlatformMetrics data
- Added `fetchTrendingHashtags()` to get hashtags from actual post performance
- Replaced `Math.random()` in scoring methods with content analysis heuristics:
  - `scoreContentForFactor()` - analyzes content properties (media, hashtags, mentions)
  - `scoreEmotionalImpact()` - detects emotional triggers, exclamations, emojis
  - `scoreShareability()` - evaluates media, lists, relatable/actionable content
  - `scoreTimingRelevance()` - checks time-sensitive keywords, seasonal references
  - `scoreUniqueness()` - measures content length, originality, specific data
  - `scoreTrendAlignment()` - compares against trending hashtags
- Replaced mock predictions with data-driven calculations:
  - `predictReach()` - uses historical metrics + platform multipliers
  - `predictEngagement()` - calculates from reach and historical engagement rates
  - `predictConversions()` - based on engagement and historical conversion data
  - `predictROI()` - blends historical ROI with quality score adjustments
- Updated `getTrendingHashtags()`, `getRelevantHashtags()`, `getNicheHashtags()` to use real data
- Updated `calculateConsistencyScore()` with actual text similarity analysis
- Added historical data caching for performance

**Lines changed:** +587/-20

### Task 2: Wire SocialSchedulerCoordinator to Real Publishing

**Commit:** `f3dad8e`

**Changes:**
- Added imports for `prisma` and platform services
- Replaced mock `publishPost()` with real platform API calls:
  - Fetches user credentials from PlatformConnection table
  - Creates platform service via `createPlatformService()`
  - Calls `service.createPost()` for actual publishing
  - Handles token refresh callback for automatic credential updates
  - Persists results to CalendarPost table
- Added `getPlatformCredentials()` to fetch user's platform tokens
- Added `isRetryableError()` for intelligent retry handling:
  - Retries: rate limits (429), timeouts, network errors, 503
  - No retry: auth errors (401/403), content policy errors
- Added `getRealQueueMetrics()` to query actual CalendarPost data:
  - Counts scheduled/published/failed posts
  - Groups by platform
  - Calculates real success rate
- Extended `ScheduledPost` metadata interface to include publishing fields

**Lines changed:** +252/-8

### Task 3: Wire TrendPredictorCoordinator to Real Analytics

**Commit:** `7999269`

**Changes:**
- Added import for `prisma`
- Replaced mock `collectMarketSignals()` with real database queries:
  - Queries PlatformMetrics for engagement signals from last 7 days
  - Extracts keywords/hashtags from high-performing posts
  - Queries TrackedCompetitor/CompetitorSnapshot for competitor signals
  - Queries SentimentTrend for sentiment-based signals
- Replaced mock `analyzeHistoricalPatterns()` with real Post queries:
  - Finds similar posts by keyword matching
  - Analyzes engagement patterns
  - Calculates match score based on data volume and performance
- Replaced mock `identifyOpportunities()` with real Campaign ROI data:
  - Queries completed campaigns for historical ROI
  - Adjusts opportunity ROI based on trend potential
  - Adds partnership opportunities based on influencer data
- Updated `createTrendFromPattern()` to use real signal data:
  - Calculates viral potential from signal strength and volume
  - Determines platforms from signal sources
  - Uses industry benchmarks for lifespan prediction
- Updated `analyzeViralPotential()` with data-driven factors:
  - Novelty: queries existing content count
  - Shareability: evaluates platform mix
  - Accessibility: analyzes keyword complexity
- Added `calculateAverageSentiment()` helper method

**Lines changed:** +452/-61

## Verification

- [x] `npm run type-check` passes (only pre-existing errors)
- [x] All three coordinator files import from lib/social and lib/prisma
- [x] No `Math.random()` in primary prediction methods
- [x] `publishPost()` in scheduler calls real platform service
- [x] Historical data used for trend analysis

## Pre-existing Issues (Not Fixed)

These errors exist but are unrelated to this plan:
- `lib/prisma.ts`: Prisma driver adapter type incompatibility
- `lib/video/capture-service.ts`: Missing puppeteer-screen-recorder package

## Metrics

| Metric | Value |
|--------|-------|
| Files modified | 3 |
| Lines added | ~1,291 |
| Lines removed | ~89 |
| Commits | 3 |
| Math.random() calls removed | 15+ |
| Database queries added | 12+ |

## Data Sources Connected

| Coordinator | Data Sources |
|-------------|--------------|
| PlatformSpecialist | PlatformMetrics, PlatformPost, Campaign |
| SocialScheduler | PlatformConnection, CalendarPost |
| TrendPredictor | PlatformMetrics, Post, TrackedCompetitor, CompetitorSnapshot, SentimentTrend, Campaign |

## Phase 14 Complete

This is the only plan in Phase 14. Phase 14 (Feature Completion - Agents) is now complete.

## Next Steps

Proceed to Phase 15: Google Developer Console
- Configure OAuth consent screens for Google APIs
- Verify apps for production
- Set up proper API credentials and quotas
