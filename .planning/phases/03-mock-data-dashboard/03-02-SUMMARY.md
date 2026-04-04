---
phase: 03-mock-data-dashboard
plan: 02
subsystem: ui
tags: [dashboard, mock-removal, experiments, tasks, metrics-table, audit]

requires:
  - phase: 03-mock-data-dashboard
    provides: 03-01 cleaned 7 config files and 8 dashboard pages of mock fallbacks

provides:
  - Zero mock data in experiments and tasks dashboard pages
  - MetricsTable accepts real data via props, shows dashes when empty
  - components/tasks/mock-data.ts deleted
  - Full audit table documenting all remaining mock patterns across components/

affects: [05-01, 05-02, 05-03, 05-04, 05-05, 10-01]

tech-stack:
  added: []
  patterns: [metrics-table-data-prop-pattern]

key-files:
  created: []
  modified:
    - app/dashboard/experiments/page.tsx
    - app/dashboard/tasks/page.tsx
    - components/analytics/metrics-table.tsx
    - components/tasks/index.ts
  deleted:
    - components/tasks/mock-data.ts

key-decisions:
  - "MetricsTable accepts MetricsTableRow[] data prop, shows em dashes when empty"
  - "8 standalone feature components with mock data deferred to Phase 5+ (not imported by dashboard)"

patterns-established:
  - "MetricsTable data-driven pattern: accept data prop, render dashes for missing values"
  - "Dashboard audit methodology: grep → classify → fix/defer/accept"

issues-created: []

duration: ~7 min
completed: 2026-02-16
---

# Phase 3 Plan 02: Experiments, Tasks, MetricsTable + Full Dashboard Audit Summary

**Removed mock fallbacks from experiments and tasks pages, made MetricsTable data-driven, deleted mock-data.ts, and completed full dashboard/component audit confirming zero mock data in any dashboard page.**

## Performance
- Task 1: ~5 min
- Task 2: ~2 min (audit only, no fixes needed)
- Total: ~7 min
- Tasks: 2/2 completed
- Files modified: 4 + 1 deleted

## Accomplishments
- Experiments page shows empty state with CTA instead of inline mockExperiments array
- Tasks page shows error/empty states instead of falling back to mockTasks (3 fallback patterns removed)
- components/tasks/mock-data.ts deleted entirely (146 lines)
- MetricsTable accepts `data` prop (MetricsTableRow[]), shows em dashes when empty instead of Math.random()
- Full audit confirms zero mock imports and zero Math.random() data generation in any dashboard page
- 8 standalone feature components documented as deferred (Phase 5+)
- All barrel exports (components/*/index.ts) confirmed clean of mock re-exports

## Task Commits

1. **Task 1: Fix experiments, tasks, and MetricsTable mock fallbacks** - `1b73a3e` (fix)
   - 5 files: experiments/page.tsx, tasks/page.tsx, metrics-table.tsx, tasks/index.ts, tasks/mock-data.ts (deleted)
2. **Task 2: Full dashboard and component audit sweep** - No commit (audit only, no fixes needed)

## Decisions Made
- **MetricsTable data prop** — Added `MetricsTableRow[]` interface. Component renders real data when provided, em dashes ("—") when empty. This replaces Math.random() calls that generated different fake numbers on every render.
- **8 standalone components deferred** — SentimentAnalysis, AIHashtagGenerator, AIPersonaManager, AIABTesting, PredictiveAnalytics, RealTimeAnalytics, ROICalculator, WorkflowAutomation all have mock data but are NOT imported by any dashboard page. Deferred to Phase 5+ when backing APIs exist.

## Deviations from Plan

None — plan executed exactly as written.

## Full Audit Table

### Dashboard Pages (`app/dashboard/**/*.tsx`)

| File | Pattern | Classification |
|------|---------|---------------|
| content/page.tsx:153 | `setTimeout(() => setIsLoading(false), 500)` | Acceptable - UI loading delay for retry |
| help/page.tsx:47 | `setTimeout(() => setIsLoading(false), 400)` | Acceptable - UI loading delay for retry |
| patterns/page.tsx:50 | `setTimeout(() => setIsLoading(false), 600)` | Acceptable - UI loading delay for retry |
| schedule/page.tsx:155 | `setTimeout(() => setIsCreating(false), 1000)` | Acceptable - UI feedback for post creation |
| sandbox/page.tsx:114 | `setTimeout(() => setIsLoading(false), 400)` | Acceptable - UI loading delay for retry |

**Zero** `mock`, `Mock`, `MOCK`, `Math.random`, `generateMock`, or `fake` data patterns in any dashboard page.

### Components (`components/**/*.{ts,tsx}`)

| File | Pattern | Classification |
|------|---------|---------------|
| SentimentAnalysis.tsx | `generateMockData()`, 30+ Math.random calls | Deferred - Phase 5+ |
| AIHashtagGenerator.tsx | 12 Math.random calls | Deferred - Phase 5+ |
| AIPersonaManager.tsx | 5 Math.random calls | Deferred - Phase 5+ |
| AIABTesting.tsx | 8 Math.random calls | Deferred - Phase 5+ |
| PredictiveAnalytics.tsx | 4 Math.random calls | Deferred - Phase 5+ |
| RealTimeAnalytics.tsx | 14 Math.random calls | Deferred - Phase 5+ |
| ROICalculator.tsx | 1 Math.random call | Deferred - Phase 5+ |
| WorkflowAutomation.tsx | 2 Math.random calls (node positioning) | Deferred - Phase 5+ |
| marketing/MarketingLayout.tsx | 4 Math.random calls | Acceptable - visual animation |
| visuals/ActivityStreamSVG.tsx | 6 Math.random calls | Acceptable - visual animation |
| visuals/AIRobot.tsx | 7 Math.random calls | Acceptable - visual animation |
| visuals/SocialNetworkSVG.tsx | 5 Math.random calls | Acceptable - visual animation |
| visuals/FloatingPostsSVG.tsx | 1 Math.random call | Acceptable - visual animation |
| skeletons/dashboard-skeletons.tsx | 1 Math.random call | Acceptable - skeleton height |
| ui/skeleton.tsx | 1 Math.random call | Acceptable - skeleton height |
| sandbox/platform-mockups.tsx | PlatformMockup export | Acceptable - UI component, not mock data |

### Barrel Export Check

All `components/*/index.ts` files confirmed clean. No mock arrays re-exported. Only `PlatformMockup` contains "mock" in name — it's a legitimate UI component for preview rendering.

## Verification Results

| Check | Result |
|-------|--------|
| mockExperiments in experiments/page.tsx | 0 matches |
| mockTasks in tasks/page.tsx | 0 matches |
| components/tasks/mock-data.ts deleted | Confirmed |
| Math.random in metrics-table.tsx | 0 matches |
| Named mock imports in components/ and app/dashboard/ | 0 matches |
| Math.random in app/dashboard/**/*.tsx | 0 matches |
| Mock exports in barrel index.ts files | 0 (PlatformMockup is UI component) |
| npx tsc --noEmit | Pass (0 errors) |

## Issues Encountered
None.

## Next Step
Phase 3 complete. Ready for Phase 4: Security Hardening.

---
*Phase: 03-mock-data-dashboard*
*Completed: 2026-02-16*
*Commits: 1b73a3e*
