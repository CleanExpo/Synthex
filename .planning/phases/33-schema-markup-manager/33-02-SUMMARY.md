---
phase: 33-schema-markup-manager
plan: "02"
title: "Schema Markup Manager Hook + Dashboard + Navigation"
subsystem: seo
tags: [schema, json-ld, structured-data, dashboard, hook, navigation]
requires:
  - 33-01 # Schema Markup Service + API routes
provides:
  - useSchemaMarkup React hook with 4 functions
  - Enhanced Schema Markup Manager dashboard with 5-tab interface
  - Updated SEO hub card and command palette entry
affects:
  - hooks/useSchemaMarkup.ts (new)
  - app/dashboard/seo/schema/page.tsx (modified)
  - app/dashboard/seo/page.tsx (modified)
  - components/CommandPalette.tsx (modified)
tech-stack: [Next.js 15, TypeScript, Tailwind, Radix UI, Lucide icons]
key-files:
  - hooks/useSchemaMarkup.ts
  - app/dashboard/seo/schema/page.tsx
key-decisions:
  - Used `generateRichPreview` client-side (no API round-trip) since it is a pure function in schema-markup-service
  - SERPPreviewCard rendered inline in the page rather than as a separate file to avoid splitting small UI logic
  - `Braces` icon was not in the icons barrel; used `Code` and `FileCode` alternatives instead
  - Tab navigation uses state-driven buttons (no Radix Tabs) per plan specification
  - handleTabChange triggers loadTemplates lazily (only on first Templates tab visit)
  - handleTabChange auto-generates SERP preview when switching to SERP tab if schema exists
duration: ~18 minutes
completed: 2026-02-18T00:00:00Z
---

# Phase 33 Plan 02: Schema Markup Manager Hook + Dashboard + Navigation Summary

**Added the useSchemaMarkup hook and rebuilt the schema page as a 5-tab dashboard with validator, extractor, template browser, and SERP preview.**

## Performance

- **Duration**: ~18 minutes
- **Started**: 2026-02-18
- **Completed**: 2026-02-18
- **Tasks**: 2 of 2 completed
- **Files**: 1 created, 3 modified

## Accomplishments

- Created `hooks/useSchemaMarkup.ts` following the exact usePageSpeed pattern (AbortController, mountedRef, useCallback, useEffect cleanup)
- Rebuilt `app/dashboard/seo/schema/page.tsx` from single-tab generator into 5-tab Schema Markup Manager
- Tab 1 (Editor): existing generator functionality preserved, added Validate button + score badge
- Tab 2 (Validator): paste JSON-LD textarea, score display, error/warning list with severity icons, fix suggestions
- Tab 3 (Extractor): URL input, extracted schema cards with type badges, expandable JSON preview, Copy and Edit in Editor actions
- Tab 4 (Templates): category filter bar, lazy-loaded template grid with popularity stars, Use Template action
- Tab 5 (SERP Preview): Google-like preview card per schema type (FAQ dropdowns, Product card with price/rating, Article with date/author, Event with date/location, Generic fallback)
- Updated SEO hub card title and description to reflect full Schema Markup Manager capabilities
- Added `schema-markup-manager` command palette entry with `Code` icon and comprehensive keyword list
- Added `Code` icon import to CommandPalette.tsx
- Type-check: only pre-existing errors in lib/prisma.ts, lib/video/capture-service.ts, and with-turbopack-app/ — zero new errors

## Task Commits

1. `feat(33-02): add useSchemaMarkup hook and enhanced dashboard` (20dd1fe)
2. `feat(33-02): update SEO hub card and command palette for Schema Markup Manager` (b73929e)

## Files Created

- `hooks/useSchemaMarkup.ts` — React hook with validateSchema, extractFromUrl, loadTemplates, generatePreview; AbortController-based cleanup

## Files Modified

- `app/dashboard/seo/schema/page.tsx` — Complete rebuild: 5-tab interface (Editor, Validator, Extractor, Templates, SERP Preview)
- `app/dashboard/seo/page.tsx` — Updated SEOToolCard title and description for Schema Markup Manager
- `components/CommandPalette.tsx` — Added Code import + schema-markup-manager navigation command

## Decisions Made

- Used `generateRichPreview` client-side (pure function) rather than calling an API route — avoids unnecessary network overhead for local computation
- `Braces` was not in the icons barrel; substituted `Code` and `FileCode` which are available and semantically appropriate
- Tab state is plain React state (not Radix Tabs) per plan specification
- Templates are lazy-loaded: only fetched on first visit to Templates tab, then cached in hook state
- SERP preview auto-generates when switching to the SERP tab if a schema is already available

## Deviations from Plan

- `Braces` and `FileCode` were both listed in the plan's icon list; `Braces` is absent from the icons barrel so `Code` was used as a substitute in its place. `FileCode` is available and used in the Validator tab title.
- `SERPPreviewCard` was implemented inline in `page.tsx` rather than as a separate file — the component is tightly coupled to the page's tab state and did not warrant its own file.

## Issues Encountered

- None.

## Next Phase Readiness

Phase 33 Plan 02 complete. Phase 33 (Schema Markup Manager) is fully complete. Ready for Phase 34 (GEO Readiness Dashboard).
