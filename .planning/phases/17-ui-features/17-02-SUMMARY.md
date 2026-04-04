---
phase: 17-ui-features
plan: 02
status: complete
subsystem: ui
tags: [product-tour, feature-spotlight, keyboard-shortcuts, ux]
key-files: [components/ProductTour.tsx, components/dashboard/keyboard-hints.tsx]
affects: [dashboard experience, user onboarding]
---

# Plan 17-02: Enhance Feature Discoverability

**ProductTour expanded to 12 steps, KeyboardHints component shows shortcuts on first visit**

## Performance

- **Duration:** ~6 min
- **Tasks:** 4/4
- **Files modified:** 3
- **Files created:** 1

## Accomplishments

- Expanded ProductTour from 7 to 12 steps (added personas, reports, experiments, seo, video)
- Created KeyboardHints component for first-time shortcut discovery
- Integrated KeyboardHints into dashboard layout
- Added KeyboardHints to dashboard barrel exports

## Task Commits

1. **Task 1: Expand ProductTour with additional steps** - `fec886d` (feat)
2. **Task 2: Create KeyboardHints component** - `ecb9d98` (feat)
3. **Task 3: Add KeyboardHints to dashboard layout** - `87d7d66` (feat)
4. **Task 4: Update dashboard barrel exports** - `c37e804` (refactor)

## Files Created/Modified

| Type | File | Purpose |
|------|------|---------|
| Modified | components/ProductTour.tsx | Added 5 new tour steps |
| Created | components/dashboard/keyboard-hints.tsx | Keyboard hints for first-time users |
| Modified | app/dashboard/layout.tsx | Integrated KeyboardHints component |
| Modified | components/dashboard/index.ts | Added KeyboardHints export |

## New ProductTour Steps (12 total)

Order: welcome -> dashboard -> content-generator -> **personas** -> command-palette -> analytics -> **reports** -> **experiments** -> schedule -> **seo** -> **video** -> complete

New steps added (bold above):
- Personas: "Create AI personas that capture your brand voice"
- Reports: "Create detailed performance reports for your campaigns"
- Experiments: "Run experiments to optimize your content"
- SEO: "Optimize content for search engines and AI-powered search"
- Video: "Generate and edit videos optimized for social media"

## KeyboardHints Component

- Appears 3 seconds after first dashboard visit
- Shows shortcuts: Cmd+K (command palette), ? (help)
- Persists dismissal to localStorage
- Glassmorphic styling matching dashboard design
- Uses Command icon (Keyboard not available in icon library)

## Decisions Made

- Used `Command` icon instead of `Keyboard` (not in icon library)
- Positioned KeyboardHints in bottom-right corner (z-40)
- 3-second delay before showing hints (not intrusive)

## Deviations from Plan

**1. [No deviation] Used Command icon instead of Keyboard**
- **Found during:** Icon library check
- **Issue:** Keyboard icon doesn't exist in @/components/icons
- **Fix:** Used Command icon from @heroicons/react (semantically appropriate)
- **Files affected:** components/dashboard/keyboard-hints.tsx

## Issues Encountered

None.

## Next Step

Ready for Plan 17-03: Enhance Onboarding Flow (tour integration, completion page improvements)

---
*Phase: 17-ui-features*
*Completed: 2026-02-17*
