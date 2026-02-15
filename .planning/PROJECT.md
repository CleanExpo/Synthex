# Synthex Enhancement & Hardening

## What This Is

Production hardening and enhancement of Synthex — an AI-powered marketing automation platform. The platform is live but has critical gaps: mock data in API routes, incomplete social platform integrations, legacy dead code, and low test coverage.

## Core Value

**Every endpoint returns real data, every platform works, every dashboard page connects to live APIs.** No mock data, no stubs, no silent fallbacks.

## Requirements

### Validated (Existing Capabilities)

- Next.js 15 App Router full-stack SPA
- 100+ API routes in `app/api/`
- 31 dashboard pages
- 50+ Prisma models (PostgreSQL via Supabase)
- JWT + Google OAuth + GitHub OAuth authentication (PKCE)
- Stripe subscription billing (Free/Professional/Business/Custom tiers)
- AI content generation via OpenRouter, Anthropic, Google Gemini, OpenAI
- Twitter/X, LinkedIn, Instagram, Facebook social posting
- Redis caching (Upstash), BullMQ job queues
- Sentry error tracking, PostHog analytics
- Vercel deployment with 5 cron jobs

### Active

- [ ] Remove all mock/stub data from 9 API routes
- [ ] Remove silent mock fallbacks from 3 dashboard pages
- [ ] Implement TikTok, YouTube, Pinterest, Reddit, Threads platform services
- [ ] Archive legacy Synthex/ Express subdirectory
- [ ] Rewrite CLAUDE.md to reflect actual Next.js 15 architecture
- [ ] Consolidate 31 .env files to 5
- [ ] Wire env validation to app startup
- [ ] Complete rate limiting and auth middleware coverage
- [ ] Implement weekly digest email sending
- [ ] Achieve 80%+ test coverage on auth, stripe, social services
- [ ] Clean up 7 build scripts to 2
- [ ] Remove 240MB+ puppeteer from production dependencies
- [ ] Full endpoint audit with automated verification

### Out of Scope

- New feature development (beyond completing existing stubs)
- UI redesign or new dashboard pages
- Database schema changes (beyond adding indexes)
- New third-party integrations
- Mobile app development

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Mock data first priority | Vercel cron actively generates fake data every 30 min | Phase 2 before security |
| Comprehensive depth | User wants every endpoint audited, all platforms, 80%+ coverage | 10 phases, 30 plans |
| Keep Threads as 9th platform | OAuth provider already exists, uses Instagram Graph API | Added to Phase 5 |

## Constraints

- Windows 11 (PowerShell) development environment
- Must maintain Vercel deployment compatibility
- Cannot break existing live features while hardening
- Social platform APIs require valid OAuth credentials to test

---
*Last updated: 2026-02-16 after initialization*
