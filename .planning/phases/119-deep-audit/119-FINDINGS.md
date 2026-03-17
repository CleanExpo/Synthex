# 119-FINDINGS.md — Phase 119 Deep Audit

Generated: 2026-03-17
Total findings: 107
Sources: 119-01-FINDINGS.md (Quality/Security/Packages), 119-02-FINDINGS.md (Routes/Connections), 119-03-FINDINGS-contrast.md (UI Contrast)

---

## CRITICAL (must fix before next deploy)

### [FINDING-001] formerly QUALITY-45

**Category:** Quality Gates — Tests
**File:** `tests/unit/lib/prisma.test.ts`
**Issue:** 3 test failures in Prisma Client Utilities. The test expects the browser-environment guard to return `null` but the lazy-proxy implementation throws on property access when uninitialised. Two additional failures for DATABASE_URL validation throw unexpected error paths.
**Root cause:** Test assertions do not match the behaviour of the lazy-proxy guard in `lib/prisma.ts`.

---

### [FINDING-002] formerly QUALITY-46

**Category:** Quality Gates — Tests
**File:** `tests/contract/onboarding-referrals.contract.test.ts`
**Issue:** 7 test failures in Onboarding & Referrals API Contract Tests. Tests were written against the prior onboarding API contract. Commit 005c8154 (server-persist pipeline) changed the contract but the tests were not updated.
**Root cause:** Stale contract tests — POST /api/onboarding auth enforcement, input validation, success shape, GET auth enforcement, and GET response shape all fail.

---

### [FINDING-003] formerly QUALITY-47

**Category:** Quality Gates — Tests
**File:** `tests/unit/api/stripe-routes.test.ts`
**Issue:** 7 test failures. Test expects 3 Stripe product tiers with old names (professional/business/custom) but `lib/stripe/config.ts` now defines 4 tiers (starter/pro/growth/scale). All tier-specific feature assertions fail with TypeError.
**Root cause:** Stripe tier names were updated without updating the corresponding test file.

---

### [FINDING-004] formerly QUALITY-48

**Category:** Quality Gates — Tests
**File:** `tests/unit/api/campaigns.test.ts`
**Issue:** 8 test failures across all HTTP methods on the Campaigns API. Routes return 500 because Prisma mock setup is not resolving — `prisma.campaign.findMany`/`create`/`update`/`delete` mocks are not wired.
**Root cause:** Mock reset or import order issue in test setup. All campaign API tests fail.

---

### [FINDING-005] formerly ROUTE-01

**Category:** API Routes — Security
**File:** `app/api/system/models/route.ts:100`
**Issue:** POST handler authenticates via `getAuthUser()` but the admin role check is explicitly disabled with a TODO comment (`// TODO(UNI-475): Add admin role check`). Any authenticated user can force-refresh the AI model registry. References UNI-475, unresolved.

---

### [FINDING-006] formerly ROUTE-02

**Category:** API Routes — Validation
**File:** `app/api/generate/route.ts:70-85`
**Issue:** POST handler uses manual `if` checks instead of a Zod schema for `prompt`, `platform`, `style`, `count` parameters. This bypasses type coercion and structured validation. Route uses non-standard auth pattern (`requireApiKey` + `verifyTokenSafe`). Still accessible despite comment marking it as superseded by `/api/ai/generate-content`.

---

### [FINDING-007] formerly ROUTE-03

**Category:** API Routes — Auth
**File:** `app/api/analytics/route.ts:41` and ~28 other routes
**Issue:** `getUserIdFromRequest` reads only the `Authorization: Bearer` header, not the `auth-token` httpOnly cookie. The primary auth mechanism is httpOnly cookies. Frontend callers without an explicit Bearer header receive 401 even when authenticated via cookie. Affected: `app/api/analytics/route.ts`, `app/api/tasks/route.ts`, `app/api/research/route.ts`, `app/api/voice/analyze/route.ts`, all routes in `app/api/authority/` (5 files), `app/api/authors/` (3 files), `app/api/awards/` (3 files). ~28 files total.
**Fix:** Replace `getUserIdFromRequest(request)` with `getUserIdFromRequestOrCookies(request)` in all affected files.

---

### [FINDING-008] formerly CONTRAST-01

**Category:** UI Contrast
**File:** `components/ui/prompt-input.tsx:132`
**Element:** placeholder
**Class:** `placeholder:text-white/30`
**Issue:** AI prompt textarea placeholder text at 30% white opacity on a dark glassmorphic container. Approximately 1.8:1 contrast ratio. Fails WCAG AA 4.5:1 for normal text, 3:1 for large text. Primary AI input — high user-facing impact.
**Fix:** `placeholder:text-white/50`

---

### [FINDING-009] formerly CONTRAST-02

**Category:** UI Contrast
**File:** `components/dashboard/tabs/analytics-tab.tsx:37`
**Element:** informational text label
**Class:** `text-white/15`
**Issue:** "Chart visualisation connected to backend" helper text at 15% white opacity. Approximately 1.2:1 contrast ratio. Functionally invisible on any dark background.
**Fix:** `text-white/50`

---

### [FINDING-010] formerly CONTRAST-03

**Category:** UI Contrast
**File:** `components/dashboard/SystemPulsePanel.tsx:279`
**Element:** label
**Class:** `text-white/15`
**Issue:** "auto-refreshes every 30s" informational label at 15% opacity. Approximately 1.2:1 contrast. Invisible.
**Fix:** `text-white/40`

---

### [FINDING-011] formerly CONTRAST-04

**Category:** UI Contrast
**File:** `components/dashboard/UniteHubWidget.tsx:136`
**Element:** helper text
**Class:** `text-white/15`
**Issue:** "(configure in Unite-Group)" hint text at 15% opacity. Approximately 1.2:1. Invisible.
**Fix:** `text-white/40`

---

### [FINDING-012] formerly CONTRAST-05

