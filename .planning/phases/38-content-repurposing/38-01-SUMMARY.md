---
phase: 38-content-repurposing
plan: 01
subsystem: ai
tags: [content-repurposing, ai, threads, video-script, carousel, summary]

# Dependency graph
requires:
  - phase: 21-multi-format-generation
    provides: MultiFormatAdapter pattern, Promise.allSettled, ContentScorer integration
provides:
  - ContentRepurposer service for long-form to short-form transformation
  - POST /api/content/repurpose endpoint with 6 output formats
  - Two-phase dashboard UI with format selection
affects: [brand-voice-engine, cross-posting-automation]

# Tech tracking
tech-stack:
  added: []
  patterns: [long-to-short content transformation, multi-format parallel generation]

key-files:
  created:
    - lib/ai/content-repurposer.ts
    - app/api/content/repurpose/route.ts
    - app/dashboard/content/repurpose/page.tsx
    - app/dashboard/content/repurpose/loading.tsx
    - app/dashboard/content/repurpose/error.tsx
  modified:
    - app/dashboard/layout.tsx
    - components/CommandPalette.tsx

key-decisions:
  - "6 output formats: thread, video_script, carousel_outline, key_takeaways, summary, quote_graphics"
  - "Source types: blog, article, video_transcript, podcast, newsletter"
  - "Two-phase UI pattern matching multi-format generation for consistency"

patterns-established:
  - "Long-form to short-form transformation with format-specific system prompts"
  - "Source type awareness for context-appropriate generation"

issues-created: []

# Metrics
duration: 6min
completed: 2026-02-18
---

# Phase 38 Plan 01: Content Repurposing Summary

**ContentRepurposer service with 6 output formats (thread, video script, carousel, takeaways, summary, quotes) transforming long-form content into short-form derivatives**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-18
- **Completed:** 2026-02-18
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- ContentRepurposer class with `repurpose()` method supporting 5 source types
- System prompts for 6 output formats with format-specific structure
- Parallel generation via Promise.allSettled with ContentScorer integration
- POST /api/content/repurpose with Zod validation (100-50000 chars)
- Two-phase dashboard UI (input form → results grid)
- Sidebar navigation with Repeat icon
- Command palette integration with keywords

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ContentRepurposer service and API endpoint** - `c602777` (feat)
2. **Task 2: Create dashboard page and navigation integration** - `bc81cf4` (feat)

## Files Created/Modified

- `lib/ai/content-repurposer.ts` - ContentRepurposer class with 6 format system prompts, parallel generation, scoring
- `app/api/content/repurpose/route.ts` - POST endpoint with withAuth, Zod validation
- `app/dashboard/content/repurpose/page.tsx` - Two-phase UI with textarea, source type dropdown, format checkboxes, result cards
- `app/dashboard/content/repurpose/loading.tsx` - Animate-pulse skeleton with glassmorphic styling
- `app/dashboard/content/repurpose/error.tsx` - Error boundary using DashboardError
- `app/dashboard/layout.tsx` - Added Repeat icon import and sidebar entry
- `components/CommandPalette.tsx` - Added repurpose command with keywords

## Decisions Made

- Used 6 output formats covering major short-form content types
- Kept source type enum to 5 common long-form types
- Followed two-phase UI pattern from multi-format for consistency
- Used existing contentScorer for quality scoring

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- Phase 38 complete
- Ready for Phase 39: Brand Voice Engine

---
*Phase: 38-content-repurposing*
*Completed: 2026-02-18*
