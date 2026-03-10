# Summary: Plan 82-01 — Auth Centralisation

**Plan:** Auth Centralisation — Remove Local Auth Helpers from API Routes
**Linear:** SYN-57
**Commit:** `7b366590` — `refactor(auth): centralise auth helpers across 49 API routes (SYN-57)`
**Date:** 2026-03-10
**Duration:** ~90 min (spanning 2 sessions)

---

## Objective

Remove 49 duplicated local auth helper functions (`getUserFromRequest`, `getUserId`) from API
routes and replace with canonical functions from `@/lib/auth/jwt-utils`. This enforces the P1
architecture pattern and eliminates divergent auth logic that is a security maintenance risk.

---

## What Was Done

### Pattern Classification

All 49 files were categorised into 5 distinct patterns:

| Pattern | Count | Fix |
|---------|-------|-----|
| A — thin cookie wrapper (`getUserId` → `getUserIdFromCookies`) | 8 | Delete function, call canonical directly |
| B-cookie — partial wrapper (`getUserId` → `getUserIdFromRequestOrCookies`) | 3 | Delete function, inline canonical |
| B-header — partial wrapper (`getUserId` → `getUserIdFromRequest`) | 3 | Delete function, inline canonical |
| C — full bearer+cookie block (`getUserFromRequest`, `{id}` return) | 19 | Delete block, replace `user.id` → `userId` |
| C-email — full bearer+cookie block (`getUserFromRequest`, `{id,email}` return) | 13 | Delete block, replace `user.id` → `userId` (email unused) |
| Header-only — bearer only, no cookie fallback | 3 | Delete block, use `getUserIdFromRequest` |

**Total: 49 files**

### Key Technical Decisions

1. **Header-only distinction**: Two files (`analytics/export/route.ts`, `analytics/route.ts`, `tasks/bulk/route.ts`) used header-only auth with no cookie fallback. These correctly use `getUserIdFromRequest` rather than `getUserIdFromRequestOrCookies`.

2. **`teams/[id]/settings/route.ts` special handling**: This file contains an internal `canManageTeam(userId, teamId)` function that uses its own `const user = await prisma.user.findFirst(...)` variable. Python batch processing could not be used safely here — manual targeted replacements were applied per handler block (`GET`, `PATCH`, `DELETE`) to avoid clobbering the internal Prisma `user` variable.

3. **`{id, email}` return type**: 13 files declared `getUserFromRequest` returning `{ id: string; email: string } | null`. Searching confirmed `user.email` was never referenced at any call site in these files — only `user.id` was used. The same replacement as Pattern C applied.

4. **Python batch scripting**: Files 20–49 were processed in two batches using a Python script running via process tool, replacing the entire Auth Helper section (import, section header, function body) and updating all call sites. This ensured consistency and prevented hand-edit errors.

### Verification Results

| Check | Result |
|-------|--------|
| `npm run type-check` | Zero errors |
| `npm test` | 1496 passing, 32 failures (all pre-existing) |
| Architecture check: `grep -rn "function getUserFromRequest\|function getUserId(" app/api/` | 0 matches |
| Files modified | Exactly 49 |
| New lint errors introduced | 0 (pre-existing only) |

---

## Files Modified

### Pattern A — thin cookie wrapper (8 files)
- `app/api/ab-testing/tests/route.ts`
- `app/api/ab-testing/tests/[testId]/results/route.ts`
- `app/api/ab-testing/tests/[testId]/route.ts`
- `app/api/psychology/principles/route.ts`
- `app/api/reporting/generate/route.ts`
- `app/api/reporting/reports/[reportId]/download/route.ts`
- `app/api/reporting/reports/[reportId]/route.ts`
- `app/api/reporting/reports/route.ts`

### Pattern B-cookie wrapper (3 files)
- `app/api/personas/route.ts`
- `app/api/scheduler/posts/bulk/route.ts`
- `app/api/scheduler/posts/route.ts`

### Pattern B-header wrapper (3 files)
- `app/api/analytics/route.ts`
- `app/api/tasks/bulk/route.ts`
- `app/api/tasks/route.ts`

### Pattern C — full bearer+cookie block, `{id}` return (19 files)
- `app/api/unified/metrics/route.ts`
- `app/api/affiliates/links/route.ts`
- `app/api/affiliates/links/[linkId]/route.ts`
- `app/api/affiliates/links/[linkId]/clicks/route.ts`
- `app/api/affiliates/networks/route.ts`
- `app/api/affiliates/networks/[networkId]/route.ts`
- `app/api/affiliates/stats/route.ts`
- `app/api/analytics/benchmarks/route.ts`
- `app/api/revenue/route.ts`
- `app/api/revenue/[id]/route.ts`
- `app/api/roi/route.ts`
- `app/api/roi/investments/route.ts`
- `app/api/roi/investments/[id]/route.ts`
- `app/api/sponsors/route.ts`
- `app/api/sponsors/pipeline/route.ts`
- `app/api/sponsors/[id]/route.ts`
- `app/api/sponsors/[id]/deals/route.ts`
- `app/api/sponsors/[id]/deals/[dealId]/route.ts`
- `app/api/sponsors/[id]/deals/[dealId]/deliverables/route.ts`
- `app/api/sponsors/[id]/deals/[dealId]/deliverables/[deliverableId]/route.ts`

### Pattern C-email — full bearer+cookie block, `{id,email}` return (13 files)
- `app/api/audience/insights/route.ts`
- `app/api/bio/route.ts`
- `app/api/bio/[pageId]/route.ts`
- `app/api/bio/[pageId]/links/route.ts`
- `app/api/content/[id]/route.ts`
- `app/api/content/bulk/route.ts`
- `app/api/content/calendar/route.ts`
- `app/api/content/performance/route.ts`
- `app/api/integrations/[integrationId]/sync/route.ts`
- `app/api/listening/route.ts`
- `app/api/listening/keywords/route.ts`
- `app/api/listening/mentions/route.ts`
- `app/api/organizations/[orgId]/route.ts`

### Header-only (3 files)
- `app/api/analytics/export/route.ts`
- `app/api/teams/[id]/settings/route.ts`

---

## Deviations from Plan

None. All 49 files were in the expected patterns. No file required escalation for "additional
logic beyond auth" — all local auth helpers were pure boilerplate with no side effects.

The plan listed some files under Pattern A that turned out to be Pattern B-cookie or Pattern
B-header (e.g. `tasks/route.ts`, `scheduler/posts/route.ts`). These were handled correctly
under their actual pattern. The 49-file total is unchanged.

---

## Architecture Impact

- **Zero local auth helpers remain in `app/api/`** — enforces single source of truth
- **Single import path for auth**: all 49 routes now import from `@/lib/auth/jwt-utils`
- **Reduced auth surface**: eliminates 49 divergent code paths that could silently drift
- **Maintenance**: future auth changes (e.g. token rotation, new auth methods) require updating only `lib/auth/jwt-utils.ts`, not 49+ files

---

## Pre-existing Issues (not introduced by this plan)

- `app/api/bio/route.ts` line 37: ESLint `prefer-const` for `slug` variable in `generateUniqueSlug` — confirmed pre-existing by git stash test
- 32 Jest failures: BullMQ, Stripe mock, SubscriptionService — all pre-existing baseline failures