**Category:** UI Contrast
**File:** `components/research/SASScore.tsx:110`
**Element:** text
**Class:** `text-white/10`
**Issue:** Text at 10% white opacity. Approximately 1.1:1 contrast ratio. Completely invisible on dark background.
**Fix:** `text-white/50`

---

## HIGH (fix in Phase 121)

### [FINDING-013] formerly SECURITY-04

**Category:** Security
**Area:** env-coverage
**Issue:** `NEXT_PUBLIC_BYPASS_TOKEN` is listed in `.env.example` with the `NEXT_PUBLIC_` prefix, meaning the token value is embedded in the client-side JavaScript bundle if set. If used as an auth bypass in any deployed environment (staging or production), the token value is discoverable by any user who inspects the bundle.
**Fix:** Confirm this variable is never set in deployed environments. Remove from `.env.example` or document it is dev-only and never deployed.

---

### [FINDING-014] formerly PACKAGES-01

**Category:** Packages
**Package:** openai
**Issue:** Installed 4.104.0, latest 6.31.0. Two major versions behind. v5 and v6 have breaking API surface changes. Used in `lib/` for direct OpenAI API calls. Risk of deprecated endpoints being removed by OpenAI.

---

### [FINDING-015] formerly PACKAGES-22

**Category:** Packages — Bundle Size
**Package:** @remotion/player (94MB total)
**Issue:** `@remotion/player` is in production dependencies and imported in client components. 94MB package tree. Remotion is notoriously difficult to tree-shake. Must be loaded via `next/dynamic` with `ssr: false`.
**Fix:** Verify no static import on any page-level or layout component. Enforce dynamic import only.

---

### [FINDING-016] formerly PACKAGES-23

**Category:** Packages — Bundle Size
**Package:** gsap (6.4MB)
**Issue:** Used in `app/dashboard/web-projects/[id]/page.tsx` (`'use client'`). Uses GSAP Club plugins (SplitText, ScrollTrigger) — pro-tier features that require a paid licence. Plugin presence in the build may violate licence terms. Also adds significant bundle weight.
**Fix:** Verify GSAP Club licence. Use dynamic import for GSAP animation code.

---

### [FINDING-017] formerly ROUTE-04

**Category:** API Routes — Stub
**File:** `app/api/generate/diagram/route.ts:46-53`
**Issue:** Returns `{ status: 501 }` when `PAPER_BANANA_SERVICE_URL` is not set. Marked `@internal` with no UI page yet. Auth and Zod validation present — stub is conditional and intentional.

---

### [FINDING-018] formerly ROUTE-05

**Category:** API Routes — Stub
**File:** `app/api/generate/plot/route.ts:46-53`
**Issue:** Same pattern as FINDING-017. Returns 501 when `PAPER_BANANA_SERVICE_URL` absent. Conditional stub with auth.

---

### [FINDING-019] formerly ROUTE-06

**Category:** API Routes — Stub
**File:** `app/api/generate/route.ts:88-96`
**Issue:** Returns 501 when `OPENROUTER_API_KEY` not set. Legacy AI generation wrapper. Active callers should use `/api/ai/generate-content` but this route is still callable.

---

### [FINDING-020] formerly ROUTE-07

**Category:** API Routes — Stub
**File:** `app/api/social/youtube/post/route.ts:113-116`
**Issue:** `type=community` branch returns 501 — community posts unavailable via API (genuine YouTube API limitation). Video upload path is fully implemented. Auth and Zod present.

---

### [FINDING-021] formerly ROUTE-08

**Category:** API Routes — Auth Pattern
**File:** `app/api/social/post/route.ts:35` and `app/api/roles/route.ts:73`
**Issue:** Use `getUserIdFromCookies()` (cookie-only) rather than `getUserIdFromRequestOrCookies(request)`. High-value routes — social posting and RBAC management — cannot be called by API consumers using Bearer tokens. See also FINDING-028 for full 30-route list.

---

### [FINDING-022] formerly ROUTE-10

**Category:** API Routes — Multi-Tenancy
**File:** `app/api/tasks/route.ts` (all handlers)
**Issue:** Task model queries use only `userId` in `where` clause. No `organizationId` scoping. In multi-org context, a user switching orgs still sees tasks from their userId across all orgs. Campaigns and Posts use `organizationId` correctly.
**Fix:** Add `getEffectiveQueryFilter(userId)` or explicit `organizationId` scoping.

---

### [FINDING-023] formerly ROUTE-11

**Category:** API Routes — Multi-Tenancy
**File:** `app/api/research/route.ts` (all handlers)
**Issue:** `GEOResearchReport` queries use only `userId`. No organisation scoping. Same concern as FINDING-022.

---

### [FINDING-024] formerly ROUTE-12

**Category:** API Routes — Multi-Tenancy
**File:** `app/api/analytics/route.ts`
**Issue:** Gets campaign IDs by `where: { userId }` without org scoping. Includes campaigns from all orgs the user belongs to. The `campaigns/route.ts` correctly uses `getEffectiveQueryFilter(userId)`. Analytics bypasses this utility.

---

### [FINDING-025] formerly CONNECT-01

**Category:** Frontend Connections — Missing Route
**Frontend:** `app/dashboard/authority/page.tsx:57`
**API:** `/api/billing/subscription`
**Issue:** `fetch('/api/billing/subscription', { credentials: 'include' })` is called to gate feature access, but no `app/api/billing/subscription/route.ts` exists. The `/api/billing/` directory does not exist. This fetch returns 404, silently failing the billing check. The equivalent `/api/user/subscription` route exists and could serve this purpose.

---

### [FINDING-026] formerly CONNECT-03

**Category:** Frontend Connections — Parameter Mismatch
**Frontend:** `components/NotificationBell.tsx:53`
**API:** `/api/notifications`
**Issue:** Frontend sends `?unread=true` but route reads `url.searchParams.get('unreadOnly')`. The filter is silently ignored — the unread count badge always shows all notifications. This is the same issue as the route-level finding in FINDING-031.

