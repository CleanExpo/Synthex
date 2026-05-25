# Phase 133 — M1 Verification

## Tests added

| File                                                                 | Cases |
| -------------------------------------------------------------------- | ----- |
| `tests/unit/lib/agency/agency-task-catalog.test.ts`                  | 5     |
| `tests/unit/lib/agency/brand-voice-gate.test.ts`                     | 3     |
| `tests/unit/lib/agency/tier1-snapshot.test.ts`                       | 2     |
| `tests/unit/api/tasks-agency.test.ts`                                | 3     |
| `tests/unit/api/agency-routes.test.ts`                               | 5     |
| Prior: `spawn-workflow-from-action.test.ts`, `advisor-brief.test.ts` | 15    |

**Expected new agency tests:** 18+ (run full suite for regression).

## Verification commands (required before merge)

```bash
npm run type-check
npm run lint
npm test
```

## Migrations to apply

1. `prisma/migrations/20260525_add_agency_task_id/migration.sql`
2. `npm run seed:brands` (after DB reachable)

## Remaining non-goals

- Full SYN-806 skill implementations (IDE)
- 100 partial routes
- Live OAuth publish loop (GAP-005)
- Verified Tier-1 metrics (GA4/GSC wiring)
