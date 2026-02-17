# src/ Dependencies (for Phase 12+ migration)

## Actively Imported by app/api

| src/ File | Imported By | Migration Priority |
|-----------|-------------|-------------------|
| src/infrastructure/caching/cache.factory.ts | app/api/cache/route.ts | Low |
| src/infrastructure/logging/console-logger.ts | app/api/cache/route.ts | Low |
| src/middleware/cache-middleware.ts | app/api/cache/route.ts, app/api/patterns/cached/route.ts | Medium |
| src/middleware/session.ts | app/api/example/redis-demo/route.ts, app/api/health/redis/route.ts | Medium |
| src/middleware/rate-limit.ts | app/api/example/redis-demo/route.ts | Medium |
| src/middleware/enhanced-rate-limit.ts | app/api/generate/route.ts, app/api/rate-limit/route.ts | High |
| src/services/ai/content-variations.ts | app/api/content/variations/route.ts | High |
| src/services/content/calendar-service.ts | app/api/content/calendar/route.ts, app/api/content/calendar/optimal-times/route.ts | High |
| src/services/ai/persona-training-pipeline.ts | app/api/personas/[id]/train/route.ts | High |

## Migration Notes

- **Infrastructure files** (caching, logging) could move to `lib/infrastructure/`
- **Middleware files** could move to `lib/middleware/` or root `middleware.ts`
- **Service files** could merge with existing `lib/` services:
  - `content-variations` → `lib/ai/`
  - `calendar-service` → `lib/content/`
  - `persona-training-pipeline` → `lib/ai/`

## Files Removed in Phase 11

### Task 1: Confirmed dead legacy services (6 files, 3415 lines)
- `src/services/analytics.service.js` — 100% mock data (Math.random)
- `src/services/analytics.service.ts` — Duplicate
- `src/services/analytics.service.ts.disabled` — Disabled variant
- `src/services/dashboard-service.ts` — Not imported, duplicated lib/api
- `src/services/competitor-analysis.js` — Broken imports to non-existent files
- `src/services/white-label.js` — Broken imports to non-existent files

### Task 2: Additional dead files discovered (12 files, 8569 lines)
- `src/services/ab-testing.js` — Not imported by app/api
- `src/services/advanced-scheduler.js` — Not imported by app/api
- `src/services/automated-reporting.js` — Not imported by app/api
- `src/services/content-library.js` — Not imported by app/api
- `src/services/mobile-api.js` — Not imported by app/api
- `src/services/team-collaboration.js` — Not imported by app/api
- `src/services/translation.js` — Not imported by app/api
- `src/services/ai-content-generator.js` — Not imported by app/api
- `src/services/cache.service.js` — Only used by dead lib/api/dashboard.ts
- `src/services/cache.service.ts` — Only used by dead lib/api/dashboard.ts
- `src/services/team-collaboration.service.ts` — Only used by dead lib/api/dashboard.ts
- `lib/api/dashboard.ts` — Dead code, not imported anywhere

## Remaining src/services/ Files (not imported by app/api)

These root-level .ts files exist but are NOT imported by app/api routes:
- `src/services/agent-integration.ts`
- `src/services/analytics-dashboard.ts`
- `src/services/audit.ts`
- `src/services/auth.ts`
- `src/services/campaign.ts`
- `src/services/content.ts`
- `src/services/contentLogger.ts`
- `src/services/direct-supabase-service.ts`
- `src/services/emailService.ts`
- `src/services/notification.ts`
- `src/services/oauth.ts`
- `src/services/openrouter.ts`
- `src/services/performance.ts`
- `src/services/posts.ts`
- `src/services/product-enhancement-research.ts`
- `src/services/project.ts`
- `src/services/supabase-integration.ts`
- `src/services/tier-manager.ts`
- `src/services/ttd-rd-framework.ts`
- `src/services/twoFactor.ts`
- `src/services/userManagement.ts`

**Note:** These may be used by `src/agents/` or other src/ subsystems. A full audit of src/ internal dependencies is needed before removal.

## Summary

- **Total removed in Phase 11:** 18 files, 11,984 lines
- **Actively imported src/ files:** 9 files across 3 categories
- **Remaining root-level src/services/*.ts:** 21 files (need further audit)
