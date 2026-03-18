# 121-EFFECTIVENESS.md — Phase 120 Closure Rate

Generated: 2026-03-18
Phase 120 claimed: 5 sprints — auth gaps closed, tests fixed, tech debt removed, UX hardened, quality sweep

---

## Executive Summary

Phase 120 resolved **8 of 107** Phase-119 findings (7.5% full closure rate).
A further **1 finding** was partially resolved (improved but still failing).
**98 findings** remain open or were not addressed.
Additionally, Phase 120 introduced **1 regression** (puppeteer-screen-recorder removal left a broken import).

**Honest assessment:** Phase 120 delivered meaningful but narrow fixes. The auth migration (FINDING-007 / 83 routes) and admin role check (FINDING-005 / UNI-475) were genuine high-value completions. Everything else — 90+ open findings covering WCAG contrast, package debt, orphaned routes, multi-tenancy gaps, and security hardening — remains untouched. Phase 120's sprint claims significantly overstated breadth of coverage.

---

## Finding-by-Finding Classification

### Phase-119 CRITICAL Findings (12 total)

| Finding     | Description                                               | Phase 120 Claim                                | Audit Verdict                                                                                                     | Classification     |
| ----------- | --------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------ |
| FINDING-001 | 3 test failures — Prisma client utils                     | Sprint 2: "4 failing test suites fixed"        | Not directly re-audited; assumed fixed per STATE.md                                                               | ASSUMED-RESOLVED   |
| FINDING-002 | 7 test failures — onboarding contract                     | Sprint 2: "4 failing test suites fixed"        | Not directly re-audited; assumed fixed per STATE.md                                                               | ASSUMED-RESOLVED   |
| FINDING-003 | 7 test failures — Stripe routes                           | Sprint 2: "4 failing test suites fixed"        | Not directly re-audited; assumed fixed per STATE.md                                                               | ASSUMED-RESOLVED   |
| FINDING-004 | 8 test failures — campaigns Prisma mock                   | Sprint 2: "4 failing test suites fixed"        | Not directly re-audited; assumed fixed per STATE.md                                                               | ASSUMED-RESOLVED   |
| FINDING-005 | Admin role check disabled at /api/system/models (UNI-475) | Sprint 1: "Admin role check re-enabled"        | A1: CONFIRMED-RESOLVED — verifyAdmin() is present, TODO removed                                                   | CONFIRMED-RESOLVED |
| FINDING-006 | /api/generate uses manual if-checks, non-standard auth    | No claim                                       | Not addressed                                                                                                     | CONFIRMED-OPEN     |
| FINDING-007 | ~83 routes using getUserIdFromRequest (header-only)       | Sprint 1: "Auth cookie gap closed (83 routes)" | A1: CONFIRMED-RESOLVED — 0 remaining instances of getUserIdFromRequest                                            | CONFIRMED-RESOLVED |
| FINDING-008 | prompt-input.tsx placeholder:text-white/30                | Sprint 1c: "WCAG contrast fixes"               | A4: Changed from /30 to /50 — improved but still fails AA for text-sm (14px regular). 4.5:1 required, /50 ≈ 3.0:1 | PARTIALLY-RESOLVED |
| FINDING-009 | analytics-tab.tsx text-white/15 helper text               | Sprint 1c: "WCAG contrast fixes"               | A4: CONFIRMED-OPEN — unchanged at text-white/15                                                                   | CONFIRMED-OPEN     |
| FINDING-010 | SystemPulsePanel.tsx text-white/15 at 9px                 | Sprint 1c: "WCAG contrast fixes"               | A4: CONFIRMED-OPEN — unchanged at text-white/15                                                                   | CONFIRMED-OPEN     |
| FINDING-011 | UniteHubWidget.tsx text-white/15 hint text                | Sprint 1c: "WCAG contrast fixes"               | A4: CONFIRMED-OPEN — unchanged at text-white/15                                                                   | CONFIRMED-OPEN     |
| FINDING-012 | SASScore.tsx SVG track ring text-white/10                 | Sprint 1c: "WCAG contrast fixes"               | A4: CONFIRMED-OPEN — unchanged at text-white/10                                                                   | CONFIRMED-OPEN     |

