# 121-AUDIT-MASTER.md — All Open Findings

Generated: 2026-03-18
Source: Phase 119 (107 findings) + Phase 121 swarm audit
Status: CONFIRMED-OPEN + NEW + REGRESSION (excludes CONFIRMED-RESOLVED)

---

## Counts

| Severity  | Phase-119 Open | Phase-121 New/Regression | Total   |
| --------- | -------------- | ------------------------ | ------- |
| CRITICAL  | 8              | 1                        | 9       |
| HIGH      | 17             | 14                       | 31      |
| MEDIUM    | 24             | 12                       | 36      |
| LOW       | 30             | 14                       | 44      |
| **TOTAL** | **79**         | **41**                   | **120** |

Notes on Phase-119 open counts:

- Phase 119 had 107 findings total. Phase 120 resolved approximately 28 (see 121-EFFECTIVENESS.md for full breakdown).
- Phase-119 CRITICAL open: FINDING-001 through FINDING-012 = 12 original critical; 4 test findings (001-004) claimed resolved in Phase 120; FINDING-007 (auth migration) fully resolved; FINDING-005 (admin role) resolved. Remaining open CRITICAL from Phase 119: FINDING-008 (partially resolved/still failing), FINDING-009, FINDING-010, FINDING-011, FINDING-012, FINDING-006 (generate route validation). Count = 8 open CRITICAL.
- Detailed breakdown per severity section below.

---

## CRITICAL

### Phase 119 — CONFIRMED-OPEN

| ID          | Title                                                                                                | File                                           | Status                           |
| ----------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------- | -------------------------------- |
| FINDING-006 | /api/generate route uses manual if-checks instead of Zod, non-standard auth                          | app/api/generate/route.ts:70-85                | CONFIRMED-OPEN                   |
| FINDING-008 | prompt-input.tsx placeholder contrast text-white/30 → improved to /50 but still fails AA for text-sm | components/ui/prompt-input.tsx:132             | PARTIALLY-RESOLVED (still fails) |
| FINDING-009 | analytics-tab.tsx helper text text-white/15 (~1.2:1)                                                 | components/dashboard/tabs/analytics-tab.tsx:37 | CONFIRMED-OPEN                   |
| FINDING-010 | SystemPulsePanel.tsx "auto-refreshes" label text-white/15 at 9px                                     | components/dashboard/SystemPulsePanel.tsx:279  | CONFIRMED-OPEN                   |
| FINDING-011 | UniteHubWidget.tsx hint text text-white/15 (~1.2:1)                                                  | components/dashboard/UniteHubWidget.tsx:136    | CONFIRMED-OPEN                   |
| FINDING-012 | SASScore.tsx SVG track ring text-white/10 (~1.1:1)                                                   | components/research/SASScore.tsx:110           | CONFIRMED-OPEN                   |

Note: FINDING-001 through FINDING-004 (test failures) claimed resolved in Phase 120. FINDING-005 (admin role check) confirmed resolved. FINDING-007 (auth migration) confirmed resolved. FINDING-008 reclassified from CRITICAL to ongoing partial — still listed here because it continues to fail WCAG AA for normal-size text.

### Phase 121 — NEW

| ID             | Title                                                                    | File                                           | Status |
| -------------- | ------------------------------------------------------------------------ | ---------------------------------------------- | ------ |
| A4-FINDING-011 | analytics-tab.tsx BarChart3 icon text-white/10 (~1.1:1), fails SC 1.4.11 | components/dashboard/tabs/analytics-tab.tsx:35 | NEW    |

---

## HIGH

### Phase 119 — CONFIRMED-OPEN

