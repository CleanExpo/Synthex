# Roadmap: Synthex Enhancement & Hardening

## Overview

Transform Synthex from a partially-mocked live platform into a fully production-hardened system where every endpoint returns real data, every social platform works, and critical paths have 80%+ test coverage.

## Domain Expertise

None (internal platform work)

## Milestones

- ✅ [v1.0 Production Hardening](milestones/v1.0-ROADMAP.md) (Phases 1-10) — SHIPPED 2026-02-17
- ✅ [v1.1 Platform Enhancement](milestones/v1.1-ROADMAP.md) (Phases 11-18) — SHIPPED 2026-02-17
- ✅ **v1.2 Features** — Phases 19-29 — SHIPPED 2026-02-18
- ✅ **v1.3 Features** — Phases 30-35 — SHIPPED 2026-02-18
- ✅ [v1.4 Creator Monetization & AI Studio](milestones/v1.4-ROADMAP.md) (Phases 36-51) — SHIPPED 2026-02-18
- ✅ **v1.5 Deployment Readiness** — Phases 52-58 — SHIPPED 2026-03-03
- ✅ **v2.0 Reliable AI Agents** — Phases 59-66 — SHIPPED 2026-03-03
- ✅ [v3.0 Public Launch Readiness](milestones/v3.0-ROADMAP.md) — Phases 67-74 — SHIPPED 2026-03-10
- ✅ [v3.1 First Users](milestones/v3.1-ROADMAP.md) (Phases 75-76) — SHIPPED 2026-03-10
- ✅ **v4.0 Production Complete** — Phases 77-84 — SHIPPED 2026-03-10
- ✅ **v5.0 AI-Native GEO & Citation Engine** — Phases 85-100 — SHIPPED 2026-03-11
- 🚀 **v6.0 Adaptive Intelligence Engine** — Phases 101-107 — IN PROGRESS

## Phases

- [x] **Phase 1: Foundation Cleanup** - Remove legacy code, rewrite CLAUDE.md, consolidate env files
- [x] **Phase 2: Mock Data — API Routes** - Replace mock/stub API endpoints with real database queries
- [x] **Phase 3: Mock Data — Dashboard** - Remove silent mock fallbacks, implement error/empty states
- [x] **Phase 4: Security Hardening** - Env validation at startup, rate limiting audit, auth middleware audit
- [x] **Phase 5: Social Platform Completeness** - Implement TikTok, YouTube, Pinterest, Reddit, Threads services
- [x] **Phase 6: Cron Jobs & Background Tasks** - Fix competitor cron, implement weekly digest email
- [x] **Phase 7: Testing — Auth & Core** - 80%+ coverage on auth, social, and core services
- [x] **Phase 8: Testing — API Contracts** - Contract tests for highest-value API routes + E2E
- [x] **Phase 9: Performance & Build** - Clean build config, reduce bundle, optimize queries
- [x] **Phase 10: Final Audit** - Full endpoint audit, documentation, deployment readiness
- [x] **Phase 11: Deferred Cleanup — Legacy Services** - Migrate/remove legacy src/ services
- [x] **Phase 12: Deferred Cleanup — Components** - Wire standalone components, consolidate rate limiters
- [x] **Phase 13: Feature Completion — Models** - Add ContentLibrary model, implement stub routes
- [x] **Phase 14: Feature Completion — Agents** - Connect agent coordinators to real APIs
- [x] **Phase 15: Google Developer Console** - OAuth verification, production API credentials
- [x] **Phase 16: UI/UX — Dashboard Polish** - Improve layouts, loading states, error handling
- [x] **Phase 17: UI/UX — New Features** - Missing pages, feature discoverability, onboarding
- [x] **Phase 18: Final Verification** - Regression test, performance audit, documentation
- [x] **Phase 19: AI Template Library** - Reusable prompt templates and content patterns
- [x] **Phase 20: Content Optimization** - AI-powered suggestions for improving content quality
- [x] **Phase 21: Multi-format Generation** - Generate platform-specific content variations
- [x] **Phase 22: Analytics Dashboard v2** - Enhanced visualizations, drill-downs, date ranges
- [x] **Phase 23: Predictive Analytics** - ML engagement predictions, best-time-to-post
- [x] **Phase 24: Custom Reports Builder** - User-created report templates and exports
- [x] **Phase 25: Third-party Integrations** - Canva, Buffer, Zapier webhook receivers
- [x] **Phase 26: Webhook System** - Outbound webhooks for external integrations
- [x] **Phase 27: Approval Workflows** - Content review chains with notifications
- [x] **Phase 28: Team Collaboration** - Real-time comments, assignments, activity feeds
- [x] **Phase 29: Role Permissions** - Granular access control beyond org membership
- [x] **Phase 30: Technical SEO Dashboard** - UI for CWV metrics, mobile parity, robots.txt audits
- [x] **Phase 31: Search Console Integration** - Google Search Console API, indexing status, crawl errors
- [x] **Phase 32: PageSpeed Integration** - PageSpeed Insights API, CWV monitoring, performance trends
- [x] **Phase 33: Schema Markup Manager** - Visual JSON-LD editor, validation, injection preview
- [x] **Phase 34: GEO Readiness Dashboard** - AI search citability scores, passage analysis, optimization
- [x] **Phase 35: SEO Audit Automation** - Scheduled site audits, alerting, historical tracking
- [x] **Phase 36: AI Chat Assistant** - Conversational AI for content ideas and strategy
- [x] **Phase 37: AI Image Generation** - Generate visuals using AI models
- [x] **Phase 38: Content Repurposing** - Transform long content into multiple formats
- [x] **Phase 39: Brand Voice Engine** - Train AI on brand writing style
- [x] **Phase 40: Cross-posting Automation** - Post once, publish everywhere
- [x] **Phase 41: Content Calendar v2** - Enhanced calendar with team features
- [x] **Phase 42: Social Listening** - Monitor mentions, hashtags, competitors
- [x] **Phase 43: Link in Bio Pages** - Customizable landing pages
- [x] **Phase 44: Unified Dashboard** - All-platform metrics view
- [x] **Phase 45: Audience Insights** - Follower demographics and behavior
- [x] **Phase 46: Content Performance AI** - AI-powered content analysis
- [x] **Phase 47: Benchmark Reports** (2/2) - Industry comparison tools
- [x] **Phase 48: Revenue Tracker** (2/2) - Income tracking across sources
- [x] **Phase 49: ROI Calculator** (2/2) - Content investment return measurement
- [x] **Phase 50: Sponsor CRM** (2/2) - Brand deal management
- [x] **Phase 51: Affiliate Link Manager** (2/2) - Link insertion and tracking
- [x] **Phase 52: E2E Testing - Auth & Onboarding** - Playwright tests for auth flows
  Plans:
  - [x] 52-01: Fix auth-guard.spec.ts + create forgot-password page + validate fixtures
  - [x] 52-02: Run all auth/onboarding E2E tests + triage + document results (55/55 pass)
- [~] **Phase 53: E2E Testing - Dashboard & Campaigns** - Playwright tests for main app flows
  Plans:
  - [x] 53-01: Fix playwright.config.ts (workers/timeout), staging.spec.ts navigation
  - [x] 53-02: Fix strict mode violations (dashboard-tabs, responsive-design)
  - [ ] 53-03: Fix remaining 17 failures (auth links, dashboard pages, smoke)
  Status: 142 passed, 17 failed (from 57/40 at start) — 57% failure reduction