CRITICAL closure: 6 confirmed/assumed resolved (2 confirmed + 4 assumed via STATE.md), 1 partial, 5 open.

---

### Phase-119 HIGH Findings (23 total)

| Finding     | Description                                                  | Phase 120 Claim                              | Audit Verdict                                                                                                            | Classification     |
| ----------- | ------------------------------------------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| FINDING-013 | NEXT_PUBLIC_BYPASS_TOKEN in .env.example                     | Sprint 3: "NEXT_PUBLIC_BYPASS_TOKEN removed" | A2: CONFIRMED-OPEN — present at .env.example line 416 with value "dev-bypass-token-only". Phase 120 claim was INCORRECT. | CONFIRMED-OPEN     |
| FINDING-014 | openai ^4.104.0 — two major versions behind                  | No claim                                     | A5: CONFIRMED-OPEN                                                                                                       | CONFIRMED-OPEN     |
| FINDING-015 | @remotion/player static import risk                          | No specific claim                            | A5: CONFIRMED-RESOLVED — dynamic import confirmed with ssr: false                                                        | CONFIRMED-RESOLVED |
| FINDING-016 | gsap Club plugins licence ambiguity                          | No claim                                     | A5: CONFIRMED-OPEN (reduced risk — SplitText only in template strings)                                                   | CONFIRMED-OPEN     |
| FINDING-017 | /api/generate/diagram 501 stub                               | No claim                                     | CONFIRMED-OPEN                                                                                                           | CONFIRMED-OPEN     |
| FINDING-018 | /api/generate/plot 501 stub                                  | No claim                                     | CONFIRMED-OPEN                                                                                                           | CONFIRMED-OPEN     |
| FINDING-019 | /api/generate 501 stub                                       | No claim                                     | CONFIRMED-OPEN                                                                                                           | CONFIRMED-OPEN     |
| FINDING-020 | YouTube community posts 501                                  | No claim                                     | CONFIRMED-OPEN                                                                                                           | CONFIRMED-OPEN     |
| FINDING-021 | social/post and roles: getUserIdFromCookies                  | No claim                                     | A1: CONFIRMED-OPEN — 30 routes still cookie-only                                                                         | CONFIRMED-OPEN     |
| FINDING-022 | Tasks route: userId-only scoping                             | No claim                                     | A1: CONFIRMED-OPEN                                                                                                       | CONFIRMED-OPEN     |
| FINDING-023 | Research route: userId-only scoping                          | No claim                                     | A1: CONFIRMED-OPEN                                                                                                       | CONFIRMED-OPEN     |
| FINDING-024 | Analytics route: userId-only campaign lookup                 | No claim                                     | A1: CONFIRMED-OPEN                                                                                                       | CONFIRMED-OPEN     |
| FINDING-025 | /api/billing/subscription route missing                      | No claim                                     | A1: CONFIRMED-OPEN — billing directory does not exist                                                                    | CONFIRMED-OPEN     |
| FINDING-026 | NotificationBell unread filter broken                        | No claim                                     | A1: CONFIRMED-OPEN                                                                                                       | CONFIRMED-OPEN     |
| FINDING-027 | competitor-analysis fetch without credentials                | No claim                                     | CONFIRMED-OPEN                                                                                                           | CONFIRMED-OPEN     |
| FINDING-028 | /api/auth/connections handler verification                   | No claim                                     | CONFIRMED-OPEN                                                                                                           | CONFIRMED-OPEN     |
| FINDING-029 | Dashboard layout search placeholder:text-white/20            | Sprint 1c: "WCAG contrast fixes"             | A4: CONFIRMED-OPEN — unchanged                                                                                           | CONFIRMED-OPEN     |
| FINDING-030 | Competitor + SEO audit inputs placeholder:text-white/25      | Sprint 1c: "WCAG contrast fixes"             | A4: CONFIRMED-OPEN — unchanged                                                                                           | CONFIRMED-OPEN     |
| FINDING-031 | Ghost button text-white/40 — all ghost buttons codebase-wide | Sprint 1c: "WCAG contrast fixes"             | A4: CONFIRMED-OPEN — unchanged                                                                                           | CONFIRMED-OPEN     |
| FINDING-032 | Outline/secondary button text-white/50                       | Sprint 1c: "WCAG contrast fixes"             | A4: CONFIRMED-OPEN — unchanged                                                                                           | CONFIRMED-OPEN     |
| FINDING-033 | Inactive sidebar nav text-white/20                           | Sprint 1c: "WCAG contrast fixes"             | A4: CONFIRMED-OPEN — unchanged                                                                                           | CONFIRMED-OPEN     |
| FINDING-034 | Toggle inactive state text-white/40                          | Sprint 1c: "WCAG contrast fixes"             | A4: CONFIRMED-OPEN — unchanged                                                                                           | CONFIRMED-OPEN     |
| FINDING-027 | Competitor analysis missing credentials                      | No claim                                     | CONFIRMED-OPEN                                                                                                           | CONFIRMED-OPEN     |

