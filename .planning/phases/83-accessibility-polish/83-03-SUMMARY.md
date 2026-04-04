---
phase: 83-accessibility-polish
plan: "03"
subsystem: ui
tags: [accessibility, wcag, keyboard, aria, playwright, e2e]

# Dependency graph
requires:
  - phase: 83-accessibility-polish
    provides: 83-01 skip links/axe baseline, 83-02 form label/focus polish
provides:
  - Collapsed sidebar group icons keyboard-accessible via Link elements
  - Show More/Less button aria-expanded state and descriptive aria-label
  - Focus-visible ring on both collapsed sidebar links and Show More button
  - Five new E2E accessibility test groups covering dashboard landmarks, sidebar nav, table rows, focus indicators, loading states
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Collapsed sidebar nav icons rendered as <Link> with aria-label + href pointing to group.items[0]"
    - "Toggle buttons receive aria-expanded={booleanState} for screen reader state communication"
    - "E2E dashboard auth tests use conditional test.skip when TEST_USER_EMAIL/PASSWORD unset"

key-files:
  created: []
  modified:
    - app/dashboard/layout.tsx
    - tests/e2e/accessibility.spec.ts

key-decisions:
  - "Collapsed group icon links point to group.items[0].href (first item in group) as most logical nav target"
  - "Dashboard E2E tests skip gracefully rather than hard-fail when test credentials are absent"
  - "Show More button aria-label is dynamic: 'Show fewer navigation sections' vs 'Show all navigation sections'"

patterns-established:
  - "Collapsed sidebar icons: <Link href={group.items[0]?.href ?? '/dashboard'} aria-label={group.label}>"
  - "Toggle button pattern: aria-expanded={boolState} + aria-label that describes both states"

issues-created: []

# Metrics
duration: 12min
completed: 2026-03-10
---

# Phase 83 Plan 03: Dashboard Layout Landmark, Collapsed Sidebar Keyboard Support, E2E Accessibility Test Expansion

**Collapsed sidebar `<div>` icons replaced with keyboard-accessible `<Link>` elements, Show More/Less button receives `aria-expanded`, and five new Playwright test groups added covering dashboard WCAG landmarks, sidebar nav, table rows, focus rings, and loading states**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-10T00:00:00Z
- **Completed:** 2026-03-10T00:12:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Replaced non-focusable `<div>` collapsed sidebar group icons with `<Link>` elements (WCAG 2.1.1 Keyboard, 2.4.3 Focus Order)
- Added `aria-expanded={showAllGroups}` and descriptive `aria-label` to Show More/Less toggle button (WCAG 4.1.2 Name, Role, Value)
- Added `focus-visible:ring-2 focus-visible:ring-cyan-500` to both collapsed sidebar links and the Show More button
- Expanded `tests/e2e/accessibility.spec.ts` with 5 new test groups (Dashboard Landmark Structure, Sidebar Navigation Accessibility, Interactive Table Row Keyboard Access, Focus Visible Indicator, Loading State Accessibility)
- All 5 new test groups use conditional `test.skip` when auth credentials absent — no hard failures in CI without creds

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix collapsed sidebar keyboard access and aria-expanded** - `f5c84fcc` (fix)
2. **Task 2: Expand E2E accessibility test suite with dashboard tests** - `206371af` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `app/dashboard/layout.tsx` — Collapsed sidebar `<div>` → `<Link>` with `aria-label`/`href`; Show More button gains `aria-expanded` + `aria-label` + focus ring
- `tests/e2e/accessibility.spec.ts` — Added 5 new test groups: Dashboard Landmark Structure, Sidebar Navigation Accessibility, Interactive Table Row Keyboard Access, Focus Visible Indicator, Loading State Accessibility

## Decisions Made

- Collapsed group icon links navigate to `group.items[0]?.href ?? '/dashboard'` — the first item in each group is the most logical keyboard navigation target when the sidebar is collapsed
- Dashboard E2E tests conditionally skip (`test.skip`) rather than hard-fail when `TEST_USER_EMAIL`/`TEST_USER_PASSWORD` env vars are absent — this avoids CI failures in environments without test credentials
- `aria-label` on Show More button is dynamic, describing both expanded and collapsed states explicitly

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- Phase 83 (Accessibility & Polish) is complete — all 3 plans (83-01, 83-02, 83-03) done
- Full verification: `npm run type-check` passes (0 errors), `npm run lint` passes (no new warnings), `npm test` 1496 passing / 32 pre-existing failures (no regressions)
- Ready for Phase 84: Final UAT & Launch

---
*Phase: 83-accessibility-polish*
*Completed: 2026-03-10*
