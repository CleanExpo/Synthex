---
phase: 111-cwv-caching
plan: 01
subsystem: performance
tags: [cwv, caching, isr, sendbeacon, preconnect, vercel-cdn]

# Dependency graph
requires:
  - phase: 110
    provides: bundle optimisation and query performance baseline
provides:
  - Landing page CDN-cacheable at Vercel edge (s-maxage=3600)
  - Accurate individual web vitals reporting via sendBeacon
  - Font preconnect HTTP headers on all responses
affects: [113-security-sweep, deployment]

# Tech tracking
tech-stack:
  added: []
  patterns: [sendBeacon for fire-and-forget analytics, ISR revalidation on landing page]

key-files:
  created: []
  modified: [app/layout.tsx, app/page.tsx, vercel.json, lib/performance.ts, next.config.mjs]

key-decisions:
  - "Dashboard layout is 'use client' — route segment config cannot be added; dashboard pages are inherently dynamic via auth/cookies so no config needed"
  - "sendBeacon preferred over fetch for web vitals — survives page unload"

patterns-established:
  - "ISR pattern: export const revalidate = 3600 on static server pages"
  - "Individual metric reporting over batched zeroed-object pattern"

issues-created: []

# Metrics
duration: 4min
completed: 2026-03-12
---

# Phase 111 Plan 01: Core Web Vitals & Caching Summary

**Removed incorrect force-dynamic from root layout (unblocking CDN caching for entire site), added ISR to landing page, fixed broken web vitals accumulation, added sendBeacon + font preconnect headers**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-11T20:29:05Z
- **Completed:** 2026-03-11T20:32:42Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Removed force-dynamic + revalidate=0 from root layout — was incorrectly blocking CDN caching for the entire site despite zero dynamic calls
- Landing page now ISR-enabled (revalidate=3600) with s-maxage=3600 CDN header in vercel.json
- Fixed collectWebVitals bug: was sending 5 zeroes + 1 real value per call — now sends individual metric with rating and metricId
- Switched to sendBeacon for fire-and-forget vitals reporting (works during page unload)
- Added Link preconnect header for Google Fonts on all responses via next.config.mjs

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix route segment config** - `be13523c` (perf)
2. **Task 2: Fix collectWebVitals bug and add resource hints** - `0c813d6e` (fix)

## Files Created/Modified
- `app/layout.tsx` - Removed force-dynamic + revalidate=0 (root layout has zero dynamic calls)
- `app/page.tsx` - Added revalidate=3600 for ISR
- `vercel.json` - Added s-maxage=3600 CDN header for landing page
- `lib/performance.ts` - Replaced broken accumulation with individual metric reporting via sendBeacon
- `next.config.mjs` - Added Link preconnect header for Google Fonts

## Decisions Made
- Dashboard layout (`app/dashboard/layout.tsx`) is `'use client'` — route segment config can't be added to client components. Not needed anyway: dashboard pages are inherently dynamic via auth/cookies, so Next.js auto-detects them as dynamic.
- sendBeacon preferred over fetch for web vitals — fire-and-forget, survives page unload events.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Dashboard layout is 'use client' — cannot add route segment config**
- **Found during:** Task 1 (route segment config)
- **Issue:** Plan specified adding `force-dynamic` to `app/dashboard/layout.tsx`, but it has `'use client'` directive — route segment config only works in server components
- **Fix:** Skipped this step — dashboard pages are inherently dynamic (use auth/cookies) so Next.js renders them dynamically without explicit config
- **Verification:** Type-check passes, no functional change to dashboard behaviour

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minimal — dashboard was already dynamic by nature. No scope creep.

## Issues Encountered
None

## Next Phase Readiness
- CDN caching now active for landing page
- Web vitals data will be accurate going forward
- Ready for Phase 112: NEXUS Agent Dispatch Deduplication

---
*Phase: 111-cwv-caching*
*Completed: 2026-03-12*
