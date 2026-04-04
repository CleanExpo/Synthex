---
phase: 02-mock-data-api
plan: 04
subsystem: api
tags: [monitoring, seo-audit, integrations, persona-training, content-optimization, mock-removal, prisma, serverless]

requires:
  - phase: 02-mock-data-api
    provides: Empty-state pattern (02-01), AI error pattern (02-02), deterministic calculation pattern (02-03)

provides:
  - Monitoring metrics use honest null values for unconfigured infrastructure
  - SEO audit history stored and queried from database (prisma.sEOAudit)
  - Integration status backed by PlatformConnection model, not in-memory Map
  - Persona training state persisted in Persona.status field, not in-memory Map
  - Content optimization uses deterministic hash-based template selection (djb2)

affects: [02-05, 03-01, 06-01]

tech-stack:
  added: []
  patterns: [honest-null-for-unconfigured, database-backed-state, djb2-content-hash, serverless-safe-patterns]

key-files:
  created: []
  modified:
    - app/api/monitoring/metrics/route.ts
    - app/api/seo/audit/route.ts
    - app/api/integrations/[integrationId]/status/route.ts
    - app/api/personas/[id]/train/route.ts
    - app/api/ai-content/optimize/route.ts

key-decisions:
  - "Monitoring metrics use null (not zero) for values requiring external integration — null communicates 'not configured' vs zero which implies 'measured and empty'"
  - "SEO audit results stored via prisma.sEOAudit.create() and queried via findMany — real audit history"
  - "In-memory Maps replaced with Prisma queries — Maps reset on every Vercel cold start, making them useless"
  - "Persona training uses Persona.status field as source of truth — no TrainingJob model exists"
  - "deterministicIndex() uses djb2 hash algorithm for reproducible template selection"

patterns-established:
  - "Honest null pattern: use null (not 0 or Math.random()) for metrics requiring external infrastructure"
  - "Database-backed state: never use module-level Maps or variables for user state in serverless"
  - "Content-based deterministic selection: hash content to pick from template arrays instead of Math.random()"

issues-created: []

duration: ~8 min
completed: 2026-02-16
---

# Phase 2 Plan 04: Fix Monitoring, SEO, and Integration Stubs Summary

**Replaced Math.random() monitoring metrics with honest nulls, wired SEO audit history to database, replaced serverless-broken in-memory Maps with Prisma queries, and added deterministic content hash for template selection.**

## Performance
- Task 1: ~4 min
- Task 2: ~4 min
- Total: ~8 min
- Tasks: 2/2 completed
- Files modified: 5

## Accomplishments
- Monitoring metrics return honest `null` for values requiring monitoring integration (Datadog, Prometheus), real counts for userCount/postCount from Supabase
- SEO audit GET handler queries `prisma.sEOAudit.findMany()` for real audit history instead of hardcoded `mockHistory` array
- SEO audit POST handler stores results via `prisma.sEOAudit.create()` and tracks monthly usage with real count
- Fixed missing `await` on async `performSEOAudit()` call (bug)
- Integration status queries `prisma.platformConnection.findFirst()` instead of useless module-level Map
- Integration response prefers actual OAuth scopes from `connection.scope` over default descriptions
- Added youtube, pinterest, reddit to default permissions map
- Persona training uses `persona.status` database field as source of truth, removed Map and setInterval
- Content optimization uses `deterministicIndex()` (djb2 hash) for reproducible hook/CTA/emoji selection

## Task Commits

1. **Task 1: Replace monitoring mock metrics and SEO audit hardcoded history** - `121d5b4` (fix)
   - 7 Math.random() calls replaced with null in monitoring metrics
   - mockHistory array replaced with prisma.sEOAudit.findMany() query
   - Added prisma.sEOAudit.create() for audit result storage
   - Fixed missing await on performSEOAudit()
   - Usage tracking uses real prisma.sEOAudit.count() scoped to current month
2. **Task 2: Replace in-memory Maps and random selection with database and deterministic logic** - `dd70db7` (fix)
   - Removed integrationConnections Map, replaced with prisma.platformConnection.findFirst()
   - Removed trainingJobs Map and setInterval cleanup
   - Training POST updates persona.status to 'training', pipeline callback updates to 'active'/'draft'
   - Training GET reads persona.status from database
   - Added deterministicIndex() using djb2 hash for template selection in optimize endpoint

## Files Created/Modified
- `app/api/monitoring/metrics/route.ts` - Honest null values for unconfigured metrics, real Supabase counts
- `app/api/seo/audit/route.ts` - Real audit history from database, audit storage, usage tracking, await fix
- `app/api/integrations/[integrationId]/status/route.ts` - PlatformConnection query, OAuth scope preference
- `app/api/personas/[id]/train/route.ts` - Database-backed training state, removed Map/setInterval
- `app/api/ai-content/optimize/route.ts` - deterministicIndex() with djb2 hash, reproducible selection

## Decisions Made
- **null vs 0 for monitoring** — Used `null` instead of `0` for metrics requiring external integration. `null` communicates "not configured" while `0` implies "measured and found to be zero." The `message` field explains what's needed.
- **SEO audit model access** — Prisma lowercases the first letter of model names, so `SEOAudit` becomes `prisma.sEOAudit` in queries.
- **No TrainingJob model** — Checked full Prisma schema. Used existing `Persona.status` field ('draft'|'training'|'active'|'archived') as the source of truth for training state instead.
- **Persona pipeline callback** — The `PersonaTrainingPipeline` constructor accepts an optional callback. Used `.then()/.catch()` on the pipeline promise to update persona status in database when training completes or fails.
- **djb2 hash algorithm** — Simple, well-known string hash that produces consistent integer output. Used to deterministically select from template arrays based on content, making responses reproducible and testable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug Fix] Missing await on async performSEOAudit()**
- **Found during:** Task 1
- **Issue:** `performSEOAudit()` is async but was called without `await` in the POST handler, causing the audit to run as a fire-and-forget promise
- **Fix:** Added `await` keyword
- **Files modified:** app/api/seo/audit/route.ts
- **Committed in:** 121d5b4 (part of Task 1 commit)

**2. [Rule 1 - Enhancement] Added youtube/pinterest/reddit to default permissions**
- **Found during:** Task 2
- **Issue:** `getPermissionsForIntegration()` only had twitter, linkedin, instagram, facebook — missing 3 platforms
- **Fix:** Added tiktok, youtube, pinterest, reddit entries
- **Files modified:** app/api/integrations/[integrationId]/status/route.ts
- **Committed in:** dd70db7 (part of Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug fix, 1 missing coverage), 0 deferred
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
None.

## Next Step
Ready for 02-05-PLAN.md (Full endpoint audit — grep for remaining mock patterns)

---
*Phase: 02-mock-data-api*
*Completed: 2026-02-16*
*Commits: 121d5b4, dd70db7*