- [x] **Phase 54: API Contract Verification** - 11 contract suites, 198 tests passing, 74% route Zod coverage
  Plans:
  - [x] 54-01: Organization + approvals/roles contract tests (42 tests, 182 total passing)
  - [x] 54-02: Onboarding/referrals tests + full suite verification + coverage report (198 total)
- [~] **Phase 55: UI Audit - States** - Loading states, empty states, error boundaries
  Plans:
  - [x] 55-01: Create missing state files (root loading, platforms loading+error, seo error)
  - [ ] 55-02: Inline state audit — 13 pages for loading/empty/error coverage
- [ ] **Phase 56: UI Audit - Responsive** - Responsive design and accessibility
- [ ] **Phase 57: Performance - Bundle** - Bundle optimization and query analysis
- [ ] **Phase 58: Performance - Vitals** - Caching verification and Core Web Vitals
- [x] **Phase 75: God Mode Admin Panel** - Founder admin panel for managing users, orgs, platform health
- [x] **Phase 76: NEXUS Branding & Unite-Hub** - NEXUS branding throughout app + Unite-Hub API connector
- [x] **Phase 77: Content Creation Flow** - Upload/generate/preview UX for real content publishing
- [x] **Phase 78: Post Queue & Scheduling** - Scheduling engine UX, queue management, bulk scheduling
- [x] **Phase 79: Admin Completion** - Role updates, password reset, MRR from Stripe, audit log detail
- [x] **Phase 80: Brand Profile Setup** - Multi-brand profile configuration in God Mode
- [x] **Phase 81: Social Account Onboarding** - Connect real social accounts, audit presence, content strategy
- [x] **Phase 82: Code Quality** - Structured logger migration, component decomposition
- [x] **Phase 83: Accessibility & Polish** - WCAG skip links, E2E flaky test fixes, responsive edge cases
- [x] **Phase 84: Final UAT & Launch** - End-to-end acceptance testing, production verification
- [x] **Phase 85: Entity Coherence Engine** - NLP entity extraction, density scoring, coherence checking for AI citation
- [x] **Phase 86: Authority Engine & Design Audit** - Authoritative citation validation, claim verification against gov/academic/industry sources, Design & CRO audit with CITABLE framework, $22/month addon — COMPLETE 2026-03-11
- [x] **Phase 87: GEO Content Optimiser v2** - Princeton 9-tactic framework with real-time scoring and AI rewriting — COMPLETE 2026-03-11
- [x] **Phase 88: Writing Context & Voice Fingerprinting** - Human writing methodology, voice pattern extraction, Content Capsule Technique — COMPLETE 2026-03-11
- [x] **Phase 89: AI Slop Detection & Content Quality Gate** - Tell-phrase scanning, humanness scoring, quality enforcement — COMPLETE 2026-03-11
- [x] **Phase 90: E-E-A-T Score Builder** - Automated 20-point E-E-A-T auditing and asset generation — COMPLETE 2026-03-11
- [x] **Phase 91: Personal & Business Brand Builder** - Brand recognition automation, Knowledge Panel optimisation — COMPLETE 2026-03-11
- [x] **Phase 92: Journalist & PR Relationship Manager** - CRM for journalist relationships, pitch tracking, coverage monitoring — COMPLETE 2026-03-11
- [x] **Phase 93: Press Release Generator & Distribution** - AI-optimised PR creation with indexed distribution — COMPLETE 2026-03-11
- [x] **Phase 94: Award & Directory Orchestrator** - Systematic award submissions and niche directory listings — COMPLETE 2026-03-11
- [x] **Phase 95: AI Backlink Prospector** - AI-powered link opportunity finder with outreach automation — COMPLETE 2026-03-11
- [x] **Phase 96: Prompt Intelligence Tool** - Discover AI prompts, track competitive visibility, gap analysis — COMPLETE 2026-03-11
- [x] **Phase 97: Algorithm Sentinel & Site Health Agent** - Autonomous algorithm monitoring, crash detection, GSC integration — COMPLETE 2026-03-11
- [x] **Phase 98: Autonomous A/B Testing & Self-Healing Agent** - SEO experiments, recovery automation, dog-fooding enforcement — COMPLETE 2026-03-11
- [x] **Phase 99: Citation Performance Dashboard** - Unified GEO + SEO + citation + agent activity command centre — COMPLETE 2026-03-11
- [x] **Phase 100: v5.0 Integration Testing & Polish** - End-to-end verification, agent validation, documentation — COMPLETE 2026-03-11
- [x] **Phase 101: Adaptive Intelligence Engine — Infrastructure** - FastAPI microservice (BO + Prophet + BayesNF), TypeScript client library, Prisma models, BullMQ queue — COMPLETE 2026-03-11
- [x] **Phase 102: GEO Weight Optimisation Surfaces** - Wire BO into geo-analyzer.ts + tactic-scorer.ts, API routes, auto-observation, callback webhook — COMPLETE 2026-03-11
- [x] **Phase 103: BO Client-Facing Dashboard** - Optimisation spaces UI, learning indicators, run history, subscription gating — COMPLETE 2026-03-11
- [x] **Phase 104: Experiment + Prompt Surfaces** - A/B test sampling + prompt testing BO surfaces, Growth-tier gating — COMPLETE 2026-03-11
- [x] **Phase 105: Advanced Surfaces** - Scheduling, backlinks, psychology, self-healing, campaign ROI surfaces (Scale tier) — COMPLETE 2026-03-11
- [x] **Phase 106: Prophet Time-Series Forecasting** - Prophet dashboard, forecast charts with confidence bands, auto-training cron — COMPLETE 2026-03-11
- [ ] **Phase 107: BayesNF Spatiotemporal Predictions** - Cross-platform heatmap, spatiotemporal model training, Scale-tier predictions

## Phase Details

<details>
<summary>✅ v1.0 Production Hardening (Phases 1-10) — SHIPPED 2026-02-17</summary>

See [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) for full details.

**Key accomplishments:**
- Removed 420+ legacy files (99,000+ lines)
- Eliminated all mock data from API routes and dashboard
- Implemented 5 social platform services (TikTok, YouTube, Pinterest, Reddit, Threads)
- Built 1064 tests across 38 suites
- Audited 225 route files (395 endpoints) — 0 broken, 0 mock

</details>

<details>
<summary>✅ v1.1 Platform Enhancement (Phases 11-18) — SHIPPED 2026-02-17</summary>

See [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) for full details.

**Key accomplishments:**
- Removed 18 legacy service files (11,984 lines of mock data)
- Wired 8 standalone components to real APIs
- Consolidated 11 rate limiter files into lib/rate-limit/
- Added ContentLibrary Prisma model with CRUD API
- Connected 3 agent coordinators to real platform metrics
- Enhanced dashboard UX: loading states, error boundaries, ProductTour (12 steps)

</details>

<details>
<summary>✅ v1.2 Features (Phases 19-29) — SHIPPED 2026-02-18</summary>

**Milestone Goal:** Add new functionality across AI content generation, analytics, integrations, and collaboration.

