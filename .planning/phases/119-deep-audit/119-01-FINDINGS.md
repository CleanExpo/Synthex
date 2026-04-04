# 119-01-FINDINGS.md — Framework & Security Audit

**Plan:** 119-01
**Date:** 2026-03-17
**Commands run in:** D:\Synthex

---

## TASK 1 — QUALITY GATE SWEEP

### 1a — TypeScript (npm run type-check)

[QUALITY-01] PASS
Command: type-check
Issue: `npm run type-check` (tsc --noEmit) exits 0 — zero TypeScript errors.

---

### 1b — ESLint (npx eslint app/ components/ lib/)

Note: `npm run lint` was run against source directories only (app/, components/, lib/). The default `eslint .` command also lints `.next-turbo/` build artifacts because `.next-turbo/` is absent from the `ignores` list in `eslint.config.js`. All findings below are from source directories only.

ESLint exited with 60 problems (0 errors, 60 warnings) across source files.

[QUALITY-02] LOW
File: app/api/ai-content/sentiment/route.ts:377, 399, 479, 498
Issue: Unused eslint-disable directives for `@typescript-eslint/no-explicit-any` (rule already disabled globally)
Command: lint

[QUALITY-03] LOW
File: app/api/auth/oauth/google/callback/route.ts:26
Issue: Unused eslint-disable directive for `@typescript-eslint/no-explicit-any`
Command: lint

[QUALITY-04] LOW
File: app/api/cron/publish-scheduled/route.ts:65
Issue: Unused eslint-disable directive for `@typescript-eslint/no-explicit-any`
Command: lint

[QUALITY-05] LOW
File: app/api/library/content/[contentId]/route.ts:172
Issue: Unused eslint-disable directive for `@typescript-eslint/no-explicit-any`
Command: lint

[QUALITY-06] LOW
File: app/api/teams/stats/route.ts:127
Issue: Unused eslint-disable directive for `@typescript-eslint/no-explicit-any`
Command: lint

[QUALITY-07] LOW
File: app/api/webhooks/social/route.ts:409, 546
Issue: Unused eslint-disable directives for `@typescript-eslint/no-explicit-any`
Command: lint

[QUALITY-08] LOW
File: app/dashboard/ai-images/page.tsx:100, 139
Issue: `jsx-a11y/alt-text` — Image elements missing alt prop (accessibility)
Command: lint

[QUALITY-09] LOW
File: app/dashboard/billing/page.tsx:98
Issue: `react-hooks/exhaustive-deps` — useCallback has unnecessary dependency 'router'
Command: lint

[QUALITY-10] LOW
File: app/dashboard/seo/page/page.tsx:298
Issue: `jsx-a11y/alt-text` — Image element missing alt prop
Command: lint

[QUALITY-11] LOW
File: app/dashboard/visuals/page.tsx:85, 132
Issue: `jsx-a11y/alt-text` — Image elements missing alt prop (x2)
Command: lint

[QUALITY-12] LOW
File: components/QuickStats.tsx:2
Issue: `@typescript-eslint/no-unused-expressions` — expression statement, expected assignment or call
Command: lint

[QUALITY-13] LOW
File: components/admin/vault-import-dialog.tsx:405, 439, 521
Issue: Unused eslint-disable directive (405); no-unused-expressions warnings (439, 521)
Command: lint

[QUALITY-14] LOW
File: components/affiliates/LinkList.tsx:124
Issue: `jsx-a11y/alt-text` — Image element missing alt prop
Command: lint

[QUALITY-15] LOW
File: components/ai/image-generator.tsx:220
Issue: `jsx-a11y/alt-text` — Image element missing alt prop
Command: lint

[QUALITY-16] LOW
File: components/content/media-attacher.tsx:174, 191, 216
Issue: Missing alt prop (174); unused eslint-disable directives for `@next/next/no-img-element` (191, 216 — rule is globally off)
Command: lint

[QUALITY-17] LOW
File: components/content/platform-preview.tsx:58, 72, 88, 97
Issue: Unused eslint-disable directives for `@next/next/no-img-element` (rule globally off)
Command: lint

[QUALITY-18] LOW
File: components/error-states/ErrorStates.tsx:200
Issue: `import/no-anonymous-default-export` — anonymous default export
Command: lint

