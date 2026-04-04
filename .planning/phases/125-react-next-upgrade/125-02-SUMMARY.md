---
phase: 125-react-next-upgrade
plan: 02
subsystem: dependencies
tags: [upgrade, react, nextjs, react-day-picker, cmdk, testing-library]
requires:
  - phase: 125-01
    provides: react@19, next@16 core framework bump
provides:
  - react-day-picker@9 with migrated calendar.tsx
  - cmdk@1 with React 19 compatibility
  - '@testing-library/react@16 with React 19 support'
  - Full quality gate: 0 type errors, 0 test failures, 0 lint errors
affects: [calendar components, date pickers, command palette, all test files]
tech-stack:
  added: []
  patterns: [react-day-picker v9 Chevron component pattern]
key-files:
  created: []
  modified: [package.json, package-lock.json, components/ui/calendar.tsx]
key-decisions:
  - 'calendar.tsx migrated to react-day-picker v9 Chevron component pattern'
  - 'forwardRef usage preserved — deprecated in React 19 but not removed'
patterns-established:
  - 'react-day-picker v9: use Chevron component with orientation prop instead of IconLeft/IconRight'
issues-created: []
duration: 25min
completed: 2026-03-20
---

# Phase 125 Plan 02: Ecosystem Upgrades + Full Gate Summary

react-day-picker v9 + cmdk v1 + @testing-library/react v16 — all 3 quality gates green.

## Performance

- **Duration:** ~25 min
- **Tasks:** 3
- **Files modified:** 3 (package.json, package-lock.json, components/ui/calendar.tsx)

## Accomplishments

- react-day-picker ^8.10.0 → ^9.14.0: calendar.tsx migrated to v9 ClassNames + Chevron component API. TypeScript went from 1 error (IconLeft unknown) to 0 errors.
- cmdk ^0.2.0 → ^1.1.1: zero source changes required — cmdk v1 API fully compatible with existing command.tsx usage
- @testing-library/react ^14.1.0 → ^16.3.2: React 19 peer dependency resolved, zero test failures
- npm run type-check: 0 errors
- npm test: 1547 passed, 0 failures
- npm run lint: 0 errors (42 warnings — all pre-existing)

## Task Commits

1. **Task 1: Package bumps** - `578cef6e` (chore)
2. **Task 2: calendar.tsx migration** - `57e753de` (feat)
3. **Plan metadata** - pending (docs)

## Files Created/Modified

- `package.json` — 3 ecosystem version bumps (react-day-picker ^8.10.0→^9.14.0, cmdk ^0.2.0→^1.1.1, @testing-library/react ^14.1.0→^16.3.2)
- `package-lock.json` — regenerated (added 4 packages, removed 25 packages, changed 3 packages)
- `components/ui/calendar.tsx` — classNames keys renamed from v8 snake_case to v9 enum string values; IconLeft/IconRight components replaced with single Chevron component using orientation prop; nav_button merged into button_previous/button_next with absolute positioning inline; table→month_grid, head_row→weekdays, head_cell→weekday, row→week, cell→day, day→day_button, day_selected→selected, day_today→today, day_outside→outside, day_disabled→disabled, day_range_end→range_end, day_range_middle→range_middle, day_hidden→hidden, caption→month_caption
- `components/ui/command.tsx` — unchanged — cmdk v1 API compatible with existing usage

## Decisions Made

- Positioned `button_previous` and `button_next` absolute classes directly in the classNames value strings (merged the former `nav_button_previous`/`nav_button_next` absolute positioning into the combined `button_previous`/`button_next` keys) since v9 removes the separate `nav_button` base class
- `showOutsideDays` prop confirmed still present in v9 PropsBase — no rename needed

## Deviations from Plan

None — plan executed as specified. The actual v9 type definitions confirmed the estimated key name mappings were correct.

## Issues Encountered

- Type error was only 1 error: `IconLeft` does not exist in `CustomComponents`. Root cause: v9 replaced `IconLeft`/`IconRight` with a single `Chevron` component using an `orientation` prop. Fixed by reading the actual type definitions before writing the migration.

## Next Phase Readiness

Phase 125 complete. React 19 + Next.js 16 upgrade fully shipped (SYN-407).
v11.0 Tech Foundation Upgrades: 2/N phases done (openai v6 + React/Next.js upgrade).
Remaining backlog: SYN-401 (@auth/prisma-adapter unused), SYN-403 (gsap licence).