| ID          | Title                                                                                                                      | File                                                                     | Status                                        |
| ----------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------- |
| FINDING-013 | NEXT_PUBLIC_BYPASS_TOKEN in .env.example with non-empty placeholder                                                        | .env.example:416                                                         | CONFIRMED-OPEN                                |
| FINDING-014 | openai pinned to ^4.104.0 — two major versions behind v6.x                                                                 | package.json                                                             | CONFIRMED-OPEN                                |
| FINDING-015 | @remotion/player (94MB) — verify no static import (partially verified)                                                     | app/dashboard/admin/remotion-studio/page.tsx:40                          | CONFIRMED-RESOLVED (dynamic import confirmed) |
| FINDING-016 | gsap Club plugins (SplitText) licence ambiguity                                                                            | app/dashboard/web-projects/[id]/page.tsx:45                              | CONFIRMED-OPEN                                |
| FINDING-017 | /api/generate/diagram returns 501 when PAPER_BANANA_SERVICE_URL not set                                                    | app/api/generate/diagram/route.ts:46-53                                  | CONFIRMED-OPEN                                |
| FINDING-018 | /api/generate/plot returns 501 when PAPER_BANANA_SERVICE_URL not set                                                       | app/api/generate/plot/route.ts:46-53                                     | CONFIRMED-OPEN                                |
| FINDING-019 | /api/generate returns 501 when OPENROUTER_API_KEY not set                                                                  | app/api/generate/route.ts:88-96                                          | CONFIRMED-OPEN                                |
| FINDING-020 | YouTube community posts returns 501 — genuine API limitation                                                               | app/api/social/youtube/post/route.ts:113-116                             | CONFIRMED-OPEN                                |
| FINDING-021 | social/post and roles routes use getUserIdFromCookies (cookie-only)                                                        | app/api/social/post/route.ts:15,35,245; app/api/roles/route.ts:16,73,137 | CONFIRMED-OPEN                                |
| FINDING-022 | Tasks route queries userId only — no organizationId scoping                                                                | app/api/tasks/route.ts                                                   | CONFIRMED-OPEN                                |
| FINDING-023 | Research route queries userId only — no organizationId scoping                                                             | app/api/research/route.ts                                                | CONFIRMED-OPEN                                |
| FINDING-024 | Analytics route campaign lookup userId only — no org scoping                                                               | app/api/analytics/route.ts                                               | CONFIRMED-OPEN                                |
| FINDING-025 | /api/billing/subscription route missing — authority page 404                                                               | app/dashboard/authority/page.tsx:57                                      | CONFIRMED-OPEN                                |
| FINDING-026 | NotificationBell sends ?unread=true; route reads unreadOnly — filter silently ignored; data.hasNew vs unreadCount mismatch | components/NotificationBell.tsx:53                                       | CONFIRMED-OPEN                                |
| FINDING-027 | competitor-analysis fetch without credentials: include                                                                     | components/competitor-analysis/index.tsx:45                              | CONFIRMED-OPEN                                |
| FINDING-028 | /api/auth/connections GET+POST handler verification needed                                                                 | app/api/auth/connections/route.ts                                        | CONFIRMED-OPEN                                |
| FINDING-034 | Toggle button inactive state text-white/40 (~2.5:1), fails SC 1.4.11                                                       | components/ui/toggle.tsx:17                                              | CONFIRMED-OPEN                                |

Note: FINDING-015 (@remotion/player) confirmed resolved by A5 — excluded from open count. Adjusted Phase-119 HIGH open = 17.

### Phase 121 — NEW / REGRESSION