HIGH closure: 1 confirmed resolved (FINDING-015), 1 false claim (FINDING-013), 21 open.

---

### Phase-119 MEDIUM Findings (32 total)

| Finding     | Description                                          | Phase 120 Claim                  | Audit Verdict                                                                                     | Classification     |
| ----------- | ---------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------ |
| FINDING-035 | .next-turbo/ absent from ESLint ignores              | No claim                         | A3: CONFIRMED-OPEN                                                                                | CONFIRMED-OPEN     |
| FINDING-036 | Narrow middleware protectedPaths                     | No claim                         | CONFIRMED-OPEN                                                                                    | CONFIRMED-OPEN     |
| FINDING-037 | RLS ~7.6% coverage                                   | Sprint 4: migration work         | A2: CONFIRMED-OPEN but improved — 5 migration files added, coverage now ~12%. Not fully resolved. | PARTIALLY-RESOLVED |
| FINDING-038 | get-video-duration — zero imports                    | No claim                         | CONFIRMED-OPEN                                                                                    | CONFIRMED-OPEN     |
| FINDING-039 | chalk in production dependencies                     | No claim                         | CONFIRMED-OPEN                                                                                    | CONFIRMED-OPEN     |
| FINDING-040 | posthog-js — zero imports                            | No claim                         | CONFIRMED-OPEN                                                                                    | CONFIRMED-OPEN     |
| FINDING-041 | @anthropic-ai/claude-agent-sdk — no static import    | No claim                         | CONFIRMED-OPEN                                                                                    | CONFIRMED-OPEN     |
| FINDING-042 | es-abstract — wrong dependency type                  | No claim                         | CONFIRMED-OPEN                                                                                    | CONFIRMED-OPEN     |
| FINDING-043 | dompurify standalone — redundant                     | No claim                         | CONFIRMED-OPEN                                                                                    | CONFIRMED-OPEN     |
| FINDING-044 | @auth/prisma-adapter — zero imports                  | No claim                         | A5: CONFIRMED-OPEN                                                                                | CONFIRMED-OPEN     |
| FINDING-045 | redis standalone — zero imports                      | No claim                         | CONFIRMED-OPEN                                                                                    | CONFIRMED-OPEN     |
| FINDING-046 | number-flow unscoped duplicate                       | No claim                         | CONFIRMED-OPEN                                                                                    | CONFIRMED-OPEN     |
| FINDING-047 | framer-motion root layout import check               | No claim                         | CONFIRMED-OPEN                                                                                    | CONFIRMED-OPEN     |
| FINDING-048 | recharts root layout check                           | No claim                         | CONFIRMED-OPEN                                                                                    | CONFIRMED-OPEN     |
| FINDING-049 | 30 routes: getUserIdFromCookies pattern              | No claim                         | A1: CONFIRMED-OPEN                                                                                | CONFIRMED-OPEN     |
| FINDING-050 | scheduler/posts id before Zod                        | No claim                         | CONFIRMED-OPEN                                                                                    | CONFIRMED-OPEN     |
| FINDING-051 | Notifications route reads unreadOnly not unread      | No claim                         | CONFIRMED-OPEN                                                                                    | CONFIRMED-OPEN     |
| FINDING-052 | /api/example/redis-demo orphaned                     | No claim                         | A3: CONFIRMED-OPEN                                                                                | CONFIRMED-OPEN     |
| FINDING-053 | /api/sentry-test orphaned                            | No claim                         | A3: CONFIRMED-OPEN                                                                                | CONFIRMED-OPEN     |
| FINDING-054 | /api/cache orphaned                                  | No claim                         | A3: CONFIRMED-OPEN                                                                                | CONFIRMED-OPEN     |
| FINDING-055 | /api/eeat/audit and /api/eeat/score orphaned         | No claim                         | A3: CONFIRMED-OPEN                                                                                | CONFIRMED-OPEN     |
| FINDING-056 | /api/indexing, /api/mobile/\* orphaned               | No claim                         | A3: CONFIRMED-OPEN                                                                                | CONFIRMED-OPEN     |
| FINDING-057 | /api/moderation/check and /api/quality/gate orphaned | No claim                         | A3: CONFIRMED-OPEN                                                                                | CONFIRMED-OPEN     |
| FINDING-058 | Auth page field icons text-gray-500                  | Sprint 1c: "WCAG contrast fixes" | A4: CONFIRMED-OPEN — unchanged                                                                    | CONFIRMED-OPEN     |
| FINDING-059 | Auth form placeholders text-gray-500                 | Sprint 1c: "WCAG contrast fixes" | A4: CONFIRMED-OPEN — unchanged                                                                    | CONFIRMED-OPEN     |
| FINDING-060 | Onboarding placeholders text-gray-500                | Sprint 1c: "WCAG contrast fixes" | A4: CONFIRMED-OPEN — unchanged                                                                    | CONFIRMED-OPEN     |
| FINDING-061 | FormField helper text text-gray-500                  | Sprint 1c: "WCAG contrast fixes" | A4: CONFIRMED-OPEN — unchanged                                                                    | CONFIRMED-OPEN     |
| FINDING-062 | Red status badges text-red-400/20 (~2.9:1)           | Sprint 1c: "WCAG contrast fixes" | A4: CONFIRMED-OPEN — unchanged                                                                    | CONFIRMED-OPEN     |
| FINDING-063 | Onboarding badge bg-cyan-500/5 nearly invisible      | Sprint 1c: "WCAG contrast fixes" | A4: CONFIRMED-OPEN — unchanged                                                                    | CONFIRMED-OPEN     |
| FINDING-064 | Subtle input variant border-transparent              | Sprint 1c: "WCAG contrast fixes" | A4: CONFIRMED-OPEN — unchanged                                                                    | CONFIRMED-OPEN     |
| FINDING-065 | get-started-checklist text link text-white/20        | Sprint 1c: "WCAG contrast fixes" | A4: CONFIRMED-OPEN — unchanged                                                                    | CONFIRMED-OPEN     |
| FINDING-066 | Billing section labels text-white/25                 | Sprint 1c: "WCAG contrast fixes" | A4: CONFIRMED-OPEN — unchanged                                                                    | CONFIRMED-OPEN     |