**Key accomplishments:**
- Built AI Template Library with PromptTemplate model and CRUD API
- Implemented Content Optimization scoring service with dashboard UI
- Created Multi-format Generation for platform-specific content variations
- Enhanced Analytics Dashboard v2 with drill-downs, date ranges, comparisons
- Added Predictive Analytics with forecast charts and best-time heatmaps
- Built Custom Reports Builder with drag-drop widgets and exports
- Integrated third-party services (Canva, Buffer, Zapier webhooks)
- Implemented outbound Webhook System for external subscriptions
- Created Approval Workflows with role-based review chains
- Added Team Collaboration with real-time comments and activity feeds
- Built Role Permissions system with granular access control
- **Added `search-engineer-pro` skill suite** — Technical SEO execution with Google API integration (Search Console, Business Profile, PageSpeed Insights), mobile parity audits, INP optimization, schema injection

</details>

#### Phase 19: AI Template Library

**Goal**: Build reusable prompt templates and content patterns system
**Depends on**: v1.1 complete
**Research**: Unlikely (internal patterns)
**Plans**: TBD

Plans:
- [x] 19-01: Database & API (PromptTemplate model, CRUD routes, seed script)

#### Phase 20: Content Optimization

**Goal**: AI-powered suggestions for improving content quality
**Depends on**: Phase 19
**Research**: Likely (AI model selection, prompt engineering best practices)
**Research topics**: Content scoring algorithms, readability metrics, AI suggestion UX
**Plans**: 2/2 | Complete | 2026-02-18

Plans:
- [x] 20-01: Content Scoring Service & API (scorer, endpoint, React hook)
- [x] 20-02: Content Optimization UI (dashboard page, navigation, command palette)

#### Phase 21: Multi-format Generation

**Goal**: Generate platform-specific content variations from single input
**Depends on**: Phase 20
**Research**: Unlikely (platform patterns established in v1.0)
**Plans**: 2/2 | Complete | 2026-02-18

Plans:
- [x] 21-01: Multi-format Adapter Service & API (service, endpoint)
- [x] 21-02: Multi-format Generation UI (dashboard page, navigation, command palette)

#### Phase 22: Analytics Dashboard v2

**Goal**: Enhanced visualizations with drill-downs, custom date ranges, comparisons
**Depends on**: Phase 21
**Research**: Unlikely (Recharts patterns exist)
**Plans**: 2/2 | Complete | 2026-02-18

Plans:
- [x] 22-01: Analytics Data Refactor & Date Ranges (hook, date picker, wire charts)
- [x] 22-02: Post Drill-Down & Enhanced Tables (detail sheet, metric table tabs)

#### Phase 23: Predictive Analytics

**Goal**: ML-powered engagement predictions and best-time-to-post recommendations
**Depends on**: Phase 22
**Research**: Skipped (all prediction backend already built in v1.1)
**Plans**: 2/2 | Complete | 2026-02-18

Plans:
- [x] 23-01: Prediction Hooks, Dashboard Page & Navigation (hooks, types, page, sidebar, command palette)
- [x] 23-02: Forecast Chart & Best-Time Heatmap (Recharts area chart with confidence bands, 7x24 heatmap)

#### Phase 24: Custom Reports Builder

**Goal**: User-created report templates with drag-drop widgets and exports
**Depends on**: Phase 23
**Research**: Unlikely (internal patterns)
**Plans**: 2/2 | Complete | 2026-02-18

Plans:
- [x] 24-01: Hook + API Wiring (useReportTemplates, useReportExport hooks, refactor CustomReportBuilder to real APIs)
- [x] 24-02: Page Route + Navigation (builder page, sidebar, command palette, reports page CTA)

#### Phase 25: Third-party Integrations

**Goal**: Connect to Canva, Buffer, Zapier via API/webhooks
**Depends on**: Phase 24
**Research**: Likely (external API documentation, OAuth flows)
**Research topics**: Canva Connect API, Buffer API, Zapier webhook specs
**Plans**: 2/2 | Complete | 2026-02-18

Plans:
- [x] 25-01: Integration Services & API (lib/integrations/, third-party API routes, hook, Zapier webhook receiver)
- [x] 25-02: Integrations UI Update (third-party components, page update, command palette)

#### Phase 26: Webhook System

**Goal**: Outbound webhooks allowing external systems to subscribe to events
**Depends on**: Phase 25
**Research**: Unlikely (webhook patterns are standard)
**Plans**: 2/2 | Complete | 2026-02-18

Plans:
- [x] 26-01: WebhookEndpoint Model + CRUD API + Hook (Prisma model, rewrite stub routes, useWebhooks hook)
- [x] 26-02: Webhooks Dashboard + Navigation (page, sidebar, command palette)

#### Phase 27: Approval Workflows

**Goal**: Content review chains with role-based approvers and notifications
**Depends on**: Phase 26
**Research**: Unlikely (internal workflow patterns)
**Plans**: 2/2 | Complete | 2026-02-18

Plans:
- [x] 27-01: ApprovalRequest + WorkflowTemplate models + CRUD API routes
- [x] 27-02: useApprovals hook + dashboard page + navigation

#### Phase 28: Team Collaboration

**Goal**: Real-time comments, assignments, activity feeds on content
**Depends on**: Phase 27
**Research**: Skipped (WebSocket infrastructure already exists from v1.1)
**Plans**: 2/2 | Complete | 2026-02-18

Plans:
- [x] 28-01: Comments & Shares API + Hooks (CRUD routes, useComments, useShares)
- [x] 28-02: Collaboration Dashboard + Navigation (useActivity, dashboard page, sidebar, command palette)

#### Phase 29: Role Permissions

**Goal**: Granular access control beyond organization membership
**Depends on**: Phase 28
**Research**: Skipped (RoleManager + PermissionEngine already exist)
**Plans**: 2/2 | Complete | 2026-02-18

Plans:
- [x] 29-01: Roles API + useRoles Hook (CRUD routes, grant/revoke, hook)
- [x] 29-02: Roles Dashboard + Navigation (role cards, permission editor, user assignment)

### ✅ v1.3 Features (SHIPPED 2026-02-18)

**Milestone Goal:** Build comprehensive SEO and search optimization features leveraging the search-engineer-pro skill suite.

**Key accomplishments:**
- Built Technical SEO Dashboard with CWV monitoring, mobile parity, robots.txt validation
- Integrated Google Search Console API for indexing status and performance data
- Added PageSpeed Insights integration with performance trends and historical tracking
- Created Schema Markup Manager with visual JSON-LD editor and rich preview
- Built GEO Readiness Dashboard for AI search citability and passage optimization
- Implemented SEO Audit Automation with scheduled audits, regression alerts, and email notifications

#### Phase 30: Technical SEO Dashboard

**Goal**: UI for Core Web Vitals metrics, mobile parity audits, robots.txt validation
**Depends on**: v1.2 complete
**Research**: Unlikely (internal patterns, search-engineer-pro skill exists)
**Plans**: 1/1 | Complete | 2026-02-18

Plans:
- [x] 30-01: Technical SEO service, API routes, hook, dashboard page, navigation

#### Phase 31: Search Console Integration

**Goal**: Connect Google Search Console API for indexing status, crawl errors, performance data
**Depends on**: Phase 30
**Research**: Likely (Google Search Console API setup, OAuth scopes)
**Research topics**: GSC API authentication, data retrieval patterns, rate limits
**Plans**: 1/1 | Complete | 2026-02-18

Plans:
- [x] 31-01: Search Console service, API routes, hook, dashboard page, navigation

#### Phase 32: PageSpeed Integration

**Goal**: PageSpeed Insights API integration, CWV monitoring dashboard, performance trends
**Depends on**: Phase 31
**Research**: Likely (PageSpeed Insights API v5, CrUX data)
**Research topics**: PSI API parameters, field vs lab data, historical tracking
**Plans**: 1/1 | Complete | 2026-02-18

