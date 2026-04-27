# Synthex Compass

**Project**: Synthex — AI marketing automation (synthex.social, invite-only)
**Stack**: Next.js 15, Supabase Auth ONLY, TypeScript 5, Prisma 6, Vercel
**Milestone**: v12.0 Autonomous Ranking Engine — Sprint code-complete, PR #18 pending merge
**Current state**: Branch `claude/infallible-pasteur` | All 7 sprint issues code-complete

## 3 Architectural Rules

1. No mock data — every endpoint returns real database data
2. All mutations: Zod validation + org-scoped queries (never cross-org)
3. Auth: Supabase ONLY — never Clerk, NextAuth, or any other system

## Active Issues (PR #18 sprint)

- SYN-593–599: Done ✅ (code-complete, pending merge)
- SYN-573: In Progress (human-gated: Google Cloud Console + demo account)

## Pending Human Actions

1. Merge PR #18 (all CI checks green)
2. Enable GitHub Dependency Graph (security_analysis settings)
3. Fix Supabase Preview integration (wrong project ID)
4. SYN-573: YouTube OAuth, demo account

## Key Paths

- Planning: `.planning/STATE.md` · `ROADMAP.md`
- Memory: `.claude/memory/MEMORY.md` · `ARCHITECTURE.md` · `STANDARDS.md` · `TESTING.md` · `WORKFLOWS.md`
- Scratchpad: `.claude/scratchpad/current-session.md`
- Constitution: `CONSTITUTION.md` (re-read every session)
- Routes: `.planning/ROUTE_REFERENCE.md` (read before any implementation)
- Hooks: `.claude/hooks/*.ps1` (7 active)
