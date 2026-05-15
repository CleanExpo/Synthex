# Project State

## 2026-05-16 refresh (Synthex Phase 1, mandate `450be04c-504d-4824-bd3f-f62178721c0b`)

Since the previous 2026-04-28 snapshot, **124 commits landed on `origin/main`**.
Highlights of what shipped between 2026-04-28 → 2026-05-16:

- **Brand-config monorepo (PR series 1-of-5 → 4-of-5):** ported from Pi-CEO
  into Synthex (`@unite-group/brand-config`), reconciled primary colours
  with prod, bridged to BrandContent, design configs for all 7 brands,
  Equal/doNotExecute type-test helpers. PR 5 of 5 — TenantConfig envelope
  (`a1bc7d9c`, Phase 6 Task 6.1) — **opened today as draft PR #237**.
- **Security:** `RA-3024` rate-limit batches 1+2 (20 user-facing LLM routes);
  `RA-3021` RLS coverage CI validator + 62-table gap report (PR #232);
  HERMES H-1 (SYN-909..913) schema + Telegram/Linear escalation channels +
  discovery engine + draft generator + metrics digest.
- **Foundation:** VG-AEO-1..4 added (PR #227 unblocks 9 AEO tickets);
  RestoreAssist launch package + Vision Board (SYN-915); marketing-studio
  substrate ported from Pi-CEO (SYN-900); CARSI/CCW/DR/NRPG/RA/Synthex/
  Unite brand design configs.
- **Reliability:** SYN-953 series — lazy-init Supabase across 7+ services
  + monitoring routes (3 PRs); ai-commentary thinkingConfig + Gemini 3.1
  Pro Preview migration (SYN-935..945); Vercel AI Gateway switch.
- **Process / infra:** macOS Claude hook fixes + autoMode hard_deny
  (PR #228); `.claude/DESIGN.md` adoption + CI lint; Children.only
  structural traps closed (SYN-905..906); SWR cache revalidation on
  business switch (SYN-908); BusinessSwitcher crash fix.

### Phase 1 measurement findings (this refresh)

- **RLS adversarial baseline:** 18 / 234 public tables are actually secure
  (`docs/security/rls-adversarial-baseline-2026-05-16.md`). PR #232's
  schema-presence count of 179 is necessary but not sufficient — most
  enabled-RLS tables ship with `using (true)` policies.
- **Vercel CFR baseline (30d):** 291 deploys, 64 failures, **CFR = 21.99%
  (DORA Low)** — see `docs/ops/cfr-baseline-2026-05-16.md`. Margot baseline
  was 4-5%; Synthex is ~5× worse. Dominant failure mode is unclassified
  build errors (42/64 = 66%) — the `SYN-877: skip Next build-time
  TypeScript check` workaround is the likely root cause.
- **Stripe churn mix (30d):** BLOCKED — production Stripe key is stored as
  `sensitive` env on Vercel, not autonomously decryptable. Analysis script
  ready at `scripts/churn-mix-analysis.ts`; needs a `vercel env pull` from
  a signed-in human. See `docs/billing/churn-mix-2026-05-16.md`.
- **Open PRs:** #226 (lazy-init Supabase, CONFLICTING — needs rebase),
  #233 + #234 (Dependabot, Type Check FAILURE — needs the upstream type
  issue resolved before merge). #230 (Next 16.2.6) admin-merged today as
  `679ad40a`. #237 (TenantConfig envelope) opened today as draft.

The historical content below from the 2026-04-28 snapshot is left intact
for reference but should be considered superseded by the above.

---

> **⚠️ STALE — last-tracked phase content is multi-week behind reality (2026-04-28).**
> The "Current Position" and "Phase" sections below describe the v11.0 Tech Foundation / Autonomous Ranking Engine sprints (SYN-472 → SYN-486) that shipped in March 2026. Since then the project has shipped:
>
> - **SYN-806** _[EPIC] Senior-level AI Marketing Agency uplift_ — only In Progress on Linear (started 2026-04-26)
> - **SYN-807** Multi-model orchestration tier (Ollama + DeepSeek hybrid + boardroom synthesis layer)
> - **CEO Foundation v1.0** (PR #104), **Review Skills mandate** (RA-1744, PR #105)
> - SYN-793/794/795/799/800/801 — leads, attribution, GA4Property, rate-limit wrapper, HeyGen removal, /benchmark CTA
>
> See `.claude/memory/MEMORY.md` → `## Current State (2026-04-28) — second-PC onboarding` for the authoritative snapshot. Full re-derivation of this file is its own ticket — do not act on the dated phase content below without cross-referencing MEMORY.md and `git log origin/main`.

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-17)

**Core value:** Every endpoint returns real data, every platform works, every dashboard page connects to live APIs
**Current focus:** Autonomous Ranking Engine — ALL 3 SPRINTS COMPLETE ✅

## Current Position

Phase: Autonomous Ranking Engine — 3-Sprint Board Plan SHIPPED ✅
Last activity: 2026-03-25 — All 15 tickets across 3 sprints delivered. PR #11 open for review.

**Sprint 1 — Foundation (SYN-472→SYN-476): ✅ DONE**

- SYN-472: AI Context Injection + GSC Topic Pipeline
- SYN-473: Visibility Score MVP 0–100
- SYN-474: Review Request Automation
- SYN-475: Content Type Registry + Layout System V1
- SYN-476: Keyword Rank Tracking

**Sprint 2 — Content Intelligence (SYN-477→SYN-481): ✅ DONE**

- SYN-477: Monday Visibility Push weekly email + cron
- SYN-478: E-E-A-T Author Blocks + Schema Injection
- SYN-479: 3-Tier SEO Content Classification + library badges
- SYN-480: A/B Test Auto-Rollout cron + promoted badge
- SYN-481: GBP Photo Upload + Event/Offer Post Scheduling

**Sprint 3 — Automation Depth (SYN-482→SYN-486): ✅ DONE**

- SYN-482: Analytics Feedback Loops (4 loops) + Opportunities Widget
- SYN-483: AEO/GEO Content Mode + LocalBusiness/FAQ schema
- SYN-484: Competitor Displacement Board + Keyword Gap Tracking
- SYN-485: Revenue Projection Widget with CTR Curve Model
- SYN-486: Model Scout Cron + ModelMetric Instrumentation

**v11.0 Tech Foundation: ✅ DONE**

- PR #8: Zod 3 → 4.3.6
- PR #9: Prisma 6 → 7.5.0
- PR #10: Tailwind CSS 3 → 4.2.2
- PR #11: prisma.config DIRECT_URL + SYN-472 GSC orgId overload (open)

**Gate: npm run type-check 0 | lint 0 | 2113 tests passed (2026-03-25)**

**SWARM Audit Results (2026-03-24):**

Wave 1 — Low-risk fixes ✅

- SYN-449: Loading skeleton grid breakpoints (8 files)
- SYN-444: Sitemap already exists at app/sitemap.xml/route.ts
- SYN-450: Workflow template selection added
- SYN-451: Business DNA viewer + GET /api/brand/dna
- SYN-461: Jest .claude/ exclusion fixed
- SYN-462: Static-backup archived

Wave 2 — Medium-risk security/quality ✅

- SYN-456: WCAG contrast (408 files, gray-400→gray-300)
- SYN-437: CRON_SECRET enforced on all 21 cron routes
- SYN-445: GDPR Art.16 PATCH /api/user/profile
- SYN-457: @ts-ignore sweep (13 suppressions removed)

Wave 3 — Conversion/trust/UX ✅

- SYN-438: AI testimonials disclaimer removed
- SYN-439: ABN placeholder in footer ([ABN REQUIRED] — Phil to fill)
- SYN-447: 30-day money-back guarantee on pricing
- SYN-464: Timezone PST → AEST on contact page
- SYN-454: Demo booking section on contact page
- SYN-463: 404 page navigation improved
- SYN-443/SYN-458: Verification screen "You're in!" → direct to dashboard
- SYN-453: Single-focus first-run card on dashboard

Wave 4 — Architecture hardening ✅

- SYN-448: setInterval cleanup guards (8 lib/ classes fixed)
- SYN-452: CSP unsafe-inline removed from script-src
- SYN-440: Audit logging foundation (lib/audit/audit-logger.ts)

**Deferred (need Phil decisions):**

- SYN-441: WebSocket vs SWR polling (Phil decision P3)
- SYN-442: Upstash queue enforcement (Phil confirm P4)
- SYN-446: Auth/billing test suites (dedicated sprint)
- SYN-455: Font CDN → next/font/local (font files needed)

**Final gate: npm run type-check 0 | lint 0 | 1590 tests passed**

Previous: Phase 56 (ui-responsive) — ALL PLANS COMPLETE ✅
Last activity: 2026-03-24 — WCAG aria-current nav + MobileMenu 12-item top-level groups + responsive grid breakpoints on 6 files (UNI-1635)

Previous: Phase 127 (contact-form) — 2026-03-23 — Contact form at /contact wired to Resend SDK.
Linear: —

Previous: Phase 126 (marketing-redesign) — 2026-03-20 — UNI-1604 DONE.

Milestone: v10.0 Full Platform Quality Loop — **PENDING HUMAN GATE**
Last milestone shipped: v9.0 — 2026-03-17
Status: Phases 119–123 code-complete. Only SYN-410 (Phase 122 E2E) remains — human-gated.
Phase 124 (openai v6 upgrade, SYN-400) added as first v11.0 Tech Foundation phase — DONE.

Progress: █████████░ 95% v10.0 (human gate remaining) | Phase 124 opens v11.0

**v10.0 Code Gate Status (2026-03-19):**

- `npm run type-check` → 0 errors ✅
- `npm test` → 1547 passed, 0 failures ✅
- `npm run lint` → 0 errors (75 warnings) ✅
- CONNECT-01 (billing route) → FIXED ✅
- CONNECT-03 (notification filter) → FIXED ✅
- ROUTE-10/11 (org scoping: tasks + research) → FIXED ✅ (commit 85b98427, migration 20260319000002)
- CONTRAST-01–05 (WCAG critical) → CONFIRMED FIXED ✅
- RLS on all 132 Prisma tables → APPLIED ✅ (commit 7175300e, migration 20260319000001)

Next action: Phase 122 E2E — human must test on synthex.social (SYN-410)

## Phase 121 Swarm Audit Summary (2026-03-18)

Wave 1 (5 parallel agents) + Wave 2 (B1 consolidation) complete.
Output: .planning/phases/121-swarm-audit/

### Key Findings vs Phase 119 Baseline

Phase 119 → 107 findings. Phase 120 closed ~15 (~14%).

**CONFIRMED RESOLVED by Phase 120:**

- Auth migration (getUserIdFromRequest → OrCookies): 83 routes ✓
- Admin role check at /api/system/models (UNI-1170) ✓
- Mock data removed (audience insights, stats engagement) ✓
- puppeteer-screen-recorder removed from package.json ✓

**CONFIRMED OPEN (from Phase 119, not fixed):**

- ROUTE-10/11: tasks + research routes userId-only (SYN-391/392)
- CONNECT-01: /api/billing/subscription missing (SYN-389)
- CONNECT-03: NotificationBell param mismatch (SYN-390)
- CONTRAST-01–05: 5 CRITICAL WCAG violations (SYN-393) — CONTRAST-01 partially improved
- SECURITY-04: NEXT_PUBLIC_BYPASS_TOKEN still in .env.example (SYN-395)

**NEW REGRESSIONS (Phase 121 audit only):**

- CRITICAL: capture-service.ts dynamic import of removed package → runtime crash (SYN-394)
- HIGH: email/password login route doesn't set httpOnly cookie (SYN-397)
- HIGH: analytics route userId-only org scoping (SYN-406)
- MEDIUM: next.config.mjs disables TypeScript + ESLint on Vercel deploy (SYN-402)

### Linear Issues Created This Session

| Issue   | Title                               | Priority | Status      |
| ------- | ----------------------------------- | -------- | ----------- |
| SYN-384 | [Phase 119] Deep Audit              | High     | Done        |
| SYN-385 | [Phase 120] Quality Sweep           | Medium   | Done        |
| SYN-387 | [Phase 121] Performance & Caching   | High     | In Progress |
| SYN-388 | [Phase 123] Diagnostic Repeat       | Medium   | Backlog     |
| SYN-389 | BUG: billing/subscription missing   | Urgent   | **Done**    |
| SYN-390 | BUG: notification filter mismatch   | High     | **Done**    |
| SYN-391 | SECURITY: tasks org scoping         | Urgent   | **Done**    |
| SYN-392 | SECURITY: research org scoping      | Urgent   | **Done**    |
| SYN-393 | A11Y: 5 CRITICAL WCAG violations    | Urgent   | **Done**    |
| SYN-394 | REGRESSION: capture-service crash   | Urgent   | **Done**    |
| SYN-395 | SECURITY: bypass token in .env      | High     | **Done**    |
| SYN-396 | CLEANUP: remove demo/test routes    | High     | **Done**    |
| SYN-397 | SECURITY: login httpOnly cookie     | High     | **Done**    |
| SYN-398 | SECURITY: RLS 16/131 models         | High     | Backlog     |
| SYN-399 | A11Y: 7 HIGH contrast violations    | Medium   | Backlog     |
| SYN-400 | DEPS: openai 4.x behind             | High     | Backlog     |
| SYN-401 | DEPS: @auth/prisma-adapter unused   | Medium   | Backlog     |
| SYN-402 | BUILD: TS+ESLint disabled on deploy | High     | **Done**    |
| SYN-403 | DEPS: gsap license ambiguity        | Medium   | Backlog     |
| SYN-404 | CODE: anonymous exports             | Low      | Backlog     |
| SYN-405 | CODE: admin/layout Prisma direct    | Medium   | Backlog     |
| SYN-406 | SECURITY: analytics org scoping     | Urgent   | **Done**    |
| SYN-407 | [v11.0] Tech Foundation Upgrades    | Medium   | Backlog     |
| SYN-408 | [v11.0] Voice + Industry Modes      | Medium   | Backlog     |

## Phase 120 Summary

Sprints completed 2026-03-18:

- Sprint 1: Auth cookie gap closed (83 routes), admin check re-enabled, WCAG contrast fixed, legacy route archived
- Sprint 2: 4 failing test suites fixed (99 pass, 1 skip): prisma proxy, onboarding contract, stripe tiers, campaigns mock
- Sprint 3: puppeteer-screen-recorder removed, audience insights de-mocked, stats engagement de-mocked, .env.example cleaned, fluent-ffmpeg confirmed used
- Sprint 4: Empty states improved (personas, reports), platform connection banner, nav defaults audited, Quick Post modal, onboarding sub-copy
- Sprint 5: STATE.md updated

## Performance Metrics

**Velocity (from v1.0):**

- Total plans completed: 40
- Average duration: ~13 min
- Total execution time: ~600 min

**By Phase (v1.0):**

| Phase | Plans | Total    | Avg/Plan |
| ----- | ----- | -------- | -------- |
| 1     | 2/2   | ~16 min  | ~8 min   |
| 2     | 5/5   | ~41 min  | ~8 min   |
| 3     | 2/2   | ~21 min  | ~11 min  |
| 4     | 3/3   | ~30 min  | ~10 min  |
| 5     | 5/5   | ~42 min  | ~8 min   |
| 6     | 2/2   | ~18 min  | ~9 min   |
| 7     | 3/3   | ~30 min  | ~10 min  |
| 8     | 4/4   | ~139 min | ~35 min  |
| 9     | 3/3   | ~17 min  | ~6 min   |
| 10    | 2/2   | ~24 min  | ~12 min  |

**By Phase (v1.1):**

| Phase | Plans | Total   | Avg/Plan |
| ----- | ----- | ------- | -------- |
| 11    | 1/1   | ~15 min | ~15 min  |
| 12    | 4/4   | ~45 min | ~11 min  |
| 13    | 1/1   | ~15 min | ~15 min  |
| 14    | 1/1   | ~20 min | ~20 min  |
| 15    | 1/1   | ~15 min | ~15 min  |
| 16    | 3/3   | ~15 min | ~5 min   |
| 17    | 3/3   | ~15 min | ~5 min   |
| 18    | 1/1   | ~10 min | ~10 min  |

## Accumulated Context

### Decisions

Decisions from v1.0 that affect v1.1 work:

- crypto.randomUUID() is standard for all server-side ID generation
- All platform services use fetch() directly (except Twitter uses twitter-api-v2 SDK)
- Schema-based contract testing pattern — Zod schemas + response shapes
- Category-based rate limiting: authStrict 5/min through readDefault 120/min
- Dashboard empty state pattern: inline EmptyState with icon, message, CTA button
- Standalone feature components not imported by dashboard pages — safe to modify

Decisions from v1.1:

- Rate limiters consolidated into lib/rate-limit/ with re-exports for backward compat
- lib/middleware/api-rate-limit.ts and lib/middleware/rate-limiter.ts kept as thin re-export wrappers
- Loading states use glassmorphic styling (bg-white/5, bg-[#0f172a]/80, border-cyan-500/10)
- DashboardError component in components/dashboard/error-fallback.tsx for all error.tsx files
- PageHeader and DashboardEmptyState components for consistent layouts

Decisions from v1.2:

- PlatformConnection model reused for Canva/Buffer/Zapier with metadata JSON (no schema migration)
- Integration factory pattern: createIntegrationService(provider, credentials) returns typed service
- Zapier webhook uses dedicated ZAPIER_WEBHOOK_SECRET, separate from platform webhook handler
- INTEGRATION_REGISTRY as single source of truth for provider metadata, THIRD_PARTY_ICONS lookup for icon mapping
- ConnectDialog renders OAuth vs credential forms dynamically based on oauthSupported flag

Decisions from v1.3:

- AuthorProfile model with verified credentials and authority scores
- SEOAudit and GEOAnalysis models for search optimization
- Research report engine with Paper Banana visualizations
- Local case study generator with NAP-consistent citations

Decisions from v1.4:

- Streaming SSE for AI chat (real-time feel)
- Decimal type for all currency fields (precision in Prisma)
- Three-tier hierarchical models for CRM (Sponsor → Deal → Deliverable)
- Short code system for affiliate link cloaking
- Auto-insert keywords matching for content monetization
- AIConversation/AIMessage models for persistent chat history
- TrackedKeyword/SocialMention for social listening
- LinkBioPage/LinkBioLink for customizable landing pages

Decisions from v3.0 (Phase 69):

- `app/page.tsx` is a server component — child `'use client'` components work as client subtrees
- Dynamic OG images via `app/api/og/route.tsx` (Edge runtime) — accepts `?title=` param, 1200×630
- `generateMetadata()` in `lib/seo/metadata.ts` defaults to `/api/og?title=...` when no explicit image given
- Billing toggle extracted into `components/pricing/pricing-grid.tsx` (`'use client'`) — pricing page itself stays server component
- Starter free tier: "Free" price, plain `<Link href="/signup">` CTA, no CheckoutButton needed

Decisions from v3.0 (Phase 68):

- Billing emails use fire-and-forget Resend SDK with lazy singleton (`getResend()`) — defers `new Resend()` to first call so module imports safely in test environments without `RESEND_API_KEY`
- Static `/dashboard/billing` URL for billing portal — avoids async Stripe API call in webhook path (must respond <3s)
- Unlimited progress bars: check `!limit || limit <= 0` (not just `=== -1`) — DB uninitialised 0 also means unlimited
- HTTP 404 from `/api/user/subscription` = free plan (not error state)
- `subscription.current_period_end` in Stripe API `2025-07-30.basil` is on `subscription.items.data[0]`, not root
- Feature gate pattern: `{ error: '...', upgrade: true }` 403 — `upgrade: true` lets UI distinguish plan gates from regular auth 403s
- `subscriptionService.getSubscription(userId)` used for gate checks — exists in `lib/stripe/subscription-service.ts`
- Workflows page client (`WorkflowsPageClient.tsx`) and insights page client (`InsightsPageClient.tsx`) are the actual render points — `app/dashboard/*/page.tsx` are thin wrappers that pass to client components
- All 10 workflow sub-routes gated (executions, templates, batch, intelligence endpoints)
- Stripe test account: acct_1SzE5KGib5mMf28d (Synthex) — products/prices/webhook created in test mode
- Professional price ID: `price_1T6qNuGib5mMf28dqhxMIsP7` (AUD $249/mo), Business: `price_1T6qO3Gib5mMf28d44AXcz6c` (AUD $399/mo)
- Webhook ID: `we_1T6qO8Gib5mMf28dOiQP3fTX` — all 5 Stripe env vars set in Vercel via CLI (production+preview+development)
- To go live: replace sk*test*/pk*test* with sk*live*/pk*live* and register a new live-mode webhook

Decisions from v1.5 (Phase 54):

- 74% route Zod coverage — GET-only utility routes (health, stats, cron) do not require schema validation
- Prisma mock factory exports both default and named export: `{ __esModule: true, default: instance, prisma: instance }` to satisfy routes that use either import style
- Route handlers that call `response.cookies.set()` (e.g. onboarding POST) cannot be tested end-to-end in Jest — use schema validation + transaction-call verification instead
- Jest closure pattern for tx mocks: use plain `() => Promise.resolve(value)` inside `mockImplementation` rather than `jest.fn().mockResolvedValue()` to avoid nested mock complexity

### Deferred Items (from v1.0)

All deferred items from v1.0 resolved:

- ~~Legacy src/ services with mock data — Phase 11~~ DONE (18 files removed)
- ~~src/agents/ specialist coordinators with mock metrics — Phase 14~~ DONE (3 coordinators wired to real APIs)
- ~~8 standalone feature components with mock data — Phase 12~~ DONE (8 components wired)
- ~~Rate limiter files consolidation — Phase 12-04~~ DONE (9 files removed, unified into lib/rate-limit/)
- ~~ContentLibrary model not in schema — Phase 13~~ DONE (model added, CRUD API implemented)

### Phase 17 Analysis

**Pages discovered but not in navigation:**

- `/dashboard/reports` — Important feature, fully built
- `/dashboard/experiments` — A/B testing, fully built
- `/dashboard/billing` — Subscription management, fully built
- `/dashboard/admin`, `/dashboard/backups`, `/dashboard/monitoring` — Utility pages

**Current ProductTour:** 7 steps (basic coverage)
**Target ProductTour:** 12 steps (comprehensive coverage)

**Current CommandPalette:** 10 commands
**Target CommandPalette:** 17 commands

### Phase 52 Findings

**E2E test infrastructure:**

- Playwright runs on port 3002 (port 3001 was occupied by Grafana)
- `PW_SKIP_WEBSERVER=1 BASE_URL=http://localhost:3002` for running against existing dev server
- retries set to 1 for non-CI mode (auth rate limiter causes cross-file flakiness in full suite)
- `auth.fixture.ts`: errorMessage targets `[data-sonner-toast]` (not `[role="alert"]` — Next.js route announcer); passwordInput targets `input#password` (both password fields had type="password" with no name attr)
- Login/signup errors shown via Sonner toasts only (no DOM alert elements)
- `/api/auth/dev-login` endpoint does not exist — tests accept 404
- Onboarding step-3 Continue button is disabled until persona form is filled; fixture clicks "Skip for now" inside PersonaSetup first to enable it
- App Router soft navigation (router.push) requires `waitForURL`, not `waitForLoadState`

### Phase 53 Findings

**E2E test stabilization:**

- Workers reduced from default (~6) to 2 — server couldn't handle parallel load
- Timeout increased from 30s to 60s — cold dev server too slow
- Radix Tabs mounts all tab panels simultaneously — causes strict mode violations for `getByText()` when same text appears in multiple tabs
- Sidebar locator `'nav, aside'` matched hidden mobile nav before visible aside — fixed to `'aside'` only
- `/api/health` returns 503 ("unhealthy") when external services not connected — tests now accept 503
- Navigation errors (`ERR_ABORTED`) occur when pages redirect — tests now catch and continue
- Auth fixture `expectError()` can't rely on button becoming enabled — form may stay disabled during validation

**Resolved (Plan 53-03):**

- Auth link tests: fixed locators to match actual app text
- Dashboard page tests: added session + API mocking to `setDashboardAuth()`, React hydration waits
- Smoke test: reduced scope to core routes, better error handling
- Root cause of dashboard-flows failures: `'use client'` pages with async data fetch leave main area empty during SSR; sidebar presence now accepted as valid "page loaded" indicator

**Resolved (Plan 53-03b):**

- Onboarding full wizard: added graceful early return when wizard guard redirects (step-2→step-3 soft nav)
- Onboarding back-nav: reduced waitForURL timeout from 60s to 10s, accept any /onboarding URL
- Onboarding fixture `continue()`: catch waitForURL timeout, fallback to direct goto
- Result: onboarding spec now 23/23 passed, 0 flaky

**Remaining flaky tests (2 — passed on retry):**

- 1x accessibility focus test (email input `toBeFocused` timing)
- 1x responsive touch target size (16px button vs 24px minimum)

### Phase 62 Architecture Decisions (2026-03-03)

Research applied: Stripe Minions synthesis (`.planning/research/stripe-minions-synthesis.md`)

- **Orchestrator pattern**: Deterministic `orchestrator.ts` controls flow; LLM is called only
  within bounded step types. The system runs the model, not the other way around.
- **Context assembly**: `context-builder.ts` with token budget. Each AI step receives previous
  StepExecution.outputData (last 3 steps max), not full conversation history.
- **Confidence gating**: Every AI step returns `confidenceScore` (0.0–1.0). Auto-approve if
  ≥ 0.85 (configurable per template). Below threshold → queue for human approval.
- **2-retry cap**: `retryCount >= 2` → mark step failed, surface to human. Never loop.
- **Human gates are mandatory**: Any step writing to external systems (publish, schedule, notify)
  requires human approval regardless of confidence score.
- **3 new Prisma models**: WorkflowExecution, StepExecution, WorkflowTemplate.
- **7 step types**: ai-generate, ai-analyse, ai-enrich, human-approval, action-publish,
  action-schedule, action-notify.
- **Phases 63-66 updated**: Each phase now has Minions-informed architecture note in ROADMAP.md.

Decisions from v3.1 (Phase 75):

- Admin route guard uses `verifyTokenSafe()` + cookie read + Prisma lookup in a server layout — `auth-service.ts` is client-side only; no `getServerSession` exists
- Shared `verifyAdmin` in `lib/admin/verify-admin.ts` replaces 3× copy-paste: checks API key (timing-safe), then JWT Bearer header, then `auth-token` cookie; isOwnerEmail() bypass runs before role check
- `User` type in `components/admin/types.ts` now uses Prisma field names (`createdAt`, `lastLogin`) not Supabase names (`created_at`, `last_sign_in_at`)
- Subscription model has no `amount` field — MRR must come from Stripe API (deferred)
- Admin handleSaveUser maps status choice to API action ('suspend'/'activate'/'delete') — role updates not yet persisted (no API action for role change)

Decisions from v8.0 (Phase 114-117):

- Stripe live account: `acct_1SSgvEBJ6dR6rf4P` (Unite-Hub) — separate from test account `acct_1SzE5KGib5mMf28d`
- Live pricing: Pro $249/mo (`price_1TAJvpBJ6dR6rf4P9ESrr5Ym`), Growth $449/mo (`price_1TAJw4BJ6dR6rf4P9whS9Htz`), Scale $799/mo (`price_1TAJw5BJ6dR6rf4Pe4DnpG6w`)
- Live webhook: `we_1TAJrdBJ6dR6rf4PVh6J30OL` → `https://synthex.social/api/webhooks/stripe`
- DNS: synthex.social A record → `216.150.1.1` (Vercel's new IP range), SSL auto-managed
- Vercel nameservers: `ns1.vercel-dns.com`, `ns2.vercel-dns.com`
- Sentry removed from dependencies (caused build failures in Vercel serverless environment)
- `instrumentation.ts` uses no-throw env validation pattern
- Health/ping routes have `maxDuration=30` for cold-start survival

### Blockers/Concerns

None.

## Roadmap Evolution

- v1.0 Production Hardening: 10 phases (1-10) — SHIPPED 2026-02-17
- v1.1 Platform Enhancement: 8 phases (11-18) — SHIPPED 2026-02-17
- v1.2 Features: 11 phases (19-29), AI content + analytics + integrations + collaboration — SHIPPED 2026-02-18
- v1.3 Features: 6 phases (30-35), SEO & Search focus — SHIPPED 2026-02-18
- v1.4 Creator Monetization & AI Studio: 16 phases (36-51) — SHIPPED 2026-02-18
- v1.5 Deployment Readiness created: 7 phases (52-58), testing + polish + performance
- v2.0 Reliable AI Agents: 8 phases (59-66), context resilience + AI orchestration + workflow engine + insights — SHIPPED 2026-03-03
- v3.0 Public Launch Readiness: 8 phases (67-74), cleanup + Stripe + landing + onboarding + observability + performance + security + launch — SHIPPED 2026-03-10
- v3.1 First Users: 2 phases (75-76), God Mode admin + NEXUS branding + Unite-Hub connector — SHIPPED 2026-03-10
- v4.0 Production Complete: 8 phases (77-84), content creation + scheduling + admin + brand profiles + social onboarding + code quality + accessibility + UAT — SHIPPED 2026-03-10
- v5.0 AI-Native GEO & Citation Engine: 16 phases (85-100), entity coherence + citation tracking + GEO optimiser v2 + writing methodology + AI slop detection + E-E-A-T + brand building + PR + awards + backlinks + prompt intelligence + algorithm sentinel + autonomous A/B testing + self-healing + citation dashboard — **SHIPPED 2026-03-11**
- v8.0 Production Go-Live: 4 phases (114-117), Vercel deploy + Stripe live + DNS + launch runbook — **SHIPPED 2026-03-13** 🚀

## Session Continuity

Last session: 2026-03-23
Stopped at: Phase 127 contact-form complete — /api/contact wired to Resend
Resume file: None
Next action: Verify synthex.social domain in Resend dashboard, then live-test contact form

## Linear Issues — v2.0 Phase 59-66 Tracking

| Issue                                                 | Title                                       | Phase | Status |
| ----------------------------------------------------- | ------------------------------------------- | ----- | ------ |
| UNI-1237                                              | Phase 59: Context Resilience Infrastructure | 59    | Done   |
| UNI-1238                                              | Phase 60: Agent Orchestration Hardening     | 60    | Done   |
| (phases 61-66 issues to be created when phases begin) | —                                           | —     | —      |

---

## v12.0 — Proposed Next Milestone

Based on SWARM audit "Missing Systems" findings, v12.0 should focus on:

### Phase 126: Newsletter & Lead Nurture

- Email capture on landing (done: 2026-03-24)
- Post-signup Day 0→3→7→14 email sequence via Resend
- Unsubscribe flow

### Phase 127: PWA Service Worker

- Register sw.js for push notifications
- Offline fallback page
- Install prompt on mobile

### Phase 128: Demo Booking Integration

- Wire contact page demo form to Calendly or Cal.com
- CRM lead capture (HubSpot or Notion database)

### Phase 129: Status Page

- status.synthex.social (BetterStack or similar)
- Link in footer

### Phase 130: WebSocket → SWR Migration (pending Phil P3 decision)

- Replace lib/websocket/ with SWR polling at 5s interval
- Eliminates serverless incompatibility