| ID             | Title                                                                                  | File                                               | Status         |
| -------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------- | -------------- |
| A5-FINDING-001 | capture-service.ts still imports removed puppeteer-screen-recorder — runtime crash     | lib/video/capture-service.ts:28                    | REGRESSION     |
| A2-FINDING-002 | /api/auth/login never sets httpOnly cookie — JWT returned in body only                 | app/api/auth/login/route.ts:148-158                | NEW            |
| A1-FINDING-005 | Analytics route campaign lookup userId only (confirm FINDING-024 unresolved; see note) | app/api/analytics/route.ts:89-92                   | CONFIRMED-OPEN |
| A3-FINDING-016 | admin layout imports Prisma directly, bypasses lib/auth/ service layer                 | app/dashboard/admin/layout.tsx:18                  | NEW            |
| A4-FINDING-012 | analytics-tab.tsx "Engagement Over Time" label text-white/30 (~2.1:1)                  | components/dashboard/tabs/analytics-tab.tsx:36     | NEW            |
| A4-FINDING-013 | prompt-input.tsx keyboard hint text-white/20 at 10px (~1.5:1)                          | components/ui/prompt-input.tsx:168                 | NEW            |
| A4-FINDING-014 | prompt-input.tsx attach-file icon button text-white/40 (~2.5:1), SC 1.4.11             | components/ui/prompt-input.tsx:158                 | NEW            |
| A4-FINDING-015 | QuickPostModal.tsx placeholder:text-white/30 (~2.1:1)                                  | components/dashboard/QuickPostModal.tsx:203        | NEW            |
| A4-FINDING-016 | QuickPostModal.tsx character counter text-white/20 (~1.5:1)                            | components/dashboard/QuickPostModal.tsx:206        | NEW            |
| A4-FINDING-017 | SystemPulsePanel.tsx service URL text-white/20 at 10px (~1.5:1)                        | components/dashboard/SystemPulsePanel.tsx:178      | NEW            |
| A4-FINDING-019 | UniteHubWidget.tsx empty-state text-white/20 (~1.5:1)                                  | components/dashboard/UniteHubWidget.tsx:199        | NEW            |
| A4-FINDING-020 | WelcomeCard.tsx interactive links text-white/30 (~2.1:1)                               | components/dashboard/WelcomeCard.tsx:337           | NEW            |
| A4-FINDING-021 | WelcomeCard.tsx footer span text-white/20 (~1.5:1)                                     | components/dashboard/WelcomeCard.tsx:337           | NEW            |
| A4-FINDING-022 | get-started-checklist.tsx Dismiss action text-white/20 (~1.5:1)                        | components/dashboard/get-started-checklist.tsx:303 | NEW            |
| A4-FINDING-023 | layout.tsx sidebar nav links text-white/30 as default (~2.1:1)                         | app/dashboard/layout.tsx:537                       | NEW            |
| A4-FINDING-024 | layout.tsx sidebar icon buttons text-white/30 (~2.1:1), SC 1.4.11                      | app/dashboard/layout.tsx:490                       | NEW            |

Note: A1-FINDING-005 duplicates the Phase-119 FINDING-024 assertion and is merged with that CONFIRMED-OPEN finding rather than double-counted.

---

## MEDIUM

### Phase 119 — CONFIRMED-OPEN

| ID          | Title                                                                           | File                                                                 | Status                    |
| ----------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------- |
| FINDING-029 | Dashboard layout search bar placeholder:text-white/20 (~1.5:1)                  | app/dashboard/layout.tsx:577                                         | CONFIRMED-OPEN            |
| FINDING-030 | 5 competitor inputs + SEO audit input placeholder:text-white/25 (~1.8:1)        | app/dashboard/competitors/page.tsx; app/dashboard/seo/audit/page.tsx | CONFIRMED-OPEN            |
| FINDING-031 | Ghost button text-white/40 (~2.5:1) — all ghost buttons codebase-wide           | components/ui/button.tsx:20                                          | CONFIRMED-OPEN            |
| FINDING-032 | Outline and secondary button variants text-white/50 (~3.0:1), fails for text-xs | components/ui/button.tsx:16,18                                       | CONFIRMED-OPEN            |
| FINDING-033 | Inactive sidebar nav icons/labels text-white/20 (~1.5:1)                        | components/dashboard/SidebarGroup.tsx:61,68,73,102                   | CONFIRMED-OPEN            |
| FINDING-035 | .next-turbo/ absent from ESLint ignores array                                   | eslint.config.js                                                     | CONFIRMED-OPEN            |
| FINDING-036 | Middleware protectedPaths list is narrow — no default-deny for /api/            | middleware.ts                                                        | CONFIRMED-OPEN            |
| FINDING-037 | RLS policy coverage ~12% (16/131 models) — improved from 7.6% but very low      | supabase/migrations/                                                 | CONFIRMED-OPEN (improved) |
| FINDING-038 | get-video-duration package — zero imports in app/components/lib                 | package.json                                                         | CONFIRMED-OPEN            |
| FINDING-039 | chalk — in production dependencies, should be devDependencies                   | package.json                                                         | CONFIRMED-OPEN            |
| FINDING-040 | posthog-js — zero import references in source                                   | package.json                                                         | CONFIRMED-OPEN            |
| FINDING-041 | @anthropic-ai/claude-agent-sdk — no static import found, verify dynamic import  | package.json                                                         | CONFIRMED-OPEN            |
| FINDING-042 | es-abstract — zero imports, should be peer dep not direct dep                   | package.json                                                         | CONFIRMED-OPEN            |
| FINDING-043 | dompurify standalone — redundant alongside isomorphic-dompurify                 | package.json                                                         | CONFIRMED-OPEN            |
| FINDING-044 | @auth/prisma-adapter — zero imports, incompatible with Supabase auth stack      | package.json                                                         | CONFIRMED-OPEN            |
| FINDING-045 | redis standalone — zero imports (app uses ioredis/@upstash/redis)               | package.json                                                         | CONFIRMED-OPEN            |
| FINDING-046 | number-flow unscoped — duplicate of @number-flow/react                          | package.json                                                         | CONFIRMED-OPEN            |
| FINDING-047 | framer-motion (5.1MB) — verify not imported in root layouts                     | package.json                                                         | CONFIRMED-OPEN            |
| FINDING-048 | recharts (5.0MB) — verify chart components only in dashboard routes             | package.json                                                         | CONFIRMED-OPEN            |
| FINDING-049 | 30 routes use getUserIdFromCookies (cookie-only) instead of bearer+cookie       | app/api/ (30 files)                                                  | CONFIRMED-OPEN            |
| FINDING-050 | scheduler/posts PATCH extracts id before Zod validation                         | app/api/scheduler/posts/route.ts:316-318                             | CONFIRMED-OPEN            |
| FINDING-051 | Notifications route reads unreadOnly but frontend sends unread                  | app/api/notifications/route.ts:57                                    | CONFIRMED-OPEN            |
| FINDING-058 | Auth page field prefix icons text-gray-500 (~2.8:1), fails SC 1.4.11            | app/(auth)/login/page.tsx; app/(auth)/signup/page.tsx                | CONFIRMED-OPEN            |
| FINDING-066 | Billing section labels text-white/25 (~1.8:1)                                   | components/settings/billing-tab.tsx:81,114                           | CONFIRMED-OPEN            |