[QUALITY-19] LOW
File: components/landing/bento-gallery.tsx:51, 94
Issue: `react-hooks/exhaustive-deps` — ref value used in cleanup will have changed by cleanup time (x2)
Command: lint

[QUALITY-20] LOW
File: components/marketing/SocialProof.tsx:352
Issue: `import/no-anonymous-default-export`
Command: lint

[QUALITY-21] LOW
File: components/roi-calculator/index.tsx:60
Issue: `react-hooks/exhaustive-deps` — useCallback has unnecessary dependency 'costPerClick'
Command: lint

[QUALITY-22] LOW
File: components/scheduling/time-slot-picker.tsx:267
Issue: `react-hooks/exhaustive-deps` — 'allPlatforms' logical expression could cause stale useMemo dep
Command: lint

[QUALITY-23] LOW
File: components/settings/ai-credentials-manager.tsx:171
Issue: `react-hooks/exhaustive-deps` — useCallback missing dependency 'selectedModel'
Command: lint

[QUALITY-24] LOW
File: components/settings/brand-profile-tab.tsx:631
Issue: Unused eslint-disable directive for `@next/next/no-img-element`
Command: lint

[QUALITY-25] LOW
File: components/settings/platform-credentials-manager.tsx:272
Issue: `react-hooks/exhaustive-deps` — useCallback missing dependency 'closeForm'
Command: lint

[QUALITY-26] LOW
File: components/ui/file-tree.tsx:118, 308, 312, 316
Issue: `react-hooks/exhaustive-deps` — multiple missing/incorrect hook dependencies (4 instances)
Command: lint

[QUALITY-27] LOW
File: components/ui/nested-dialog.tsx:95
Issue: `react-hooks/exhaustive-deps` — useEffect missing dependency 'context'
Command: lint

[QUALITY-28] LOW
File: components/visuals/VisualGallery.tsx:62, 77
Issue: `jsx-a11y/alt-text` — Image elements missing alt prop (x2)
Command: lint

[QUALITY-29] LOW
File: components/workflows/NewWorkflowDialog.tsx:77
Issue: `react-hooks/exhaustive-deps` — useEffect missing dependency 'title'
Command: lint

[QUALITY-30] LOW
File: lib/auth/monitoring.ts:9
Issue: Unused eslint-disable directive for `@typescript-eslint/no-explicit-any`
Command: lint

[QUALITY-31] LOW
File: lib/authority/claim-extractor.ts:28
Issue: Unused eslint-disable directive for 'no-cond-assign'
Command: lint

[QUALITY-32] LOW
File: lib/data/validators.ts:367
Issue: `import/no-anonymous-default-export`
Command: lint

[QUALITY-33] LOW
File: lib/metrics/business-metrics.ts:926
Issue: `import/no-anonymous-default-export`
Command: lint

[QUALITY-34] LOW
File: lib/oauth/index.ts:191
Issue: `import/no-anonymous-default-export`
Command: lint

[QUALITY-35] LOW
File: lib/observability/error-tracker.ts:403
Issue: `import/no-anonymous-default-export`
Command: lint

[QUALITY-36] LOW
File: lib/observability/health-dashboard.ts:379
Issue: `import/no-anonymous-default-export`
Command: lint

[QUALITY-37] LOW
File: lib/redis-client.ts:558
Issue: `import/no-anonymous-default-export`
Command: lint

[QUALITY-38] LOW
File: lib/testing/api-test-helpers.ts:386
Issue: `import/no-anonymous-default-export`
Command: lint

[QUALITY-39] LOW
File: lib/testing/db-test-helpers.ts:499
Issue: `import/no-anonymous-default-export`
Command: lint

[QUALITY-40] LOW
File: lib/vault/vault-service.ts:40
Issue: Unused eslint-disable directive for `@typescript-eslint/no-explicit-any`
Command: lint

[QUALITY-41] LOW
File: lib/webhooks/index.ts:98
Issue: `import/no-anonymous-default-export`
Command: lint

[QUALITY-42] LOW
File: lib/webhooks/sender.ts:455
Issue: `import/no-anonymous-default-export`
Command: lint

[QUALITY-43] LOW
File: lib/webhooks/verifier.ts:461
Issue: `import/no-anonymous-default-export`
Command: lint

**ESLint side issue — QUALITY-44:**