---

### [FINDING-027] formerly CONNECT-12

**Category:** Frontend Connections — Auth Reliability
**Frontend:** `components/competitor-analysis/index.tsx:45`
**API:** `/api/intelligence/competitors?action=list`
**Issue:** Call made without `credentials: 'include'`, meaning the auth-token cookie may not be sent in cross-origin contexts. Route requires authentication via `APISecurityChecker.check`. Competitor intelligence is sensitive data.

---

### [FINDING-028] formerly CONNECT-13

**Category:** Frontend Connections — Method Verification
**Frontend:** Multiple callers of `POST /api/auth/connections`
**API:** `app/api/auth/connections/route.ts`
**Issue:** Callers from onboarding connect page and platforms dashboard both POST to `/api/auth/connections`. A GET call from `components/ai-content-studio/index.tsx:78` also calls this route with an `organizationId` query param. Need to confirm the route exports both GET and POST handlers.

---

### [FINDING-029] formerly CONTRAST-06

**Category:** UI Contrast
**File:** `app/dashboard/layout.tsx:577`
**Element:** placeholder (global search bar)
**Class:** `placeholder:text-white/20`
**Issue:** Main dashboard layout search bar placeholder at 20% opacity. Approximately 1.5:1 contrast. Fails WCAG AA. This appears on every dashboard page.
**Fix:** `placeholder:text-white/40`

---

### [FINDING-030] formerly CONTRAST-07 + CONTRAST-08

**Category:** UI Contrast
**Files:** `app/dashboard/competitors/page.tsx:344,354,364,374,384`; `app/dashboard/seo/audit/page.tsx:393`
**Element:** placeholder (6 inputs)
**Class:** `placeholder:text-white/25`
**Issue:** All 6 input placeholders at 25% opacity. Approximately 1.8:1 contrast. Fails WCAG AA.
**Fix:** `placeholder:text-white/45`

---

### [FINDING-031] formerly CONTRAST-09

**Category:** UI Contrast
**File:** `components/ui/button.tsx:20`
**Element:** button (ghost variant — all instances across codebase)
**Class:** `text-white/40` (default ghost state)
**Issue:** Ghost button default text at 40% opacity. Approximately 2.5:1 contrast. Fails WCAG AA for normal text (4.5:1) and technically fails for 12px text. Affects all ghost buttons codebase-wide (audit-log-viewer, sidebar toggle, admin bulk-actions, etc.).
**Fix:** Raise to `text-white/60` (approximately 3.8:1, passes large-text AA)

---

### [FINDING-032] formerly CONTRAST-10

**Category:** UI Contrast
**File:** `components/ui/button.tsx:16, 18`
**Element:** button (outline and secondary variants)
**Class:** `text-white/50`
**Issue:** Outline and secondary variants at 50% opacity (~3.1:1 contrast). Fail WCAG AA for 12px (text-xs) text. Affects many buttons across the codebase.
**Fix:** `text-white/70` (approximately 4.4:1)

---

### [FINDING-033] formerly CONTRAST-11

**Category:** UI Contrast
**File:** `components/dashboard/SidebarGroup.tsx:61, 68, 73, 102`
**Element:** icon and label (inactive sidebar navigation)
**Class:** `text-white/20` (inactive icons and chevrons)
**Issue:** Inactive sidebar navigation items and icons at 20% opacity. Approximately 1.5:1 contrast. Fails WCAG SC 1.4.11 Non-text Contrast (3:1 minimum for interactive icons). Core navigation — high impact.
**Fix:** `text-white/40` for icons, `text-white/50` for labels

---

### [FINDING-034] formerly CONTRAST-12

**Category:** UI Contrast
**File:** `components/ui/toggle.tsx:17`
**Element:** button (toggle inactive state)
**Class:** `text-white/40`
**Issue:** Toggle buttons in inactive state at 40% opacity. Approximately 2.5:1 contrast. Fails WCAG SC 1.4.11 (interactive control contrast).
**Fix:** `text-white/60`

---

## MEDIUM (schedule for Phase 121 or 122)

### [FINDING-035] formerly QUALITY-44

**Category:** Quality Gates — Lint Config
**File:** `eslint.config.js`
**Issue:** `.next-turbo/` directory is absent from the ESLint `ignores` list. Running `npm run lint` (which runs `eslint .`) lints the Turbopack build cache, producing hundreds of false-positive errors and warnings in generated JS. The `ignores` list covers `.next/**` but not `.next-turbo/**`.
**Fix:** Add `'.next-turbo/**'` to the `ignores` array in `eslint.config.js`.

---

### [FINDING-036] formerly SECURITY-05

**Category:** Security — Auth Middleware
**Area:** `middleware.ts`
**Issue:** The middleware `protectedPaths` list is narrow — only `/api/protected`, `/api/user`, `/api/integrations`. The vast majority of ~279 POST routes in `app/api/` are not in this list and receive no middleware-level auth enforcement. Each route must implement its own auth guard. A missing in-route guard has no fallback.
**Fix:** Document the design decision. Consider a default-deny stance for all `/api/` routes at the middleware level, whitelisting public routes explicitly.

---

### [FINDING-037] formerly SECURITY-07

**Category:** Security — RLS
**Area:** `supabase/` SQL files
**Issue:** RLS SQL files cover only 10 tables with `ENABLE ROW LEVEL SECURITY` out of 131 Prisma models (~7.6% coverage). Remaining models either use Prisma-only access (safe if all access goes through Next.js API layer), have undocumented dashboard-configured RLS, or have no RLS at all.
**Fix:** Audit which tables are accessed via `supabase.from(...)` client-side. Verify RLS policies exist for all such tables. Document Prisma-only tables as intentionally exempt.

