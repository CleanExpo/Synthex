---
phase: 119-deep-audit
plan: '01'
subsystem: testing
tags: [typescript, eslint, jest, npm-audit, security, packages, bundle]

requires: []
provides:
  - '119-01-FINDINGS.md: quality gate sweep, security audit, package hygiene findings'
affects: [119-deep-audit/119-03, phase-120, phase-121]

tech-stack:
  added: []
  patterns: ['Audit-only — no new patterns']

key-files:
  created:
    - '.planning/phases/119-deep-audit/119-01-FINDINGS.md'
  modified: []

key-decisions:
  - 'TypeScript is clean (0 errors) — type-check gate is green'
  - '4 test failures are all in test files (stale mocks/contracts), not source'
  - 'NEXT_PUBLIC_BYPASS_TOKEN needs production verification'
  - 'RLS policies not under version control — verify via Supabase dashboard'

patterns-established: []

issues-created: []

duration: ~22min
completed: 2026-03-17
---

# Phase 119 Plan 01: Framework & Security Audit Summary

**Quality gates: TypeScript PASS / 60 ESLint warnings / 4 critical test failures; 10 moderate npm vulns (devDeps only); NEXT_PUBLIC_BYPASS_TOKEN client-exposure risk flagged; 107 of 131 Prisma models lack version-controlled RLS policies**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-03-17T19:20:00Z
- **Completed:** 2026-03-17T19:42:00Z
- **Tasks:** 3
- **Files modified:** 0 (audit only)

## Accomplishments

- TypeScript gate: PASS — zero type errors across entire codebase
- ESLint gate: 60 warnings (0 errors) — all LOW severity, primarily unused eslint-disable directives
- Test gate: 4 CRITICAL failures — `stripe-routes`, `campaigns`, `onboarding-referrals`, `prisma` test files have stale mocks/contracts
- Security: 10 npm audit findings (all devDependencies, no production CVEs at moderate+)
- `NEXT_PUBLIC_BYPASS_TOKEN` in `.env.example` with `NEXT_PUBLIC_` prefix — must confirm never set in production
- RLS: only 10 of 131 Prisma models have version-controlled SQL policies
- Package hygiene: `openai` is 2 major versions behind; `@remotion/player` (94MB) and `gsap` (6.4MB) are potential bundle risks in client components

## Task Commits

Audit-only plan — no code commits. Findings written to output file only.

## Files Created/Modified

- `.planning/phases/119-deep-audit/119-01-FINDINGS.md` — 48 findings (4 CRITICAL, 5 HIGH, 7 MEDIUM, 32 LOW)

## Decisions Made

- Test failures are in test infrastructure (stale mocks), not source code — categorised as CRITICAL because the test suite cannot validate the core campaign path
- `NEXT_PUBLIC_` prefix on bypass token is a design smell but needs production env verification before escalating to CRITICAL

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- `.next-turbo/` absent from `eslint.config.js` ignores would cause linting of build artifacts; ran lint against source directories only to get clean signal
- `npm outdated` took longer than expected due to registry lookups

## Next Phase Readiness

- `119-01-FINDINGS.md` is complete and ready to be merged into `119-FINDINGS.md` by plan 119-03
- No blockers

---

_Phase: 119-deep-audit_
_Completed: 2026-03-17_
