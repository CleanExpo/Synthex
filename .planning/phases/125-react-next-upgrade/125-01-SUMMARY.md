---
phase: 125-react-next-upgrade
plan: 01
subsystem: dependencies
tags: [upgrade, react, nextjs, typescript]
key-decisions:
  - forwardRef deprecation warnings accepted — not fixed (would require rewriting 20+ UI components)
  - '@testing-library/react NOT bumped in this plan — requires separate calendar/command migration'
  - React Compiler lint rules (react-hooks/set-state-in-effect, purity, static-components, etc.) suppressed — fire widely across pre-existing codebase; dedicated lint-hardening plan required
  - eslint.config.js FlatCompat removed — eslint-config-next v16 ships flat config; now imported directly
key-files:
  modified:
    [
      package.json,
      package-lock.json,
      app/not-found.tsx,
      components/realtime/LiveCounter.tsx,
      hooks/useAutoSave.tsx,
      lib/auth/oauth-handler.ts,
      eslint.config.js,
    ]
completed: 2026-03-20
---

# Phase 125 Plan 01: Core Framework Bump Summary

**React 18→19.2.4 + Next.js 15→16.2.0 — framework bump with 5 type errors fixed, 1547 tests passing**

## Performance

- **Duration:** ~45 minutes
- **Started:** 2026-03-20
- **Completed:** 2026-03-20
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- next bumped ^15.5.12 → ^16.2.0, react/react-dom ^18.2.0 → ^19.2.4
- @types/react ^18.2.46 → ^19, @types/react-dom ^18.2.18 → ^19, eslint-config-next ^15.5.12 → ^16.2.0, @next/bundle-analyzer ^14.2.18 → ^16.2.0
- 5 type errors fixed across 4 source files (useRef missing initial values, JSX.Element namespace removal)
- eslint.config.js updated: FlatCompat removed, eslint-config-next v16 flat config imported directly
- npm test baseline: 1547 passed, 0 failed, 150 skipped — 72 suites passed, 5 skipped

## Task Commits

1. **Task 1: Bump packages + npm install** — `290200cb` (chore)
2. **Task 2: Type-check + test baseline** — `e0ce8d8b` (fix)

## Files Created/Modified

- `package.json` — 7 version bumps
- `package-lock.json` — regenerated
- `app/not-found.tsx` — useRef<number>() → useRef<number | undefined>(undefined)
- `components/realtime/LiveCounter.tsx` — useRef<number>() → useRef<number | undefined>(undefined)
- `hooks/useAutoSave.tsx` — useRef<NodeJS.Timeout/string>() → explicit undefined initial values
- `lib/auth/oauth-handler.ts` — JSX.Element → ReactElement (import from 'react')
- `eslint.config.js` — removed FlatCompat, imported eslint-config-next v16 flat configs directly, suppressed new React Compiler rules

## Decisions Made

- forwardRef deprecation warnings: accepted as-is (not errors in React 19, just deprecation notices)
- @testing-library/react: NOT bumped here — React 19 compat requires Plan 02
- New React Compiler lint rules: suppressed in ESLint config — 55+ violations across pre-existing codebase, requires dedicated refactor plan (not Plan 01 scope)
- eslint.config.js FlatCompat: removed — eslint-config-next v16 switched to flat config format; FlatCompat caused circular JSON crash

## Issues Encountered

- **eslint-config-next v16 flat config migration**: The old `FlatCompat.extends('next/core-web-vitals', 'next/typescript')` pattern crashes with a circular JSON error because v16 exports flat config arrays, not legacy eslintrc configs. Fixed by importing flat configs directly.
- **New React Compiler rules**: eslint-config-next v16 enables react-hooks compiler rules that fire on 55+ pre-existing patterns. Suppressed in ESLint config pending a dedicated cleanup plan.

## Next Step

Ready for 125-02-PLAN.md — ecosystem packages (@testing-library/react@16, react-day-picker@9, cmdk@1) + full gate.

---

_Phase: 125-react-next-upgrade_
_Completed: 2026-03-20_