### Phase 121 — NEW

| ID             | Title                                                                       | File                                                             | Status |
| -------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------ |
| A1-FINDING-009 | redis-demo route: live unauthenticated Redis write endpoint, zero callers   | app/api/example/redis-demo/route.ts                              | NEW    |
| A1-FINDING-011 | Social listening routes (TrackedKeyword, SocialMention) userId-only scoping | app/api/listening/route.ts; keywords/route.ts; mentions/route.ts | NEW    |
| A2-FINDING-003 | unsafe-inline in script-src CSP in middleware.ts and vercel.json            | middleware.ts:11-13; vercel.json:74                              | NEW    |
| A2-FINDING-004 | CORS applied globally to all routes, no dynamic origin allowlist            | middleware.ts:37                                                 | NEW    |
| A2-FINDING-010 | Owner emails hardcoded in lib/auth/jwt-utils.ts                             | lib/auth/jwt-utils.ts:46-49                                      | NEW    |
| A3-FINDING-017 | integrations page imports integrationsAPI from lib directly, bypasses hooks | app/dashboard/integrations/page.tsx:11                           | NEW    |
| A4-FINDING-018 | SystemPulsePanel.tsx timestamp text-white/20 at 9px (~1.5:1)                | components/dashboard/SystemPulsePanel.tsx:214                    | NEW    |
| A4-FINDING-025 | analytics-tab.tsx section label + empty-state text-white/25 (~1.8:1)        | components/dashboard/tabs/analytics-tab.tsx:44,46                | NEW    |
| A4-FINDING-026 | InsightsWidget.tsx helper text text-white/30 (~2.1:1)                       | components/insights/InsightsWidget.tsx:137                       | NEW    |
| A4-FINDING-027 | ContentSuggestionsWidget.tsx edit action text-white/30 (~2.1:1)             | components/dashboard/ContentSuggestionsWidget.tsx:110            | NEW    |
| A4-FINDING-028 | platforms page description + status text text-white/25 (~1.8:1)             | app/dashboard/platforms/page.tsx:167,188                         | NEW    |
| A4-FINDING-029 | button.tsx focus ring ring-white/30 (~2.1:1), fails SC 1.4.11 / 2.4.11      | components/ui/button.tsx:7                                       | NEW    |
| A5-FINDING-013 | typescript.ignoreBuildErrors: true and eslint.ignoreDuringBuilds: true      | next.config.mjs                                                  | NEW    |

