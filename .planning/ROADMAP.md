# Roadmap: Synthex Enhancement & Hardening

## Overview

Transform Synthex from a partially-mocked live platform into a fully production-hardened system where every endpoint returns real data, every social platform works, and critical paths have 80%+ test coverage. 10 phases, mock data elimination first.

## Domain Expertise

None (internal platform hardening)

## Phases

- [x] **Phase 1: Foundation Cleanup** - Remove legacy code, rewrite CLAUDE.md, consolidate env files
- [ ] **Phase 2: Mock Data — API Routes** - Replace 9 mock/stub API endpoints with real database queries
- [ ] **Phase 3: Mock Data — Dashboard** - Remove 3 silent mock fallbacks, implement error/empty states
- [ ] **Phase 4: Security Hardening** - Env validation at startup, rate limiting audit, auth middleware audit
- [ ] **Phase 5: Social Platform Completeness** - Implement TikTok, YouTube, Pinterest, Reddit, Threads services
- [ ] **Phase 6: Cron Jobs & Background Tasks** - Fix competitor cron, implement weekly digest email
- [ ] **Phase 7: Testing — Auth & Core** - 80%+ coverage on auth, social, and core services
- [ ] **Phase 8: Testing — API Contracts** - Contract tests for highest-value API routes + E2E
- [ ] **Phase 9: Performance & Build** - Clean build config, reduce bundle, optimize queries
- [ ] **Phase 10: Final Audit** - Full endpoint audit, documentation, deployment readiness

## Phase Details

### Phase 1: Foundation Cleanup
**Goal**: Remove dead code and confusion so all subsequent work targets the real codebase
**Depends on**: Nothing (first phase)
**Research**: Unlikely (internal cleanup)
**Plans**: 2 plans (consolidated from original 4 — cleanup work is bulk git rm, env consolidation pairs with CLAUDE.md rewrite)

Plans:
- [x] 01-01: Archive legacy Express app and remove root debris (Python, .md, scripts)
- [x] 01-02: Rewrite CLAUDE.md for Next.js 15 and consolidate environment files

### Phase 2: Mock Data — API Routes
**Goal**: Every API route returns real data or proper error — zero Math.random() or hardcoded arrays
**Depends on**: Phase 1
**Research**: Unlikely (wiring to existing Prisma models)
**Plans**: 5 plans

Plans:
- [x] 02-01: Fix competitor tracking mock data (critical — cron active every 30 min)
- [x] 02-02: Fix content generation mock persona
- [x] 02-03: Fix content library and research endpoints
- [x] 02-04: Fix monitoring, SEO, and integration stubs
- [ ] 02-05: Full endpoint audit (grep for remaining mock patterns)

### Phase 3: Mock Data — Dashboard
**Goal**: Dashboard pages show error states on failure, empty states with CTAs on empty data — never fake data
**Depends on**: Phase 2
**Research**: Unlikely (UI patterns)
**Plans**: 2 plans

Plans:
- [ ] 03-01: Fix admin and personas mock fallbacks
- [ ] 03-02: Fix experiments and full dashboard audit

### Phase 4: Security Hardening
**Goal**: Env validation at startup, rate limits on all sensitive routes, auth on all protected routes
**Depends on**: Phase 1
**Research**: Unlikely (applying existing security patterns)
**Plans**: 3 plans

Plans:
- [ ] 04-01: Startup validation and credential safety
- [ ] 04-02: Rate limiting coverage audit
- [ ] 04-03: Auth middleware audit

### Phase 5: Social Platform Completeness
**Goal**: All 9 platforms (Twitter, LinkedIn, Instagram, Facebook, TikTok, YouTube, Pinterest, Reddit, Threads) return valid services from factory
**Depends on**: Phase 2
**Research**: Likely (external API docs)
**Research topics**: TikTok Content Posting API, Pinterest API v5, Reddit API, YouTube Data API v3, Threads API
**Plans**: 5 plans

Plans:
- [ ] 05-01: TikTok service implementation
- [ ] 05-02: YouTube service implementation
- [ ] 05-03: Pinterest service implementation
- [ ] 05-04: Reddit service implementation
- [ ] 05-05: Threads service and factory verification

### Phase 6: Cron Jobs & Background Tasks
**Goal**: All 5 Vercel crons work with real data, weekly digest sends actual email
**Depends on**: Phase 2, Phase 5
**Research**: Unlikely (wiring existing services)
**Plans**: 2 plans

Plans:
- [ ] 06-01: Verify competitor cron uses real API calls
- [ ] 06-02: Implement weekly digest email and verify all crons

### Phase 7: Testing — Auth & Core
**Goal**: 80%+ coverage on lib/auth/ and lib/social/
**Depends on**: Phase 4, Phase 5
**Research**: Unlikely (extending existing test patterns)
**Plans**: 3 plans

Plans:
- [ ] 07-01: Auth flow test suite
- [ ] 07-02: Prisma service tests
- [ ] 07-03: Platform service tests

### Phase 8: Testing — API Contracts
**Goal**: Contract tests for top API routes, E2E critical paths, 80%+ coverage on lib/stripe/
**Depends on**: Phase 7
**Research**: Unlikely (extending existing test patterns)
**Plans**: 4 plans

Plans:
- [ ] 08-01: Content and analytics API tests
- [ ] 08-02: Auth and user API tests
- [ ] 08-03: Payment and webhook tests
- [ ] 08-04: E2E critical path tests

### Phase 9: Performance & Build
**Goal**: Clean build (no || true, no --legacy-peer-deps), smaller bundle, optimized queries
**Depends on**: Phase 8
**Research**: Unlikely (internal optimization)
**Plans**: 3 plans

Plans:
- [ ] 09-01: Build configuration cleanup
- [ ] 09-02: Dependency optimization
- [ ] 09-03: Database query optimization

### Phase 10: Final Audit
**Goal**: Every endpoint verified, documentation accurate, deployment ready
**Depends on**: Phase 9
**Research**: Unlikely
**Plans**: 2 plans

Plans:
- [ ] 10-01: Full endpoint audit report
- [ ] 10-02: Documentation and deployment readiness

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation Cleanup | 2/2 | Complete | 2026-02-16 |
| 2. Mock Data — API Routes | 4/5 | In progress | - |
| 3. Mock Data — Dashboard | 0/2 | Not started | - |
| 4. Security Hardening | 0/3 | Not started | - |
| 5. Social Platforms | 0/5 | Not started | - |
| 6. Cron Jobs | 0/2 | Not started | - |
| 7. Testing — Auth | 0/3 | Not started | - |
| 8. Testing — API | 0/4 | Not started | - |
| 9. Performance | 0/3 | Not started | - |
| 10. Final Audit | 0/2 | Not started | - |
