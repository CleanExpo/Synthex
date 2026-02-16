# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-16)

**Core value:** Every endpoint returns real data, every platform works, every dashboard page connects to live APIs
**Current focus:** Phase 6 in progress — wiring cron jobs to real platform APIs.

## Current Position

Phase: 6 of 10 (Cron Jobs & Background Tasks)
Plan: 1 of 2 in current phase
Status: In progress
Last activity: 2026-02-17 — Completed 06-01-PLAN.md — Competitor tracking cron wired to real APIs

Progress: █████░░░░░ 50% (Phase 6)

## Performance Metrics

**Velocity:**
- Total plans completed: 17
- Average duration: ~9 min
- Total execution time: ~152 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 2/2 | ~16 min | ~8 min |
| 2 | 5/5 | ~41 min | ~8 min |
| 3 | 2/2 | ~21 min | ~11 min |
| 4 | 3/3 | ~30 min | ~10 min |
| 5 | 5/5 | ~42 min | ~8 min |
| 6 | 1/2 | ~10 min | ~10 min |

**Recent Trend:**
- Last 5 plans: 05-03 (~8 min), 05-04 (~8 min), 05-05 (~8 min), 06-01 (~10 min)
- Trend: Consistent ~8-10 min

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Mock data first priority (Vercel cron actively generating fake data)
- Comprehensive depth (10 phases, 30 plans)
- Archive by git rm, not _archive/ directory (files remain in git history)
- CLAUDE.md now reflects Next.js 15 architecture (not Express 4)
- Env files consolidated: 2 tracked (.env.example, .env.test), 2 gitignored (.env, .env.local)
- Pending snapshots use dataSource: 'pending' with zero metrics (02-01)
- Empty state pattern: { data: [], message: "hint" } established (02-01)
- AI unavailable returns error, never silently substitutes fake content (02-02)
- No ContentLibrary model in schema — endpoints return 501/empty state (02-03)
- Trending calculateChange() uses deterministic thresholds, not Math.random() (02-03)
- Monitoring metrics use null for unconfigured infrastructure (02-04)
- SEO audit results stored via prisma.sEOAudit.create() (02-04)
- In-memory Maps replaced with Prisma queries — Maps useless in serverless (02-04)
- deterministicIndex() uses djb2 hash for reproducible template selection (02-04)
- crypto.randomUUID() is the standard for all server-side ID generation (02-05)
- Legacy src/ services with mock data deferred — not used by app/api routes (02-05)
- Probabilistic cleanup, retry jitter, client-side animations are acceptable Math.random() uses (02-05)
- Twitter OAuth PKCE now uses crypto for code challenge (security fix, 02-05)
- Dashboard empty state pattern: inline EmptyState with icon, message, CTA button (03-01)
- Settings API key creation calls /api/user/api-keys, not Math.random() (03-01)
- Analytics fallback numbers use 0, not null — charts render correctly with zeros (03-01)
- Billing page has explicit error state UI with retry button (03-01)
- MetricsTable accepts MetricsTableRow[] data prop, shows em dashes when empty (03-02)
- 8 standalone feature components with mock data deferred to Phase 5+ (03-02)
- instrumentation.ts uses dynamic import for lightweight startup — no Prisma at init (04-01)
- CRITICAL env vars throw at startup; SECRET/INTERNAL vars warn with graceful degradation (04-01)
- Health check exposes env validation counts only — never var names or values (04-01)
- config/env.server.ts and src/env.ts deleted — single canonical EnvValidator (04-01)
- lib/middleware/rate-limiter.ts designated as canonical rate limiter (04-02)
- Category-based rate limit wrappers in api-rate-limit.ts: authStrict 5/min, authGeneral 15/min, admin 30/min, billing 20/min, aiGeneration 20/min, mutation 60/min, readDefault 120/min (04-02)
- In-memory Map in signup route removed — replaced with distributed Upstash Redis limiter (04-02)
- 3 other rate limiter files left untouched — future consolidation task (04-02)
- verify-token returns only { valid, userId } — minimal data exposure (04-03)
- sentry-test guarded by NODE_ENV, returns 404 in production (04-03)
- auth/profile switched from email-param lookup to userId-scoped queries (04-03)
- Monitoring infrastructure endpoints (health-dashboard, metrics, performance, events) kept public (04-03)
- stats and trending endpoints are intentionally public marketing data (04-03)
- TikTok uses fetch() directly — no SDK, consistent with Instagram/LinkedIn (05-01)
- TikTok deletePost returns false — API does not support programmatic deletion (05-01)
- TikTok syncAnalytics combines user info + video list (no aggregated analytics API) (05-01)
- YouTube uses fetch() directly — consistent with all other platform services (05-02)
- YouTube deletePost fully implemented via DELETE /videos?id={id} (05-02)
- YouTube syncAnalytics tries Analytics API first, falls back to channel+video stats (05-02)
- YouTube token refresh preserves original refresh token (Google doesn't issue new one) (05-02)
- YouTube-specific features (playlist add, thumbnail upload) stay in route, not in service (05-02)
- Pinterest uses fetch() directly — consistent with all other platform services (05-03)
- Pinterest deletePost fully implemented via DELETE /v5/pins/{id} returning 204 (05-03)
- Pinterest syncAnalytics handles 403 for personal accounts — business-only endpoint (05-03)
- Pinterest boardId is REQUIRED for createPost — pins must belong to a board (05-03)
- Pinterest GET route includes boards in metadata for UI board selection (05-03)
- Pinterest video pins not supported via URL — require pre-upload (05-03)
- Reddit uses fetch() directly — consistent with all other platform services (05-04)
- Reddit POST requests use form-encoded bodies (URLSearchParams), not JSON (05-04)
- All Reddit API requests include User-Agent header (Synthex/1.0) to avoid 429s (05-04)
- Reddit posts require both title and subreddit — validated with Zod in route (05-04)
- Reddit delete uses t3_ prefix for post fullnames (05-04)
- Reddit syncAnalytics returns karma as engagement proxy — no impressions API (05-04)
- Reddit GET route supports ?subreddits=true for listing subscribed subreddits (05-04)
- Threads uses Meta Graph API with base URL https://graph.threads.net/v1.0/ (05-05)
- Threads two-step post creation: create container then publish (same as Instagram pattern) (05-05)
- Threads token refresh uses th_refresh_token grant type (05-05)
- Threads deletePost attempts DELETE but gracefully returns false if unsupported (05-05)
- All 9 platforms verified in factory -- every platform returns non-null service instance (05-05)
- competitor-fetcher.ts is standalone module — does not import full platform services (06-01)
- Failed competitor fetches create snapshots with dataSource 'error' or 'unsupported', never zeros (06-01)
- Alert detection is per-platform with real deltas: follower >10% = warning, engagement >50% = info (06-01)
- Reddit competitor lookup needs no auth — public about.json endpoint (06-01)
- YouTube competitor lookup supports API key fallback (YOUTUBE_API_KEY or GOOGLE_API_KEY) (06-01)

### Deferred Issues

- Legacy src/ services (analytics.service.js, dashboard-service.ts, competitor-analysis.js, white-label.js) have extensive mock data — deferred until Next.js migration
- src/agents/ specialist coordinators have mock metrics — deferred until agent system connected to real APIs
- 8 standalone feature components (SentimentAnalysis, AIHashtagGenerator, AIPersonaManager, AIABTesting, PredictiveAnalytics, RealTimeAnalytics, ROICalculator, WorkflowAutomation) have mock data — not imported by dashboard pages, deferred to Phase 5+
- scripts/emergency-deploy.js and scripts/fix-production-site.js reference deleted config/env.server.ts as write target — update when scripts are next maintained

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-17
Stopped at: Completed 06-01-PLAN.md (1 of 2 in Phase 6) — Competitor tracking cron wired to real platform APIs
Resume file: None
Next action: Execute 06-02-PLAN.md (Weekly digest email and verify all crons)
