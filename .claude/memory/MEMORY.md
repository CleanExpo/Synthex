# Synthex Project Memory

## Project Overview

- **Repo**: CleanExpo/Synthex on GitHub
- **Stack**: Next.js 15 (App Router), TypeScript 5, Prisma 6, PostgreSQL (Supabase), Vercel
- **Domain**: synthex.social (live — invite-only)
- **Local path varies by machine** — always use repo-relative paths

## Claude Code Tool Architecture (updated 2026-04-01)

### Project-level (`.claude/`) — Synthex-specific only

- **4 agents**: build-engineer, code-architect, qa-sentinel, senior-reviewer
- **25 skills**: api-testing, architecture-enforcer, auth-patterns, browser-auth, browser-debug, browser-verify, build-orchestrator, client-manager, client-retention, code-review, content-pipeline, database-prisma, design, imagen-designer, platform-showcase, project-scanner, route-auditor, scout, security-hardener, site-smoke-test, social-integrations, spec-generator, sql-hardener, ui-ux, video-engine
- **19 hooks**: PowerShell scripts for build validation, pre-commit checks
- **6 rules**: backend, database, development, frontend, operations, skills
- **5 memory files**: MEMORY.md, ARCHITECTURE.md, STANDARDS.md, TESTING.md, WORKFLOWS.md, compass.md
- **Scratchpad**: `.claude/scratchpad/` — ephemeral session working space

### User-level (`~/.claude/`) — General-purpose, available across all projects

- **17 agents**: hive-mind, blog-researcher, blog-reviewer, blog-seo, blog-writer, content-creator, imagen-generator, marketing-automation, performance-optimizer, platform-specialist, research-analyst, search-engineer, seo-strategist, ux-researcher, video-director, visual-designer, visual-design-agent
- **34 skills**: blog suite (14), SEO (5+3 existing), video/visual (3), research (3), meta (5), visual-generator

## Linear Project

- **Workspace**: unite-hub
- **Project**: Synthex (ID: 3125c6e4-b729-48d4-a718-400a2b83ddc5)
- **Team**: Unite-Hub (key: UNI / SYN)

## Current State (2026-04-24)

- **Main HEAD**: tracking rapid delivery — see `git log origin/main --oneline` for the authoritative list
- **DB**: 131+ Prisma models — migrations applied to production Supabase
- **Test suite**: 144 suites, 2794 passing, 0 failing
- **Deploy status**: LIVE at https://synthex.social (invite-only)
- **Gate**: `npm run lint && npm run type-check && npm test` — all green

## Recently Shipped (2026-04-24 hardening sprint)

| PR  | Issues                                | Impact                                                                                                                                                                                                                                                   |
| --- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #69 | SYN-782 / SYN-783 / SYN-784 / SYN-785 | CI lint gate unblocked; Score Accuracy Gate self-heals on missing secrets; shadow-dim mock drift fixed; `.claude/settings.local.json` untracked                                                                                                          |
| #70 | SYN-786                               | Gemini 3.1 Flash/Pro (GCN2026) registered at tier `latest`; Native Function Calling wired; 70% TTFT reduction available via existing OpenRouter pipeline                                                                                                 |
| #71 | SYN-789                               | Removed 10 `as any` casts from intelligence pipeline — exposed and fixed 2 silent production bugs (monthly-story owner email lookup on nonexistent `User.role`; quality-gate auto-unlock never firing because `StoryConfig` was included on wrong model) |
| #72 | SYN-790                               | Removed `dangerouslySetInnerHTML` on 4 static marketing copy sites (JSON-LD untouched)                                                                                                                                                                   |

## Open Linear tickets (2026-04-24)

| Ticket  | Scope                                                                    | Status      |
| ------- | ------------------------------------------------------------------------ | ----------- |
| SYN-787 | NotebookLM Enterprise spike (12h ceiling) — AU GCP project required      | Backlog     |
| SYN-788 | Managed MCP BigQuery read-only spike (6h ceiling) — GCP project required | Backlog     |
| SYN-680 | Ask Synthex Anything (Sprint 8 anchor)                                   | In Review   |
| SYN-573 | YouTube OAuth credential fallback + demo env vars                        | Human-gated |