Plans:
- [x] 32-01: PageSpeed service, API routes, hook, dashboard page, navigation

#### Phase 33: Schema Markup Manager

**Goal**: Visual JSON-LD editor, schema validation, injection preview, template library
**Depends on**: Phase 32
**Research**: Unlikely (internal patterns, schema.org specs known)
**Plans**: 2/2 | Complete

Plans:
- [x] 33-01: Schema Markup Service + API Routes (service, validate, extract, templates, rich preview)
- [x] 33-02: Hook + Enhanced Dashboard + Navigation (useSchemaMarkup, tabbed UI, hub card, command palette)

#### Phase 34: GEO Readiness Dashboard

**Goal**: AI search citability scores, passage-level analysis, platform-specific optimization
**Depends on**: Phase 33
**Research**: Unlikely (geo-engine skill exists)
**Plans**: 2/2 | Complete | 2026-02-18

Plans:
- [x] 34-01: GEO Readiness Service + API Routes (service, analyze, history, trends)
- [x] 34-02: useGeoReadiness Hook + Dashboard Page + Navigation (hook, 4-tab page, SEO hub card, command palette)

#### Phase 35: SEO Audit Automation

**Goal**: Scheduled comprehensive site audits, alerting on regressions, historical tracking
**Depends on**: Phase 34
**Research**: Unlikely (cron patterns exist from v1.0)
**Plans**: 2/2 | Complete | 2026-02-18

Plans:
- [x] 35-01: ScheduledAuditTarget model + CRUD API + Cron job + regression detection + email alerts
- [x] 35-02: useScheduledAudits + useAuditHistory hooks + 3-tab dashboard page + navigation

<details>
<summary>✅ v1.4 Creator Monetization & AI Studio (Phases 36-51) — SHIPPED 2026-02-18</summary>

See [milestones/v1.4-ROADMAP.md](milestones/v1.4-ROADMAP.md) for full details.

**Key accomplishments:**
- AI Chat Assistant with streaming SSE and conversation history
- AI Image Generation (OpenAI/Stability providers)
- Revenue tracking across sponsorships, affiliates, ads, tips, merchandise
- Sponsor CRM with deals pipeline and deliverable tracking
- Affiliate link management with auto-insertion and click tracking
- Social listening with keyword monitoring and mention alerts
- Link in Bio pages with customizable themes and analytics

</details>

### ✅ v1.5 Deployment Readiness (SHIPPED 2026-03-03)

**Milestone Goal:** Ensure everything built in v1.0-v1.4 is tested, polished, and production-ready. No new features — focus on testing, verification, and optimization.

#### Phase 52: E2E Testing - Auth & Onboarding

**Goal**: Playwright tests for authentication and onboarding user flows
**Depends on**: v1.4 complete
**Research**: Unlikely (Playwright patterns exist from v1.0)
**Plans**: 2 plans

Plans:
- [x] 52-01: Fix auth-guard.spec.ts + create forgot-password page + validate fixtures
- [ ] 52-02: Run all auth/onboarding E2E tests + triage + document results

#### Phase 53: E2E Testing - Dashboard & Campaigns

**Goal**: Playwright tests for dashboard navigation, campaign creation, analytics
**Depends on**: Phase 52
**Research**: Unlikely (internal patterns)
**Plans**: TBD

Plans:
- [ ] 53-01: TBD

#### Phase 54: API Contract Verification

**Goal**: Schema validation for all 65+ API route categories, Zod response shapes
**Depends on**: Phase 53
**Research**: Unlikely (Zod patterns established)
**Plans**: TBD

Plans:
- [ ] 54-01: TBD

#### Phase 55: UI Audit - States

**Goal**: Audit all 30+ dashboard pages for loading states, empty states, error boundaries
**Depends on**: Phase 54
**Research**: Unlikely (internal patterns)
**Plans**: 1/2 | In progress | 2026-03-02

Plans:
- [x] 55-01: Create missing state files (root loading, platforms loading+error, seo error)
- [ ] 55-02: Inline state audit — 13 pages for loading/empty/error coverage

#### Phase 56: UI Audit - Responsive

**Goal**: Responsive design audit and accessibility (WCAG 2.1 AA) compliance
**Depends on**: Phase 55
**Research**: Unlikely (established guidelines)
**Plans**: TBD

Plans:
- [ ] 56-01: TBD

#### Phase 57: Performance - Bundle

**Goal**: Bundle size analysis, Prisma query optimization, dead code elimination
**Depends on**: Phase 56
**Research**: Unlikely (internal patterns)
**Plans**: TBD

Plans:
- [ ] 57-01: TBD

#### Phase 58: Performance - Vitals

**Goal**: Redis caching verification, Core Web Vitals compliance (LCP < 2.5s, INP < 200ms)
**Depends on**: Phase 57
**Research**: Unlikely (PageSpeed integration exists)
**Plans**: TBD

