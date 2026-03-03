# Synthex Compass

**Project**: Synthex — AI marketing automation (synthex.social, not yet public)
**Stack**: Next.js 15, Supabase Auth ONLY, TypeScript 5, Prisma 6, Vercel
**Milestone**: v2.0 Reliable AI Agents (Phases 59-66)
**Current phase**: 60 — Agent Orchestration Hardening (UNI-1238)

## 3 Architectural Rules
1. No mock data — every endpoint returns real database data
2. All mutations: Zod validation + org-scoped queries (never cross-org)
3. Auth: Supabase ONLY — never Clerk, NextAuth, or any other system

## Active Issues
- UNI-1237: Phase 59 Context Resilience Infrastructure (Done)
- UNI-1238: Phase 60 Agent Orchestration Hardening (In Progress)

## Key Paths
- Planning: .planning/STATE.md · ROADMAP.md · MILESTONES.md
- Hooks: .claude/hooks/*.ps1 (5 active + PreCompact + SessionStart)
- Memory: .claude/memory/MEMORY.md · compass.md
- Scratchpad: .claude/scratchpad/current-session.md
- Constitution: CONSTITUTION.md (re-read every session)