[QUALITY-44] MEDIUM
File: eslint.config.js
Issue: `.next-turbo/` directory is absent from the `ignores` list. Running `npm run lint` (which runs `eslint .`) lints the turbopack build cache, producing hundreds of false-positive errors and warnings in generated JS. The `ignores` list covers `.next/**` but not `.next-turbo/**`.
Command: lint

---

### 1c — Tests (npm test -- --passWithNoTests)

**Result: FAIL — 4 test suites failed, 25 tests failed out of 1683.**

[QUALITY-45] CRITICAL
File: tests/unit/lib/prisma.test.ts
Issue: 3 test failures in Prisma Client Utilities:

- "should export prisma as null when window is defined (jsdom environment)" — proxy throws instead of returning null
- "should throw when DATABASE_URL is empty string" — proxy throwing unexpected error path
- "should throw when DATABASE_URL is invalid format" — proxy throwing unexpected error path
  Root cause: Test assertions don't match the behaviour of the lazy-proxy guard in lib/prisma.ts (proxy throws on property access when uninitialised, test expects null).
  Command: test

[QUALITY-46] CRITICAL
File: tests/contract/onboarding-referrals.contract.test.ts
Issue: 7 test failures in Onboarding & Referrals API Contract Tests:

- POST /api/onboarding auth enforcement (401 not returned when unauthenticated)
- POST /api/onboarding input validation (400 not returned for missing fields)
- POST /api/onboarding success response shape (prisma.$transaction not triggered)
- GET /api/onboarding auth enforcement (401 not returned)
- GET /api/onboarding response shape (200 not returned with expected shape)
  Root cause: Contract tests appear to be testing a prior version of the onboarding API contract that changed in commit 005c8154 (server-persist pipeline).
  Command: test

[QUALITY-47] CRITICAL
File: tests/unit/api/stripe-routes.test.ts
Issue: 7 test failures in lib/stripe/config Helper Functions:

- "PRODUCTS should have 3 tiers" — PRODUCTS now has 4 keys (starter, pro, growth, scale) but test expects 3
- getProductByPriceId/getProductByName tests expecting 'professional', 'business', 'custom' keys that no longer exist
- Professional/Business/Custom tier feature assertions fail with TypeError (keys absent)
  Root cause: lib/stripe/config.ts was updated to use new tier names (starter/pro/growth/scale) but the test file was not updated to match.
  Command: test

[QUALITY-48] CRITICAL
File: tests/unit/api/campaigns.test.ts
Issue: 8 test failures in Campaigns API:

- GET /api/campaigns returning 500 instead of 200 (mock prisma not wired correctly)
- POST /api/campaigns returning 500 instead of 200
- PUT /api/campaigns returning 500 instead of 200/404
- DELETE /api/campaigns returning 500 instead of 200/404
  Root cause: Prisma mock setup appears to be failing — routes return 500 because `prisma.campaign.findMany` / `create` / `update` / `delete` mocks are not resolving. Likely a mock reset or import order issue in test setup.
  Command: test

**Test summary: 4 FAIL suites, 25 failed tests, 1508 passed, 150 skipped.**

---

## TASK 2 — SECURITY AUDIT

### 2a — npm audit

[SECURITY-01] LOW
Area: npm-audit
Issue: `@tootallnate/once` (<3.0.1) — Incorrect Control Flow Scoping (GHSA-vpq2-c234-7xj6). Dependency chain: `jest-environment-jsdom` → `jsdom` → `http-proxy-agent` → `@tootallnate/once`. devDependency only — no production exposure.
Fix: `npm audit fix --force` (would install jest-environment-jsdom@30 — breaking change, test update required)

[SECURITY-02] LOW
Area: npm-audit
Issue: `elliptic` (all versions) — Cryptographic Primitive with Risky Implementation (GHSA-848j-6mx2-7j84). Dependency chain: `@storybook/nextjs` → `node-polyfill-webpack-plugin` → `crypto-browserify` → `browserify-sign`/`create-ecdh` → `elliptic`. devDependency (Storybook) only — no production exposure.
Fix: `npm audit fix --force` (would install @storybook/nextjs@7.0.14 — breaking change)

**npm audit summary: 10 low severity vulnerabilities, all in devDependencies (jest-environment-jsdom, @storybook/nextjs chains). Zero production/runtime vulnerabilities.**

---