Plans:
- [ ] 58-01: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation Cleanup | v1.0 | 2/2 | Complete | 2026-02-16 |
| 2. Mock Data — API Routes | v1.0 | 5/5 | Complete | 2026-02-16 |
| 3. Mock Data — Dashboard | v1.0 | 2/2 | Complete | 2026-02-16 |
| 4. Security Hardening | v1.0 | 3/3 | Complete | 2026-02-16 |
| 5. Social Platforms | v1.0 | 5/5 | Complete | 2026-02-16 |
| 6. Cron Jobs | v1.0 | 2/2 | Complete | 2026-02-17 |
| 7. Testing — Auth | v1.0 | 3/3 | Complete | 2026-02-17 |
| 8. Testing — API | v1.0 | 4/4 | Complete | 2026-02-17 |
| 9. Performance | v1.0 | 3/3 | Complete | 2026-02-17 |
| 10. Final Audit | v1.0 | 2/2 | Complete | 2026-02-17 |
| 11. Deferred — Legacy | v1.1 | 1/1 | Complete | 2026-02-17 |
| 12. Deferred — Components | v1.1 | 4/4 | Complete | 2026-02-17 |
| 13. Feature — Models | v1.1 | 1/1 | Complete | 2026-02-17 |
| 14. Feature — Agents | v1.1 | 1/1 | Complete | 2026-02-17 |
| 15. Google Console | v1.1 | 1/1 | Complete | 2026-02-17 |
| 16. UI/UX — Polish | v1.1 | 3/3 | Complete | 2026-02-17 |
| 17. UI/UX — Features | v1.1 | 3/3 | Complete | 2026-02-17 |
| 18. Final Verification | v1.1 | 1/1 | Complete | 2026-02-17 |
| 19. AI Template Library | v1.2 | 1/1 | Complete | 2026-02-17 |
| 20. Content Optimization | v1.2 | 2/2 | Complete | 2026-02-18 |
| 21. Multi-format Generation | v1.2 | 2/2 | Complete | 2026-02-18 |
| 22. Analytics Dashboard v2 | v1.2 | 2/2 | Complete | 2026-02-18 |
| 23. Predictive Analytics | v1.2 | 2/2 | Complete | 2026-02-18 |
| 24. Custom Reports Builder | v1.2 | 2/2 | Complete | 2026-02-18 |
| 25. Third-party Integrations | v1.2 | 2/2 | Complete | 2026-02-18 |
| 26. Webhook System | v1.2 | 2/2 | Complete | 2026-02-18 |
| 27. Approval Workflows | v1.2 | 2/2 | Complete | 2026-02-18 |
| 28. Team Collaboration | v1.2 | 2/2 | Complete | 2026-02-18 |
| 29. Role Permissions | v1.2 | 2/2 | Complete | 2026-02-18 |
| 30. Technical SEO Dashboard | v1.3 | 1/1 | Complete | 2026-02-18 |
| 31. Search Console Integration | v1.3 | 1/1 | Complete | 2026-02-18 |
| 32. PageSpeed Integration | v1.3 | 1/1 | Complete | 2026-02-18 |
| 33. Schema Markup Manager | v1.3 | 2/2 | Complete | - |
| 34. GEO Readiness Dashboard | v1.3 | 2/2 | Complete | 2026-02-18 |
| 35. SEO Audit Automation | v1.3 | 2/2 | Complete | 2026-02-18 |
| 36. AI Chat Assistant | v1.4 | 2/2 | Complete | 2026-02-18 |
| 37. AI Image Generation | v1.4 | 2/2 | Complete | 2026-02-18 |
| 38. Content Repurposing | v1.4 | 1/1 | Complete | 2026-02-18 |
| 39. Brand Voice Engine | v1.4 | 1/1 | Complete | 2026-02-18 |
| 40. Cross-posting Automation | v1.4 | 1/1 | Complete | 2026-02-18 |
| 41. Content Calendar v2 | v1.4 | 2/2 | Complete | 2026-02-18 |
| 42. Social Listening | v1.4 | 2/2 | Complete | 2026-02-18 |
| 43. Link in Bio Pages | v1.4 | 2/2 | Complete | 2026-02-18 |
| 44. Unified Dashboard | v1.4 | 2/2 | Complete | 2026-02-18 |
| 45. Audience Insights | v1.4 | 2/2 | Complete | 2026-02-18 |
| 46. Content Performance AI | v1.4 | 2/2 | Complete | 2026-02-18 |
| 47. Benchmark Reports | v1.4 | 2/2 | Complete | 2026-02-18 |
| 48. Revenue Tracker | v1.4 | 2/2 | Complete | 2026-02-18 |
| 49. ROI Calculator | v1.4 | 2/2 | Complete | 2026-02-18 |
| 50. Sponsor CRM | v1.4 | 2/2 | Complete | 2026-02-18 |
| 51. Affiliate Link Manager | v1.4 | 2/2 | Complete | 2026-02-18 |
| 52. E2E Testing - Auth | v1.5 | 0/2 | Planned | - |
| 53. E2E Testing - Dashboard | v1.5 | 0/? | Not started | - |
| 54. API Contract Verification | v1.5 | 0/? | Not started | - |
| 55. UI Audit - States | v1.5 | 1/2 | In progress | 2026-03-02 |
| 56. UI Audit - Responsive | v1.5 | 0/? | Not started | - |
| 57. Performance - Bundle | v1.5 | 0/? | Not started | - |
| 58. Performance - Vitals | v1.5 | 1/1 | Complete | 2026-03-03 |
| 59. Context Resilience Infrastructure | v2.0 | 0/? | Not started | - |
| 60. Agent Orchestration Hardening | v2.0 | 0/? | Not started | - |
| 61. AI Session Memory & Persistence | v2.0 | 2/2 | Complete | 2026-03-03 |
| 62. Multi-step Workflow Engine | v2.0 | 1/3 | In progress | - |
| 63. Parallel Agent Execution | v2.0 | 0/? | Not started | - |
| 64. AI Quality & Brand Voice Guardian | v2.0 | 0/? | Not started | - |
| 65. Campaign Intelligence Engine | v2.0 | 0/? | Not started | - |
| 66. Autonomous Insights Agent | v2.0 | 1/1 | Complete | 2026-03-03 |
| 67. Codebase Cleanup | v3.0 | 3/3 | Done | 2026-03-03 |
| 68. Stripe Activation | v3.0 | 3/3 | Done | 2026-03-03 |
| 69. Public Landing Page | v3.0 | 1/1 | Done | 2026-03-03 |
| 70. Onboarding Funnel | v3.0 | 2/2 | Done | 2026-03-10 |
| 71. Observability & Monitoring | v3.0 | 1/1 | Done | 2026-03-10 |
| 72. Performance Hardening | v3.0 | 1/1 | Done | 2026-03-10 |
| 73. Pre-launch Security | v3.0 | 0/? | Not started | - |
| 74. Launch Day | v3.0 | 0/? | Not started | - |
| 75. God Mode Admin Panel | v3.1 | 1/1 | Complete | 2026-03-10 |
| 76. NEXUS Branding & Unite-Hub | v3.1 | 1/1 | Complete | 2026-03-10 |
| 77. Content Creation Flow | v4.0 | 0/4 | Planned | - |
| 85. Entity Coherence Engine | v5.0 | 0/2 | Planned | - |
| 86. Citation Tracking & Monitoring | v5.0 | 0/3 | Planned | - |
| 87. GEO Content Optimiser v2 | v5.0 | 0/3 | Planned | - |
| 88. Writing Context & Voice Fingerprinting | v5.0 | 0/3 | Planned | - |
| 89. AI Slop Detection & Content Quality Gate | v5.0 | 0/3 | Planned | - |
| 90. E-E-A-T Score Builder | v5.0 | 0/3 | Planned | - |
| 91. Personal & Business Brand Builder | v5.0 | 3/3 | Complete | 2026-03-11 |
| 92. Journalist & PR Relationship Manager | v5.0 | 0/2 | Planned | - |
| 93. Press Release Generator & Distribution | v5.0 | 0/2 | Planned | - |
| 94. Award & Directory Orchestrator | v5.0 | 0/2 | Planned | - |
| 95. AI Backlink Prospector | v5.0 | 0/3 | Planned | - |
| 96. Prompt Intelligence Tool | v5.0 | 0/2 | Planned | - |
| 97. Algorithm Sentinel & Site Health Agent | v5.0 | 2/2 | Complete | 2026-03-11 |
| 98. Autonomous A/B Testing & Self-Healing Agent | v5.0 | 0/3 | Planned | - |
| 99. Citation Performance Dashboard | v5.0 | 0/2 | Planned | - |
| 100. v5.0 Integration Testing & Polish | v5.0 | 0/2 | Planned | - |

### ✅ v2.0 Reliable AI Agents (SHIPPED 2026-03-03)

**Milestone Goal:** Context-resilient development infrastructure + AI orchestration platform
features. Transform Synthex from stateless AI tools into persistent, reliable AI agents.

Inspired by the "Context Drift Problem" research (Unite-Group, March 2026): PreCompact hooks,
subagent isolation, disk-based state, and hook enforcement applied to both dev infrastructure
and product features.

#### Phase 59: Context Resilience Infrastructure

**Goal**: Eliminate context drift risk in the development process
**Depends on**: v1.5 complete
**Research**: Done (Context Drift Problem research document, March 2026)
**Plans**: TBD

Plans:
- [ ] 59-01: CONSTITUTION.md + PreCompact hook + SessionStart + UserPromptSubmit hooks

#### Phase 60: Agent Orchestration Hardening

**Goal**: Automate Linear MCP session workflow; add project-level hive-mind orchestrator
**Depends on**: Phase 59
**Research**: Unlikely (internal patterns established)
**Plans**: TBD

Plans:
- [ ] 60-01: Linear session automation + hive-mind agent + pre-agent-dispatch.ps1