---

## LOW

### Phase 119 — CONFIRMED-OPEN

| ID          | Title                                                                         | File                                                                                 | Status                    |
| ----------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------- |
| FINDING-052 | /api/example/redis-demo orphaned route                                        | app/api/example/redis-demo/route.ts                                                  | CONFIRMED-OPEN            |
| FINDING-053 | /api/sentry-test orphaned route                                               | app/api/sentry-test/route.ts                                                         | CONFIRMED-OPEN            |
| FINDING-054 | /api/cache orphaned route — auth guard status unknown                         | app/api/cache/route.ts                                                               | CONFIRMED-OPEN            |
| FINDING-055 | /api/eeat/audit and /api/eeat/score orphaned routes                           | app/api/eeat/audit/route.ts; app/api/eeat/score/route.ts                             | CONFIRMED-OPEN            |
| FINDING-056 | /api/indexing, /api/mobile/config, /api/mobile/sync orphaned routes           | app/api/indexing/route.ts; mobile/\*                                                 | CONFIRMED-OPEN            |
| FINDING-057 | /api/moderation/check and /api/quality/gate orphaned routes                   | app/api/moderation/check/route.ts; quality/gate/route.ts                             | CONFIRMED-OPEN            |
| FINDING-059 | Auth form placeholders placeholder:text-gray-500 (~2.8:1)                     | app/(auth)/login/page.tsx; app/(auth)/signup/page.tsx                                | CONFIRMED-OPEN            |
| FINDING-060 | Onboarding form placeholders placeholder:text-gray-500                        | app/(onboarding)/onboarding/page.tsx                                                 | CONFIRMED-OPEN            |
| FINDING-061 | FormField helper text text-gray-500 — global via FormField component          | components/ui/form-field.tsx:136                                                     | CONFIRMED-OPEN            |
| FINDING-062 | Red status badges text-red-400 on bg-red-500/20 (~2.9:1), widespread          | 10+ components                                                                       | CONFIRMED-OPEN            |
| FINDING-063 | Onboarding review badge bg-cyan-500/5 nearly invisible                        | app/(onboarding)/onboarding/review/page.tsx:740                                      | CONFIRMED-OPEN            |
| FINDING-064 | subtle input variant border-transparent — invisible until focus               | components/ui/input.tsx:23                                                           | CONFIRMED-OPEN            |
| FINDING-065 | get-started-checklist text link text-white/20 (~1.5:1)                        | components/dashboard/get-started-checklist.tsx:271                                   | CONFIRMED-OPEN            |
| FINDING-067 | @tootallnate/once <3.0.1 CVE (devDependency chain only)                       | package.json (transitive)                                                            | CONFIRMED-OPEN            |
| FINDING-068 | elliptic CVE — devDependency chain only (Storybook)                           | package.json (transitive)                                                            | CONFIRMED-OPEN            |
| FINDING-069 | ~70 dead env vars in .env.example (NEXTAUTH_SECRET, FACEBOOK_CLIENT_ID, etc.) | .env.example                                                                         | CONFIRMED-OPEN            |
| FINDING-070 | Middleware parses JWT without signature verification in Edge Runtime          | middleware.ts                                                                        | CONFIRMED-OPEN            |
| FINDING-072 | @anthropic-ai/sdk 0.20.9 vs 0.79.0 — 59 minor versions behind                 | package.json                                                                         | CONFIRMED-OPEN            |
| FINDING-073 | tailwindcss 3.4.x vs v4.x                                                     | package.json                                                                         | CONFIRMED-OPEN            |
| FINDING-074 | zod 3.25.76 vs v4 RC — approaching major version                              | package.json                                                                         | CONFIRMED-OPEN            |
| FINDING-075 | @tiptap/react 2.27.2 vs v3.20.3 — breaking API changes                        | package.json                                                                         | CONFIRMED-OPEN            |
| FINDING-076 | @stripe/stripe-js 7.9.0 vs 8.10.0                                             | package.json                                                                         | CONFIRMED-OPEN            |
| FINDING-077 | stripe (server) 18.5.0 vs 20.4.1                                              | package.json                                                                         | CONFIRMED-OPEN            |
| FINDING-078 | react 18.3.1 vs 19.2.4 — major migration effort                               | package.json                                                                         | CONFIRMED-OPEN            |
| FINDING-079 | next 15.5.12 vs 16.1.7                                                        | package.json                                                                         | CONFIRMED-OPEN            |
| FINDING-080 | @prisma/client 6.14.0 vs 7.5.0 — breaking changes                             | package.json                                                                         | CONFIRMED-OPEN            |
| FINDING-081 | @supabase/ssr 0.6.1 vs 0.9.0 — auth-critical                                  | package.json                                                                         | CONFIRMED-OPEN            |
| FINDING-082 | cmdk 0.2.1 vs 1.1.1 — effectively a major bump                                | package.json                                                                         | CONFIRMED-OPEN            |
| FINDING-083 | /api/health routes intentionally no auth — exempt, documented                 | app/api/health/                                                                      | CONFIRMED-OPEN (exempt)   |
| FINDING-086 | Dual login entry points (/api/auth/login vs unified-login)                    | app/api/auth/login/route.ts                                                          | CONFIRMED-OPEN            |
| FINDING-089 | /api/tasks/[id] dynamic route missing — tasks by ID return 404                | hooks/use-dashboard.ts:273                                                           | CONFIRMED-OPEN            |
| FINDING-090 | /api/admin/org-brand-profile route — not confirmed called from admin UI       | app/api/admin/org-brand-profile/route.ts                                             | CONFIRMED-OPEN            |
| FINDING-091 | Stale eslint-disable directives (9 instances across 6 files)                  | Multiple app/api/ routes                                                             | CONFIRMED-OPEN            |
| FINDING-092 | jsx-a11y/alt-text — Image missing alt prop (11 instances, 7 files)            | Multiple components                                                                  | CONFIRMED-OPEN            |
| FINDING-093 | react-hooks/exhaustive-deps warnings (8 files)                                | Multiple components                                                                  | CONFIRMED-OPEN            |
| FINDING-094 | use client directive after import in QuickStats.tsx (dead directive)          | components/QuickStats.tsx; components/admin/vault-import-dialog.tsx                  | CONFIRMED-OPEN            |
| FINDING-095 | import/no-anonymous-default-export — 11 instances across lib/ + components/   | Multiple lib/ and components/ files                                                  | CONFIRMED-OPEN            |
| FINDING-096 | react-hooks/exhaustive-deps ref cleanup issues (bento-gallery.tsx x2)         | components/landing/bento-gallery.tsx:51,94                                           | CONFIRMED-OPEN            |
| FINDING-097 | Stale @next/next/no-img-element eslint-disable directives                     | components/settings/brand-profile-tab.tsx; components/content/platform-preview.tsx   | CONFIRMED-OPEN            |
| FINDING-098 | Stale eslint-disable for globally disabled rules                              | lib/auth/monitoring.ts; lib/authority/claim-extractor.ts; lib/vault/vault-service.ts | CONFIRMED-OPEN            |
| FINDING-099 | FirstWeekWidget micro-labels text-white/25 (~1.8:1) — 6 instances             | components/dashboard/FirstWeekWidget.tsx                                             | CONFIRMED-OPEN            |
| FINDING-100 | Underline tab inactive border-transparent — intentional, documented           | components/ui/tabs.tsx:62                                                            | CONFIRMED-OPEN (accepted) |
| FINDING-101 | Radio item checked state loses border                                         | components/ui/radio-group.tsx:40,42                                                  | CONFIRMED-OPEN            |
| FINDING-102 | Page super-title labels text-white/25 (~1.8:1)                                | components/dashboard/dashboard-header.tsx:21; page-header.tsx:21                     | CONFIRMED-OPEN            |
| FINDING-103 | CardDescription text-gray-400 (~3.5:1), fails strict AA for 14px              | app/(auth)/login/page.tsx; app/(auth)/signup/page.tsx                                | CONFIRMED-OPEN            |
| FINDING-104 | Calendar outside-month days text-gray-500 + opacity-50 stacked                | components/ui/calendar.tsx:36,48,49                                                  | CONFIRMED-OPEN            |
| FINDING-105 | Tab section sub-labels text-white/25 — uppercase small font                   | Multiple dashboard tabs components                                                   | CONFIRMED-OPEN            |
| FINDING-106 | 60 ESLint warnings across source files (consolidated)                         | Multiple files                                                                       | CONFIRMED-OPEN            |
| FINDING-107 | hooks/use-settings-data.ts misleading comment re billing route                | hooks/use-settings-data.ts:143                                                       | CONFIRMED-OPEN            |

