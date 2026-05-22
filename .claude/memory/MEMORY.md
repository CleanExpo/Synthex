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

## Recently Shipped (2026-04-24 mega-hardening session — 16 PRs)

| PR  | Issue(s)                              | Impact                                                                                                                                                                                                                                                   |
| --- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #69 | SYN-782 / SYN-783 / SYN-784 / SYN-785 | CI lint gate unblocked; Score Accuracy Gate self-heals on missing secrets; shadow-dim mock drift fixed; `.claude/settings.local.json` untracked                                                                                                          |
| #70 | SYN-786                               | Gemini 3.1 Flash/Pro (GCN2026) registered at tier `latest`; Native Function Calling wired; 70% TTFT reduction available via existing OpenRouter pipeline                                                                                                 |
| #71 | SYN-789                               | Removed 10 `as any` casts from intelligence pipeline — exposed and fixed 2 silent production bugs (monthly-story owner email lookup on nonexistent `User.role`; quality-gate auto-unlock never firing because `StoryConfig` was included on wrong model) |
| #72 | SYN-790                               | Removed `dangerouslySetInnerHTML` on 4 static marketing copy sites                                                                                                                                                                                       |
| #73 | SYN-791                               | MEMORY.md refresh (this file)                                                                                                                                                                                                                            |
| #74 | **SYN-792 (P0)**                      | **Redirect-loop fix** — `proxy.ts` (Next.js 16 renamed from middleware.ts) restored with safety-first gating; `/auth/login` no longer self-loops; marketing pages indexable by SEO crawlers                                                              |
| #75 | SYN-699                               | OAuth state replay window tightened 10m → 2m                                                                                                                                                                                                             |
| #76 | SYN-700                               | LinkedIn webhook HMAC-signed; Pinterest challenge requires verify_token — both fail-closed                                                                                                                                                               |
| #77 | SYN-701                               | Vault DOCX upload validates ZIP magic bytes + 30s parse timeout + audit log                                                                                                                                                                              |
| #78 | SYN-702 Phase 1                       | `lib/auth/cron-auth.ts` helper — per-route secret isolation with shared-secret fallback                                                                                                                                                                  |
| #79 | SYN-755                               | Innovation hypothesis registration template + CI soft-warning + compliance log                                                                                                                                                                           |
| #80 | SYN-724                               | CVML event schema + `emit()` wrapper — 7 features × 6 event types, 94 unit tests                                                                                                                                                                         |
| #81 | SYN-759                               | `noImplicitReturns` + `noFallthroughCasesInSwitch` added to tsconfig (strict was already on)                                                                                                                                                             |
| #82 | SYN-732 Phase 1                       | 4 HIGH + 2 MEDIUM silent-fail handlers — AICalendarSection (3 sites), UniteHubWidget, advisor feedback, team invite banner                                                                                                                               |
| #83 | SYN-702 Phase 2                       | 44 cron routes migrated to `verifyCronRequest` helper — 248 lines of inline auth replaced with 137 lines                                                                                                                                                 |
| #84 | SYN-732 Phase 2                       | 3 remaining real silent-fail sites (admin/health, video, monthly-story) + confirmed 5 audit findings already correct                                                                                                                                     |

**Pending merge:** PR #85 (SYN-725) — `client_value_scorecard` materialised view + weekly Slack scorecard Action. Build green, Supabase Preview failing (known pre-existing infra issue — wrong project linked).

## Open Linear tickets (2026-04-24)

| Ticket  | Scope                                                                    | Status      |
| ------- | ------------------------------------------------------------------------ | ----------- |
| SYN-787 | NotebookLM Enterprise spike (12h ceiling) — AU GCP project required      | Backlog     |
| SYN-788 | Managed MCP BigQuery read-only spike (6h ceiling) — GCP project required | Backlog     |
| SYN-680 | Ask Synthex Anything (Sprint 8 anchor)                                   | In Review   |
| SYN-573 | YouTube OAuth credential fallback + demo env vars                        | Human-gated |

## Pending Human Actions (Phill)

