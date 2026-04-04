---
phase: 17-ui-features
plan: 01
status: complete
subsystem: ui
tags: [navigation, sidebar, command-palette, discoverability, dropdown]
key-files: [app/dashboard/layout.tsx, components/CommandPalette.tsx]
affects: [feature-discovery, user-navigation]
---

# Plan 17-01: Add Missing Navigation Items

**Sidebar now includes Reports and Experiments; user dropdown has Billing; CommandPalette expanded from 10 to 17 commands**

## Performance

- **Duration:** ~8 min
- **Tasks:** 3/3
- **Files modified:** 2

## Accomplishments

- Added Reports and Experiments links to sidebar navigation (after Analytics)
- Added Billing link to user avatar dropdown menu
- Expanded CommandPalette with 7 new navigation commands
- Improved feature discoverability for hidden pages

## Task Commits

1. **Task 1: Add Reports and Experiments to sidebar** - `534b178` (feat)
2. **Task 2: Add Billing to user dropdown** - `0292ddd` (feat)
3. **Task 3: Expand CommandPalette commands** - `7dd2025` (refactor)

## Files Created/Modified

| Type | File | Purpose |
|------|------|---------|
| Modified | app/dashboard/layout.tsx | Added sidebar items + dropdown Billing link |
| Modified | components/CommandPalette.tsx | Added 7 new navigation commands |

## New Navigation Items

### Sidebar (22 items now, was 20)
- Reports (after Analytics)
- Experiments (after Reports)

### User Dropdown
- Billing (after Settings, before Sign Out)

### CommandPalette (17 commands now, was 10)
New commands:
- Reports - Generate performance reports
- Experiments - A/B testing and optimization
- Personas - AI brand voice personas
- Competitors - Track competitor activity
- Team - Manage team members
- Billing - Manage subscription and payments
- Help & Support - Get help and documentation

## Decisions Made

- Used `File` icon for Reports (FileSpreadsheet not in icon library)
- Placed Reports/Experiments after Analytics in sidebar (grouped with data/insights features)
- Billing placed in user dropdown (account-related) rather than sidebar

## Deviations from Plan

**1. [Rule 3 - Blocking] Changed icon from FileSpreadsheet to File**
- **Found during:** Verification (type-check)
- **Issue:** FileSpreadsheet icon doesn't exist in the icon library
- **Fix:** Used File icon from @heroicons/react (already exported)
- **Files modified:** app/dashboard/layout.tsx, components/CommandPalette.tsx
- **Verification:** Type-check passes

## Issues Encountered

None.

## Next Step

Ready for Plan 17-02: Enhance Feature Discoverability (expand ProductTour, add KeyboardHints)

---
*Phase: 17-ui-features*
*Completed: 2026-02-17*
