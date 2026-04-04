# Phase 67 Plan 02: Orphaned Route Audit Summary

**Audited all 300+ app/api/ routes; 25 orphaned routes documented with @internal or @deprecated JSDoc — no silent orphans remain.**

## Accomplishments

- Audited all API routes in app/api/ (approximately 300 route.ts files)
- ~250+ routes: WIRED (had existing callers in hooks/, components/, or app/dashboard/)
- ~45 routes: INTERNAL (intentional non-UI — cron, webhooks, auth, admin, monitoring, health — already classified by plan rules)
- 25 routes: ORPHANED → actioned
  - 22 marked @internal (Action B): clear server-side or infra purpose, no UI page yet
  - 3 marked @deprecated (Action C): no infra purpose, dead code candidates
  - 0 wired to frontend (Action A): no orphans had obvious existing UI homes without new pages

## Files Modified

### Action B — @internal (22 routes)

- `app/api/clients/route.ts` — agency client management; no /dashboard/clients page yet
- `app/api/features/route.ts` — plan-based feature-flag resolution
- `app/api/loyalty/route.ts` — loyalty tier system; no UI page yet
- `app/api/mobile/config/route.ts` — mobile SDK runtime configuration
- `app/api/mobile/sync/route.ts` — mobile offline data synchronisation
- `app/api/moderation/check/route.ts` — server-side content safety pipeline
- `app/api/performance/metrics/route.ts` — internal performance monitoring
- `app/api/system/models/route.ts` — LLM model registry admin tool
- `app/api/ws/route.ts` — WebSocket notification infra (UI uses SSE via /api/notifications/stream)
- `app/api/email/send/route.ts` — internal email delivery service
- `app/api/indexing/route.ts` — Google Search Console URL submission (admin/cron)
- `app/api/rate-limit/route.ts` — rate limit diagnostics and reset (infra tool)
- `app/api/organizations/route.ts` — org creation (onboarding flow) + admin listing
- `app/api/generate/route.ts` — legacy AI generation wrapper; active callers use /api/ai/generate-content
- `app/api/generate/diagram/route.ts` — Paper Banana microservice proxy for diagram generation
- `app/api/generate/plot/route.ts` — Paper Banana microservice proxy for data plot generation
- `app/api/library/content/route.ts` — duplicate path; active callers use /api/content-library
- `app/api/library/content/[contentId]/route.ts` — duplicate path; active callers use /api/content-library/[id]
- `app/api/quotes/route.ts` — quote/citation management; no dashboard page yet
- `app/api/quotes/[id]/route.ts` — quote/citation management; no dashboard page yet
- `app/api/eeat/score/route.ts` — EEAT content scoring pipeline; intended for content/SEO pages
- `app/api/eeat/audit/route.ts` — combined EEAT+GEO audit pipeline; intended for SEO pages

### Action C — @deprecated (3 routes)

- `app/api/example/redis-demo/route.ts` — dev demo stub; session middleware was deleted; no production use
- `app/api/cache/route.ts` — cache stats duplicated by /api/monitoring/metrics; uses src/infrastructure path not in use
- `app/api/sentry-test/route.ts` — dev/staging-only Sentry integration test; disabled in production

## Decisions Made

- **eeat/** routes: Marked @internal (not @deprecated) because EEAT scoring is an active framework feature; the authors page already shows eeatScore retrieved via /api/authors, and the standalone eeat endpoints are valuable for future content editor integration.
- **generate/** base route: Marked @internal because it is a backward-compatibility wrapper, not dead code; external API consumers may depend on it.
- **library/content/** routes: Marked @internal noting they are duplicates of /api/content-library — the @internal comment signals this for future deduplication.
- **organizations/**: Marked @internal (not admin) because POST is used in the onboarding flow server-side and GET is admin-only; no direct fetch() call from frontend hooks.
- **ws/**: Marked @internal; the actual realtime frontend uses SSE via /api/notifications/stream, not this WebSocket endpoint directly.

## Issues Encountered

None. Type-check passed with 0 errors. Test results: 1506 passing, 22 pre-existing failures (Stripe/BullMQ/Prisma mocks), no regressions.

## Next Step

Ready for 67-03-PLAN.md — Fetch Pattern Standardisation