1. ~~**Enable GitHub Dependency Graph**~~ ✅ **RESOLVED 2026-04-28** — fixed at source via `gh api -X PUT repos/CleanExpo/Synthex/vulnerability-alerts`. All future PRs auto-green on Dependency Review.
2. **SYN-573 actions** — Google Cloud Console (YouTube OAuth), demo account (HeyGen scope removed 2026-04-25 per CEO directive — see SYN-800)
3. **GCP project in `australia-southeast1`** — unblocks SYN-787 (NotebookLM) and SYN-788 (MCP BigQuery) spikes
4. **Supabase secrets for Score Accuracy Gate** — `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in repo Actions secrets. Without them the gate skips cleanly with a `::warning::` (SYN-783/784/785 fix); adding them flips it from "skipped" to "enforced"
5. **Fix Supabase Preview** — Supabase dashboard (wrong project ID `joiswghkfvfevbowtanp` linked)
6. **Apply SYN-725 migration** — `supabase/migrations/20260424000001_syn725_client_value_scorecard_view.sql` via Supabase CLI or MCP `apply_migration`
7. **Schedule pg_cron refresh for `client_value_scorecard`** — nightly `REFRESH MATERIALIZED VIEW CONCURRENTLY` (unique index already in place)
8. **Add `SLACK_CVML_WEBHOOK_URL` secret** to repo Actions — unblocks `.github/workflows/client-value-scorecard.yml` Monday 09:00 AEDT run
9. **Dry-run CVML scorecard workflow** via `workflow_dispatch` with `dry_run=true` before first live Monday post

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

## Stripe — N/A (internal SaaS)

Synthex is an internal Unite-Group SaaS. No external billing required. Prior Stripe scaffolding (account / pricing / webhook) is dormant — do not propose Stripe-related work without explicit CEO direction. _(Cleared 2026-04-28 per CEO directive.)_

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

## Current State (2026-04-28) — second-PC onboarding

This PC was synced after working on another machine. Local `main` was 241 commits behind `origin/main` and has been fast-forwarded to `eef77b59` (last shipped: SYN-806 ollama-provider test fix, 2026-04-27). `npm install` clean (2387 packages); `prisma validate` passes.

**Active themes since 2026-04-24:**

- **SYN-806** — _[EPIC] Senior-level AI Marketing Agency uplift_ (only In Progress on Linear, started 2026-04-26). CEO directive: design specialised skills + agents at 15+yr expert calibration. Includes CEO Foundation v1.0 ship in PR #104.
- **SYN-807** — Multi-model orchestration tier. Ollama local (Gemma) + DeepSeek V4 Flash/Pro via OpenRouter for cost-optimised hybrid. Phase 2 added the **boardroom** synthesis layer + `delegate.mjs` CLI (PR #103). Phase 1 added the Ollama provider + task-intent routing matrix (PR #102).
- **RA-1744** — Review Skills mandate added to CLAUDE.md (PR #105). Four-skill discipline: `design-pressure-test` · `parallel-delegate` · `opus-adversary` · `codex-adversarial`. `opus-adversary` is the pre-push gate. Skills live at `~/.claude/skills/` (user-level).
- **SYN-794 / SYN-795 / SYN-799 / SYN-779 / SYN-801** — ground-truth Lead model + capture/verify endpoints, real multi-touch attribution engine, per-IP + per-org rate-limit wrapper, public `/benchmark` page, `/benchmark` CTA → `/api/leads` signing shim.
- **SYN-793** — GA4Property model + property management API.
- **SYN-800** — HeyGen removed from Synthex per CEO directive 2026-04-25.
- **SYN-770 / SYN-774 / SYN-776 / SYN-777 / SYN-780** — governance + architecture specs (CVML Journey activation gate, Cross-Client Benchmark Intelligence IOR + compliance log entry, Sprint 9 industry benchmarks spec, Synthex Network Score spec).
- **SYN-725** — Postgres window-function correctness fix shipped (PR #100). Materialised view ready; pg_cron refresh + `SLACK_CVML_WEBHOOK_URL` still listed as Pending Human Actions.

**Other PR activity:** development-loop PRD + `Grill-Me` skill + handoff scaffolding (#89), `mutates_checkout` workflow concurrency, maintainer-review workflows.

**Open In Progress on Linear (2026-04-28):** SYN-806 (only one).

**Pending Human Actions still open** (carried from 2026-04-24 list, minus #1 GitHub Dependency Graph which was resolved at source 2026-04-28): SYN-573 YouTube OAuth + demo env; GCP project in `australia-southeast1` (unblocks SYN-787 NotebookLM + SYN-788 BigQuery MCP spikes); Supabase Score Accuracy secrets; Supabase Preview project relink; SYN-725 migration apply + pg_cron + Slack webhook.

**SYN-806 Phase 3 shipped (2026-04-28):** Senior calibration uplifts merged for marketing-operations-director (#114), performance-attribution-lead (#115), brand-strategist (#116), foundation-keeper (#117), paid-performance-marketer NEW slot 5 (#118), pr-communications-lead NEW slot 11 (#119), plus Phase 3 batch (customer-insights-lead + research-lead + local-seo-geo-veteran + client-retention + platform-content-adaptor + platform-content-optimiser) in PR #120. All skills now produce structured TS contracts consumable by senior-strategist / senior-cmo / brand-voice-enforce / foundation-keeper.

**External skill adoption (2026-04-28):** gstack (`garrytan/gstack`, 85k⭐) installed globally with `/qa` + `/cso` enabled only — see `CLAUDE.md` "External Skills — gstack (Selective)" section. All 21 other gstack commands disabled to avoid namespace collision with the 400+ existing skill catalog.

[28/04/2026] DECISION: Adopt gstack but gate to `/qa` + `/cso` only | REASON: 20 of 23 gstack commands duplicate Synthex's existing planning/design/CEO skill catalog; only Playwright real-browser QA and OWASP+STRIDE security audit are net-new value | ALTERNATIVES REJECTED: full install (namespace clutter, redundant overhead), skip entirely (loses two genuinely useful gates)

[28/04/2026] DECISION: "Karpathy stacks" interpreted as the philosophy already adopted in CLAUDE.md (think before coding · simplicity first · surgical changes · goal-driven execution) | REASON: Karpathy maintains zero TypeScript/Next.js stacks; his repos are educational ML (autoresearch, llm.c, llm-council, micrograd). The `Karpathy-Inspired Coding Guidelines` section in CLAUDE.md is the operative reference | ALTERNATIVES REJECTED: copying llm-council patterns (Synthex's SYN-807 boardroom is already the equivalent), copying autoresearch (no clear fit for marketing-automation pipeline)

[28/04/2026] DECISION: GitHub Dependency Review check fixed at source via vulnerability-alerts API enable (no longer in Pending Human Actions) | REASON: `gh api -X PUT repos/CleanExpo/Synthex/vulnerability-alerts` enables vulnerability alerts AND triggers Dependency Graph SBOM, which the Dependency Review workflow consumes. All future PRs auto-green | ALTERNATIVES REJECTED: leaving as a manual Phill action (forever-deferred), disabling the workflow (loses real security signal)

[28/04/2026] DECISION: Stripe scaffolding dormant — Synthex is internal Unite-Group SaaS, no external billing | REASON: CEO directive 2026-04-28 — internal application, no go-to-market commercial plan. Prior Stripe pricing tables / webhook config retained but flagged dormant in MEMORY.md | ALTERNATIVES REJECTED: removing Stripe code entirely (premature — may activate later), continuing to maintain Stripe migrations (waste of cycles)

[28/04/2026] DECISION: SYN-806 Phase 3 skill calibration adopts standardised v0.3 template (5 markers + 10 NEVER + TS output contract + worked example) | REASON: Phase 2 PRs revealed inconsistent senior-skill output shape — orchestrator could not reliably consume outputs cross-skill. v0.3 template enforces structured TS contract per skill so senior-strategist / senior-cmo / brand-voice-enforce / foundation-keeper can pipeline-route deterministically | ALTERNATIVES REJECTED: free-form prose outputs (orchestrator must re-parse each invocation), JSON-Schema-only contracts (loses worked-example evidence of senior judgment)

[01/05/2026] DECISION: RestoreAssist spine amended to "Australia's first Australian-designed full CRM — Office and Field Management System designed specifically for the Australian Restoration Industry" (supersedes 2026-04-26 field-only spine) | REASON: actual shipping product is office+field unified, not field-only; CEO confirmed in chat 2026-04-30; 4 RA launch posts (02/03/04/07) blocked on this for Monday 4 May Apple Store launch. Foundation patched at lines 198 + 200; AU+NZ market reach + WHS/IICRC/ABCC compliance differentiator + "remove double-handling" phrasing locked alongside | ALTERNATIVES REJECTED: keeping field-only spine (4 posts must be rewritten + product positioning lies), waiting for foundation-keeper formal amendment (Monday launch deadline)

[04/05/2026] DECISION (SYN-787, NotebookLM Enterprise spike — code-side first half): **DEFER** until CEO provisions an `australia-southeast1` GCP project | REASON: 4 of the 5 spike kill conditions cannot be evaluated without a live tenant: AU region availability, CMEK vs Supabase RLS conflict, retention/data-flow validation, and quality comparison against the existing pipeline. Evaluable from code: integration surface is small — `supabase/functions/generate-advisor-brief/index.ts` is a 77-line scheduling proxy that POSTs to `/api/internal/generate-advisor-brief`; NotebookLM would slot into the internal Node route, not the Edge Function. No new auth surface needed since both calls run server-side under existing Supabase service role. No Supabase RLS conflict at the application boundary — the conflict zone is whether NotebookLM's CMEK requirement coexists with Supabase's managed encryption (unknown without a live VPC-SC test). Tentative recommendation: adopt only if (a) AU region confirmed, (b) CMEK does not require Supabase decryption visibility, (c) NotebookLM grounding adds quality the current Claude-on-Supabase pipeline does not. Re-open spike with full 12h ceiling once CEO has provisioned the GCP project | ALTERNATIVES REJECTED: kill spike entirely (loses optionality on a real architectural gap — current Advisor Brief does not ingest client-uploaded DOCX/XLSX), proceed without provisioning (cannot answer 4 of 5 kill conditions, would produce a fabricated decision)

[04/05/2026] DECISION (SYN-788, BigQuery managed MCP spike — code-side first half): **DEFER** until CEO provisions a BigQuery managed MCP endpoint | REASON: 3 of the 4 hard reject conditions cannot be evaluated without provisioning: data residency on `australia-southeast1`, query latency vs Prisma-on-Supabase baseline, bundle-size impact of the managed MCP client. Evaluable from code: `app/api/ask-synthex/route.ts` is 595 lines and is the natural integration surface; `supabase/functions/client-context-query/index.ts` is 100 lines, a thin Edge Function. The Prisma-on-Supabase baseline is already AU-resident and passes Synthex's RLS contract; replacing it with managed MCP only makes sense if MCP latency is meaningfully lower OR if BigQuery analytics queries Synthex doesn't currently support become available. Synthex has no live MCP client (legacy Express archived 2026-03-22), so any adoption is greenfield. Tentative recommendation: defer — managed MCP is solving an integration problem Synthex doesn't have today (analytics already work via Prisma + materialised views). Re-open spike only if (a) BigQuery use case lands that Prisma cannot serve, (b) AU region confirmed, (c) bundle impact <2MB gzipped on the Ask Synthex route | ALTERNATIVES REJECTED: kill spike (loses BigQuery optionality), proceed without provisioning (cannot answer 3 of 4 reject conditions)

[21/05/2026] DECISION (SYN-968, M12 governed signal ledger): Start M12 with a pure service-layer governed signal contract under `lib/marketing-agency/intelligence/` before UI, database, or provider wiring | REASON: UNI-2046 Phase 1 semantic search and Health Loop are already merged; the next leverage is converting source data into evidence-backed Signal, Opportunity, Risk, ApprovalGate, and Outcome objects with deterministic scoring and draft-mode gates. This keeps policy out of UI/provider scripts and gives Apify/Google/social adapters a stable contract. | ALTERNATIVES REJECTED: UI-first Command Centre card (would show theatre before intelligence logic), direct Apify script repair first (would preserve loose provider-shaped output instead of governed ontology output), Prisma-first schema work (premature before service contract stabilises)

[22/05/2026] DECISION (SYN-968, M12 Slice 2): Map Apify creative/search records into governed signals before opportunity conversion, and keep `marketing-agency:apify-intel` stdout parseable as JSON | REASON: The live Apify path can return useful Google Search records while some social actors remain unavailable or schema-blocked; the system must preserve those partial live signals without treating provider output as strategy. Logs now stay off stdout, and output includes `governedSignals`, `rankedSignals`, and `opportunities` from the service-layer contract. | ALTERNATIVES REJECTED: wait for all social actors to be green before mapping signals (blocks useful Google evidence), put Apify-specific scoring in the script (keeps policy in provider code), ignore stdout cleanliness (breaks downstream agent/tool consumption)

[22/05/2026] DECISION (SYN-968, M12 Slice 3): Persist governed Marketing Agency signals, opportunities, and outcome events in organisation-scoped Prisma tables before UI exposure | REASON: Slice 1/2 proved the service contract and Apify adapter; Command Centre and Health Loop work now need durable ontology records that preserve source evidence, signal score, risk state, approval gate, and outcome-learning hooks across agent runs. The Apify command persists only when `MARKETING_AGENCY_SIGNAL_ORGANIZATION_ID` is configured, keeping provider execution JSON-only by default. | ALTERNATIVES REJECTED: UI-first display of transient JSON (no durable learning loop), direct provider-shaped database rows (policy leaks into adapters), unconditional Apify persistence (would write without an explicit org boundary)

[22/05/2026] DECISION (SYN-968, M12 Slice 4): Expose persisted governed opportunities through an authenticated Marketing Agency read API and dashboard panel before wiring Command Centre actions | REASON: Slice 3 created durable records, but the product still had no real consumer for the persisted opportunity ledger. A read-only, organisation-scoped endpoint plus passive dashboard panel makes the evidence/risk/approval state inspectable without introducing execution, provider calls, publishing, or ad-spend controls. | ALTERNATIVES REJECTED: direct UI queries against Prisma (skips route/auth contract), Command Centre action buttons first (would create execution surface before review visibility), static fixture display (would hide whether persistence is actually connected)

[22/05/2026] DECISION (SYN-968, M12 Slice 5): Feed Marketing Agency outcome events into the Command Centre Health Loop as optional learning signals | REASON: M12 needed outcome learning visible in the operational loop, but absence of campaign outcome events should not make core CI/Wiki/semantic pipelines red. The Health Loop now carries a passive, org-scoped Marketing Agency outcome snapshot beside required pipeline health. | ALTERNATIVES REJECTED: treating no campaign outcomes as red pipeline failure (penalizes new orgs), hiding outcomes only in the Marketing Agency page (misses Command Centre observability), adding execution controls before learning visibility

[22/05/2026] DECISION (SYN-968, M12 Slice 6): Add a passive Board/Margot/@team routing queue to the Command Centre before any execution controls | REASON: Draft command intake already exists, but operators still need to see how a packet moves through Board input, Margot pass, evidence/risk/approval gates, and @team routing. The panel consumes the existing in-memory draft packet and keeps provider execution, publishing, persistence, and spend blocked. | ALTERNATIVES REJECTED: persisting queue rows before a review contract stabilises (adds schema before product proof), adding action buttons first (creates execution surface before visibility), leaving route data only in the intake preview (hides the queue model from the Command Centre operating surface)

## Detailed Reference Files

- [agents-and-skills.md](agents-and-skills.md) — Full agent/skill inventory
- [linear-backlog.md](linear-backlog.md) — Current Linear issue snapshot
- [compass.md](compass.md) — Quick project orientation (3 rules, active issues, key paths)
- [ARCHITECTURE.md](ARCHITECTURE.md) — Full architectural patterns and layer rules
- [STANDARDS.md](STANDARDS.md) — Code conventions, API patterns, TypeScript standards
- [TESTING.md](TESTING.md) — Test patterns, verification rules, CEO directive
- [WORKFLOWS.md](WORKFLOWS.md) — Multi-agent rules, scope routing, session management