## Pending Human Actions (Phill)

1. **Enable GitHub Dependency Graph** — github.com/CleanExpo/Synthex/settings/security_analysis — fixes the pre-existing `Dependency Review` CI check that shows red on every PR
2. **SYN-573 actions** — Google Cloud Console (YouTube OAuth), HeyGen API key, demo account
3. **GCP project in `australia-southeast1`** — unblocks SYN-787 (NotebookLM) and SYN-788 (MCP BigQuery) spikes
4. **Supabase secrets for Score Accuracy Gate** — `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in repo Actions secrets. Without them the gate skips cleanly with a `::warning::` (SYN-783/784/785 fix); adding them flips it from "skipped" to "enforced"
5. **Fix Supabase Preview** — Supabase dashboard (wrong project ID `joiswghkfvfevbowtanp` linked)

## Codebase Hardening Baseline (as of 2026-04-24)

- `as any` casts repo-wide: 7 (down from 17)
- `dangerouslySetInnerHTML` on non-JSON-LD paths: 0
- Supabase-only auth: enforced (CLAUDE.md hard limit)
- OpenRouter-primary AI: enforced (model registry abstraction)
- `.claude/settings.local.json`: untracked + gitignored (stops machine-local state dirtying the tree)

## GCN2026 Adoption Decisions (2026-04-24)

Google Cloud Next 2026 (Apr 22-24) shipped five major announcements. Synthex adoption stance:

| Announcement                     | Verdict  | Notes                                                                |
| -------------------------------- | -------- | -------------------------------------------------------------------- |
| Gemini 3.1 Flash/Pro + NFC       | ADOPTED  | SYN-786 — shipped. 70% TTFT reduction, Native Function Calling wired |
| Managed MCP (BigQuery read-only) | SPIKE    | SYN-788 — blocked on GCP project                                     |
| NotebookLM Enterprise            | SPIKE    | SYN-787 — blocked on GCP AU project                                  |
| Vertex Agent Platform / ADK      | REJECTED | Duplicates `lib/workflow/orchestrator.ts` — rebuild not justified    |
| A2A Protocol v1.2                | DEFERRED | No cross-cloud handoff need today — revisit Q3 2026                  |

## Key Architecture Patterns

- **Auth**: Supabase Auth ONLY (NextAuth removed) + JWT + PKCE — see `auth-patterns` skill
- **AI**: OpenRouter (primary), user BYOK API keys, model registry in `lib/ai/model-registry.ts`
- **Claude 4.6**: `thinking: { type: "adaptive" }` — NOT deprecated `budget_tokens`
- **Multi-business**: Organisation scoping via `lib/multi-business/`
- **Encryption**: API key encryption in `lib/encryption/`
- **9 platforms**: YouTube, Instagram, TikTok, X, Facebook, LinkedIn, Pinterest, Reddit, Threads
- **Workflow Engine**: `lib/workflow/` — orchestrator, step-executor, context-builder (Phase 62)
- **Onboarding**: 4-step flow: keys → audit → goals → socials

## Stripe (Live)

- **Account**: `acct_1SSgvEBJ6dR6rf4P` (Unite-Hub)
- **Pricing**: Pro $249/mo, Growth $449/mo, Scale $799/mo (AUD)
- **Webhook**: `we_1TAJrdBJ6dR6rf4PVh6J30OL` → `https://synthex.social/api/webhooks/stripe`
- **To go live**: swap `sk_test_*`/`pk_test_*` with live keys + register new live-mode webhook

## Architectural Decisions Log

[24/04/2026] DECISION: Adopt Gemini 3.1 via existing OpenRouter abstraction; reject direct Vertex SDK | REASON: OpenRouter-primary stands. Direct Vertex adoption creates vendor lock-in and requires new auth surface. Model registry entries at tier `latest` (SYN-786) give 70% TTFT reduction with zero architectural change | ALTERNATIVES REJECTED: Direct Vertex SDK (lock-in), Gemini Enterprise Agent Platform/ADK (duplicates lib/workflow)

