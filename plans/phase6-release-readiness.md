# Phase 6: Release Readiness
Status: Planned
Owner: Release Conductor
Updated: 2026-01-16

## Goals
- Clear build, lint, and type checks
- Validate auth and critical user flows
- Confirm environment parity for production

## Checklist
- [x] Run `npm run type-check`
- [x] Run `npm run lint`
- [x] Run `npm run test`
- [ ] Run `npm run build`
- [ ] Run `npm audit --omit=dev`
- [ ] Verify `.env.example` matches required production variables
- [ ] Smoke test auth + dashboard navigation

## Exit Criteria
- All checks pass or exceptions are documented
- No blocking security findings