### 2b — Environment Variable Coverage

**Source vars NOT in .env.example:** None found (only `npm_package_version` which is a Node.js built-in, not a secret).

**Dead config in .env.example (vars listed but not used in app/api/ or lib/):**

[SECURITY-03] LOW
Area: env-coverage
Issue: 70 variables in `.env.example` have no `process.env.<VAR>` reference in `app/api/` or `lib/`. Many are feature flags, legacy aliases, and provider stubs. Notable dead config entries:

- `API_KEY_SALT`, `API_URL`, `APP_VERSION` — never referenced in source
- `CACHE_ENABLED`, `CACHE_TTL_SECONDS` — not consumed in lib/
- `CORS_ORIGIN` — not read (CORS_ALLOWED_ORIGINS is used instead but also not found in source scan)
- `DEPLOYMENT_PROTECTION_BYPASS_SECRET` — not consumed in app/api/ or lib/
- `ENABLE_AB_TESTING`, `ENABLE_ADVANCED_ANALYTICS`, `ENABLE_AI_CONTENT`, `ENABLE_COMPETITOR_ANALYSIS`, `ENABLE_CORS`, `ENABLE_ERROR_TRACKING`, `ENABLE_HELMET`, `ENABLE_PERFORMANCE_MONITORING`, `ENABLE_PSYCHOLOGY_ANALYTICS`, `ENABLE_RATE_LIMITING`, `ENABLE_REQUEST_LOGGING`, `ENABLE_REQUEST_SANITIZATION`, `ENABLE_STRATEGIC_MARKETING`, `ENABLE_WHITE_LABEL` — feature flags declared but not read in source
- `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET` — not read (FACEBOOK_APP_ID / FACEBOOK_APP_SECRET are used instead)
- `INSTAGRAM_CLIENT_ID`, `INSTAGRAM_CLIENT_SECRET` — not read in source
- `NEXTAUTH_SECRET`, `NEXTAUTH_URL` — not read (project uses Supabase Auth, not NextAuth)
- `OPENROUTER_BASE_URL`, `OPENROUTER_MODEL` — not consumed in scanned files
- `PINTEREST_CLIENT_ID`, `PINTEREST_CLIENT_SECRET` — not read (PINTEREST_APP_ID/SECRET used instead)
- `RATE_LIMIT_ENABLED`, `RATE_LIMIT_MAX`, `RATE_LIMIT_MAX_REQUESTS`, `RATE_LIMIT_WINDOW_MS` — not read in source
- `REDIS_HOST`, `REDIS_PASSWORD`, `REDIS_PORT`, `REDIS_USERNAME` — individual components, REDIS_URL is used instead
- `SESSION_SECRET`, `STRIPE_API_KEY`, `STRIPE_LIVE_KEY`, `STRIPE_PUBLISHABLE_KEY` — not consumed
- `THREADS_CLIENT_ID`, `THREADS_CLIENT_SECRET` — not read
- `VERCEL_OIDC_TOKEN` — auto-set variable, not consumed in source
  Fix: Audit .env.example and remove or mark as "legacy/unused" entries that have no source references.

[SECURITY-04] HIGH
Area: env-coverage
Issue: `NEXT_PUBLIC_BYPASS_TOKEN` is listed in `.env.example` as "dev-bypass-token-only" with `NEXT_PUBLIC_` prefix, meaning it is exposed in the client-side JavaScript bundle. No source references were found in `app/api/` or `lib/` — however the `NEXT_PUBLIC_` prefix means this token value is embedded in the client bundle if set. If this token is used for any auth bypass in development, exposing it client-side in a deployed staging environment would allow client-side bypass discovery.
Fix: Confirm this variable is never set in any deployed environment (staging/production). Remove from .env.example or document that it is never deployed.

---

### 2c — Auth Middleware Scan

**Middleware.ts review:**

The middleware uses two matcher patterns:

1. `'/((?!_next/static|_next/image|favicon.ico|public/).*)'` — matches ALL paths except static assets. This **includes** `/api/` routes.
2. `'/api/ai/:path*'` — redundant (already covered by pattern 1).

The comment in middleware.ts states "api routes (rate limited per-route via withRateLimit)" but the matcher **does** match API routes. The session check only applies to `protectedPaths = ['/dashboard', '/onboarding', '/api/protected', '/api/user', '/api/integrations']`. All other `/api/` routes bypass the middleware auth guard and rely on in-route checks.

