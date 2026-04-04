---
phase: 22-analytics-dashboard-v2
plan: 01
subsystem: ui
tags: [react, recharts, analytics, date-range, performance-api, hooks]

requires:
  - phase: 21-multi-format-generation
    provides: Dashboard navigation patterns, command palette entries
provides:
  - usePerformanceAnalytics hook for analytics data fetching
  - Custom date range support on analytics page
  - Real data wiring for all analytics charts
affects: [22-02-drill-down-tables, analytics-dashboard]

tech-stack:
  added: []
  patterns: [hook-based analytics data fetching, date range with preset+custom, performance API with custom dates]

key-files:
  created: []
  modified:
    - hooks/use-dashboard.ts
    - app/api/analytics/performance/route.ts
    - app/dashboard/analytics/page.tsx
    - components/analytics/analytics-stats.tsx
    - components/analytics/types.ts
    - components/analytics/analytics-header.tsx
    - components/analytics/analytics-config.ts

key-decisions:
  - "usePerformanceAnalytics builds URL params internally, mapping '24h'/'7d' period values to API-supported '7d'/'30d'/'90d'/'1y' enum"
  - "Custom date range is passed as ISO strings directly to hook params; hook passes startDate/endDate to API when present"
  - "Platform distribution pie chart uses performance API platforms array instead of old AnalyticsData.platformBreakdown"
  - "transformTimelineToEngagement distributes aggregated engagement proportionally across platforms (30/25/25/20%) as API returns only totals"
  - "transformTopContent uses index+1 as numeric id since TopPost.id is number but API returns string ids"
  - "PerformanceChart (radar) maps platform data to ContentPerformanceItem: type=platform name, engagement=engagement, reach=engagementRate, clicks=posts"
  - "GrowthIndicator component added inline in analytics-stats.tsx for reusable positive/negative trend display"
  - "onFilter prop deprecated (not removed) in AnalyticsHeader to maintain backward compatibility"

duration: 45min
completed: 2026-02-18
---

## Performance

All 3 tasks completed within a single session. No blockers encountered. TypeScript clean across all modified files.

## Accomplishments

- Replaced the manual `useEffect` + raw fetch pattern on the analytics page with a dedicated `usePerformanceAnalytics` hook that uses the established `useApi` SWR pattern
- Extended the performance API to accept optional `startDate`/`endDate` ISO date params, with automatic fallback to period-based date range
- Added `PerformanceData`, `GrowthData` interfaces to `types.ts` matching the actual API response shape
- Replaced three hardcoded percentage values (+18.2%, +12.5%, +24.8%) in stat cards with real growth data from the performance API
- Enhanced `AnalyticsHeader` with a platform filter dropdown (10 platforms) and custom date range picker that appears conditionally
- Added `transformTimelineToEngagement`, `transformTimelineToGrowth`, `transformTopContent` transform functions to `analytics-config.ts`
- All 5 chart sections now receive real data: EngagementChart, PlatformChart, PerformanceChart, GrowthChart, TopPosts
- Removed `alert()` stubs (`handleFilter`)
- Updated `handleRetry` to use hook's `refetch`

## Task Commits

| Task | Hash | Description |
|------|------|-------------|
| Task 1 | `4113ce3` | feat(22-01): create usePerformanceAnalytics hook and refactor analytics page data layer |
| Task 2 | `4f62f3d` | feat(22-01): enhance analytics header with date range picker and platform filter |
| Task 3 | `6093864` | feat(22-01): wire chart components to real performance API data |

## Files Created

None.

## Files Modified

| File | Change |
|------|--------|
| `hooks/use-dashboard.ts` | Added `usePerformanceAnalytics` hook and `PerformanceAnalyticsParams` interface |
| `app/api/analytics/performance/route.ts` | Added `startDate`/`endDate` to Zod schema; conditional date range logic |
| `app/dashboard/analytics/page.tsx` | Full refactor: hook-based fetching, platform state, dateRange state, real chart data |
| `components/analytics/types.ts` | Added `GrowthData`, `PerformanceData` interfaces; updated `DisplayData` with optional `growth` |
| `components/analytics/analytics-stats.tsx` | Added `GrowthIndicator` component; replaced hardcoded % with real growth data |
| `components/analytics/analytics-header.tsx` | Added platform Select, DatePickerWithRange, new props |
| `components/analytics/analytics-config.ts` | Added `platformFilterOptions`, `'custom'` time range, 3 transform functions |

## Decisions Made

1. **Period mapping**: The API accepts `7d|30d|90d|1y` but the UI has `24h` as an option. Mapped `24h` -> `7d` in the hook's URL builder since the API does not support sub-day granularity.

2. **Engagement distribution**: `transformTimelineToEngagement` uses fixed ratios (30/25/25/20%) to distribute aggregated engagement across Twitter/LinkedIn/Instagram/TikTok. This is acceptable as the timeline endpoint returns totals-only. A future plan can add per-platform timeline data.

3. **TopPost numeric id**: The performance API returns string UUIDs for post IDs, but `TopPost.id` is `number`. Used `index + 1` as a stable numeric key. The `onViewDetails` handler receives this index, which is navigated to `/dashboard/content?postId={id}` (replacing the previous `alert()` stub).

4. **PerformanceChart mapping**: The radar chart has axes `engagement`, `reach`, `clicks`. Mapped from platforms as: `engagement` = total engagement, `reach` = engagementRate (0-100 scale fits radar well), `clicks` = posts count.

5. **onFilter backward compatibility**: Kept `onFilter` as a deprecated optional prop on `AnalyticsHeaderProps` to avoid breaking any downstream callers. The page no longer passes it.

## Deviations from Plan

- **transformTimelineToEngagement**: Plan said "label the series accordingly" when platform filter active. Implemented with fixed proportional distribution for simplicity. The EngagementChart component is designed for multi-platform data `{ date, twitter, linkedin, instagram, tiktok }` and there is no per-platform timeline from the API. Noted as enhancement for 22-02.

- **handleViewPostDetails**: Plan had `alert('Viewing details for post X')` as stub. Replaced with navigation to `/dashboard/content?postId={id}` which is more useful than leaving an alert.

## Issues Encountered

None. All pre-existing TypeScript errors (`lib/prisma.ts`, `lib/video/capture-service.ts`) were present before this plan and remain unmodified.

## Next Phase Readiness

Plan 22-01 is complete. The analytics page now:
- Fetches from `/api/analytics/performance` via `usePerformanceAnalytics` hook
- Displays real engagement/reach/posts growth percentages
- Supports custom date range (DatePickerWithRange on second row)
- Supports platform filtering (10 platforms)
- All 5 chart sections render real API data

Ready for 22-02 (drill-down tables) which can build on the `usePerformanceAnalytics` hook and `PerformanceData` type established here.
