# Synthex Project Memory

## Project Overview
- **Repo**: CleanExpo/Synthex on GitHub
- **Stack**: Next.js 15 (App Router), TypeScript 5, Prisma 6, PostgreSQL (Supabase), Vercel
- **Domain**: synthex.social
- **Local path varies by machine** — always use repo-relative paths

## Claude Code Tool Architecture (updated 2026-03-01)

### Project-level (`.claude/`) — Synthex-specific only
- **4 agents**: build-engineer, code-architect, qa-sentinel, senior-reviewer
- **21 skills**: api-testing, architecture-enforcer, auth-patterns, build-orchestrator, client-manager, client-retention, code-review, content-pipeline, database-prisma, design, imagen-designer, platform-showcase, project-scanner, route-auditor, scout, security-hardener, social-integrations, spec-generator, sql-hardener, ui-ux, video-engine
- **19 hooks**: PowerShell scripts for build validation, pre-commit checks
- **6 rules**: backend, database, development, frontend, operations, skills
- **Scratchpad**: `.claude/scratchpad/` — ephemeral session working space (date-prefix, 7-day cleanup)

### User-level (`~/.claude/`) — General-purpose, available across all projects
- **17 agents**: hive-mind, blog-researcher, blog-reviewer, blog-seo, blog-writer, content-creator, imagen-generator, marketing-automation, performance-optimizer, platform-specialist, research-analyst, search-engineer, seo-strategist, ux-researcher, video-director, visual-designer, visual-design-agent
- **34 skills**: blog suite (14), SEO (5+3 existing), video/visual (3), research (3), meta (5), visual-generator

## Linear Project
- **Workspace**: unite-hub
- **Project**: Synthex (ID: 3125c6e4-b729-48d4-a718-400a2b83ddc5)
- **Team**: Unite-Hub (key: UNI)
- **Status**: All backlog issues Done. 5 strategic issues (UNI-1180–1184) tracked separately.

## Current State (2026-03-03)
- **Branch**: main at `41413357`
- **DB**: 91 Prisma models, schema unchanged since v1.4
- **Test suite**: 62 suites, 1482 passing (25 pre-existing failures: BullMQ transform, Stripe mock, SubscriptionService)
- **Milestone**: v2.0 Reliable AI Agents — Phase 62 next; Phase 59 DONE (UNI-1237), Phase 60 DONE (UNI-1238), Phase 61 DONE
- **v1.5 shipped**: 2026-03-03 — all 7 phases done, 1482 tests passing
- **Deploy status**: Not yet public — synthex.social is live URL but in GOD MODE testing only. Stripe integration on hold. UNI-1202/UNI-1203 human-gated.
- **v2.0 dev infra complete**: CONSTITUTION.md, PreCompact + SessionStart + pre-agent-dispatch hooks, AGENT-REGISTRY.md, hive-mind.md orchestrator

### v1.5 Final (UNI-1226–1230 — all Done)
| ID | Title | Commit |
|---|---|---|
| UNI-1169 | Add 19 missing env vars to .env.example | `e785d9a` |
| UNI-1170 | Add admin role check to POST /api/system/models | `ba9f5ce` |
| UNI-1171 | Wire up referral invite email sending | `542f80b` |
| UNI-1172 | Implement SEO usage tracking | `ec4d45b` |
| UNI-1173 | Route error monitoring to Sentry | `4ea3f6a` |
| UNI-1174 | Create auth-patterns skill | `04a3492` |
| UNI-1175 | Create content-pipeline skill | `04a3492` |
| UNI-1176 | Create social-integrations skill | `04a3492` |
| UNI-1177 | Create scratchpad directory | `961543d` |
| UNI-1178 | Slim CLAUDE.md to routing table | `961543d` |
| UNI-1179 | Update MEMORY.md | this commit |

### Strategic Issues (future — human-gated)
| ID | Title | Status |
|---|---|---|
| UNI-1180 | Linear MCP hook configuration | Todo |
| UNI-1181 | Build autonomous headless task-runner | Todo |
| UNI-1182 | E2E verification on live Vercel | Todo (human) |
| UNI-1183 | Consolidate auth systems | Todo |
| UNI-1184 | CLAUDE.md session protocol | Todo |

## Key Architecture Patterns
- Auth: NextAuth.js v4 + JWT + Google/GitHub OAuth (see `auth-patterns` skill)
- AI: OpenRouter (primary), user BYOK API keys (see `content-pipeline` skill)
- Social: 9 platforms with OAuth + webhooks (see `social-integrations` skill)
- Multi-business: Organisation scoping via `lib/multi-business/`
- Encryption: API key encryption in `lib/encryption/`
- 91 Prisma models

## User Preferences
- Australian English spelling
- Concise, practical responses
- Simplest viable option first
- No US-centric examples
- Every code change traceable to a Linear issue
- Commit format: `UNI-XXXX: short description`

## Detailed Reference Files
- [agents-and-skills.md](agents-and-skills.md) — Full agent/skill inventory
- [linear-backlog.md](linear-backlog.md) — Linear issue snapshot