### Phase 121 — NEW

| ID             | Title                                                                       | File                                       | Status |
| -------------- | --------------------------------------------------------------------------- | ------------------------------------------ | ------ |
| A1-FINDING-012 | audience/insights null org guard missing                                    | app/api/audience/insights/route.ts         | NEW    |
| A1-FINDING-013 | predict/trends returns 403 instead of 401 for unauthenticated requests      | app/api/predict/trends/route.ts:87-90      | NEW    |
| A2-FINDING-006 | FIELD_ENCRYPTION_KEY and ENCRYPTION_KEY are all-zeros placeholders          | .env.example:260,399                       | NEW    |
| A2-FINDING-007 | No key re-encryption migration utility for ENCRYPTION_KEY rotation          | lib/encryption/api-key-encryption.ts:27-41 | NEW    |
| A2-FINDING-011 | NEXT_PUBLIC_CRON_SECRET defined in .env.example                             | .env.example:769-770                       | NEW    |
| A2-FINDING-012 | ws ^8.14.0 may be vulnerable to CVE-2024-37890; jsonwebtoken, axios flagged | package.json                               | NEW    |
| A3-FINDING-018 | integrations page imports TACTIC_LABELS directly from lib                   | app/dashboard/geo/optimiser/page.tsx:8     | NEW    |
| A3-FINDING-019 | integrations page imports INTEGRATION_REGISTRY directly from lib            | app/dashboard/integrations/page.tsx:10     | NEW    |
| A3-FINDING-028 | bio route uses Math.random() for slug generation — not crypto-safe          | app/api/bio/route.ts:33                    | NEW    |
| A5-FINDING-007 | puppeteer in serverExternalPackages despite being devDependency only        | next.config.mjs:115                        | NEW    |
| A5-FINDING-008 | react-icons and lodash in optimizePackageImports but not installed          | next.config.mjs                            | NEW    |
| A5-FINDING-009 | React 18.2 installed; React 19 stable and recommended for Next.js 15        | package.json                               | NEW    |
| A5-FINDING-010 | Tailwind CSS 3.4.x installed; v4.x stable                                   | package.json                               | NEW    |
| A5-FINDING-014 | @next/bundle-analyzer pinned to v14 while Next.js is v15                    | package.json                               | NEW    |

