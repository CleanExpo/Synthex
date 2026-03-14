# Synthex Compass

**Project**: Synthex — AI marketing automation (synthex.social, not yet public)
**Stack**: Next.js 15, Supabase Auth ONLY, TypeScript 5, Prisma 6, Vercel
**Milestone**: v9.0 Autonomous Operation (Phases 118+) — PLANNING
**Current phase**: None — All 117 phases shipped, next milestone needed

## 3 Architectural Rules
1. No mock data — every endpoint returns real database data
2. All mutations: Zod validation + org-scoped queries (never cross-org)
3. Auth: Supabase ONLY — never Clerk, NextAuth, or any other system

## Active Issues
- UNI-1180: Linear MCP hook configuration (Todo)
- UNI-1181: Build autonomous headless task-runner (Todo)
- UNI-1182: E2E verification on live Vercel (Todo, human)
- SYN-378: Vault System — Centralised Secrets Management (Done 2026-03-15)

## Autonomy Foundation (shipped 2026-03-15)
- Vault: 30 AI keys seeded across 10 businesses (AES-256-GCM, org-scoped)
- Workflow Engine: lib/workflow/ (orchestrator, step-executor, context-builder)
- Credential-inject step type: vault → workflow context (no leakage to AI prompts)
- Parallel Agents (Phase 63), Quality Gates (Phase 64), Campaign Intelligence (Phase 65), Autonomous Agent (Phase 66) — all shipped

## Key Paths
- Planning: .planning/STATE.md · ROADMAP.md · MILESTONES.md
- Hooks: .claude/hooks/*.ps1 (7 active: guard, pre-build, pre-write, post-write, post-research, pre-compact, session-start, pre-agent-dispatch)
- Memory: .claude/memory/MEMORY.md · compass.md
- Scratchpad: .claude/scratchpad/current-session.md
- Constitution: CONSTITUTION.md (re-read every session)
- Agent registry: .planning/AGENT-REGISTRY.md
- Orchestrator: .claude/agents/hive-mind.md