---

### [FINDING-038] formerly PACKAGES-13

**Category:** Packages — Unused
**Package:** get-video-duration
**Issue:** Zero import references in `app/`, `components/`, `lib/`. Listed in `dependencies`. May be used in `scripts/` or legacy code.

---

### [FINDING-039] formerly PACKAGES-14

**Category:** Packages — Unused
**Package:** chalk
**Issue:** Zero import references in `app/`, `components/`, `lib/`. Likely used only in `scripts/` (CLI). Should move to `devDependencies`.

---

### [FINDING-040] formerly PACKAGES-15

**Category:** Packages — Unused
**Package:** posthog-js
**Issue:** Zero import references in source. Listed in devDependencies with zero usage. Confirm whether analytics is handled differently.

---

### [FINDING-041] formerly PACKAGES-16

**Category:** Packages — Unused
**Package:** @anthropic-ai/claude-agent-sdk
**Issue:** No static `from '@anthropic-ai/claude-agent-sdk'` import found in source. May be used via dynamic import in `lib/queue/workers/autonomous-task-worker.ts` — verify the dynamic import path is correct.

---

### [FINDING-042] formerly PACKAGES-17

**Category:** Packages — Unused
**Package:** es-abstract
**Issue:** Zero import references in `app/`, `components/`, `lib/`. Typically a peer dependency — should not be in direct `dependencies`.

---

### [FINDING-043] formerly PACKAGES-18

**Category:** Packages — Unused
**Package:** dompurify (standalone)
**Issue:** Zero direct `dompurify` imports. Codebase uses `isomorphic-dompurify` (found in `lib/sanitize.ts`). Both packages in `dependencies`. The standalone `dompurify` is redundant.

---

### [FINDING-044] formerly PACKAGES-19

**Category:** Packages — Unused
**Package:** @auth/prisma-adapter
**Issue:** Zero import references. This is the NextAuth Prisma adapter. Project uses Supabase Auth (not NextAuth) per CLAUDE.md. Package should be removed.

---

### [FINDING-045] formerly PACKAGES-20

**Category:** Packages — Unused
**Package:** redis (standalone)
**Issue:** Zero import references. Codebase uses `ioredis` and `@upstash/redis`. Standalone `redis@5` package appears unused.

---

### [FINDING-046] formerly PACKAGES-21

**Category:** Packages — Unused
**Package:** number-flow (without scope)
**Issue:** Both `number-flow` and `@number-flow/react` are in dependencies. Source uses `@number-flow/react`. The unscoped `number-flow` shows zero source imports — likely a redundant duplicate.

---

### [FINDING-047] formerly PACKAGES-24

**Category:** Packages — Bundle Size
**Package:** framer-motion (5.1MB)
**Issue:** Imported in multiple `'use client'` components (AIABTesting, AIHashtagGenerator, AIWritingAssistant, AnimatedCard, etc.). Verify not imported in `app/layout.tsx` or root layouts.

---

### [FINDING-048] formerly PACKAGES-25

**Category:** Packages — Bundle Size
**Package:** recharts (5.0MB)
**Issue:** Imported in multiple `'use client'` chart components. Depends on D3 sub-modules. Verify chart components are only rendered within dashboard routes, not root layout.

---

### [FINDING-049] formerly ROUTE-09

**Category:** API Routes — Auth Pattern
**Files:** 30 route files using `getUserIdFromCookies()` (see 119-02-FINDINGS.md for full list)
**Issue:** All 30 files use cookie-only auth. Mutation routes among these cannot be called by API consumers using Bearer tokens. Preferred function: `getUserIdFromRequestOrCookies(request)` which checks cookies first, then header.

---

### [FINDING-050] formerly ROUTE-13

**Category:** API Routes — Validation
**File:** `app/api/scheduler/posts/route.ts:316-318`
**Issue:** PATCH handler extracts `id` from raw body before Zod validation. `id` is checked for existence but not validated as UUID format. Minor gap.

---

### [FINDING-051] formerly ROUTE-14 / CONNECT-03 (route perspective)

**Category:** API Routes — Parameter Mismatch
**File:** `app/api/notifications/route.ts:57`
**Issue:** Route reads `url.searchParams.get('unreadOnly')` but frontend sends `?unread=true`. The unread filter silently does nothing — always returns all notifications. See also FINDING-026 for the frontend perspective.

---

### [FINDING-052] formerly CONNECT-04

**Category:** Frontend Connections — Orphaned Route
**API:** `/api/example/redis-demo`
**Issue:** Route exists with no frontend caller. Developer example route — should be removed or access-restricted before production.

---

### [FINDING-053] formerly CONNECT-05

**Category:** Frontend Connections — Orphaned Route
**API:** `/api/sentry-test`
**Issue:** Sentry integration test route with no frontend caller. Should be removed or restricted to admin use in production.

---

### [FINDING-054] formerly CONNECT-07

**Category:** Frontend Connections — Orphaned Route
**API:** `/api/cache`
**Issue:** Cache management route with no frontend caller. Verify auth guard is in place.

---

### [FINDING-055] formerly CONNECT-08

**Category:** Frontend Connections — Orphaned Routes
**API:** `/api/eeat/audit`, `/api/eeat/score`
**Issue:** Older EEAT routes with no frontend callers — may be superseded by `/api/eeat/v2/` routes.

---

### [FINDING-056] formerly CONNECT-09

**Category:** Frontend Connections — Orphaned Routes
**API:** `/api/indexing`, `/api/mobile/config`, `/api/mobile/sync`
**Issue:** Routes exist with no frontend callers. May be intended for mobile app or external integration, or may be orphaned.

---

### [FINDING-057] formerly CONNECT-10

**Category:** Frontend Connections — Orphaned Routes
**API:** `/api/moderation/check`, `/api/quality/gate`
**Issue:** Moderation check and quality gate routes have no frontend callers. `/api/quality/audit` IS called, `/api/quality/gate` is not.

