# Synthex Enhancement & Hardening

## What This Is

AI-powered marketing automation platform — production-hardened with zero mock data, 9 social platform integrations, 1064 passing tests, and 225 verified API endpoints. Next.js 15 full-stack app deployed on Vercel.

## Core Value

**Every endpoint returns real data, every platform works, every dashboard page connects to live APIs.** No mock data, no stubs, no silent fallbacks.

## Current State (v1.1 shipped 2026-02-17)

- 225 route files, 395 HTTP endpoints (223 active, 2 intentional stubs, 0 mock, 0 broken)
- 9 social platforms operational (Twitter, LinkedIn, Instagram, Facebook, TikTok, YouTube, Pinterest, Reddit, Threads)
- 38 test suites, 1064 tests passing
- 68 Prisma models (added ContentLibrary)
- Clean build (no workarounds)
- All standalone components wired to real APIs
- Consolidated rate limiting in lib/rate-limit/
- Enhanced dashboard UX: loading states, error boundaries, ProductTour (12 steps)

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

### Active

(No active requirements — planning next milestone)

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

---
*Last updated: 2026-02-17 after v1.1 milestone*
