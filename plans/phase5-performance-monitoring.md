# Phase 5: Performance Optimization and Monitoring
Status: In progress
Owner: Release Conductor
Updated: 2026-01-16

## Goals
- Reduce client bundle impact on analytics pages
- Verify Web Vitals collection before release
- Document performance baseline for release validation

## Completed
- [x] Lazy-load analytics charts on `/analytics`

## In Progress
- [ ] Run bundle analysis (`npm run analyze`)
- [ ] Audit image usage and add `next/image` where missing
- [ ] Review caching headers for static assets
- [ ] Confirm monitoring events are ingested in production

## Validation Checklist
- [ ] Lighthouse audit for `/analytics` and `/dashboard`
- [ ] LCP < 2.5s, INP < 200ms, CLS < 0.1 on desktop
- [ ] No regression in analytics chart rendering

## Deliverables
- Performance notes captured in this file
- Phase status updated in `plans/finish-plan.md`
