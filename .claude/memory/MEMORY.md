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

## Current State (2026-03-12 — v7.0 IN PROGRESS)
- **Branch**: main at `e7673a7e` (pushed to origin)
- **DB**: 91 Prisma models, schema unchanged since v1.4
- **Test suite**: 1514 passing, type-check 0 errors
- **Milestone**: v7.0 Production Hardening & Quality — Phases 108-113 (SYN-374)
- **Deploy status**: Codebase production-ready; public launch is human-gated
- **Previous milestones**: v1.0-v6.0 all SHIPPED (107 phases complete)

### v4.0 Phases (all Done)
| Phase | Focus | Linear |
|-------|-------|--------|
| 77 | Content Creation Flow | SYN-52 |
| 78 | Post Queue & Scheduling | SYN-53 |
| 79 | Admin Panel Completion | SYN-18 |
| 80 | Brand Profile Setup | SYN-54 |
| 81 | Social Account Onboarding | SYN-55 |
| 82 | Code Quality Hardening | SYN-57 |
| 83 | Accessibility Polish (WCAG 2.1 AA) | SYN-58 |
| 84 | Final UAT + Launch Readiness | SYN-60 |

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
- 91 Prisma models (+ 3 being added in Phase 62: WorkflowExecution, StepExecution, WorkflowTemplate)

## Minions-Inspired Architecture (Phase 62+)
Research synthesis: `.planning/research/stripe-minions-synthesis.md`
5 core principles applied to Synthex development:
1. Context > Model — assemble perfect context per step (context-builder.ts)
2. System runs the model — orchestrator.ts drives, LLM responds to step prompts only
3. One-shot over loops — single LLM call per step with rich context
4. Parallelise over iterate — Phase 63 adds N-execution parallelism via BullMQ
5. Walls before models — 2-retry cap, confidence gates, human approval for external actions
Phase 62 workflow path: lib/workflow/{orchestrator,step-executor,context-builder}.ts + step-types/
Blueprint library: AGENT-REGISTRY.md has 5 execution patterns (feature, bugfix, refactor, api-route, workflow-step)

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
