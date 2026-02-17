---
phase: 23-predictive-analytics
plan: 01
subsystem: ui
tags: [react, predictions, engagement, optimal-times, hooks, glassmorphic]

requires:
  - phase: 22-analytics-dashboard-v2
    provides: usePerformanceAnalytics pattern, AnalyticsSkeleton, APIErrorCard, PageHeader
provides:
  - usePredictionHistory hook for prediction stats and history
  - useOptimalTimes hook for optimal posting times
  - fetchEngagementPrediction async function for POST predictions
  - fetchForecast async function for POST engagement forecasts
  - PredictionStats, EngagementPredictor, OptimalTimesCard components
  - /dashboard/predictions page
affects: [23-02-forecast-chart, predictions-dashboard]

tech-stack:
  added: []
  patterns: [hook-based prediction data fetching, async POST functions for mutations, glassmorphic form cards]

key-files:
  created:
    - components/predictions/types.ts
    - components/predictions/prediction-stats.tsx
    - components/predictions/engagement-predictor.tsx
    - components/predictions/optimal-times-card.tsx
    - components/predictions/index.ts
    - app/dashboard/predictions/page.tsx
  modified:
    - hooks/use-dashboard.ts
    - app/dashboard/layout.tsx
    - components/CommandPalette.tsx

key-decisions:
  - "GET-based hooks (usePredictionHistory, useOptimalTimes) follow usePerformanceAnalytics pattern with useApi; POST-based operations (fetchEngagementPrediction, fetchForecast) are plain async functions using fetchWithAuth"
  - "Lightbulb icon chosen for sidebar instead of Activity (Activity maps to same ChartBarIcon as BarChart3, would be visually duplicate)"
  - "Engagement predictor uses native HTML select elements with glassmorphic styling rather than Radix Select, matching the pattern in content optimizer page"
  - "Optimal times card includes inline loading skeleton rather than AnalyticsSkeleton to match card-level loading"
  - "Forecast section left as placeholder div with dashed border for Plan 23-02"

duration: 25min
completed: 2026-02-18
---

## Performance

All 3 tasks completed within a single session. No blockers encountered. TypeScript clean across all new and modified files (only pre-existing errors in lib/prisma.ts and lib/video/capture-service.ts remain).

## Accomplishments

- Created TypeScript interfaces in `components/predictions/types.ts` matching all prediction API response shapes: PredictionInput, PredictionResult, PredictionHistoryItem, PredictionStats, OptimalTimeSlot, OptimalTimesResult, ForecastPoint, EngagementForecast
- Added `usePredictionHistory` hook (GET /api/analytics/predict-engagement) with 60s stale / 5min cache
- Added `useOptimalTimes` hook (GET /api/optimize/auto-schedule) with 5min stale / 30min cache
- Added `fetchEngagementPrediction` async function (POST /api/analytics/predict-engagement)
- Added `fetchForecast` async function (POST /api/predict/trends?action=forecast)
- Created `PredictionStats` component: 3-column stat grid with colored accuracy indicator
- Created `EngagementPredictor` component: full form with text, platform, content type, media options; results display with metrics grid, confidence badge, factors list, recommendations
- Created `OptimalTimesCard` component: next optimal time display, methodology badge, top 5 time slots with score bars
- Created `/dashboard/predictions` page with header + platform filter, stats row, two-column predictor/times layout, and forecast placeholder
- Added Predictions sidebar entry (Lightbulb icon, after Analytics)
- Added Predictive Analytics command palette entry with relevant keywords

## Task Commits

| Task | Hash | Description |
|------|------|-------------|
| Task 1 | `da265f1` | feat(23-01): create prediction hooks and types |
| Task 2 | `e56b3b8` | feat(23-01): create predictive analytics dashboard page |
| Task 3 | `cc1ff32` | feat(23-01): add predictions navigation and command palette entries |

## Files Created

| File | Purpose |
|------|---------|
| `components/predictions/types.ts` | TypeScript interfaces for all prediction API responses |
| `components/predictions/prediction-stats.tsx` | 3-column stats grid (total predictions, verified, accuracy) |
| `components/predictions/engagement-predictor.tsx` | Engagement prediction form with results display |
| `components/predictions/optimal-times-card.tsx` | Optimal posting times card with score bars |
| `components/predictions/index.ts` | Barrel exports for predictions feature |
| `app/dashboard/predictions/page.tsx` | Main predictions dashboard page |

## Files Modified

| File | Change |
|------|--------|
| `hooks/use-dashboard.ts` | Added prediction type imports, usePredictionHistory, useOptimalTimes hooks, fetchEngagementPrediction, fetchForecast async functions |
| `app/dashboard/layout.tsx` | Added Lightbulb import, Predictions sidebar entry after Analytics |
| `components/CommandPalette.tsx` | Added Lightbulb import, Predictive Analytics command entry |

## Decisions Made

1. **Hook vs async function for POST endpoints**: Following the established pattern from Phase 22, GET-based data fetching uses `useApi` hooks with stale/cache times. POST-based mutations are plain async functions exported from `use-dashboard.ts` since `useApi` is GET-oriented.

2. **Icon selection**: `Lightbulb` (LightBulbIcon from Heroicons) was chosen for the sidebar over `Activity` because `Activity` maps to `ChartBarIcon` -- the same underlying icon as `BarChart3` used by Analytics. This avoids visual duplication.

3. **Native select elements**: The engagement predictor uses native HTML `<select>` with glassmorphic styling (`bg-white/5 border-white/10`) rather than the Radix `Select` component, matching the pattern used in the content optimizer page.

4. **Forecast placeholder**: A dashed-border placeholder div is rendered at the bottom of the page for the Engagement Forecast Chart that Plan 23-02 will implement.

## Deviations from Plan

- **No deviations**: All tasks executed exactly as planned. The only decision point was icon selection, where the plan itself suggested checking available icons.

## Issues Encountered

None. All pre-existing TypeScript errors (`lib/prisma.ts` Prisma adapter type mismatch, `lib/video/capture-service.ts` missing puppeteer-screen-recorder types) remain unmodified and unrelated.

## Next Phase Readiness

Plan 23-01 is complete. The predictions page now:
- Fetches prediction stats and history via `usePredictionHistory`
- Fetches optimal posting times via `useOptimalTimes`
- Submits engagement predictions via `fetchEngagementPrediction`
- Displays results with glassmorphic styling
- Is accessible from sidebar and command palette

Ready for 23-02 (Engagement Forecast Chart) which will:
- Use the `fetchForecast` async function already exported from `use-dashboard.ts`
- Use the `ForecastPoint` and `EngagementForecast` types already defined
- Replace the placeholder div at the bottom of the page with a Recharts area chart