#### Phase 61: AI Session Memory & Persistence

**Goal**: AI conversations persist across page reload, re-authentication, and browser close
**Depends on**: Phase 60
**Research**: Unlikely (AIConversation model already exists)
**Plans**: 2 plans

Plans:
- [ ] 61-01: URL-based conversation routing (reload-persistent selection)
- [ ] 61-02: Auto-title + conversation search + archive toggle

#### Phase 62: Multi-step Workflow Engine

**Goal**: Define and execute sequential AI workflows with human-approval gates
**Depends on**: Phase 61
**Research**: Done (Stripe Minions synthesis — `.planning/research/stripe-minions-synthesis.md`)
**Architecture**: Minions-inspired blueprint pattern — deterministic orchestrator, bounded AI
  steps, confidence-gated auto-approval, 2-retry cap, human gates for external actions
**Plans**: 3/3 — COMPLETE

Plans:
- [x] 62-01: Prisma schema (WorkflowExecution + StepExecution) + core library
             (orchestrator.ts + step-executor.ts + context-builder.ts)
- [x] 62-02: API routes (6 endpoints) + step type implementations (7 types) + BullMQ integration
- [x] 62-03: Dashboard page (execution list, step progress, approval UI)

#### Phase 63: Parallel Agent Execution

**Goal**: Batch content generation; simultaneous platform variations; progress indicators
**Depends on**: Phase 62
**Research**: Done (Minions synthesis covers parallelism)
**Architecture**: True parallelism — N workflow executions simultaneously via BullMQ
  concurrency control; partial success model (allSettled not allRejected); each execution
  reads its own StepExecution chain with no shared state
**Plans**: 1/1 — COMPLETE (2026-03-03)

Plans:
- [x] 63-01: WORKFLOW_PARALLEL queue + enqueueWorkflowBatch + parallel-executor.ts + batch API routes + ParallelExecutionWidget + batchId schema field

#### Phase 64: AI Quality & Brand Voice Guardian

**Goal**: Auto-review all content before publishing; brand consistency scoring
**Depends on**: Phase 63
**Research**: Done (Minions "human review is load-bearing" principle directly applies)
**Architecture**: This IS the mandatory human review gate. Confidence scoring routes
  low-confidence content to human review; high-confidence auto-approved. Integrates with
  Phase 62 WorkflowExecution as a validation step type.
**Plans**: 1/1 — COMPLETE (2026-03-03)

Plans:
- [x] 64-01: QualityScorer + brand-voice API routes (score + review queue) + QualityScoreCard + ReviewQueuePanel + /dashboard/brand-voice

#### Phase 65: Campaign Intelligence Engine

**Goal**: Performance-based learning, pattern extraction, A/B auto-evaluation
**Depends on**: Phase 64
**Research**: Done (Minions: step output history as training signal)
**Architecture**: StepExecution.outputData + approval decisions feed back to prompt
  optimisation. Context > model — improve context assembly, not model version.
**Plans**: 1/1 — COMPLETE (2026-03-03)

Plans:
- [x] 65-01: pattern-extractor.ts + prompt-optimizer.ts + intelligence API + IntelligencePanel + Performance tab in WorkflowsPageClient

#### Phase 66: Autonomous Insights Agent

**Goal**: Scheduled AI proactively surfaces opportunities and auto-schedules top content
**Depends on**: Phase 65
**Research**: Done (Minions "minion invoked from cron" pattern)
**Architecture**: Scheduled workflow executions triggered by Vercel cron, bounded by
  circuit breakers (equivalent to Minions 2-round CI cap for scheduled agents).
**Plans**: 1/1 — COMPLETE (2026-03-03)

Plans:
- [x] 66-01: insights-agent.ts + /api/cron/insights + vercel.json cron + /api/insights + InsightsWidget + /dashboard/insights

<details>
<summary>✅ v3.0 Public Launch Readiness (Phases 67-74) — SHIPPED 2026-03-10</summary>

See [milestones/v3.0-ROADMAP.md](milestones/v3.0-ROADMAP.md) for full details.

**Key accomplishments:**
- Codebase cleanup: SWR standard enforced, 300 routes audited, dead packages removed
- Stripe Activation: AUD billing, feature gates, billing emails
- Public landing page: dynamic OG images, Starter tier, billing toggle
- Onboarding: D+0/D+3/D+7 welcome emails, ProductTour 18 steps
- Sentry v8, structured logging, Redis caching, CSP hardening
- LAUNCH-RUNBOOK.md + smoke-test.mjs — v3.0 go-live ready

</details>

<details>
<summary>✅ v3.1 First Users (Phases 75-76) — SHIPPED 2026-03-10</summary>

See [milestones/v3.1-ROADMAP.md](milestones/v3.1-ROADMAP.md) for full details.

**Key accomplishments:**
- God Mode admin panel: owner-only route guard, real SWR data fetching, suspend/activate/delete actions
- Shared verifyAdmin utility replacing 3x copy-paste auth implementations
- Unite-Group NEXUS branding in footer, metadata, about page, and JSON-LD org schema
- Unite-Hub connector: fire-and-forget event hooks wired into Stripe webhooks + publish flow
- Unite-Hub pull endpoint + daily revenue cron for cross-product metrics

</details>

### ✅ v4.0 Production Complete (SHIPPED 2026-03-10)

**Milestone Goal:** Finalise Synthex for full production use — content creation UX, scheduling engine, admin completion, brand profiles, social account onboarding, code quality, accessibility, and final UAT.

#### Phase 77: Content Creation Flow

**Goal**: Upload/generate/preview UX for real content publishing
**Depends on**: v3.1 complete
**Linear**: SYN-45
**Research**: Unlikely (existing AI generation + media upload patterns)
**Plans**: 4 plans

Plans:
- [x] 77-01: Media upload & attachment pipeline
- [x] 77-02: Platform preview cards & content composer upgrade
- [x] 77-03: Draft-to-publish pipeline & publish confirmation
- [x] 77-04: Multi-platform publish & post status tracking

#### Phase 78: Post Queue & Scheduling

**Goal**: Scheduling engine UX — queue management, time-slot picker, bulk scheduling
**Depends on**: Phase 77
**Linear**: SYN-44
**Research**: Unlikely (scheduling infrastructure exists from Phase 40-41)
**Plans**: 4 plans

Plans:
- [x] 78-01: Queue management dashboard
- [x] 78-02: Time-slot picker & conflict detection
- [x] 78-03: Bulk scheduling wizard & CSV import
- [x] 78-04: Publish cron hardening & schedule health

#### Phase 79: Admin Completion

**Goal**: Complete admin panel — role update API, password reset, MRR from Stripe API, audit log detail drawer
**Depends on**: Phase 78
**Research**: Likely (Stripe API for subscription amount/MRR calculation)
**Research topics**: Stripe Subscription API amount fields, invoice line items for MRR
**Plans**: 3 plans

Plans:
- [x] 79-01: Role update API, edit-user dialog, password reset
- [x] 79-02: MRR from Stripe API with caching + fallback
- [x] 79-03: Audit log detail drawer

#### Phase 80: Brand Profile Setup

**Goal**: Multi-brand profile configuration in God Mode — 4 brands + Synthex profile
**Depends on**: Phase 79
**Linear**: SYN-15, SYN-16
**Research**: Unlikely (existing admin panel patterns)
**Plans**: 2 plans

