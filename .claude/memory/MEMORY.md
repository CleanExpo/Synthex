# Synthex Project Memory

## Project Overview
- **Repo**: CleanExpo/Synthex on GitHub
- **Stack**: Next.js 15 (App Router), TypeScript 5, Prisma 6, PostgreSQL (Supabase), Vercel
- **Domain**: synthex.social
- **Local path varies by machine** — always use repo-relative paths

## Agent Ecosystem
- **16 agents** in `.claude/agents/` — see [agents-and-skills.md](agents-and-skills.md)
- **31 skills** in `.claude/skills/`
- **Hive-mind** is the master orchestrator — delegates to specialists, enforces quality gates

## Linear Project
- **Workspace**: unite-hub
- **Project**: Synthex (ID: 3125c6e4-b729-48d4-a718-400a2b83ddc5)
- **Team**: Unite-Hub (key: UNI)
- **Status**: In Progress, 85% complete, target date 2026-03-31

## Current State (2026-02-28)
- **Branch**: main at ea4b294
- **Stash**: UX-Update branch work stashed on Windows PC
- 8 In Progress issues, 48 Todo issues in Linear backlog
- Key urgents: Billing (UNI-885), Auth/OAuth (UNI-915), Env vars (UNI-846), Production readiness (UNI-1145)

## Key Architecture Patterns
- Auth: NextAuth.js v4 + JWT + Google/GitHub OAuth
- AI: OpenRouter (primary), user BYOK API keys, model registry in `lib/ai/model-registry.ts`
- Multi-business: Organization scoping via `lib/multi-business/`
- Encryption: API key encryption in `lib/encryption/`
- 9 platforms: YouTube, Instagram, TikTok, X, Facebook, LinkedIn, Pinterest, Reddit, Threads
- 67 Prisma models

## Workstream Plan
1. **Billing** (4 issues) — build-engineer + code-architect
2. **Auth/Security** (~25 issues) — hive-mind team
3. **Features/UI** (9 issues) — hive-mind team
4. **SEO/Video** (10 issues) — seo-strategist team

## User Preferences
- Australian English spelling
- Concise, practical responses
- Simplest viable option first
- No US-centric examples

## Detailed Reference Files
- [agents-and-skills.md](agents-and-skills.md) — Full agent/skill inventory
- [linear-backlog.md](linear-backlog.md) — Current Linear issue snapshot
