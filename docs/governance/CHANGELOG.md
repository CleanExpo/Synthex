# Changelog

All notable changes to Synthex are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [v11.1] — SWARM Audit Sprint — 2026-03-24

### Added

- Audit logging foundation — `lib/audit/audit-logger.ts` (SYN-440)
- Business DNA viewer on brand settings page + `GET /api/brand/dna` (SYN-451)
- Workflow template selection on workflows page (SYN-450)
- Demo booking section on contact page (SYN-454)
- `PATCH /api/user/profile` for GDPR Art.16 data rectification (SYN-445)
- Single-focus first-run card on dashboard empty state (SYN-453)

### Fixed

- `setInterval`/`setTimeout` cleanup guards added to 8 `lib/` classes to prevent memory leaks (SYN-448): AnalyticsTracker, MemoryCacheLayer, MemoryCache, MonitoringService, PerformanceMonitor, ModelManagerAgent, WebSocket server and client
- WCAG 2.1 AA contrast — `gray-400`/`slate-400` upgraded to `gray-300` across 408 files (SYN-456)
- Removed `@ts-ignore` suppressions and `as any` casts — 13 suppressions removed (SYN-457)
- AI-generated testimonials disclosure removed — replaced with social proof copy (SYN-438)
- 30-day money-back guarantee added to pricing cards and hero CTA (SYN-447)
- Company registration placeholder added to footer — ABN field pending (SYN-439)
- Timezone corrected from PST to AEST on contact page (SYN-464)
- Skip-verification CTA promoted in signup flow — removed dashboard access gate (SYN-443)
- 404 page improved with homepage and key navigation links (SYN-463)
- Loading skeleton grid breakpoints added for mobile (SYN-449)
- Mobile breakpoints added to dashboard component and page grids (UNI-1635)
- MobileMenu updated with full top-level navigation (UNI-1635)
- `aria-current=page` added to active sidebar nav links (UNI-1635)

### Security

- CSP `unsafe-inline` removed from `script-src` (SYN-452)
- CRON_SECRET enforced on all 21 cron routes (SYN-437)

---

## [v11.0] — Phase 55–56 · Obsidian Import + UI Polish — 2026-03-23

### Added

- Obsidian markdown importer: parser, service, API routes, and `ObsidianImportModal` wired into drafts page (UNI-1633)
- Real PDF generation for reports — replaces JSON stub (FUNC-1)
- Cookie consent banner with GDPR/CCPA analytics gating (COMP-2)
- GDPR data export endpoint `POST /api/user/export` (COMP-3)
- Axiom HTTP transport for production error tracking (INFRA-5)

### Fixed

- 7 HIGH WCAG contrast violations resolved (FUNC-5 / SYN-399)
- Client errors now persisted to `AuditLog` — in-memory buffer removed (INFRA-5)
- Missing error states added to bio and experiments pages (Phase 55-02)
- Supabase Auth record deleted on account deletion (COMP-1)
- Contact form wired to Resend — real email delivery to configured address (Phase 127)
- Contact details updated — `support@synthex.social`, Brisbane QLD (Phase 127)
- Sitemap conflict resolved — `app/sitemap.ts` removed; `app/sitemap.xml/route.ts` is canonical

### Security

- `CRON_SECRET` and JWT secret validation hardened across production routes

---

## [v10.0] — Production Quality Loop — 2026-03-19

### Added

- Route Reference system — `ROUTE_REFERENCE.md` with 498 routes, 100 pages, model index
- `routes:refresh` npm script + `refresh-routes.sh` for automated Zone 1 regeneration
- Post-route-create git hook to auto-refresh route reference
- Non-coder build guide, `/build` command, and verification gate docs
- Pre-compact-context hook registers `ROUTE_REFERENCE.md` as drift-recovery resource

### Fixed

- Production build type errors resolved (UNI-1634)
- Missing shadcn-ui components installed; `components.json` added (UNI-1634)
- `useKeyboardShortcuts` `useMemo` dependency closure fixed (UNI-438)
- ESLint `--max-warnings 0` enforced (QG-2)
- All ESLint warnings resolved — 0 warnings (QG-1)

### Security

- SSRF protection added (SEC-4)
- JWT signature verification hardened (SEC-5)
- WebSocket CORS validation added (COMP-5)
- IDOR vulnerabilities patched on two API surfaces (SEC-1, SEC-2)
- Token exposure in API response removed (SEC-3)
- Unhandled 500s wired to Slack via AlertManager (SEC-7)

---

## [v9.0] — v9.0 Production Hardening — 2026-03-17

### Added

- Dedicated Lighthouse CI workflow — audits production URL
- Senior PM execution plan with 41-ticket production readiness sprint

### Fixed

- `useEffect` dependency array stability fix for keyboard shortcuts (UNI-438)

### Changed

- `api.legacy/` archived; empty `src/` directory removed (STRUCT-6, STRUCT-7)

---

## [v8.0] — Production Go-Live — 2026-03-13

### Added

