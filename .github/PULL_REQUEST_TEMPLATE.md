<!--
Root PR template. Directory-based templates under .github/PULL_REQUEST_TEMPLATE/
remain available via ?template=<name>.md query string.
-->

## Summary

<!-- One or two sentences on what this PR changes and why. -->

## Linked issue

<!-- e.g. Closes SYN-724 -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor / tech debt
- [ ] Docs / infrastructure

## CVML — Client Value Measurement Layer (SYN-724 / Session 34)

- [ ] All new client-value features emit the 6 CVML events through `emit()` wrapper (`lib/measurement/emit.ts`)
- [ ] Any retrofit of a shipped client-value feature (SYN-726) adds an additive `emit()` call without removing existing emissions
- [ ] No PII in `ClientValueEvent.metadata` (emails / URLs / business names hashed or omitted)

## Quality checklist

- [ ] Unit tests pass locally (`npm run test`)
- [ ] TypeScript strict mode compiles (`npm run typecheck`)
- [ ] Lint clean (`npm run lint`)
- [ ] Auth coverage test (SYN-609) still green if new API routes added
- [ ] JSON-LD schema validator (SYN-557/558/559) still green if generated content touched
- [ ] No Supabase schema changes snuck into a TypeScript-only PR (schema changes belong in dedicated migration PRs)

## Screenshots / recordings

<!-- Optional — paste any UI screenshots or CLI output. -->

## Notes for reviewer

<!-- Context the diff won't convey — design trade-offs, follow-ups, etc. -->
