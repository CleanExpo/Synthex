# Synthex Compass

**Project**: Synthex — AI marketing automation (synthex.social, not yet public)
**Stack**: Next.js 15, Supabase Auth ONLY, TypeScript 5, Prisma 6, Vercel
**Milestone**: v2.0 Reliable AI Agents (Phases 59-66)
**Current phase**: 62 — Multi-step Workflow Engine (UNI-TBD) | 3 plans planned (0/3 executed)

## 3 Architectural Rules
1. No mock data — every endpoint returns real database data
2. All mutations: Zod validation + org-scoped queries (never cross-org)
3. Auth: Supabase ONLY — never Clerk, NextAuth, or any other system

## Active Issues
- UNI-1237: Phase 59 Context Resilience Infrastructure (Done)
- UNI-1238: Phase 60 Agent Orchestration Hardening (Done)
- Phase 61: AI Session Memory & Persistence (Done — UNI-TBD)

## Key Paths
- Planning: .planning/STATE.md · ROADMAP.md · MILESTONES.md
- Hooks: .claude/hooks/*.ps1 (7 active: guard, pre-build, pre-write, post-write, post-research, pre-compact, session-start, pre-agent-dispatch)
- Memory: .claude/memory/MEMORY.md · compass.md
- Scratchpad: .claude/scratchpad/current-session.md
- Constitution: CONSTITUTION.md (re-read every session)
- Agent registry: .planning/AGENT-REGISTRY.md
- Orchestrator: .claude/agents/hive-mind.md
