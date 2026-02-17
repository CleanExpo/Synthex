---
phase: 04-security-hardening
plan: 03
subsystem: auth-middleware
tags: [security, auth, audit, api-routes]
requires: [04-01, 04-02]
provides: [auth-coverage-audit, zero-unprotected-sensitive-routes]
affects: [app/api/**, lib/auth/jwt-utils.ts]
tech-stack: [nextjs, jwt, nextauth]
key-files:
  - app/api/auth/verify-token/route.ts
  - app/api/sentry-test/route.ts
  - app/api/auth/profile/route.ts
  - app/api/dashboard/stats/route.ts
  - app/api/email/send/route.ts
  - app/api/monitoring/alerts/route.ts
  - app/api/monitoring/business-metrics/route.ts
key-decisions:
  - verify-token returns only { valid, userId } to minimize data exposure
  - sentry-test guarded by NODE_ENV, returns 404 in production
  - auth/profile switched from email param to userId-scoped queries
  - monitoring infrastructure endpoints (health-dashboard, metrics, performance, events) kept public
  - stats and trending endpoints are public marketing data
duration: ~12 min
completed: 2026-02-16
---

# Phase 4 Plan 03: Auth Middleware Audit Summary

**Audited all 218 API routes for auth coverage, fixed verify-token stub, guarded sentry-test, and added auth to 5 unprotected sensitive routes.**

## Accomplishments

### Task 1: Fix auth stubs and disable debug endpoints
- **verify-token**: Replaced `{ valid: true }` stub with proper JWT validation using `verifyTokenSafe()`. Now supports GET (cookie), POST (header/body/cookie). Returns only `{ valid, userId }` per minimal data exposure principle.
- **sentry-test**: Added `NODE_ENV === 'production'` guard that returns 404. Both GET and POST handlers protected. File kept for dev/staging Sentry verification.

### Task 2: Audit all API routes for auth coverage
- Audited all 218 route.ts files under app/api/
- Found 5 UNPROTECTED-SENSITIVE routes and added auth:
  1. **auth/profile** - Was accessible by email param without auth. Added `getUserIdFromCookies()`, switched to userId-scoped queries.
  2. **dashboard/stats** - Had inline JWT but didn't reject unauthenticated requests (returned all data unscoped). Replaced with `getUserIdFromRequestOrCookies()` + 401 rejection.
  3. **email/send** - Could send arbitrary emails without auth. Added `getUserIdFromCookies()` check.
  4. **monitoring/alerts** - Could send/view alerts without auth. Added `getUserIdFromCookies()` to GET and POST.
  5. **monitoring/business-metrics** - Exposed business KPIs without auth. Added `getUserIdFromCookies()`.
- Classified 32 intentionally public routes (auth flow, health probes, webhooks with signature verification, infrastructure monitoring)
- Verified all 186 routes with standard auth patterns are correctly protected

## Files Modified

| File | Change |
|------|--------|
| app/api/auth/verify-token/route.ts | Replaced stub with proper JWT validation |
| app/api/sentry-test/route.ts | Added NODE_ENV production guard |
| app/api/auth/profile/route.ts | Added getUserIdFromCookies, scoped by userId |
| app/api/dashboard/stats/route.ts | Replaced inline JWT with getUserIdFromRequestOrCookies |
| app/api/email/send/route.ts | Added getUserIdFromCookies auth check |
| app/api/monitoring/alerts/route.ts | Added getUserIdFromCookies to GET/POST |
| app/api/monitoring/business-metrics/route.ts | Added getUserIdFromCookies to GET |

## Auth Coverage Audit Table

### Protected Routes (186 routes)

| Route | Auth Method |
|-------|-------------|
| /api/ab-testing/tests | getUserIdFromCookies |
| /api/ab-testing/tests/[testId] | getUserIdFromCookies |
| /api/ab-testing/tests/[testId]/results | getUserIdFromCookies |
| /api/activity | APISecurityChecker |
| /api/admin/audit-log | verifyAdmin (ADMIN_API_KEY + JWT) |
| /api/admin/jobs | verifyAdmin (ADMIN_API_KEY + JWT) |
| /api/admin/upgrade-subscription | verifyAdmin (ADMIN_API_KEY + JWT) |
| /api/admin/users | verifyAdmin (ADMIN_API_KEY + JWT) |
| /api/ai/generate-content | verifyTokenSafe |
| /api/ai/pm/conversations | APISecurityChecker |
| /api/ai/pm/conversations/[id]/messages | APISecurityChecker |
| /api/ai/pm/digest | APISecurityChecker |
| /api/ai/pm/feedback | APISecurityChecker |
| /api/ai/pm/suggestions | APISecurityChecker |
| /api/ai-content/hashtags | getUserIdFromRequestOrCookies + APISecurityChecker |
| /api/ai-content/optimize | getUserIdFromRequestOrCookies + APISecurityChecker |
| /api/ai-content/sentiment | APISecurityChecker |
| /api/ai-content/sentiment/batch | APISecurityChecker |
| /api/ai-content/translate | getUserIdFromRequestOrCookies + APISecurityChecker |
| /api/analytics | getUserIdFromRequest |
| /api/analytics/anomalies | APISecurityChecker |
| /api/analytics/dashboard | getUserIdFromCookies |
| /api/analytics/engagement | APISecurityChecker |
| /api/analytics/export | verifyToken + APISecurityChecker |
| /api/analytics/insights | APISecurityChecker |
| /api/analytics/performance | getUserIdFromRequestOrCookies + APISecurityChecker |
| /api/analytics/predict-engagement | APISecurityChecker |
| /api/analytics/realtime | APISecurityChecker |
| /api/analytics/reports | APISecurityChecker (via reporting module) |
| /api/analytics/reports/scheduled | APISecurityChecker (via reporting module) |
| /api/analytics/sentiment | APISecurityChecker |
| /api/auth/[platform]/disconnect | getUserIdFromRequestOrCookies |
| /api/auth/accounts | getUserIdFromRequestOrCookies + APISecurityChecker |
| /api/auth/api-keys | getUserIdFromRequestOrCookies + APISecurityChecker |
| /api/auth/connections | getUserIdFromRequestOrCookies + APISecurityChecker |
| /api/auth/link/google | getUserIdFromRequestOrCookies |
| /api/auth/logout | getUserIdFromRequestOrCookies + verifyTokenSafe |
| /api/auth/oauth/[platform] | supabase.auth.getUser |
| /api/auth/profile | getUserIdFromCookies (FIXED) |
| /api/auth/refresh | verifyTokenSafe |
| /api/auth/unified | getUserIdFromRequestOrCookies |
| /api/auth/unlink/google | getUserIdFromRequestOrCookies |
| /api/auth/user | getUserIdFromRequestOrCookies |
| /api/auth/verify-token | verifyTokenSafe (FIXED - was stub) |
| /api/authors | getUserIdFromRequest |
| /api/authors/[id] | getUserIdFromRequest |
| /api/authors/[id]/schema | getUserIdFromRequest |
| /api/backup | CRON_SECRET + ADMIN_API_KEY |
| /api/brand/generate | getUserIdFromCookies + getUserIdFromRequest |
| /api/businesses | getUserIdFromRequestOrCookies |
| /api/businesses/[id] | getUserIdFromRequestOrCookies |
| /api/businesses/overview | getUserIdFromRequestOrCookies |
| /api/businesses/switch | getUserIdFromRequestOrCookies |
| /api/cache | ADMIN_API_KEY |
| /api/campaigns | getUserIdFromRequestOrCookies |
| /api/clients | APISecurityChecker |
| /api/competitors | APISecurityChecker |
| /api/competitors/[competitorId]/analyze | APISecurityChecker |
| /api/competitors/alerts | APISecurityChecker |
| /api/competitors/track | APISecurityChecker |
| /api/competitors/track/[id] | APISecurityChecker |
| /api/competitors/track/[id]/snapshot | APISecurityChecker |
| /api/competitors/track/execute | CRON_SECRET |
| /api/content/[id] | verifyToken |
| /api/content/bulk | verifyToken |
| /api/content/calendar | verifyToken |
| /api/content/calendar/optimal-times | APISecurityChecker |
| /api/content/comments | APISecurityChecker |
| /api/content/generate | withAuth |
| /api/content/share | APISecurityChecker |
| /api/content/variations | APISecurityChecker |
| /api/cron/analyze-patterns | CRON_SECRET + ADMIN_API_KEY |
| /api/cron/health-score | CRON_SECRET |
| /api/cron/proactive-insights | CRON_SECRET |
| /api/cron/weekly-digest | CRON_SECRET |
| /api/dashboard/stats | getUserIdFromRequestOrCookies (FIXED) |
| /api/eeat/audit | getUserIdFromRequest |
| /api/eeat/score | getUserIdFromRequest |
| /api/email/send | getUserIdFromCookies (FIXED) |
| /api/example/redis-demo | withSession + withRateLimit |
| /api/features | APISecurityChecker |
| /api/gamification/achievements | APISecurityChecker |
| /api/gamification/streak | APISecurityChecker |
| /api/generate | verifyTokenSafe |
| /api/geo/analyze | getUserIdFromRequest |
| /api/geo/passages | getUserIdFromRequest |
| /api/geo/score | getUserIdFromRequest |
| /api/integrations | supabase.auth.getUser |
| /api/integrations/[id]/connect | supabase.auth.getUser |
| /api/integrations/[id]/status | getUserIdFromCookies |
| /api/integrations/[id]/sync | verifyToken |
| /api/intelligence/competitors | APISecurityChecker |
| /api/invoices | getUserIdFromRequestOrCookies + APISecurityChecker |
| /api/library/content | APISecurityChecker |
| /api/library/content/[contentId] | APISecurityChecker |
| /api/local/case-studies | getUserIdFromRequest |
| /api/loyalty | APISecurityChecker |
| /api/media/generate/image | APISecurityChecker |
| /api/media/generate/video | APISecurityChecker |
| /api/media/generate/voice | APISecurityChecker |
| /api/media/library | APISecurityChecker |
| /api/mobile/config | APISecurityChecker |
| /api/mobile/sync | APISecurityChecker |
| /api/moderation/check | APISecurityChecker |
| /api/monitoring/alerts | getUserIdFromCookies (FIXED) |
| /api/monitoring/business-metrics | getUserIdFromCookies (FIXED) |
| /api/monitoring/errors | supabase.auth.getUser |
| /api/notifications | APISecurityChecker |
| /api/notifications/[notificationId]/read | APISecurityChecker |
| /api/notifications/settings | APISecurityChecker |
| /api/notifications/stream | getUserIdFromRequestOrCookies + APISecurityChecker |
| /api/onboarding | getAuthUser (Supabase) |
| /api/optimize/auto-schedule | APISecurityChecker |
| /api/organizations | APISecurityChecker |
| /api/organizations/[orgId] | verifyToken |
| /api/patterns/analyze | supabase.auth.getUser |
| /api/patterns/cached | withSession (inline middleware) |
| /api/performance/metrics | Infrastructure monitoring |
| /api/personas | getUserIdFromRequest |
| /api/personas/[id]/optimize | APISecurityChecker |
| /api/personas/[id]/train | APISecurityChecker |
| /api/platforms/[platform]/metrics | APISecurityChecker (PUBLIC_READ policy) |
| /api/platforms/metrics | APISecurityChecker (PUBLIC_READ policy) |
| /api/predict/trends | APISecurityChecker |
| /api/psychology/analyze | getUserIdFromCookies |
| /api/psychology/principles | getUserIdFromCookies |
| /api/quotes | extractUserId (withAuth) |
| /api/quotes/[id] | APISecurityChecker |
| /api/rate-limit | getUserIdFromRequestOrCookies + ADMIN_API_KEY |
| /api/recommendations | APISecurityChecker |
| /api/referrals | APISecurityChecker |
| /api/referrals/redeem | APISecurityChecker |
| /api/reporting/generate | getUserIdFromCookies |
| /api/reporting/reports | APISecurityChecker (via reporting module) |
| /api/reporting/reports/[reportId] | APISecurityChecker (via reporting module) |
| /api/reporting/reports/[reportId]/download | APISecurityChecker (via reporting module) |
| /api/reports/scheduled | APISecurityChecker (via reporting module) |
| /api/reports/scheduled/execute | CRON_SECRET (via cron module) |
| /api/reports/templates | APISecurityChecker (via reporting module) |
| /api/research | getUserIdFromRequest |
| /api/research/[id] | getUserIdFromRequest |
| /api/research/capabilities | APISecurityChecker |
| /api/research/implementation-plan | APISecurityChecker |
| /api/research/trends | APISecurityChecker |
| /api/scheduler/posts | getUserIdFromRequest |
| /api/scheduler/posts/[postId] | APISecurityChecker |
| /api/seo | APISecurityChecker |
| /api/seo/audit | APISecurityChecker |
| /api/seo/schema | APISecurityChecker |
| /api/social/facebook/post | getUserIdFromRequestOrCookies + APISecurityChecker |
| /api/social/instagram/post | getUserIdFromRequestOrCookies + APISecurityChecker |
| /api/social/linkedin/post | getUserIdFromRequestOrCookies + APISecurityChecker |
| /api/social/post | getUserIdFromCookies |
| /api/social/tiktok/post | getUserIdFromRequestOrCookies + APISecurityChecker |
| /api/social/twitter/post | getUserIdFromRequestOrCookies + APISecurityChecker |
| /api/social/youtube/post | getUserIdFromRequestOrCookies + APISecurityChecker |
| /api/stripe/billing-portal | getUserIdFromRequestOrCookies + APISecurityChecker |
| /api/stripe/change-plan | getUserIdFromRequestOrCookies + APISecurityChecker |
| /api/stripe/checkout | getUserIdFromRequestOrCookies + APISecurityChecker |
| /api/tasks | getUserIdFromRequest |
| /api/tasks/bulk | getUserIdFromRequest |
| /api/team | APISecurityChecker |
| /api/teams/[id]/settings | verifyToken |
| /api/teams/activity | getUserIdFromRequestOrCookies + APISecurityChecker |
| /api/teams/invitations | getUserIdFromRequestOrCookies + APISecurityChecker |
| /api/teams/invitations/[id] | getUserIdFromRequestOrCookies + APISecurityChecker |
| /api/teams/invite | APISecurityChecker |
| /api/teams/members | APISecurityChecker |
| /api/teams/members/[memberId] | getUserIdFromRequestOrCookies + APISecurityChecker |
| /api/teams/members/[memberId]/role | getUserIdFromRequestOrCookies + APISecurityChecker |
| /api/teams/notifications | APISecurityChecker |
| /api/teams/stats | getUserIdFromRequestOrCookies + APISecurityChecker |
| /api/user/account | supabase.auth.getUser |
| /api/user/avatar | supabase.auth.getUser |
| /api/user/change-password | supabase.auth.getUser |
| /api/user/profile | supabase.auth.getUser |
| /api/user/settings | supabase.auth.getUser |
| /api/user/subscription | APISecurityChecker |
| /api/user/usage | getUserIdFromRequestOrCookies + APISecurityChecker |
| /api/video | APISecurityChecker |
| /api/visuals | getUserIdFromRequest |
| /api/visuals/generate | getUserIdFromRequest |
| /api/webhooks/[platform] | META_WEBHOOK_VERIFY_TOKEN (signature) |
| /api/webhooks/internal | INTERNAL_WEBHOOK_SECRET (signature) |
| /api/webhooks/stats | x-api-key header check |
| /api/webhooks/user | verifyToken |
| /api/white-label/config | APISecurityChecker |
| /api/ws | getUserIdFromRequestOrCookies + APISecurityChecker |

### Intentionally Public Routes (32 routes)

| Route | Category | Rationale |
|-------|----------|-----------|
| /api/auth/[platform]/callback | Auth flow | OAuth callback handler |
| /api/auth/[platform]/connect | Auth flow | OAuth initiation |
| /api/auth/callback/[platform] | Auth flow | OAuth callback (alt path) |
| /api/auth/login | Auth flow | Login endpoint |
| /api/auth/oauth/github | Auth flow | GitHub OAuth initiation |
| /api/auth/oauth/github/callback | Auth flow | GitHub OAuth callback |
| /api/auth/oauth/google | Auth flow | Google OAuth initiation |
| /api/auth/oauth/google/callback | Auth flow | Google OAuth callback |
| /api/auth/request-reset | Auth flow | Password reset request |
| /api/auth/reset | Auth flow | Password reset execution |
| /api/auth/signup | Auth flow | User registration |
| /api/auth/unified-login | Auth flow | Unified login handler |
| /api/auth/verify-email | Auth flow | Email verification |
| /api/health | Health check | Load balancer probe |
| /api/health/auth | Health check | Auth system health |
| /api/health/db | Health check | Database health |
| /api/health/live | Health check | Liveness probe |
| /api/health/ready | Health check | Readiness probe |
| /api/health/redis | Health check | Redis health |
| /api/health/scaling | Health check | Scaling metrics |
| /api/monitoring/events | Infrastructure | Client-side telemetry ingestion |
| /api/monitoring/health-dashboard | Infrastructure | System health dashboard |
| /api/monitoring/metrics | Infrastructure | System metrics |
| /api/monitoring/performance | Infrastructure | Performance monitoring |
| /api/performance/metrics | Infrastructure | Performance metrics |
| /api/sentry-test | Debug (guarded) | Returns 404 in production |
| /api/stats | Marketing | Aggregate public platform stats |
| /api/trending | Marketing | Aggregate trending topics |
| /api/webhooks/email/sendgrid | Webhook | SendGrid signature verification |
| /api/webhooks/social | Webhook | Platform signature verification |
| /api/webhooks/stripe | Webhook | Stripe signature verification |

## Decisions Made

1. **verify-token returns minimal payload** - Only `{ valid, userId }` returned. Full JWT payload (email, name, exp) not exposed to minimize data leakage surface.
2. **sentry-test guarded by NODE_ENV, not deleted** - Kept for dev/staging Sentry verification. Returns 404 in production.
3. **auth/profile switched from email-param to userId-scoped** - Previously allowed any email lookup without auth. Now requires auth and queries by userId.
4. **Monitoring infrastructure endpoints kept public** - monitoring/events (telemetry), monitoring/health-dashboard, monitoring/metrics, monitoring/performance are infrastructure endpoints similar to health checks. They expose system-level metrics, not user data.
5. **stats and trending are intentionally public** - These return aggregate platform-wide data for marketing pages, not user-specific data.

## Issues Encountered

None.

## Verification

- [x] `npm run type-check` passes
- [x] `npm run build` succeeds
- [x] verify-token validates JWTs properly (not a stub)
- [x] sentry-test returns 404 in production (NODE_ENV guard)
- [x] Complete auth audit table (218 routes)
- [x] No sensitive route lacks authentication (5 gaps fixed)

## Task Commits

| Task | Commit | Hash |
|------|--------|------|
| Task 1: Fix auth stubs and debug endpoints | fix(04-03): fix verify-token stub and guard sentry-test | ed0b590 |
| Task 2: Add auth to unprotected sensitive routes | fix(04-03): add auth to unprotected sensitive routes | baca454 |

## Next Step

Phase 4 complete (all 3 plans done). Ready for Phase 5: Social Platform Completeness.