[SECURITY-05] MEDIUM
Area: auth-middleware
Issue: The middleware `protectedPaths` list is narrow — it only covers `/api/protected`, `/api/user`, `/api/integrations`. The vast majority of ~279 POST routes in `app/api/` are not in this list and receive no middleware-level auth enforcement. Each route must implement its own auth guard. This is architecturally intentional (defence-in-depth via `getUserIdFromRequestOrCookies`/`APISecurityChecker`), but means a missing in-route guard has no fallback.
Fix: Document the design decision clearly. Consider adding a default-deny stance for all `/api/` routes at the middleware level, whitelisting public routes explicitly.

[SECURITY-06] LOW
Area: auth-middleware
Issue: The `auth-token` cookie (custom JWT for demo/fallback auth) is trusted immediately with `hasCustomAuth = !!authToken`. The onboarding check parses the JWT payload without signature verification in Edge Runtime (comment: "no DB query needed in Edge Runtime"). If the JWT payload is tampered the `onboardingComplete === false` check could be bypassed to skip the onboarding redirect — though the route handlers still perform full DB-backed checks.
Fix: Consider verifying the JWT signature in middleware even in Edge Runtime using the Web Crypto API with the HS256 algorithm, rather than parsing without verification.

**10 sampled POST routes — auth guard check:**

All 10 sampled routes have auth guards before DB queries:

| Route                                       | Auth mechanism                                  | Result |
| ------------------------------------------- | ----------------------------------------------- | ------ |
| app/api/ab-testing/tests/route.ts           | `getUserIdFromCookies()`                        | PASS   |
| app/api/activity/route.ts                   | `APISecurityChecker.check(AUTHENTICATED_WRITE)` | PASS   |
| app/api/admin/invites/route.ts              | `verifyAdmin(request)`                          | PASS   |
| app/api/admin/jobs/route.ts                 | `verifyAdmin(request)`                          | PASS   |
| app/api/admin/platform-credentials/route.ts | `APISecurityChecker.check` + `requireOwner`     | PASS   |
| app/api/admin/remotion/route.ts             | `verifyAdmin(request)`                          | PASS   |
| app/api/admin/upgrade-subscription/route.ts | `ADMIN_API_KEY` header check                    | PASS   |
| app/api/admin/users/route.ts                | `verifyAdmin(request)`                          | PASS   |
| app/api/admin/vault/decrypt/route.ts        | `APISecurityChecker.check` + `requireOwner`     | PASS   |
| app/api/campaigns/route.ts                  | `getUserIdFromRequestOrCookies(request)`        | PASS   |

Bonus check: Webhook routes (stripe, social, internal) all use signature verification, not session auth — appropriate for webhook endpoints.

No missing auth guards found in sampled routes.

---

### 2d — Supabase RLS Surface

[SECURITY-07] MEDIUM
Area: rls
Issue: RLS SQL files exist under `supabase/` (`schema-step2-rls.sql`, `complete-schema.sql`, etc.) but they cover only **10 tables** with `ENABLE ROW LEVEL SECURITY`:

- profiles, personas, content, campaigns, scheduled_posts, analytics, platform_connections, api_usage, notifications, team_members

The Prisma schema has **131 models**. The RLS policies in version-controlled SQL files cover ~7.6% of all models. The remaining ~121 models either:

1. Use Prisma-only access (no direct Supabase client access from client) — which is safe if all access goes through the Next.js API layer
2. Have RLS enabled but configured directly in the Supabase dashboard (not version-controlled)
3. Have no RLS at all (high risk if any client-side Supabase queries exist)
   Fix: Audit which tables are accessed via `supabase.from(...)` client-side. For all such tables, verify RLS policies exist in the dashboard and add them to version-controlled SQL files. For Prisma-only tables, document that RLS is intentionally not required.

[SECURITY-08] LOW
Area: rls
Issue: `supabase/schema-step2-rls.sql` is a step-2 setup script, not a migrations directory. There is no `supabase/migrations/` directory with timestamped migration files tracking schema evolution over time. Changes to RLS policies are not tracked incrementally.
Fix: Adopt Supabase CLI migration workflow (`supabase migration new`) to version RLS policy changes incrementally alongside Prisma migrations.

