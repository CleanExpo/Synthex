# Synthex Enhancement & Hardening

## What This Is

AI-powered marketing automation platform — production-hardened with zero mock data, 9 social platform integrations, 1433+ passing tests, and 225 verified API endpoints. Next.js 15 full-stack app deployed on Vercel.

## Core Value

**Every endpoint returns real data, every platform works, every dashboard page connects to live APIs.** No mock data, no stubs, no silent fallbacks.

## Current State (v1.5 Deployment Readiness — Phase 55 of 58)

- 225 route files, 395 HTTP endpoints (223 active, 2 intentional stubs, 0 mock, 0 broken)
- 9 social platforms operational (Twitter, LinkedIn, Instagram, Facebook, TikTok, YouTube, Pinterest, Reddit, Threads)
- 56 test suites, 1433 tests passing (198 API contract tests, Playwright E2E suite, Jest unit/integration)
- 91 Prisma models (added v1.2–v1.4 feature models)
- Clean build (no workarounds)
- v1.2: 3rd-party integrations (Canva, Buffer, Zapier), integration factory pattern, webhook system, approval workflows, team collaboration, role permissions
- v1.3: SEO & GEO features (AuthorProfile, SEOAudit, GEOAnalysis, Search Console, PageSpeed, Schema Markup, Scheduled Audits)
- v1.4: Creator Monetisation & AI Studio (AI Chat streaming SSE, Image Gen, Social Listening, Link-in-Bio, Sponsor CRM, Affiliate links)
- v1.5: E2E suite stabilised (Phases 52–53), API contract tests 74% Zod coverage (Phase 54), UI state audit in progress (Phase 55)

## Requirements

### Validated

- Next.js 15 App Router full-stack SPA
- 225+ API routes in `app/api/` (395 HTTP endpoints)
- 31 dashboard pages
- 67 Prisma models (PostgreSQL via Supabase)
- JWT + Google OAuth + GitHub OAuth authentication (PKCE)
- Stripe subscription billing (Free/Professional/Business/Custom tiers)
- AI content generation via OpenRouter, Anthropic, Google Gemini, OpenAI
- All 9 social platforms: Twitter/X, LinkedIn, Instagram, Facebook, TikTok, YouTube, Pinterest, Reddit, Threads -- v1.0
- Redis caching (Upstash), BullMQ job queues
- Sentry error tracking, PostHog analytics
- Vercel deployment with 5 cron jobs
- Zero mock data in API routes -- v1.0
- Zero mock fallbacks in dashboard pages -- v1.0
- Env validation at startup with fail-fast behavior -- v1.0
- Category-based rate limiting on all sensitive routes -- v1.0
- Auth middleware on all protected routes -- v1.0
- Weekly digest email sending -- v1.0
- 80%+ test coverage on auth, social, core services -- v1.0
- Clean build configuration -- v1.0
- Full endpoint audit with 0 broken routes -- v1.0
- Remove legacy src/services mock data -- v1.1
- Wire standalone components to real APIs -- v1.1
- Consolidate rate limiters -- v1.1
- ContentLibrary model and CRUD API -- v1.1
- Agent coordinators connected to real data -- v1.1
- Dashboard loading states and error boundaries -- v1.1
- ProductTour expanded (12 steps) -- v1.1
- Onboarding flow connected to ProductTour -- v1.1
- 3rd-party integrations: Canva, Buffer, Zapier via integration factory pattern — v1.2
- Integration registry as single source of truth for provider metadata — v1.2
- SEO & GEO: AuthorProfile, SEOAudit, GEOAnalysis, Research reports with citations — v1.3
- Creator Monetisation: Sponsor CRM (Sponsor/Deal/Deliverable), affiliate link cloaking — v1.4
- AI Studio: Conversational AI with streaming SSE, image generation, content repurposing — v1.4
- Social Listening: TrackedKeyword, SocialMention, brand monitoring — v1.4
- Link-in-Bio: Customisable landing pages (LinkBioPage, LinkBioLink) — v1.4
- E2E test suite: Playwright (auth, dashboard, onboarding flows) — v1.5
- API contract tests: 198 tests, 11 suites, 74% Zod route coverage — v1.5
- UI state audit: loading.tsx, error.tsx for all dashboard routes — v1.5

### Active

- Phase 55-02: Inline state audit — 13 dashboard pages for loading/empty/error coverage
- Phase 56: Responsive design audit + WCAG 2.1 AA compliance
- Phase 57: Bundle analysis, Prisma query optimisation
- Phase 58: Core Web Vitals compliance, Redis cache verification

### Out of Scope

- New feature development (beyond completing existing stubs)
- UI redesign or new dashboard pages
- Database schema changes (beyond adding indexes)
- New third-party integrations
- Mobile app development

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Mock data first priority | Vercel cron actively generates fake data every 30 min | Good -- eliminated all mock data in Phases 2-3 |
| Comprehensive depth (10 phases, 30 plans) | User wants every endpoint audited, all platforms, 80%+ coverage | Good -- 30/30 plans completed in 2 days |
| Keep Threads as 9th platform | OAuth provider already exists, uses Meta Graph API | Good -- implemented with 488 lines |
| Archive by git rm, not _archive/ | Files remain in git history, no directory bloat | Good -- clean repo |
| crypto.randomUUID() standard | Replace all Math.random() ID generation server-side | Good -- 23 files converted |
| fetch() directly for all platforms | Consistent pattern, no SDK dependency bloat (except twitter-api-v2) | Good -- all 9 platforms use same pattern |
| Schema-based contract testing | Zod schemas + response shapes, no E2E NextRequest mocking | Good -- 256 tests in Phase 8 |
| In-memory Maps → Prisma queries | Maps useless in serverless (cold starts reset state) | Good -- reliable across deployments |
| Category-based rate limiting | authStrict 5/min through readDefault 120/min | Good -- covers all sensitive routes |
| Integration factory pattern | Single createIntegrationService(provider, credentials) for Canva/Buffer/Zapier | Good — no schema migration needed (uses metadata JSON on PlatformConnection) |
| Streaming SSE for AI chat | Real-time feel without WebSocket complexity | Good — compatible with Vercel serverless |
| Schema-based contract testing (74% Zod) | Zod schemas + response shapes, no E2E NextRequest mocking | Good — 198 tests pass in CI, GET-only utility routes exempt |

## Constraints

- Windows 11 (PowerShell) development environment
- Must maintain Vercel deployment compatibility
- Cannot break existing live features while hardening
- Social platform APIs require valid OAuth credentials to test

## Deferred Items

All v1.0 deferred items resolved in v1.1:
- ✓ Legacy src/ services — 18 files removed
- ✓ Agent coordinators — 3 connected to real APIs
- ✓ Standalone components — 8 wired to real APIs
- ✓ Rate limiters — consolidated into lib/rate-limit/
- ✓ ContentLibrary — model added, CRUD API implemented

**Pre-existing issues (not blocking):**
- lib/prisma.ts adapter type errors (Prisma 6 driver adapter types)
- lib/video/capture-service.ts puppeteer-screen-recorder (optional video feature)
- 2 skipped contract tests require a live server (onboarding integration path)

**Deferred from v1.5 sprint findings:**
- 754 console.log statements identified — structured logger migration (non-blocking)
- 14 components over 600 lines — decomposition backlog (non-blocking)
- Skip links not implemented — WCAG enhancement (Phase 56)
- 2 E2E flaky tests (passed on retry): focus timing + responsive touch target

---
*Last updated: 2026-03-03 — v1.5 Phase 55-01 complete*