Plans:
- [x] 80-01: Brand Profile API (GET + PATCH, Zod validation)
- [x] 80-02: Brand Profile UI (SWR hook, settings tab, logo upload)

#### Phase 81: Social Account Onboarding

**Goal**: Connect real social accounts, audit existing presence, define initial content strategy
**Depends on**: Phase 80
**Linear**: SYN-7, SYN-8, SYN-6
**Research**: Unlikely (9-platform connection hub already exists)
**Plans**: TBD

Plans:
- [ ] 81-01: TBD

#### Phase 82: Code Quality

**Goal**: Structured logger migration (754 console.logs), component decomposition (14 large components)
**Depends on**: Phase 81
**Research**: Unlikely (internal patterns, existing structured logger)
**Plans**: 3 plans

Plans:
- [x] 82-01: Auth centralisation — 49 local auth helpers removed
- [x] 82-02: Logger migration (248 files) + icon barrel fix
- [x] 82-03: TypeScript `any` elimination (57 usages) + hex colour token cleanup

#### Phase 83: Accessibility & Polish

**Goal**: WCAG skip links, E2E flaky test fixes, responsive edge cases
**Depends on**: Phase 82
**Research**: Unlikely (established WCAG guidelines)
**Plans**: 3 plans

Plans:
- [x] 83-01: Keyboard navigation, aria-current, table row access
- [x] 83-02: Form accessibility — focus-visible rings, spinner aria-labels, input labels
- [x] 83-03: Dashboard landmark, collapsed sidebar keyboard, E2E accessibility tests

#### Phase 84: Final UAT & Launch

**Goal**: End-to-end user acceptance testing, production smoke tests, go-live verification
**Depends on**: Phase 83
**Research**: Unlikely (existing smoke-test.mjs + LAUNCH-RUNBOOK.md)
**Plans**: TBD

Plans:
- [ ] 84-01: TBD

### 🚧 v5.0 AI-Native GEO & Citation Engine (Phases 85-100)

**Milestone Goal:** Transform Synthex's existing GEO dashboard into a full AI citation and authority-building platform with human-quality writing methodology and autonomous intelligence agents. Every feature builds on the existing `lib/geo/` infrastructure. All content must read as genuinely human. Autonomous agents protect site health. Synthex eats its own dog food.

**Architectural Mandate:** Every intelligence system built for clients must simultaneously run on Synthex's own properties. Dog-fooding is non-negotiable.

**Research basis:** Edward Sturm "Google Is Crushing Anchor Links" (2026), Nico | AI Ranking "Perfect SEO Copywriter with Claude Skills" (2026), Princeton KDD 2024 GEO study, BrightEdge/LatticeOcean citation data, Northeastern "Measuring AI Slop in Text"

#### Phase 85: Entity Coherence Engine

**Goal**: Analyse content for entity density, disambiguation, and coherence — the #1 factor in AI citation
**Depends on**: None (extends existing GEO infrastructure)
**Research**: Unlikely
**Plans**: 2 plans (service + API, dashboard UI)
**New models**: `EntityAnalysis`

#### Phase 86: Authority Engine & Design Audit

**Goal**: Real-time claim validation engine verifying marketing claims against authoritative sources (government, academic, industry), plus Design & Conversion Audit with CITABLE framework for LLM citation fitness
**Depends on**: Phase 85
**Research**: Applied — Aaron Tay "Agentic Researcher" pattern, Claude API citations, Semantic Scholar (214M papers), Australian Government APIs, 2026 CRO/design research (Core Web Vitals, LLM citation structure, CITABLE framework)
**Plans**: 7 plans (Prisma + types, source connectors, core engine, API routes + subscription gating, dashboard UI, design audit services, design audit UI + integration)
**New models**: `AuthorityAnalysis`, `AuthorityCitation`, `CitationMonitor`
**Business model**: $22 AUD/month "Authoritative Ranking" addon — separate Stripe product
**Architecture**: Claude API direct (not MCP SDK) — `web_search_20250305` tool with domain filtering
**Key innovation**: CITABLE framework (7 LLM citation fitness dimensions), 4 source connectors, Design Quality + CRO + LLM Citation Fitness scoring

#### Phase 87: GEO Content Optimiser v2

**Goal**: Real-time content editor scoring and rewriting content using the Princeton 9-tactic framework
**Depends on**: Phase 85, Phase 86
**Research**: Unlikely
**Plans**: 3 plans (tactic scorer service, AI rewrite pipeline, editor UI integration)

#### Phase 88: Writing Context & Voice Fingerprinting

**Goal**: Human writing methodology engine — capture voice patterns, inject rich writing context, eliminate AI slop at the source
**Depends on**: Phase 87
**Research**: Unlikely (methodology frameworks from Nico + Sturm research)
**Plans**: 3 plans (voice fingerprint service, methodology engine + prompt integration, dashboard wizard)
**New models**: `WritingMethodology`, `VoiceFingerprint`
**Key files**: `lib/ai/content-generator.ts` → `buildPrompt()`, `lib/ai/content-scorer.ts`

#### Phase 89: AI Slop Detection & Content Quality Gate

**Goal**: Detect AI-generated content quality issues, enforce human writing standards, provide iterative improvement suggestions
**Depends on**: Phase 88
**Research**: Unlikely
**Plans**: 3 plans (slop detector + humanness scorer, content scorer/optimizer integration, dashboard + quality gate)
**New models**: `ContentQualityAudit`
**Key files**: `lib/ai/content-scorer.ts` → new 6th `writingQuality` dimension

#### Phase 90: E-E-A-T Score Builder

**Goal**: Automated E-E-A-T auditing AND building — not just identifying gaps but generating the assets to fill them
**Depends on**: Phase 85, Phase 87, Phase 88
**Research**: Unlikely
**Plans**: 3 plans (scorer + auto-generator service, API routes, dashboard page)
**New models**: `EEATAudit`, `AuthorProfile` extension

#### Phase 91: Personal & Business Brand Builder

**Goal**: Automated personal and business brand recognition system — build E-E-A-T for individuals and organisations
**Depends on**: Phase 90
**Research**: Likely (Knowledge Panel trigger patterns, brand discovery APIs)
**Plans**: 3 plans (brand profile service + discovery, consistency checker, dashboard + calendar)
**New models**: `BrandIdentity`, `BrandCredential`, `BrandMention`

#### Phase 92: Journalist & PR Relationship Manager

**Goal**: CRM for journalist relationships, pitch tracking, and media coverage monitoring
**Depends on**: Phase 91
**Research**: Likely (journalist database sources, media monitoring APIs)
**Plans**: 2 plans (service + API, dashboard UI)
**New models**: `JournalistContact`, `PRPitch`, `MediaCoverage`

#### Phase 93: Press Release Generator & Distribution

**Goal**: AI-optimised press release creation with distribution to indexed services
**Depends on**: Phase 92, Phase 88
**Research**: Likely (PR distribution API integrations)
**Plans**: 2 plans (generator service + distribution, dashboard + analytics)
**New models**: `PressRelease`, `PRDistribution`

#### Phase 94: Award & Directory Orchestrator

**Goal**: Systematic award submissions and niche directory listings for AI visibility and backlink building
**Depends on**: Phase 91
**Research**: Unlikely
**Plans**: 2 plans (service + tracker, dashboard + submission writer)
**New models**: `AwardListing`, `DirectoryListing`, `SubmissionTracker`

#### Phase 95: AI Backlink Prospector