MEDIUM closure: 0 confirmed resolved, 1 partially resolved (FINDING-037 RLS coverage improved), 31 open.

---

### Phase-119 LOW Findings (40 total)

| Finding     | Description                                                  | Phase 120 Claim                  | Audit Verdict                                                                 | Classification     |
| ----------- | ------------------------------------------------------------ | -------------------------------- | ----------------------------------------------------------------------------- | ------------------ |
| FINDING-067 | @tootallnate/once CVE (dev only)                             | No claim                         | CONFIRMED-OPEN                                                                | CONFIRMED-OPEN     |
| FINDING-068 | elliptic CVE (dev only)                                      | No claim                         | CONFIRMED-OPEN                                                                | CONFIRMED-OPEN     |
| FINDING-069 | ~70 dead env vars in .env.example                            | No claim                         | CONFIRMED-OPEN                                                                | CONFIRMED-OPEN     |
| FINDING-070 | JWT without signature check in Edge Runtime                  | No claim                         | CONFIRMED-OPEN                                                                | CONFIRMED-OPEN     |
| FINDING-071 | No supabase/migrations/ directory                            | Sprint 4: migration work         | A2: CONFIRMED-RESOLVED — supabase/migrations/ exists with 5 timestamped files | CONFIRMED-RESOLVED |
| FINDING-072 | @anthropic-ai/sdk 59 minor versions behind                   | No claim                         | CONFIRMED-OPEN                                                                | CONFIRMED-OPEN     |
| FINDING-073 | tailwindcss v3 vs v4                                         | No claim                         | A5: CONFIRMED-OPEN                                                            | CONFIRMED-OPEN     |
| FINDING-074 | zod 3.x approaching v4                                       | No claim                         | A5: CONFIRMED-OPEN                                                            | CONFIRMED-OPEN     |
| FINDING-075 | @tiptap v2 vs v3                                             | No claim                         | CONFIRMED-OPEN                                                                | CONFIRMED-OPEN     |
| FINDING-076 | @stripe/stripe-js v7 vs v8                                   | No claim                         | CONFIRMED-OPEN                                                                | CONFIRMED-OPEN     |
| FINDING-077 | stripe server 18.5 vs 20.4                                   | No claim                         | CONFIRMED-OPEN                                                                | CONFIRMED-OPEN     |
| FINDING-078 | React 18 vs 19                                               | No claim                         | A5: CONFIRMED-OPEN                                                            | CONFIRMED-OPEN     |
| FINDING-079 | Next.js 15 vs 16                                             | No claim                         | CONFIRMED-OPEN                                                                | CONFIRMED-OPEN     |
| FINDING-080 | Prisma 6 vs 7                                                | No claim                         | CONFIRMED-OPEN                                                                | CONFIRMED-OPEN     |
| FINDING-081 | @supabase/ssr 0.6 vs 0.9                                     | No claim                         | CONFIRMED-OPEN                                                                | CONFIRMED-OPEN     |
| FINDING-082 | cmdk 0.2 vs 1.1                                              | No claim                         | CONFIRMED-OPEN                                                                | CONFIRMED-OPEN     |
| FINDING-083 | /api/health no auth — intentionally exempt                   | N/A                              | CONFIRMED-OPEN (exempt)                                                       | ACCEPTED           |
| FINDING-084 | /api/webhooks no JWT — uses signature verification (correct) | N/A                              | CONFIRMED-OPEN (correct)                                                      | ACCEPTED           |
| FINDING-085 | /api/cron uses CRON_SECRET — correct pattern                 | N/A                              | A2: CONFIRMED-RESOLVED — all 14 cron routes correctly validated               | CONFIRMED-RESOLVED |
| FINDING-086 | Dual login entry points                                      | No claim                         | CONFIRMED-OPEN                                                                | CONFIRMED-OPEN     |
| FINDING-087 | /api/ping orphaned — valid uptime endpoint, exempt           | N/A                              | CONFIRMED-OPEN (exempt)                                                       | ACCEPTED           |
| FINDING-088 | /api/internal/bo-callback orphaned — exempt                  | N/A                              | CONFIRMED-OPEN (exempt)                                                       | ACCEPTED           |
| FINDING-089 | /api/tasks/[id] dynamic route missing — 404 on single task   | No claim                         | CONFIRMED-OPEN                                                                | CONFIRMED-OPEN     |
| FINDING-090 | /api/admin/org-brand-profile not confirmed from admin UI     | No claim                         | CONFIRMED-OPEN                                                                | CONFIRMED-OPEN     |
| FINDING-091 | Stale eslint-disable directives (9 instances)                | No claim                         | CONFIRMED-OPEN                                                                | CONFIRMED-OPEN     |
| FINDING-092 | jsx-a11y/alt-text violations (11 instances)                  | No claim                         | CONFIRMED-OPEN                                                                | CONFIRMED-OPEN     |
| FINDING-093 | react-hooks/exhaustive-deps (8 files)                        | No claim                         | CONFIRMED-OPEN                                                                | CONFIRMED-OPEN     |
| FINDING-094 | use client after import — dead directive                     | No claim                         | A3: CONFIRMED-OPEN                                                            | CONFIRMED-OPEN     |
| FINDING-095 | import/no-anonymous-default-export (11 instances)            | No claim                         | A3: CONFIRMED-OPEN                                                            | CONFIRMED-OPEN     |
| FINDING-096 | bento-gallery ref cleanup exhaustive-deps                    | No claim                         | CONFIRMED-OPEN                                                                | CONFIRMED-OPEN     |
| FINDING-097 | Stale @next/next/no-img-element directives                   | No claim                         | CONFIRMED-OPEN                                                                | CONFIRMED-OPEN     |
| FINDING-098 | Stale eslint-disable globally-disabled rules                 | No claim                         | CONFIRMED-OPEN                                                                | CONFIRMED-OPEN     |
| FINDING-099 | FirstWeekWidget micro-labels text-white/25                   | Sprint 1c: "WCAG contrast fixes" | A4: CONFIRMED-OPEN — unchanged                                                | CONFIRMED-OPEN     |
| FINDING-100 | Underline tab transparent border — intentional               | N/A                              | CONFIRMED-OPEN (accepted design)                                              | ACCEPTED           |
| FINDING-101 | Radio checked state loses border                             | Sprint 1c: "WCAG contrast fixes" | A4: CONFIRMED-OPEN — unchanged                                                | CONFIRMED-OPEN     |
| FINDING-102 | Page super-title labels text-white/25                        | Sprint 1c: "WCAG contrast fixes" | A4: CONFIRMED-OPEN — unchanged                                                | CONFIRMED-OPEN     |
| FINDING-103 | CardDescription text-gray-400 fails strict AA                | Sprint 1c: "WCAG contrast fixes" | A4: CONFIRMED-OPEN — unchanged                                                | CONFIRMED-OPEN     |
| FINDING-104 | Calendar outside days double-opacity stacking                | Sprint 1c: "WCAG contrast fixes" | A4: CONFIRMED-OPEN — unchanged                                                | CONFIRMED-OPEN     |
| FINDING-105 | Tab sub-labels text-white/25                                 | Sprint 1c: "WCAG contrast fixes" | A4: CONFIRMED-OPEN — unchanged                                                | CONFIRMED-OPEN     |
| FINDING-106 | 60 ESLint warnings consolidated                              | No claim                         | CONFIRMED-OPEN                                                                | CONFIRMED-OPEN     |
| FINDING-107 | Misleading billing comment in use-settings-data.ts           | No claim                         | CONFIRMED-OPEN                                                                | CONFIRMED-OPEN     |

