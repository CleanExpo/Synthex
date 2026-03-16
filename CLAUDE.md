# SESSION PROTOCOL — READ FIRST, EVERY SESSION

## START OF SESSION
1. Check `.claude/scratchpad/current-session.md` — if it exists, read it and resume interrupted work before starting anything new
2. Run Linear MCP: list top 5 issues with status "In Progress" for the Synthex project — these are your active priorities
3. Check `.tasks/active/` for any active task files
4. Do not start new work until steps 1-3 are complete

## DURING SESSION
- Every 10 tool calls, write a brief progress note to `.claude/scratchpad/current-session.md`
- Format: `## [timestamp] Progress\n- What was just done\n- What's next\n- Current issue: UNI-XXXX`
- If context window warning appears, write full state to scratchpad immediately before stopping

## END OF SESSION
- Update every Linear issue touched: add a comment with files changed and what was done, set status to Done if complete
- Clear `.claude/scratchpad/current-session.md` (delete its contents, leave the file)
- Run `git status` — commit any uncommitted changes with issue identifier in message
- Never leave uncommitted changes

## TOOL CONSTRAINTS (NON-NEGOTIABLE)
- Never run `git push` without explicit human confirmation in the chat
- Never modify `.env`, `.env.local`, or `.env.production` without explicit human confirmation
- Never delete files — move to `.claude/archived/YYYY-MM-DD/` instead
- Never install new npm packages without stating the package name and reason first
- All work must be traceable to a Linear issue — no changes without an issue identifier

## PROJECT STANDARDS
- Australian English: colour, mould, organise, recognise, licence (noun)
- Currency: AUD
- Date format: DD/MM/YYYY
- Stack: Next.js 15, Supabase Auth (ONLY — no Clerk, no NextAuth), TypeScript, Tailwind, Radix UI, OpenRouter

## Data Fetching Pattern

Three patterns exist — use the right one for the context:

| Context | Pattern | Package |
|---------|---------|---------|
| Hook in `hooks/` | `useApi()` / `useMutation()` | `hooks/use-api.ts` (internal) |
| Standalone widget/component | `useSWR(url, fetchJson, opts)` | `swr` |
| Server-side (API route, server action) | `fetch()` directly | native |

**SWR rule:** Always use `credentials: 'include'` fetcher. Reference: `components/dashboard/GamificationWidget.tsx`

**Never add** new raw `fetch()` calls inside `'use client'` components — use SWR instead.
**Never add** new custom fetch abstractions — use the existing patterns above.

---

# Synthex

AI-powered marketing automation platform. Next.js 15 full-stack app deployed on Vercel.

## Stack

Next.js 15 (App Router) | TypeScript 5 | Prisma 6 | PostgreSQL (Supabase) | Vercel | Node 22 | Windows 11

## Commands

```bash
npm run dev              # Dev server (Turbo)
npm run build            # Production build
npm test                 # Jest unit tests
npm run type-check       # tsc --noEmit
npm run lint             # ESLint
npx prisma db push       # Push schema to DB
npm run release:check    # Full pre-release validation
```

## Key Directories

| Path | Purpose |
|------|---------|
| `app/` | Pages + API routes (App Router) |
| `lib/` | Services, utilities, integrations |
| `components/` | React components (Radix UI + Tailwind) |
| `prisma/` | Schema (91 models) + migrations |
| `.claude/skills/` | 21 domain skills (auto-triggered) |
| `.claude/rules/` | 6 context rule domains |
| `.claude/memory/` | Project state + cross-session context |
| `.claude/scratchpad/` | Ephemeral working space |
| `.planning/` | GSD roadmap + phase plans |
| `.env.example` | Required env vars (source of truth) |

## Architecture (Detail in Skills)

- **Auth**: `auth-patterns` skill — JWT, Supabase session, RBAC, owner bypass, PKCE
- **AI**: `content-pipeline` skill — Model registry, provider abstraction, BYOK, scoring
- **Social**: `social-integrations` skill — 9 platforms, OAuth, webhooks, token encryption
- **API**: `route-auditor` skill — APISecurityChecker, Zod validation, org scoping
- **DB**: `database-prisma` skill — 91 models, migrations, query patterns
- **Security**: `security-hardener` skill — CSP, CORS, rate limiting, audit logging
- **Deploy**: `build-orchestrator` skill — Vercel, crons, env management

## Memory

Read `.claude/memory/MEMORY.md` at session start. Update when priorities change.

## Conventions

- Commits: `<type>(<scope>): <description>` — e.g., `fix(api): resolve auth timeout`
- React: `PascalCase.tsx` | Utils: `kebab-case.ts` | Skills: `SKILL.md`
- Pre-PR: `npm run type-check && npm run lint && npm test`

---

## Context Drift Prevention

Context drift occurs when project rules are lost during automatic context compaction.
This project has a 3-pillar defence:

| Pillar | Mechanism | File |
|--------|-----------|------|
| PreCompact hook | Saves state + injects additionalContext guidance | `.claude/hooks/pre-compact-context.py` |
| Session scratchpad | Manual progress notes every 10 tool calls | `.claude/scratchpad/current-session.md` |
| Memory file | Cross-session project state | `.claude/memory/MEMORY.md` |

If you notice drift (wrong patterns, ignored rules), re-read this file and `.claude/memory/MEMORY.md`.

## Verification Discipline

**Banned phrases** — run the command instead of saying it:
- "should work" / "probably passes" / "seems correct" / "likely fixed"

**Before any "Done" or completion claim:**
1. Run the relevant check command (`npm run type-check`, `npm test`, `npm run lint`)
2. Read the full output
3. Report actual pass/fail count — no assumptions

## Architectural Decisions Log

All significant architectural choices are recorded at `.claude/memory/MEMORY.md`.
Format: `[DD/MM/YYYY] DECISION: X | REASON: Y | ALTERNATIVES REJECTED: Z`
Agents append entries — never delete existing ones.

## Multi-Agent Harness (Phase-Gated Work)

For complex features, use the 8-phase convergence loop:

| Phase | Owner | Purpose |
|-------|-------|---------|
| 1. Intake | orchestrator | Classify intent, scope, risk |
| 2. Discovery | product-strategist | Create PRD |
| 3. Decomposition | technical-architect + senior-engineer | Architecture delta + plan |
| 4. Execution | specialists | Parallel implementation (TDD enforced) |
| 5. Aggregation | orchestrator | Merge results, resolve conflicts |
| 6. Verification | verification + qa-validator | Code (PASS/FAIL) + acceptance (0-100) |
| 7. Iteration | orchestrator | Remediate failures (max 2 cycles) |
| 8. Production | delivery-manager | PR creation — human review gate |

**Scope routing:**
- Trivial (copy, config): Phases 4 → 6 → 8
- Standard (new component, endpoint): Full phases 1–8
- Complex (migration, new system): Full phases with extended Phase 2

**Escalation rule:** If Phase 7 exceeds 2 cycles, or any rubric scores below 50 — stop and escalate to the human.
Never merge PRs automatically — Phase 8 always ends at a human review gate.