---

## TASK 3 — PACKAGE HYGIENE

### 3a — Outdated Packages

[PACKAGES-01] HIGH
Package: openai
Issue: outdated — installed 4.104.0, latest 6.31.0 (2 major versions behind)
Detail: Used in lib/ for direct OpenAI API calls. v5 and v6 have breaking API surface changes.

[PACKAGES-02] LOW
Package: @anthropic-ai/sdk
Issue: outdated — installed 0.20.9, latest 0.79.0 (same major 0.x, but 59 minor versions behind — significant API drift)
Detail: Used in autonomous task worker. Large gap in a 0.x package where breaking changes are common.

[PACKAGES-03] LOW
Package: tailwindcss
Issue: outdated — installed 3.4.19, latest 4.2.1 (1 major version behind)
Detail: Tailwind v4 is a significant rewrite with different config format. Not urgent but requires a dedicated migration.

[PACKAGES-04] LOW
Package: zod
Issue: outdated — installed 3.25.76, latest 4.3.6 (1 major version behind)
Detail: Zod v4 has breaking changes. Used pervasively across the codebase for validation.

[PACKAGES-05] LOW
Package: @tiptap/react, @tiptap/starter-kit
Issue: outdated — installed 2.27.2, latest 3.20.3 (1 major version behind)
Detail: TipTap v3 has breaking API changes. Used in editor components.

[PACKAGES-06] LOW
Package: @stripe/stripe-js
Issue: outdated — installed 7.9.0, latest 8.10.0 (1 major version behind)
Detail: Client-side Stripe.js. v8 has minor breaking changes in type signatures.

[PACKAGES-07] LOW
Package: stripe (server)
Issue: outdated — installed 18.5.0, latest 20.4.1 (2 minor versions behind, not major)
Detail: 2 minor versions, monitor for deprecations.

[PACKAGES-08] LOW
Package: react / react-dom
Issue: outdated — installed 18.3.1, latest 19.2.4 (1 major version behind)
Detail: React 19 introduces breaking changes with the new compiler, concurrent features, and hooks. Major migration effort.

[PACKAGES-09] LOW
Package: next
Issue: outdated — installed 15.5.12, latest 16.1.7 (1 major version behind)
Detail: Next.js 16 — requires coordinated upgrade with React 19.

[PACKAGES-10] LOW
Package: @prisma/client / prisma
Issue: outdated — installed 6.14.0, latest 7.5.0 (1 major version behind)
Detail: Prisma 7 has breaking changes in API. Requires schema/query review.

[PACKAGES-11] LOW
Package: @supabase/ssr
Issue: outdated — installed 0.6.1, latest 0.9.0 (minor, 0.x)
Detail: Auth-critical package — monitor for security patches.

[PACKAGES-12] LOW
Package: cmdk
Issue: outdated — installed 0.2.1, latest 1.1.1 (0.x → 1.x is effectively a major bump)
Detail: Command menu component used in UI.

---

### 3b — Unused Production Dependencies

Scan methodology: grep for `from '<package>'` in app/, components/, lib/. Dynamic imports (`import('<package>')`) counted separately.

[PACKAGES-13] MEDIUM
Package: get-video-duration
Issue: unused — zero static or dynamic import references found in app/, components/, lib/
Detail: Listed in `dependencies`. May be used in scripts/ or legacy code outside the scanned directories. Investigate before removal.

[PACKAGES-14] MEDIUM
Package: chalk
Issue: unused — zero static import references found in app/, components/, lib/
Detail: Likely used only in scripts/ (CLI tooling). If true, should move to devDependencies.

[PACKAGES-15] MEDIUM
Package: posthog-js
Issue: unused — zero static import references found in app/, components/, lib/
Detail: Listed in devDependencies (already noted) but also shows zero usage in source. Confirm whether analytics is handled differently.

[PACKAGES-16] MEDIUM
Package: @anthropic-ai/claude-agent-sdk
Issue: unused (static imports) — used only via lazy/dynamic import in lib/queue/workers/autonomous-task-worker.ts comment, but no `from '@anthropic-ai/claude-agent-sdk'` import found
Detail: The worker comments reference it but the actual import line was not found in the grep scan. Verify the dynamic import path is correct.