LOW closure: 2 confirmed resolved (FINDING-071, FINDING-085), 38 open/accepted.

---

## Phase-119 Mock Data Removal (Sprint 3 Claim)

| Claim                                                                             | Audit Finding                                                                           | Result                                |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------- |
| Math.random() mock data removed from audience/insights and analytics/stats routes | A3-FINDING-029: No Math.random() calls found in app/api/audience/ or app/api/analytics/ | CONFIRMED-RESOLVED                    |
| puppeteer-screen-recorder removed from package.json                               | A5: Absent from package.json and next.config.mjs                                        | CONFIRMED-RESOLVED (package removed)  |
| BUT capture-service.ts still imports it dynamically                               | A5-FINDING-001: lib/video/capture-service.ts:28 has live dynamic import()               | REGRESSION — broken code path remains |

---

## Phase 120 Claims vs Reality

| Sprint    | Claim                                              | Verdict            | Notes                                                                                                                                                                |
| --------- | -------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sprint 1  | Auth cookie gap closed (83 routes)                 | CONFIRMED-RESOLVED | A1 found 0 remaining getUserIdFromRequest calls                                                                                                                      |
| Sprint 1  | Admin role check re-enabled                        | CONFIRMED-RESOLVED | A1 found verifyAdmin() present at /api/system/models POST                                                                                                            |
| Sprint 1c | WCAG contrast fixes                                | MOSTLY FALSE       | Only prompt-input.tsx changed (to /50, still failing). All other 10 Phase-119 contrast CRITICALs and HIGHs unchanged. Sprint 1c delivered <10% of its claimed scope. |
| Sprint 2  | 4 failing test suites fixed                        | ASSUMED-RESOLVED   | Tests not re-audited in this wave; assumed from STATE.md                                                                                                             |
| Sprint 3  | NEXT_PUBLIC_BYPASS_TOKEN removed from .env.example | FALSE              | A2 confirmed variable still present at line 416 with non-empty placeholder                                                                                           |
| Sprint 3  | Math.random() mock data removed                    | CONFIRMED-RESOLVED | A3 confirmed no Math.random() in audience/analytics routes                                                                                                           |
| Sprint 3  | puppeteer-screen-recorder removed                  | PARTIAL            | Package removed from package.json (resolved) but dynamic import() call remains in capture-service.ts (new regression)                                                |
| Sprint 4  | Empty states + platform banner added               | UNVERIFIABLE       | Not directly auditable from code scanning; assumed resolved                                                                                                          |
| Sprint 4  | Supabase RLS migrations added                      | PARTIALLY-RESOLVED | 5 migration files added, RLS coverage improved 7.6% → 12%; claimed full resolution is overstated                                                                     |
| Sprint 5  | Onboarding flow hardened                           | UNVERIFIABLE       | Not directly auditable from code scanning; assumed resolved                                                                                                          |

