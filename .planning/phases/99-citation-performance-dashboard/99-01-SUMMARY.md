# Phase 99-01 Summary — Citation Performance Dashboard: Aggregation API Layer

**Completed:** 2026-03-11
**Status:** DONE

## What Was Built

### lib/citation/aggregator.ts
Unified aggregation library with three exported async functions:

- **`getOverviewStats(userId, orgId)`** — Aggregates from 11 Phase 85–98 models simultaneously using `Promise.all`. Returns `OverviewStats` with 8 domain summaries + 10 most recent agent activity items. All sub-queries wrapped in individual try-catch; any table failure returns zeros without crashing the endpoint.

- **`getTimeline(userId, orgId, days)`** — Returns `TimelinePoint[]` with daily GEO scores, quality scores, and alert counts for the last N days (default 30). Pre-initialises all days in the range so gaps appear as nulls (displayed as chart breaks).

- **`getOpportunities(userId, orgId)`** — Returns up to 10 priority `OpportunityItem[]` sorted critical → warning → info. Sources: unacknowledged SentinelAlerts, untested PromptTrackers, identified BacklinkProspects, running SEOExperiments.

### API Routes
| Route | File |
|-------|------|
| `GET /api/citation/overview` | `app/api/citation/overview/route.ts` |
| `GET /api/citation/timeline?days=N` | `app/api/citation/timeline/route.ts` |
| `GET /api/citation/opportunities` | `app/api/citation/opportunities/route.ts` |

All routes use `getUserIdFromRequest()` for auth, return `{ success: true, data: ... }` envelopes, and handle errors with 500 responses.

## Models Aggregated
`GEOAnalysis`, `EntityAnalysis`, `CitationMonitor`, `BrandMention`, `BrandIdentity`, `ContentQualityAudit`, `EEATAudit`, `PromptTracker`, `BacklinkProspect`, `SentinelAlert`, `HealingAction`, `SEOExperiment`

## No Prisma Changes
Zero schema modifications — pure read-only aggregation.

## Commits
- `feat(99-01): lib/citation/aggregator.ts — unified data aggregation`