[PACKAGES-17] MEDIUM
Package: es-abstract
Issue: unused — zero import references found in app/, components/, lib/
Detail: es-abstract is a polyfill library typically used as a peer dependency by other packages (e.g., array methods polyfills). Should not be in direct dependencies unless explicitly used.

[PACKAGES-18] MEDIUM
Package: dompurify (standalone)
Issue: unused — zero direct `dompurify` imports found; the codebase uses `isomorphic-dompurify` instead (found in lib/sanitize.ts)
Detail: Both `dompurify` and `isomorphic-dompurify` are in dependencies. The direct `dompurify` package appears redundant — `isomorphic-dompurify` wraps it for Node/browser compatibility.

[PACKAGES-19] MEDIUM
Package: @auth/prisma-adapter
Issue: unused — zero import references found in app/, components/, lib/
Detail: This is the NextAuth Prisma adapter. The project uses Supabase Auth (not NextAuth) per CLAUDE.md. This package should be removed.

[PACKAGES-20] MEDIUM
Package: redis (standalone)
Issue: unused — zero import references found in app/, components/, lib/
Detail: The codebase uses `ioredis` and `@upstash/redis` instead. The standalone `redis` npm package (redis@5) appears unused. Verify no dynamic requires before removal.

[PACKAGES-21] MEDIUM
Package: number-flow (vs @number-flow/react)
Issue: Both `number-flow` and `@number-flow/react` are in dependencies. components/landing/pricing-section.tsx imports from `@number-flow/react`. The `number-flow` standalone package (without `@` scope) shows zero source imports.
Detail: Likely `number-flow` is a redundant duplicate of `@number-flow/react`.

---

### 3c — Bundle Size Estimate (Large Client-Facing Packages)

Key sizes measured:

- `@prisma` (all): 174MB — server only, not bundled
- `googleapis`: 164MB — server only, not bundled
- `next`: 148MB — framework, handled by Next.js bundler
- `@remotion` (all): 93MB — see below
- `prisma`: 50MB — server only (CLI)
- `framer-motion`: 5.1MB — see below
- `gsap`: 6.4MB — see below
- `recharts`: 5.0MB — see below
- `bullmq`: 5.0MB — server queue, not bundled

[PACKAGES-22] HIGH
Package: @remotion/player (94MB total for @remotion/\* + remotion)
Issue: large-client-bundle — `@remotion/player` is in production `dependencies` and imported in client components (uses `'use client'`-capable components). Remotion player bundles video rendering logic. This is a significant bundle weight for any page that imports the player.
Detail: lib/video/ and app/dashboard/ may import this. The `remotion` runtime itself is 1.4MB standalone; `@remotion/player` adds ~92MB total for the package tree (including `@remotion/core`, `@remotion/media-utils`, etc.). Actual client bundle impact depends on tree-shaking, but Remotion is notoriously hard to tree-shake.
Fix: Ensure Remotion player is loaded only via dynamic import with `next/dynamic` and `ssr: false`. Verify no static import on any page-level or layout component.

[PACKAGES-23] HIGH
Package: gsap (6.4MB)
Issue: large-client-bundle — gsap is used in `app/dashboard/web-projects/[id]/page.tsx` which is a `'use client'` component. gsap (GreenSock Animation Platform) is 6.4MB in node_modules. It registers `SplitText` and `ScrollTrigger` plugins directly on the gsap instance.
Detail: The web-projects page uses `gsap.registerPlugin(SplitText)` and `gsap.registerPlugin(ScrollTrigger)` — both are GSAP Club plugins (pro features). Club plugins may not be properly licensed for this install and could cause issues in production. The plugins themselves add significant weight.
Fix: Verify GSAP Club license. Use dynamic import for the GSAP animation code to prevent it loading on every route.

[PACKAGES-24] MEDIUM
Package: framer-motion (5.1MB)
Issue: large-client-bundle — imported in multiple `'use client'` components (AIABTesting, AIHashtagGenerator, AIWritingAssistant, AnimatedCard, etc.). framer-motion at 5.1MB is a meaningful client bundle addition.
Detail: Used across many components. Acceptable if used consistently, but verify no layout-level imports that would force it onto every page.
Fix: Ensure framer-motion is not imported in app/layout.tsx or other root layouts. Consider using CSS animations for simple transitions.