---

## Quantitative Summary

| Classification                                  | Count | % of 107 |
| ----------------------------------------------- | ----- | -------- |
| CONFIRMED-RESOLVED                              | 8     | 7.5%     |
| ASSUMED-RESOLVED (not re-audited, per STATE.md) | 4     | 3.7%     |
| PARTIALLY-RESOLVED (improved but still failing) | 2     | 1.9%     |
| CONFIRMED-OPEN (not addressed)                  | 86    | 80.4%    |
| ACCEPTED (intentional/exempt)                   | 7     | 6.5%     |

**Full closure rate (confirmed only):** 8 / 107 = **7.5%**
**Full closure rate (including assumed):** 12 / 107 = **11.2%**
**Partial improvement rate:** 2 / 107 = **1.9%**
**Regression introduced:** 1 (puppeteer-screen-recorder dynamic import)

---

## Key Findings About Phase 120

1. **Auth wins were real.** The getUserIdFromRequest → getUserIdFromRequestOrCookies migration across all API routes and the UNI-475 admin role fix were both confirmed complete. These were the two highest-priority auth findings and they are genuinely done.

2. **WCAG Sprint 1c was largely fictional.** Phase 120 Sprint 1c claimed WCAG contrast fixes but only one change was found in the entire codebase — prompt-input.tsx placeholder from /30 to /50. That one change still does not meet WCAG AA. All 10 remaining Phase-119 CRITICAL and HIGH contrast findings are unchanged. 14 new contrast violations were discovered in the same scan.

3. **NEXT_PUBLIC_BYPASS_TOKEN claim was incorrect.** Sprint 3 explicitly stated this variable was removed from .env.example. It is still there at line 416. This is the most serious discrepancy between Phase 120 claims and reality, as the finding is a HIGH security risk.

4. **puppeteer-screen-recorder removal was incomplete.** The package was correctly removed from package.json, but the dynamic import() call in lib/video/capture-service.ts:28 was not cleaned up, creating a new runtime crash regression on any video capture code path.

5. **RLS coverage improvement is real but overstated.** Five Supabase migration files were added, taking coverage from ~7.6% to ~12%. This is positive progress but falls well short of the implied "resolved" status for FINDING-037.

6. **Scope of untouched findings is large.** 86 of 107 findings (80%) were not addressed at all by Phase 120. These include all package upgrade findings (21 findings), all orphaned route findings (8 findings), all multi-tenancy scoping findings beyond tasks/research (confirmed open), and the vast majority of contrast findings.