---

### [FINDING-058] formerly CONTRAST-13

**Category:** UI Contrast
**Files:** `app/(auth)/login/page.tsx:326,346,361`; `app/(auth)/signup/page.tsx:453,473,493,510,543,560`
**Element:** icon (field prefix/suffix icons)
**Class:** `text-gray-500`
**Issue:** Input field prefix icons (Mail, Lock, Eye, User) use text-gray-500 (#6b7280) on dark glassmorphic card. Approximately 2.8:1 contrast. Fails WCAG SC 1.4.11 Non-text Contrast (3:1). High-traffic auth pages.
**Fix:** `text-gray-400` (#9ca3af) — approximately 3.5:1

---

### [FINDING-059] formerly CONTRAST-14

**Category:** UI Contrast
**Files:** `app/(auth)/login/page.tsx:333,353`; `app/(auth)/signup/page.tsx:431,460,480,503,550`
**Element:** placeholder (auth form inputs)
**Class:** `placeholder:text-gray-500`
**Issue:** All auth form input placeholders at text-gray-500 (#6b7280) on bg-white/5 dark surface. Approximately 2.8:1. Fails WCAG AA for normal text. Critical user path.
**Fix:** `placeholder:text-gray-400` (#9ca3af) — approximately 3.5:1

---

### [FINDING-060] formerly CONTRAST-15

**Category:** UI Contrast
**Files:** `app/(onboarding)/onboarding/page.tsx:271,288`; `app/(onboarding)/onboarding/review/page.tsx:495,564,684`
**Element:** placeholder (onboarding form inputs)
**Class:** `placeholder:text-gray-500`
**Issue:** Onboarding form placeholders at text-gray-500. Same contrast concern as FINDING-059. Onboarding is a first-use critical path.
**Fix:** `placeholder:text-gray-400`

---

### [FINDING-061] formerly CONTRAST-16

**Category:** UI Contrast
**File:** `components/ui/form-field.tsx:136`
**Element:** helper text
**Class:** `text-gray-500`
**Issue:** Form field helper text (hint below input) at text-gray-500. Approximately 2.8:1. Fails WCAG AA for normal text. Applies globally wherever `FormField` is used with helper text.
**Fix:** `text-gray-400`

---

### [FINDING-062] formerly CONTRAST-17

**Category:** UI Contrast
**Files:** `components/admin/audit-log-drawer.tsx`, `components/admin/audit-log-viewer.tsx`, `components/authority/AuthorityScoreCard.tsx`, `components/affiliates/LinkList.tsx`, `components/affiliates/NetworkList.tsx`, `components/ai-pm/AIPMPanel.tsx`, `components/approval-workflow/RequestCard.tsx`, `components/approval-workflow/RequestDetail.tsx`, `components/authority/LLMCitationFitnessCard.tsx`, `components/bayesian/RunHistoryTable.tsx`, and 5+ other components
**Element:** badge / status indicator
**Class:** `bg-red-500/20 text-red-400`
**Issue:** Red status badges use text-red-400 on bg-red-500/20. Approximately 2.9:1 contrast. Fails WCAG AA for 12px badge text (4.5:1 required). Widespread pattern across 10+ components.
**Fix:** Use `text-red-300` instead of `text-red-400` — approximately 4.2:1 on dark/red-tinted composite

---

### [FINDING-063] formerly CONTRAST-18

**Category:** UI Contrast
**File:** `app/(onboarding)/onboarding/review/page.tsx:740`
**Element:** badge
**Class:** `bg-cyan-500/5 text-cyan-400`
**Issue:** Badge uses 5% opacity cyan background — nearly invisible container. Badge boundary not distinguishable from page background.
**Fix:** `bg-cyan-500/15` with `border-cyan-500/40`

---

### [FINDING-064] formerly CONTRAST-19

**Category:** UI Contrast
**File:** `components/ui/input.tsx:23` (subtle variant)
**Element:** input border (unfocused)
**Class:** `border-transparent`
**Issue:** The `subtle` input variant has `border-transparent` in unfocused state. Input field boundaries invisible until focus. Applies wherever `variant="subtle"` is used.
**Fix:** `border border-white/[0.08]` for unfocused state (consistent with glass variant)

---

### [FINDING-065] formerly CONTRAST-20

**Category:** UI Contrast
**File:** `components/dashboard/get-started-checklist.tsx:271`
**Element:** text link button
**Class:** `text-white/20`
**Issue:** Text action link at 20% opacity. Approximately 1.5:1. Fails all WCAG text contrast thresholds.
**Fix:** `text-white/50`

---

### [FINDING-066] formerly CONTRAST-21

**Category:** UI Contrast
**Files:** `components/settings/billing-tab.tsx:81, 114`
**Element:** section header labels
**Class:** `text-white/25`
**Issue:** "Included on free" and "Starter includes" billing section labels at 25% opacity. These are content labels (~1.8:1 contrast).
**Fix:** `text-white/50`

---

## LOW (backlog)

### [FINDING-067] formerly SECURITY-01

**Category:** Security — npm audit
**Issue:** `@tootallnate/once` (<3.0.1) — Incorrect Control Flow Scoping (GHSA-vpq2-c234-7xj6). devDependency chain only (jest-environment-jsdom → jsdom → http-proxy-agent). Zero production exposure.

---

### [FINDING-068] formerly SECURITY-02

**Category:** Security — npm audit
**Issue:** `elliptic` — Cryptographic Primitive with Risky Implementation (GHSA-848j-6mx2-7j84). devDependency chain only (Storybook). Zero production exposure.

---

### [FINDING-069] formerly SECURITY-03

**Category:** Security — env coverage
**Issue:** ~70 variables in `.env.example` have no `process.env.<VAR>` reference in `app/api/` or `lib/`. Notable dead entries include: `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (project uses Supabase Auth), `FACEBOOK_CLIENT_ID`/`CLIENT_SECRET` (wrong var names — app uses `FACEBOOK_APP_ID`/`APP_SECRET`), `STRIPE_API_KEY`/`LIVE_KEY`/`PUBLISHABLE_KEY`, multiple feature-flag env vars with no source readers, `REDIS_HOST`/`PORT`/`PASSWORD` (app uses `REDIS_URL` instead).
**Fix:** Audit and remove or annotate dead entries in `.env.example`.

---

### [FINDING-070] formerly SECURITY-06

**Category:** Security — Auth Middleware
**File:** `middleware.ts`
**Issue:** The `auth-token` JWT is parsed without signature verification in Edge Runtime (comment: "no DB query needed in Edge Runtime"). Tampered JWT payload could bypass the `onboardingComplete === false` redirect check, though route handlers still perform full DB-backed checks.
**Fix:** Consider verifying JWT signature in middleware using Web Crypto API with HS256.

---

### [FINDING-071] formerly SECURITY-08

**Category:** Security — RLS
**Issue:** `supabase/schema-step2-rls.sql` is a step-2 setup script, not a migrations directory. No `supabase/migrations/` directory with timestamped migration files. RLS policy changes are not tracked incrementally.
**Fix:** Adopt Supabase CLI migration workflow for incremental RLS policy tracking.

---

### [FINDING-072] formerly PACKAGES-02

**Category:** Packages — Outdated
**Package:** @anthropic-ai/sdk
**Issue:** Installed 0.20.9, latest 0.79.0. 59 minor versions behind in a 0.x package where breaking changes are common.

---

### [FINDING-073] formerly PACKAGES-03

**Category:** Packages — Outdated
**Package:** tailwindcss
**Issue:** Installed 3.4.19, latest 4.2.1. Tailwind v4 is a significant config-format rewrite. Not urgent but requires a dedicated migration.

---

### [FINDING-074] formerly PACKAGES-04

**Category:** Packages — Outdated
**Package:** zod
**Issue:** Installed 3.25.76, latest 4.3.6. Zod v4 has breaking changes. Used pervasively across the codebase.

---

### [FINDING-075] formerly PACKAGES-05

**Category:** Packages — Outdated
**Package:** @tiptap/react, @tiptap/starter-kit
**Issue:** Installed 2.27.2, latest 3.20.3. TipTap v3 has breaking API changes. Used in editor components.

---

### [FINDING-076] formerly PACKAGES-06

**Category:** Packages — Outdated
**Package:** @stripe/stripe-js
**Issue:** Installed 7.9.0, latest 8.10.0. Client-side Stripe.js. v8 has minor breaking changes in type signatures.

---

### [FINDING-077] formerly PACKAGES-07

**Category:** Packages — Outdated
**Package:** stripe (server)
**Issue:** Installed 18.5.0, latest 20.4.1. 2 minor versions behind — monitor for deprecations.

---

### [FINDING-078] formerly PACKAGES-08

**Category:** Packages — Outdated
**Package:** react / react-dom
**Issue:** Installed 18.3.1, latest 19.2.4. React 19 introduces breaking changes with the new compiler, concurrent features, and hooks. Major migration effort.

---

### [FINDING-079] formerly PACKAGES-09

**Category:** Packages — Outdated
**Package:** next
**Issue:** Installed 15.5.12, latest 16.1.7. Requires coordinated upgrade with React 19.

---

### [FINDING-080] formerly PACKAGES-10

**Category:** Packages — Outdated
**Package:** @prisma/client / prisma
**Issue:** Installed 6.14.0, latest 7.5.0. Prisma 7 has breaking changes in API. Requires schema/query review.

---

### [FINDING-081] formerly PACKAGES-11

**Category:** Packages — Outdated
**Package:** @supabase/ssr
**Issue:** Installed 0.6.1, latest 0.9.0. Auth-critical package — monitor for security patches.

---

### [FINDING-082] formerly PACKAGES-12

**Category:** Packages — Outdated
**Package:** cmdk
**Issue:** Installed 0.2.1, latest 1.1.1. 0.x → 1.x is effectively a major bump. Used for command menu UI.

---

### [FINDING-083] formerly ROUTE-15

**Category:** API Routes — Intentional No-Auth
**Files:** All `app/api/health/` routes
**Issue:** No auth guards. Intentional for health check endpoints. Documented for completeness. Exempt.

---

### [FINDING-084] formerly ROUTE-16

**Category:** API Routes — Intentional No-Auth
**Files:** All `app/api/webhooks/` routes
**Issue:** No JWT auth — use webhook signature verification. Correct pattern. Exempt.

---

### [FINDING-085] formerly ROUTE-17

**Category:** API Routes — Intentional No-Auth
**Files:** All `app/api/cron/` routes (14 routes)
**Issue:** Use `CRON_SECRET` for authorization rather than user JWT. Correct for Vercel cron jobs. All checked cron routes have the `CRON_SECRET` check in place. Exempt.

---

### [FINDING-086] formerly ROUTE-18

**Category:** API Routes — Duplication
**File:** `app/api/auth/login/route.ts` and `app/api/auth/unified-login/route.ts`
**Issue:** Dual login entry points. `/api/auth/login` appears to be legacy; `/api/auth/unified-login` is the current path. Not a security issue but may cause confusion.

---

### [FINDING-087] formerly CONNECT-06

**Category:** Frontend Connections — Exempt Orphaned Route
**API:** `/api/ping`
**Issue:** No frontend caller. Valid uptime monitoring endpoint. Exempt.

---

### [FINDING-088] formerly CONNECT-11

**Category:** Frontend Connections — Exempt Orphaned Route
**API:** `/api/internal/bo-callback`
**Issue:** Internal service callback (Bayesian Optimisation). No frontend caller expected. Exempt.

---

### [FINDING-089] formerly CONNECT-14

**Category:** Frontend Connections — Missing Dynamic Route
**Frontend:** `hooks/use-dashboard.ts:273`
**API:** `/api/tasks/${taskId}` (dynamic single-task GET)
**Issue:** `useApi<Task>(taskId ? \`/api/tasks/${taskId}\` : null)`calls`/api/tasks/[id]`but only`app/api/tasks/route.ts`(collection) and`app/api/tasks/bulk/route.ts`exist. No`app/api/tasks/[id]/route.ts`. Will 404 when a single task is requested by ID.

---

### [FINDING-090] formerly CONNECT-15

**Category:** Frontend Connections — Route Visibility
**API:** `app/api/admin/org-brand-profile/route.ts`
**Issue:** Not found in frontend grep results. May be called from admin UI but not confirmed. Verify the admin dashboard calls this route correctly.

---

### [FINDING-091] formerly QUALITY-02 through QUALITY-07

**Category:** Quality Gates — Lint
**Files:** Multiple `app/api/` route files (sentiment, google-callback, cron, library, teams-stats, webhooks)
**Issue:** Unused `eslint-disable` directives for `@typescript-eslint/no-explicit-any` — the rule is already disabled globally. Stale suppression comments across 6 files, 9 instances.

---

### [FINDING-092] formerly QUALITY-08, 10, 11, 14, 15, 16, 28

**Category:** Quality Gates — Lint (Accessibility)
**Files:** `app/dashboard/ai-images/page.tsx`, `app/dashboard/seo/page/page.tsx`, `app/dashboard/visuals/page.tsx`, `components/affiliates/LinkList.tsx`, `components/ai/image-generator.tsx`, `components/content/media-attacher.tsx`, `components/visuals/VisualGallery.tsx`
**Issue:** `jsx-a11y/alt-text` — Image elements missing alt prop across 7 files (11 instances). Accessibility violation.

---

### [FINDING-093] formerly QUALITY-09, 21, 22, 23, 25, 26, 27, 29

**Category:** Quality Gates — Lint
**Files:** `app/dashboard/billing/page.tsx`, `components/roi-calculator/index.tsx`, `components/scheduling/time-slot-picker.tsx`, `components/settings/ai-credentials-manager.tsx`, `components/settings/platform-credentials-manager.tsx`, `components/ui/file-tree.tsx`, `components/ui/nested-dialog.tsx`, `components/workflows/NewWorkflowDialog.tsx`
**Issue:** `react-hooks/exhaustive-deps` warnings across 8 files. Missing or incorrect hook dependencies.

---

### [FINDING-094] formerly QUALITY-12, 13

**Category:** Quality Gates — Lint
**Files:** `components/QuickStats.tsx`, `components/admin/vault-import-dialog.tsx`
**Issue:** `@typescript-eslint/no-unused-expressions` — expression statements that should be assignments or calls.

---

### [FINDING-095] formerly QUALITY-18, 20, 32-43

**Category:** Quality Gates — Lint
**Files:** `components/error-states/ErrorStates.tsx`, `components/marketing/SocialProof.tsx`, and 9 `lib/` files
**Issue:** `import/no-anonymous-default-export` across 11 locations. Named exports are preferred for tree-shaking and debugging.

---

### [FINDING-096] formerly QUALITY-19

**Category:** Quality Gates — Lint
**File:** `components/landing/bento-gallery.tsx:51, 94`
**Issue:** `react-hooks/exhaustive-deps` — ref value used in cleanup will have changed by cleanup time (x2 instances).

---

### [FINDING-097] formerly QUALITY-24, 17

**Category:** Quality Gates — Lint
**Files:** `components/settings/brand-profile-tab.tsx`, `components/content/platform-preview.tsx`
**Issue:** Stale `eslint-disable` directives for `@next/next/no-img-element` — rule is globally disabled.

---

### [FINDING-098] formerly QUALITY-30, 31, 40

**Category:** Quality Gates — Lint
**Files:** `lib/auth/monitoring.ts`, `lib/authority/claim-extractor.ts`, `lib/vault/vault-service.ts`
**Issue:** Stale `eslint-disable` directives for rules already disabled globally or now non-existent.

---

### [FINDING-099] formerly CONTRAST-22

**Category:** UI Contrast
**Files:** `components/dashboard/FirstWeekWidget.tsx:173,177,181,206,214,239`
**Element:** micro-labels (9-10px widget data labels)
**Class:** `text-white/25`
**Issue:** "Total", "Drafts", "Scheduled" and timestamp micro-labels at 25% opacity. Approximately 1.8:1. Intentional design aesthetic for de-emphasised labels. Low impact on core usability.
**Fix:** `text-white/40` if legibility is needed

---

### [FINDING-100] formerly CONTRAST-23

**Category:** UI Contrast
**File:** `components/ui/tabs.tsx:62` (underline variant)
**Element:** inactive tab border
**Class:** `border-transparent`
**Issue:** Underline tab inactive border is transparent — intentional pattern where no underline until active. Not an accessibility failure; tab affordance provided by visible text. Documented for completeness.

---

### [FINDING-101] formerly CONTRAST-24

**Category:** UI Contrast
**File:** `components/ui/radio-group.tsx:40, 42`
**Element:** radio item (checked state border)
**Class:** `data-[state=checked]:border-transparent`
**Issue:** Radio items lose border when checked — checked state provides fill colour feedback. Borderline acceptable but border would add additional clarity.
**Fix:** Consider `data-[state=checked]:border-cyan-500/60` for additional clarity

---

### [FINDING-102] formerly CONTRAST-25

**Category:** UI Contrast
**Files:** `components/dashboard/dashboard-header.tsx:21`, `components/dashboard/page-header.tsx:21`
**Element:** page super-title labels
**Class:** `text-white/25`
**Issue:** Section category super-labels above page headings at 25% opacity. Decorative context. Approximately 1.8:1.
**Fix:** `text-white/40`

---

### [FINDING-103] formerly CONTRAST-26

**Category:** UI Contrast
**Files:** `app/(auth)/login/page.tsx:259`; `app/(auth)/signup/page.tsx:292, 391`
**Element:** CardDescription text
**Class:** `text-gray-400`
**Issue:** CardDescription at text-gray-400 (~3.5:1) on dark card. Passes WCAG for large text (3:1) but fails strict WCAG AA for 14px regular text (4.5:1).
**Fix:** `text-gray-300` (approximately 5.1:1)

---

### [FINDING-104] formerly CONTRAST-27

**Category:** UI Contrast
**File:** `components/ui/calendar.tsx:36, 48, 49`
**Element:** calendar day labels (disabled/outside states)
**Class:** `text-gray-500 opacity-50` (stacked)
**Issue:** Outside-month days stack text-gray-500 and opacity-50 — approximately 1.4:1 effective contrast. Disabled elements are WCAG-exempt but double-opacity stacking is extreme. Intentional for "disabled" visual treatment.
**Fix:** `text-gray-600 opacity-100` gives same visual weight without stacking

---

### [FINDING-105] formerly CONTRAST-28

**Category:** UI Contrast
**Files:** Multiple `components/dashboard/tabs/*.tsx` files
**Element:** section sub-labels ("PLATFORM BREAKDOWN", "UPCOMING POSTS", etc.)
**Class:** `text-white/25`
**Issue:** Uppercase tracking labels at 25% opacity. Approximately 1.8:1. Decorative uppercase at small font size.
**Fix:** `text-white/40`

---

### [FINDING-106]

**Category:** Quality Gates — Lint
**Files:** Multiple QUALITY-02 through QUALITY-43 low-severity lint warnings (consolidated)
**Issue:** 60 ESLint warnings across source files — all LOW severity. Full list documented in 119-01-FINDINGS.md.

---

### [FINDING-107] formerly CONNECT-02

**Category:** Frontend Connections — Context Note
**File:** `hooks/use-settings-data.ts:143`
**Issue:** Comment references `/api/billing/subscription` but the hook correctly calls `/api/user/subscription`. No bug, but the comment is misleading. See FINDING-025 for the actual broken call in the authority page.

---

---

## Summary Statistics

| Category             | CRITICAL | HIGH   | MEDIUM | LOW    | Total   |
| -------------------- | -------- | ------ | ------ | ------ | ------- |
| Quality Gates        | 4        | 0      | 1      | 7      | 12      |
| Security             | 0        | 1      | 2      | 3      | 6       |
| Packages             | 0        | 3      | 9      | 11     | 23      |
| API Routes           | 3        | 8      | 3      | 6      | 20      |
| Frontend Connections | 0        | 4      | 8      | 6      | 18      |
| UI Contrast          | 5        | 7      | 9      | 7      | 28      |
| **Total**            | **12**   | **23** | **32** | **40** | **107** |

> Note: 6 additional LOW findings are consolidated ESLint noise (FINDING-091 through 098 cover several grouped QUALITY items). Total individual findings numbered: 107.

---

## Phase 121 Priority Queue (Top 10)

These 10 findings represent the highest combined impact of user harm, security risk, and revenue exposure. Phase 121 should address them in this order.

1. **FINDING-007** (ROUTE-03, CRITICAL) — `getUserIdFromRequest` in ~28 routes reads Bearer header only, not cookies. Every cookie-authenticated frontend request to analytics, tasks, research, authority, authors, awards, and voice routes silently 401s. Data appears broken to real users right now.

2. **FINDING-004** (QUALITY-48, CRITICAL) — 8 campaign API test failures due to broken Prisma mock setup. Campaigns are the core product object. Test suite can't validate any campaign mutations, blocking safe future changes to this critical path.

3. **FINDING-025** (CONNECT-01, HIGH) — Missing `/api/billing/subscription` route. The authority dashboard calls it directly for feature gating — returns 404 silently, causing feature gates to fail open or produce broken UI. Billing/authority is a premium feature.

4. **FINDING-005** (ROUTE-01, CRITICAL) — Admin role check disabled at `/api/system/models`. Any authenticated user can force-refresh the model registry. Unresolved TODO (UNI-475) — small blast radius but represents incomplete security hardening.

5. **FINDING-031** (CONTRAST-09, HIGH) — Ghost button default text at `text-white/40` (~2.5:1 contrast). This affects virtually every ghost button in the product — toolbar buttons, close buttons, action menus, sidebar toggles. Single line fix in `button.tsx` with broad positive impact.

6. **FINDING-029** (CONTRAST-06, HIGH) — Dashboard layout global search placeholder at `text-white/20`. This is on every dashboard page. Invisible placeholder makes the search bar appear broken/empty.

7. **FINDING-026** (CONNECT-03, HIGH) — Notification unread filter silently broken. Frontend sends `?unread=true`, route reads `unreadOnly`. Notification bell badge always shows total count, not unread count. Visual regression visible to all users.

8. **FINDING-022** + **FINDING-023** (ROUTE-10/11, HIGH) — Tasks and research routes lack `organizationId` scoping. In any multi-org scenario, users see tasks/research across all their orgs. Data isolation risk for paying multi-org customers.

9. **FINDING-013** (SECURITY-04, HIGH) — `NEXT_PUBLIC_BYPASS_TOKEN` with client-bundle exposure. Requires immediate verification that this is not set in staging or production. Zero-effort check, high risk if misconfigured.

10. **FINDING-059** + **FINDING-060** (CONTRAST-14/15, MEDIUM) — Auth and onboarding form placeholders at `text-gray-500` (~2.8:1) on dark input fields. First experience for new users — low-contrast form fields create friction at signup/login/onboarding. Simple class rename across ~15 input fields.