**Goal**: AI-powered link-building opportunity identification, evaluation, and prioritisation
**Depends on**: Phase 92
**Research**: Likely (backlink data sources — Ahrefs/Moz API or alternatives)
**Plans**: 3 plans (prospector service, outreach automation, dashboard + pipeline)
**New models**: `LinkProspect`, `OutreachCampaign`, `AcquiredLink`

#### Phase 96: Prompt Intelligence Tool

**Goal**: Discover what questions people ask AI about a brand's category, track trending prompts, map competitive visibility
**Depends on**: Phase 86
**Research**: Likely (prompt discovery methodology)
**Plans**: 2 plans (discovery + monitoring service, dashboard + alerts)
**New models**: `TrackedPrompt`, `PromptCitation`

#### Phase 97: Algorithm Sentinel & Site Health Agent

**Goal**: Autonomous agent monitoring Google algorithm volatility, detecting site crashes, diagnosing root causes, triggering protective responses
**Depends on**: Phase 86, Phase 95
**Research**: Likely (Semrush Sensor scraping, GSC API OAuth flow)
**Plans**: 3 plans (sentinel agent core + volatility monitor, GSC API integration + crash detection, competitor radar + alerts)
**New models**: `AlgorithmEvent`, `SiteHealthSnapshot`, `CrashDiagnosis`, `CompetitorAlert`
**Cron**: `/api/cron/algorithm-sentinel` — daily + on-demand
**Key pattern**: Follows `lib/agents/insights-agent.ts` — circuit breaker, workflow execution, confidence scoring

#### Phase 98: Autonomous A/B Testing & Self-Healing Agent

**Goal**: Agent that continuously A/B tests SEO/GEO strategies, detects what works, auto-applies winners, and executes recovery workflows
**Depends on**: Phase 97, Phase 88, Phase 89, Phase 90
**Research**: Unlikely (A/B testing infra exists)
**Plans**: 3 plans (experimenter agent + experiment types, self-healing agent + recovery pipeline, weekly report + learning loop)
**New models**: `SEOExperiment`, `ExperimentResult`, `RecoveryWorkflow`, `RecoveryAction`
**Crons**: `/api/cron/seo-experimenter` (weekly), `/api/cron/self-healing` (triggered + daily)

#### Phase 99: Citation Performance Dashboard

**Goal**: Unified analytics combining GEO metrics, citation tracking, E-E-A-T scores, writing quality, algorithm health, and agent activity
**Depends on**: Phases 85-98
**Research**: Unlikely
**Plans**: 2 plans (unified data service + API, dashboard page)

#### Phase 100: v5.0 Integration Testing & Polish

**Goal**: End-to-end verification, performance optimisation, autonomous agent validation, and polish
**Depends on**: Phases 85-99
**Research**: None
**Plans**: 2 plans (testing + fixes, polish + docs + agent runbooks)

---

<details>
<summary>📦 Archived v3.0 Phase Details</summary>

#### Phase 67: Codebase Cleanup (ARCHIVED)

**Goal**: Remove unused packages (canvas-confetti, verify TanStack Table), wire or remove
remaining orphaned API routes, standardise SWR/fetch patterns across dashboard
**Depends on**: v2.0 complete
**Research**: Unlikely (internal work — no new integrations)
**Plans**: TBD

Plans:
- [x] 67-01: Remove @tanstack/react-table + @tanstack/react-query (confirmed unused)
- [x] 67-02: Orphaned API route audit — wire or document all orphans
- [x] 67-03: Fetch pattern standardisation + CLAUDE.md canonical pattern

**Status**: 3/3 | Done

#### Phase 68: Stripe Activation

**Goal**: Enable real Stripe billing — un-gate UNI-1202/1203, enforce subscription feature
gates, wire customer portal, verify payment webhooks end-to-end
**Depends on**: Phase 67
**Research**: Likely (Stripe Billing Portal API, subscription enforcement patterns)
**Research topics**: Stripe customer portal configuration, subscription gate middleware, proration handling
**Plans**: 3/3 | Done

Plans:
- [x] 68-01: Billing email notifications (receipt, failure, cancellation) + dashboard display bugs UNI-633/634
- [x] 68-02: Subscription feature gate enforcement (SEO audit, workflows, insights) + UpgradePrompt component
- [x] 68-03: Public pricing page (/pricing) + Stripe test account configured + Vercel env vars deployed

#### Phase 69: Public Landing Page

**Goal**: Public-facing marketing pages at synthex.social root — hero, features, pricing
page with plan comparison, SEO meta tags, Open Graph images
**Depends on**: Phase 68
**Research**: Unlikely (existing SEO system + Next.js patterns)
**Plans**: TBD

Plans:
- [x] 69-01: Server component landing page + dynamic OG images + Starter free tier + billing toggle + HowItWorks + Testimonials

**Status**: 1/1 | Done

#### Phase 70: Onboarding Funnel

**Goal**: Reduce signup→first-value friction — improve onboarding wizard, add welcome
email sequence, refine trial UX, extend product tour to cover new v2.0 features
**Depends on**: Phase 69
**Research**: Unlikely (existing onboarding + email infrastructure)
**Plans**: TBD

Plans:
- [x] 70-01: Welcome email sequence D+0/D+3/D+7 (Resend templates, onboarding trigger, cron)
- [x] 70-02: ProductTour v2.0 extension (workflows/insights/upgrade steps) + onboarding complete tour CTA

**Status**: 2/2 | Done | 2026-03-10

#### Phase 71: Observability & Monitoring

**Goal**: Wire Sentry error tracking (currently stubbed), add structured logging,
cron failure alerting, uptime monitoring, and error budget dashboards
**Depends on**: Phase 70
**Research**: Likely (Sentry Next.js SDK v8 + source maps + performance monitoring)
**Research topics**: Sentry Next.js App Router integration, cron check-ins, alert thresholds
**Plans**: TBD

Plans:
- [x] 71-01: Sentry v8 activation (withSentryConfig, cron monitors, logger)

**Status**: 1/1 | Done | 2026-03-10

#### Phase 72: Performance Hardening

**Goal**: Redis caching for expensive queries (analytics, recommendations), remaining
Prisma N+1 fixes, final bundle analysis, Vercel CWV verification on live deployment
**Depends on**: Phase 71
**Research**: Unlikely (patterns from v1.5 apply)
**Plans**: TBD

Plans:
- [x] 72-01: Cache dashboard endpoints + fix N+1 in business-metrics

**Status**: 1/1 | Done | 2026-03-10

#### Phase 73: Pre-launch Security

**Goal**: Rate limit tuning for public traffic volumes, CSP/CORS audit, secrets rotation
documentation, Supabase auth configuration review, GDPR compliance check
**Depends on**: Phase 72
**Research**: Unlikely (Sprint 3 + existing security patterns)
**Plans**: 1/1 | Complete | 2026-03-10

Plans:
- [x] 73-01: CSP hardening (remove unsafe-eval), CORS distributed tracing headers, SECURITY.md

#### Phase 74: Launch Day

**Goal**: Smoke test suite against live Vercel deployment, go-live runbook, DNS/CDN
configuration, rollback procedure, monitoring dashboard setup, launch announcement
**Depends on**: Phase 73
**Research**: Unlikely (internal procedures)
**Plans**: 1/1 | Complete | 2026-03-10

Plans:
- [x] 74-01: Smoke test script (scripts/smoke-test.mjs), LAUNCH-RUNBOOK.md with go-live checklist + rollback procedure

</details>