[24/04/2026] DECISION: `.claude/settings.local.json` is machine-local state and must not be tracked in git | REASON: Claude Code appends approved permissions to this file on every tool call; having it tracked dirtied the working tree every session and triggered the stop-verify-git hook | ALTERNATIVES REJECTED: Keeping it tracked (permanent noise), editing to ignore patterns-only (file still gets rewritten wholesale)

[24/04/2026] DECISION: Score Accuracy Gate workflow skips cleanly with `::warning::` when Supabase secrets absent | REASON: Previously the workflow called curl with empty SUPABASE_URL, producing exit 3 (malformed URL) under `bash -e`. Repo secrets are human-gated — CI must not red-fail on missing infrastructure config | ALTERNATIVES REJECTED: Requiring secrets before merge (blocks unrelated PRs), `continue-on-error: true` (hides real gate failures)

[24/04/2026] DECISION: `as any` casts are audit targets, not safe suppressions — each one masks either schema drift or test mock drift | REASON: SYN-789 audit of 10 casts revealed 2 real production bugs (owner email lookup on nonexistent `User.role`; `StoryConfig` included on wrong model). `as any` has negative expected value even when "technically safe" | ALTERNATIVES REJECTED: Treating casts as cosmetic (ships real bugs), global ESLint rule to ban `any` (breaks current tests-in-flight)

[01/04/2026] DECISION: generateStaticParams in app/clients/[slug]/page.tsx wraps DB call in try/catch returning [] | REASON: CI environment has placeholder DATABASE_URL (no real DB) — prisma.organization.findMany() throws ECONNREFUSED at build time; returning [] triggers ISR on-demand rendering with zero production behaviour change | ALTERNATIVES REJECTED: seeding CI DB (complex, fragile), removing static generation entirely (SEO impact)

[01/04/2026] DECISION: CLAUDE.md slimmed to ≤150 lines with companion files in .claude/memory/ | REASON: CLAUDE.md was 198 lines, making it unwieldy to read every session; detail extracted to ARCHITECTURE.md, STANDARDS.md, TESTING.md, WORKFLOWS.md so CLAUDE.md becomes a navigation hub | ALTERNATIVES REJECTED: removing detail entirely (knowledge lost), keeping single file (too long)

[01/04/2026] DECISION: glob v11 uses named export `globSync` from 'glob' (not `import * as glob`) | REASON: glob v11 removed the default namespace export; `globSync` must be imported as named export | ALTERNATIVES REJECTED: downgrading glob (would reintroduce old API)

[30/03/2026] DECISION: Advisor brief delivered via Supabase Edge Function cron (deliver-advisor-brief) + stored in AdvisorBrief table | REASON: Decouples generation (async cron) from delivery (API read); brief persists for dashboard display without re-generating per request | ALTERNATIVES REJECTED: on-demand generation per page load (expensive, slow, no history)

[30/03/2026] DECISION: TeamInviteBanner eligibility check: user must be in an organisation for 45+ days with 0 team members | REASON: Prevents invite prompt spam on new accounts; 45 days = sufficient time to have real usage and real need for team | ALTERNATIVES REJECTED: immediate prompt (annoying), time-only (ignores team state)

## Detailed Reference Files

- [agents-and-skills.md](agents-and-skills.md) — Full agent/skill inventory
- [linear-backlog.md](linear-backlog.md) — Current Linear issue snapshot
- [compass.md](compass.md) — Quick project orientation (3 rules, active issues, key paths)
- [ARCHITECTURE.md](ARCHITECTURE.md) — Full architectural patterns and layer rules
- [STANDARDS.md](STANDARDS.md) — Code conventions, API patterns, TypeScript standards
- [TESTING.md](TESTING.md) — Test patterns, verification rules, CEO directive
- [WORKFLOWS.md](WORKFLOWS.md) — Multi-agent rules, scope routing, session management