---

## Resolved Findings (excluded from open lists above)

The following Phase-119 findings were confirmed resolved by Phase 121 audit agents:

| Phase-119 ID | Resolution                                                               | Confirmed By                      |
| ------------ | ------------------------------------------------------------------------ | --------------------------------- |
| FINDING-001  | Test failures fixed (Prisma client utils)                                | STATE.md claim; not re-audited    |
| FINDING-002  | Test failures fixed (onboarding contract)                                | STATE.md claim; not re-audited    |
| FINDING-003  | Test failures fixed (Stripe routes)                                      | STATE.md claim; not re-audited    |
| FINDING-004  | Test failures fixed (campaigns)                                          | STATE.md claim; not re-audited    |
| FINDING-005  | Admin role check re-enabled via verifyAdmin()                            | A1-FINDING-001 CONFIRMED-RESOLVED |
| FINDING-007  | Auth migration (getUserIdFromRequest → OrCookies) complete — 0 remaining | A1-FINDING-002 CONFIRMED-RESOLVED |
| FINDING-015  | @remotion/player confirmed dynamic import only                           | A5-FINDING-003 CONFIRMED-RESOLVED |
| FINDING-071  | supabase/migrations/ directory now exists with 5 timestamped files       | A2-FINDING-008 CONFIRMED-RESOLVED |

Total confirmed resolved: 8 findings (7.5% of 107).
