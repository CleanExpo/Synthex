---
phase: 32-pagespeed-integration
plan: "01"
title: "PageSpeed Integration"
subsystem: seo
tags: [pagespeed, lighthouse, cwv, performance, api, dashboard]
requires:
  - 30-01 # Technical SEO Dashboard (established patterns, SEOAudit model)
  - 31-01 # Search Console Integration (hook/page patterns, navigation patterns)
provides:
  - PageSpeed Insights service with PSI v5 API integration
  - 3 API routes (analyze, history, trends)
  - usePageSpeed React hook
  - PageSpeed dashboard page with analysis, trends, and history
  - SEO hub card and command palette navigation
affects:
  - lib/seo/pagespeed-service.ts (new)
  - app/api/seo/pagespeed/* (new, 3 routes)
  - hooks/usePageSpeed.ts (new)
  - app/dashboard/seo/pagespeed/page.tsx (new)
  - app/dashboard/seo/page.tsx (modified)
  - components/CommandPalette.tsx (modified)
tech-stack: [Next.js 15, TypeScript, Prisma, Recharts, Zod, PageSpeed Insights API v5]
key-files:
  - lib/seo/pagespeed-service.ts
  - app/api/seo/pagespeed/analyze/route.ts
  - app/api/seo/pagespeed/history/route.ts
  - app/api/seo/pagespeed/trends/route.ts
  - hooks/usePageSpeed.ts
  - app/dashboard/seo/pagespeed/page.tsx
key-decisions:
  - Separate service from technical-seo-service.ts (expanded PSI data extraction)
  - Demo data fallback when API key not set (consistent with search-console pattern)
  - Field metrics preferred over lab when available (CrUX over Lighthouse)
  - SEOAudit records with auditType 'pagespeed' for storage isolation
  - Dual Y-axis trend chart (score left, seconds right)
duration: ~12 minutes
completed: 2026-02-18T16:42:00Z
---

# Phase 32 Plan 01: PageSpeed Integration Summary

**Built PageSpeed Insights integration with on-demand URL analysis, Lighthouse category scores, field/lab CWV data, opportunity and diagnostic extraction, historical trend tracking, and a glassmorphic dashboard page with Recharts visualizations.**

## Performance

- **Duration**: ~12 minutes
- **Started**: 2026-02-18T16:29:48Z
- **Completed**: 2026-02-18T16:42:00Z
- **Tasks**: 3 of 3 completed
- **Files**: 6 created, 2 modified

## Accomplishments

- Created `pagespeed-service.ts` with three exported functions: `runPageSpeedAnalysis`, `getPageSpeedHistory`, `getPerformanceTrends`
- Integrated with PageSpeed Insights API v5, extracting Lighthouse category scores (performance, SEO, accessibility, best-practices), field CrUX metrics, lab Lighthouse metrics, top 5 opportunities with savings, and top 5 diagnostics
- Built demo data fallback with `isDemo` flag when API key unavailable or API fails
- Created 3 API routes following established security patterns: POST `/api/seo/pagespeed/analyze`, GET `/api/seo/pagespeed/history`, GET `/api/seo/pagespeed/trends`
- Created `usePageSpeed` hook following `useSearchConsole` pattern (raw fetch + useState + useCallback + AbortController + cleanup)
- Built full dashboard page at `/dashboard/seo/pagespeed` with URL analysis form, mobile/desktop strategy toggle, score gauges with color coding, CWV metric cards with good/needs-work/poor thresholds, opportunities and diagnostics lists, Recharts LineChart with dual Y-axis for trends, and analysis history table
- Added PageSpeed Insights card to SEO hub page between Search Console and Page Analysis
- Added command palette entry with comprehensive keywords

## Task Commits

1. `feat(32-01): add PageSpeed service and API routes` (35871d0)
2. `feat(32-01): add usePageSpeed hook and dashboard page` (be13cba)
3. `feat(32-01): add PageSpeed navigation entries` (e8020c9)
4. `fix(32-01): fix TypeScript strict type errors in pagespeed-service` (989f715)

## Files Created

- `lib/seo/pagespeed-service.ts` - PageSpeed service with 3 functions, 7 exported types, demo data fallback
- `app/api/seo/pagespeed/analyze/route.ts` - POST route for on-demand analysis with Zod validation
- `app/api/seo/pagespeed/history/route.ts` - GET route for analysis history from SEOAudit records
- `app/api/seo/pagespeed/trends/route.ts` - GET route for daily average performance trends
- `hooks/usePageSpeed.ts` - React hook with analysis, history, and trends state management
- `app/dashboard/seo/pagespeed/page.tsx` - Full dashboard page with glassmorphic styling

## Files Modified

- `app/dashboard/seo/page.tsx` - Added PageSpeed Insights SEOToolCard
- `components/CommandPalette.tsx` - Added pagespeed-insights command entry

## Decisions Made

1. **Separate service from technical-seo-service.ts**: The existing `fetchPageSpeedData` is a private helper for mobile parity comparison. The new service extracts significantly more data (opportunities, diagnostics, field vs lab distinction) and warrants its own module.
2. **Demo data fallback**: Consistent with the search-console service pattern. When `GOOGLE_PAGESPEED_API_KEY` is not set or API fails, returns realistic demo data with `isDemo: true` flag.
3. **Field metrics preferred over lab**: Dashboard shows field (CrUX) data when available, falling back to lab (Lighthouse) data, with source labels shown to the user.
4. **auditType 'pagespeed'**: Uses SEOAudit model with `auditType: 'pagespeed'` to isolate PageSpeed records from other audit types (full, page, geo, eeat).
5. **Dual Y-axis trend chart**: Left axis for performance score (0-100), right axis for LCP in seconds and CLS, providing meaningful scale for all metrics.

## Deviations from Plan

- Added a 4th fix commit to resolve TypeScript strict type errors with `Object.values()` returning `unknown[]` when iterating Lighthouse audit entries. Cast to `Record<string, unknown>[]` for type safety.
- Pre-existing lint command failure (Next.js 15 ESLint migration issue) prevents lint validation, but this is unrelated to our changes.
- Pre-existing TypeScript errors in `lib/prisma.ts` (Prisma driver adapter types) and `lib/video/capture-service.ts` (missing puppeteer module) are not related to this phase.

## Issues Encountered

- `Object.values(audits)` returns `unknown[]` in strict TypeScript when `audits` comes from parsed JSON. Fixed by casting the array to `Record<string, unknown>[]` before filtering and sorting.

## Next Phase Readiness

Phase 32 Plan 01 complete. All PageSpeed Insights functionality is in place. Ready for Phase 33 (Schema Markup Manager) or additional Phase 32 plans if needed.