[PACKAGES-25] MEDIUM
Package: recharts (5.0MB)
Issue: large-client-bundle — imported in multiple `'use client'` chart components (engagement-chart, EngagementTrendsChart, growth-chart, performance-chart, PlatformDistributionChart, etc.).
Detail: recharts depends on D3 sub-modules. Used across analytics dashboard components. Acceptable for analytics pages but ensure chart components are not imported in shared layouts.
Fix: Verify chart components are only rendered within dashboard routes, not in root layout.

---

## SUMMARY TABLE

| ID                              | Severity | Area            | Short description                                                             |
| ------------------------------- | -------- | --------------- | ----------------------------------------------------------------------------- |
| QUALITY-01                      | PASS     | type-check      | Zero TypeScript errors                                                        |
| QUALITY-02–07                   | LOW      | lint            | Stale eslint-disable directives in app/api/ files                             |
| QUALITY-08,10,11,14,15,16,28    | LOW      | lint            | Missing alt props on img elements (accessibility)                             |
| QUALITY-09,21,22,23,25,26,27,29 | LOW      | lint            | react-hooks/exhaustive-deps warnings (8 locations)                            |
| QUALITY-12,13                   | LOW      | lint            | no-unused-expressions in components                                           |
| QUALITY-18,20,32–43             | LOW      | lint            | anonymous default exports (11 locations)                                      |
| QUALITY-19                      | LOW      | lint            | ref cleanup timing warnings (bento-gallery)                                   |
| QUALITY-24,17                   | LOW      | lint            | stale eslint-disable directives in components                                 |
| QUALITY-44                      | MEDIUM   | lint config     | .next-turbo/ not in ESLint ignores list                                       |
| QUALITY-45                      | CRITICAL | test            | 3 prisma.test.ts failures (proxy/null assertion mismatch)                     |
| QUALITY-46                      | CRITICAL | test            | 7 onboarding-referrals contract test failures (stale contract)                |
| QUALITY-47                      | CRITICAL | test            | 7 stripe-routes test failures (tier names changed, tests not updated)         |
| QUALITY-48                      | CRITICAL | test            | 8 campaigns test failures (prisma mock setup failing)                         |
| SECURITY-01,02                  | LOW      | npm-audit       | 10 low vulns in devDep chains (jest-environment-jsdom, storybook)             |
| SECURITY-03                     | LOW      | env-coverage    | ~70 dead config vars in .env.example with no source usage                     |
| SECURITY-04                     | HIGH     | env-coverage    | NEXT_PUBLIC_BYPASS_TOKEN — client-exposed bypass token                        |
| SECURITY-05                     | MEDIUM   | auth-middleware | Narrow protectedPaths list — most /api/ routes rely solely on in-route guards |
| SECURITY-06                     | LOW      | auth-middleware | auth-token JWT parsed without signature verify in Edge Runtime                |
| SECURITY-07                     | MEDIUM   | rls             | Only 10 of 131 Prisma models have RLS policies in version-controlled SQL      |
| SECURITY-08                     | LOW      | rls             | No incremental Supabase migration files — RLS changes not tracked             |
| PACKAGES-01                     | HIGH     | outdated        | openai 4.x → 6.x (2 major versions behind)                                    |
| PACKAGES-02                     | LOW      | outdated        | @anthropic-ai/sdk 0.20.9 → 0.79.0 (59 minor versions)                         |
| PACKAGES-03–12                  | LOW      | outdated        | tailwindcss, zod, tiptap, stripe-js, react, next, prisma, supabase, cmdk      |
| PACKAGES-13–21                  | MEDIUM   | unused          | 9 production deps with zero source imports                                    |
| PACKAGES-22                     | HIGH     | bundle          | @remotion/player in prod deps — 94MB tree, must use dynamic import            |
| PACKAGES-23                     | HIGH     | bundle          | gsap (6.4MB) in 'use client' page; GSAP Club plugins need license check       |
| PACKAGES-24                     | MEDIUM   | bundle          | framer-motion (5.1MB) in multiple client components                           |
| PACKAGES-25                     | MEDIUM   | bundle          | recharts (5.0MB) in multiple client chart components                          |

**Total findings: 48**

| Severity | Count |
| -------- | ----- |
| CRITICAL | 4     |
| HIGH     | 5     |
| MEDIUM   | 7     |
| LOW      | 32    |
| PASS     | 1     |