- Multiple dashboard API routes: ROI (`/api/dashboard/roi`), citation, awards, E-E-A-T score, referral programme, geographic audience distribution, experiments management, sponsorship deals, visual content analytics, voice consistency scoring, user bio management (UNI-440)
- Stripe live account wired — Pro/Growth/Scale AUD pricing live
- Vercel production deployment — `synthex.social` DNS live

### Security

- Production CRON_SECRET and webhook secrets configured
- Stripe live webhook registered at `https://synthex.social/api/webhooks/stripe`

---

## [v5.0] — AI-Native GEO & Citation Engine — 2026-03-11

### Added

- Entity coherence and citation tracking engine
- GEO optimiser v2
- E-E-A-T framework implementation
- Brand building, PR, and awards subsystems
- Prompt intelligence and algorithm sentinel
- Autonomous A/B testing engine
- Self-healing content pipeline
- Citation dashboard

---

## [v4.0] — Production Complete — 2026-03-10

### Added

- Content creation and scheduling pipeline
- Admin panel with God Mode
- Brand profiles system
- Social onboarding flow

### Fixed

- Code quality sweep across all modules
- Accessibility improvements to WCAG 2.1 AA

---

## [v3.1] — First Users — 2026-03-10

### Added

- NEXUS branding update
- Unite-Hub connector
- Admin God Mode panel

---

## [v3.0] — Public Launch Readiness — 2026-03-10

### Added

- Stripe billing integration (test mode → live promotion path)
- Landing page redesign
- Onboarding wizard
- Observability pipeline
- Performance and security hardening
- Dynamic OG image generation via `/api/og` (Edge runtime)
- Billing toggle extracted into `components/pricing/pricing-grid.tsx`
- Free Starter tier with `<Link>` CTA (no Stripe needed for free plan)

### Fixed

- Codebase cleanup from v2.0 technical debt

---

## [v2.0] — Reliable AI Agents — 2026-03-03

### Added

- Context resilience infrastructure (Phase 59)
- Agent orchestration hardening — deterministic orchestrator pattern (Phase 60)
- AI workflow engine with `WorkflowExecution`, `StepExecution`, `WorkflowTemplate` Prisma models
- 7 step types: `ai-generate`, `ai-analyse`, `ai-enrich`, `human-approval`, `action-publish`, `action-schedule`, `action-notify`
- Confidence gating — auto-approve at ≥0.85, human gate below threshold
- 2-retry cap per failing step before human escalation
- Context assembly with token budget (`context-builder.ts`)
- Streaming SSE for AI chat

---

## [v1.5] — Deployment Readiness — 2026-02-19

### Added

- Playwright E2E test suite with auth fixture
- Jest unit test coverage to 74% route Zod coverage
- Performance and polish pass

### Fixed

- Onboarding wizard E2E stability (23/23 passed after stabilisation)
- Prisma mock factory dual export pattern for Jest compatibility

---

## [v1.4] — Creator Monetisation & AI Studio — 2026-02-18

### Added

- CRM with three-tier hierarchy: Sponsor → Deal → Deliverable
- Affiliate link cloaking with short-code system
- `AIConversation`/`AIMessage` Prisma models for persistent chat history
- `TrackedKeyword`/`SocialMention` for social listening
- `LinkBioPage`/`LinkBioLink` for customisable landing pages
- Auto-insert keyword matching for content monetisation

---

## [v1.3] — SEO & Search Focus — 2026-02-18

### Added

- `AuthorProfile` model with verified credentials and authority scores
- `SEOAudit` and `GEOAnalysis` Prisma models
- Research report engine with visualisations
- Local case study generator with NAP-consistent citations

---

## [v1.2] — Features: AI Content + Analytics + Integrations — 2026-02-18

### Added

- `PlatformConnection` model reused for Canva, Buffer, Zapier via metadata JSON
- Integration factory pattern: `createIntegrationService(provider, credentials)`
- Zapier webhook with dedicated `ZAPIER_WEBHOOK_SECRET`
- `INTEGRATION_REGISTRY` as single source of truth for provider metadata
- `ConnectDialog` rendering OAuth vs credential forms dynamically

---

## [v1.1] — Platform Enhancement — 2026-02-17

### Added

- Rate limiters consolidated into `lib/rate-limit/` with backward-compat re-exports
- `DashboardError` component in `components/dashboard/error-fallback.tsx`
- `PageHeader` and `DashboardEmptyState` components for consistent layouts
- Glassmorphic loading state styling

---

## [v1.0] — Production Hardening — 2026-02-17

### Added

- Auth migration: `getUserIdFromRequest` → OrCookies pattern across 83 routes
- `crypto.randomUUID()` as standard for server-side ID generation
- Category-based rate limiting: `authStrict` 5/min through `readDefault` 120/min
- Dashboard empty state pattern with icon, message, and CTA button
- Schema-based contract testing with Zod schemas + response shapes

### Fixed

- All platform services using `fetch()` directly (Twitter uses `twitter-api-v2` SDK)
- Admin role check re-enabled at `/api/system/models`
- Mock data removed from audience insights and stats engagement

### Security

- Row Level Security applied to all 132 Prisma tables
- Org scoping enforced on tasks and research routes
- Login route `httpOnly` cookie gap closed
- TypeScript and ESLint re-enabled on Vercel production builds
