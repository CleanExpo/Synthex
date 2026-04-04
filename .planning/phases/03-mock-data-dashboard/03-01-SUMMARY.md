---
phase: 03-mock-data-dashboard
plan: 01
subsystem: ui
tags: [dashboard, mock-removal, error-states, empty-states, config-cleanup, analytics, settings, billing]

requires:
  - phase: 02-mock-data-api
    provides: All API routes return real data or proper error — zero mock fallbacks in backend

provides:
  - Zero mock data arrays in 7 config files (schedule, team, personas, admin, analytics, dashboard, settings)
  - 8 dashboard pages show error states on API failure (not fake data)
  - 8 dashboard pages show empty states with CTAs on empty data
  - 4 dashboard tab components show empty states instead of mock data
  - Analytics transform functions return empty arrays on missing API data
  - Settings page uses API call for key creation (not Math.random)

affects: [03-02, 10-01]

tech-stack:
  added: []
  patterns: [dashboard-error-empty-state-pattern, api-error-card-with-retry, empty-state-with-cta]

key-files:
  created: []
  modified:
    - components/schedule/schedule-config.ts
    - components/team/team-config.ts
    - components/personas/personas-config.ts
    - components/admin/admin-config.ts
    - components/analytics/analytics-config.ts
    - components/dashboard/dashboard-config.ts
    - components/settings/settings-config.ts
    - components/dashboard/tabs/team-tab.tsx
    - components/dashboard/tabs/scheduler-tab.tsx
    - components/dashboard/tabs/analytics-tab.tsx
    - components/dashboard/tabs/ai-studio-tab.tsx
    - app/dashboard/schedule/page.tsx
    - app/dashboard/team/page.tsx
    - app/dashboard/personas/page.tsx
    - app/dashboard/admin/page.tsx
    - app/dashboard/analytics/page.tsx
    - app/dashboard/settings/page.tsx
    - app/dashboard/billing/page.tsx
    - app/dashboard/page.tsx

key-decisions:
  - "Dashboard empty state pattern: inline EmptyState component with icon, message, and CTA button"
  - "Settings API key creation calls /api/user/api-keys endpoint, shows error if unavailable"
  - "Analytics fallback numbers replaced with 0 (not null) — charts render correctly with zeros"
  - "Billing page gets explicit error state UI with retry button"

patterns-established:
  - "Dashboard pages follow Loading → Error → Empty → Data rendering pattern"
  - "Empty states include actionable CTA buttons (Create Post, Invite Member, etc.)"
  - "Config files contain only configuration constants, never sample/mock data"

issues-created: []

duration: ~14 min
completed: 2026-02-16
---

# Phase 3 Plan 01: Config Cleanup + Page Fallbacks Summary

**Removed all mock data arrays from 7 config files and replaced silent mock fallbacks in 8 dashboard pages + 4 tab components with proper error/empty states using APIErrorCard and inline EmptyState components.**

## Performance
- Task 1: ~7 min
- Task 2: ~7 min
- Total: ~14 min
- Tasks: 2/2 completed
- Files modified: 19

## Accomplishments
- 7 config files cleaned of all mock data arrays (mockScheduledPosts, mockTeamMembers, mockActivityLog, mockPersonas, mockUsers, engagementData, platformDistribution, contentPerformance, growthData, topPosts, mockAIGenerations, mockScheduledPosts, platformBreakdown, mockApiKeys, mockInvoices)
- 8 dashboard pages now show proper error states on API failure instead of silently falling back to fake data
- 8 dashboard pages show empty states with actionable CTAs when data is legitimately empty
- 4 dashboard tab components (team-tab, scheduler-tab, analytics-tab, ai-studio-tab) fixed to show empty states instead of importing removed mock arrays
- Analytics transform functions (transformPlatformData, transformChartData) return empty arrays instead of mock data fallbacks
- Settings page API key creation uses real API call instead of Math.random().toString(36)
- Billing page surfaces errors to users instead of silently keeping defaults
- Main dashboard no longer falls back to hardcoded trending topics

## Task Commits

1. **Task 1: Remove mock arrays from config files and fix schedule/team/personas/admin fallbacks** - `93d8670` (fix)
   - 4 config files: removed mockScheduledPosts, mockTeamMembers, mockActivityLog, mockPersonas, mockUsers
   - 4 dashboard pages: schedule, team, personas, admin — all show error/empty states
2. **Task 2: Remove analytics/dashboard/settings mocks and fix remaining page fallbacks** - `6eb5738` (fix)
   - 3 config files: removed 5 analytics arrays, 4 dashboard arrays, mockApiKeys, mockInvoices
   - 4 dashboard tab components: fixed broken imports from removed mock arrays
   - 4 dashboard pages: analytics, settings, billing, main dashboard — all show error/empty states

## Decisions Made
- **Dashboard empty state pattern** — Used inline EmptyState component with icon, descriptive message, and CTA button (e.g., "No posts scheduled yet. Create your first post to get started." with "Create Post" button)
- **Settings API key creation** — Replaced Math.random().toString(36) with proper API call to `/api/user/api-keys`. Shows toast error "API key management not yet available." if endpoint doesn't exist.
- **Analytics fallback numbers** — Replaced hardcoded numbers (reach: 2400000, engagement: 184500, etc.) with `0` rather than `null`. Charts render correctly with zeros; null would require additional null-checking throughout.
- **Billing error state** — Added explicit error state UI with AlertCircle icon and retry button. Previous implementation silently kept default billing info on fetch failure.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Dashboard tab components imported removed mock arrays**
- **Found during:** Task 2
- **Issue:** 4 dashboard tab components (team-tab.tsx, scheduler-tab.tsx, analytics-tab.tsx, ai-studio-tab.tsx) imported mock arrays from dashboard-config.ts that were being removed. TypeScript compilation would fail.
- **Fix:** Replaced mock data rendering in each tab with empty state messages
- **Files modified:** components/dashboard/tabs/team-tab.tsx, scheduler-tab.tsx, analytics-tab.tsx, ai-studio-tab.tsx
- **Committed in:** 6eb5738

---

**Total deviations:** 1 auto-fixed (blocking — 4 additional files needed), 0 deferred
**Impact on plan:** Necessary for TypeScript compilation. No scope creep — same pattern applied.

## Verification Results

| Check | Result |
|-------|--------|
| Grep for mockPersonas/mockTeamMembers/mockScheduledPosts/mockUsers/mockApiKeys/mockInvoices/mockAIGenerations/mockActivityLog | 0 matches |
| Grep analytics-config.ts for engagementData/platformDistribution/contentPerformance/growthData/topPosts | 0 matches |
| Grep app/dashboard/ for Math.random | 0 matches |
| npx tsc --noEmit | Pass (0 errors) |

## Issues Encountered
None.

## Next Step
Ready for 03-02-PLAN.md (Fix experiments, tasks, MetricsTable + full dashboard audit)

---
*Phase: 03-mock-data-dashboard*
*Completed: 2026-02-16*
*Commits: 93d8670, 6eb5738*
