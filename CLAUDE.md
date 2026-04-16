# SESSION PROTOCOL — READ FIRST, EVERY SESSION

## START OF SESSION

1. Read `CONSTITUTION.md` — immutable rules that override all other guidance
2. Check `.claude/scratchpad/current-session.md` — resume interrupted work before starting
3. Read `.claude/memory/MEMORY.md` — cross-session state and architectural decisions
4. Run Linear MCP: list top 5 "In Progress" issues for Synthex — active priorities
5. Do not start new work until steps 1–4 are complete

## PRE-IMPLEMENTATION

1. Find the route in `.planning/ROUTE_REFERENCE.md` — confirm path, HTTP method, auth level, Prisma models
2. Check "Known issues" for that route
3. If not in the reference, `grep -r "routename" app/` before assuming a path

## POST-IMPLEMENTATION

1. Update `.planning/ROUTE_REFERENCE.md` → "Recent Changes" log and any "Known issues" found
2. Do NOT update the full route listing unless routes were added or renamed

## DURING SESSION

- Every 10 tool calls: write progress to `.claude/scratchpad/current-session.md`
- Format: `## [HH:MM] Progress\n- Done: ...\n- Next: ...\n- Issue: SYN-XXXX`
- Context window warning: write full state to scratchpad immediately

## END OF SESSION

- Update every Linear issue touched — add comment with files changed + status
- Clear `.claude/scratchpad/current-session.md` (empty file, keep file)
- Run `git status` — commit any uncommitted changes with issue identifier
- Never leave uncommitted changes

---

# SKILL AUTO-SELECTION (ALWAYS-ON)

**Before responding to any non-trivial task:** identify and invoke applicable skills using the Skill tool.
- If a matching skill exists → invoke it before starting work
- If no matching skill exists for a specialised task → generate one using `/skill-auto` then invoke it
- Use `/skill-auto [task description]` to auto-match skills when unsure

**Quick reference — Synthex domain skills:**

| Task type              | Skill(s) to invoke                              |
| ---------------------- | ----------------------------------------------- |
| API route / endpoint   | `route-auditor`, `api-testing`                  |
| Auth / RBAC            | `auth-patterns`                                 |
| Database / Prisma      | `database-prisma`, `sql-hardener`               |
| UI component / page    | `ui-ux`, `ui-review`                            |
| Deploy / build         | `build-orchestrator`                            |
| Browser verification   | `browser-verify`, `browser-debug`               |
| Post-deploy health     | `site-smoke-test`, `browser-auth`               |
| Code review            | `code-review`, `security-hardener`              |
| Content / social       | `content-pipeline`                              |
| Security audit         | `security-hardener`, `route-auditor`            |

---

# HARD LIMITS (NON-NEGOTIABLE)

- **Never `git push`** without explicit human confirmation in chat
- **Never modify** `.env`, `.env.local`, or `.env.production` without explicit human confirmation
- **Never delete files** — move to `.claude/archived/YYYY-MM-DD/` instead
- **Never install npm packages** without stating: package name + reason + bundle size impact
- **Never skip pre-commit hooks** (`--no-verify`)
- **Never use Clerk, NextAuth, Auth.js, or any auth system other than Supabase** — absolute
- **All work must trace to a Linear issue (SYN-XXXX)** — no code changes without one

---

# PROJECT IDENTITY

**Synthex** — AI-powered marketing automation platform
Live at `synthex.social` · Repo: `CleanExpo/Synthex` · Local: `D:\Synthex`

**Stack:** Next.js 15 (App Router) · TypeScript 5 · Prisma 6 · PostgreSQL (Supabase) · Vercel · Node 22 · Windows 11

**Auth:** Supabase session → JWT → RBAC permissions → owner bypass
Auth code lives in `lib/auth/` — always check there first.

---

# COMMANDS

```bash
npm run dev              # Dev server (Turbopack) — port 3000
npm run build            # Production build (webpack)
npm test                 # Jest unit tests
npm run type-check       # tsc --noEmit
npm run lint             # ESLint
npm run release:check    # Full pre-release validation
npx prisma validate      # Validate schema (run before any db push)
npx prisma db push       # Push schema to DB
npm run routes:refresh   # Regenerate ROUTE_REFERENCE.md — run after adding/renaming routes
```

**Pre-PR gate:** `npm run type-check && npm run lint && npm test`

---

# KEY DIRECTORIES

| Path                           | Purpose                                                                      |
| ------------------------------ | ---------------------------------------------------------------------------- |
| `app/`                         | Pages + API routes (App Router)                                              |
| `lib/`                         | Services, utilities, integrations                                            |
| `lib/auth/`                    | Auth — check here first, always                                              |
| `prisma/schema.prisma`         | Prisma schema (source of truth)                                              |
| `.claude/memory/`              | MEMORY.md · ARCHITECTURE.md · STANDARDS.md · TESTING.md · WORKFLOWS.md      |
| `.claude/skills/`              | Domain skills (invoke via Skill tool)                                        |
| `.planning/ROUTE_REFERENCE.md` | **Read before any implementation** — all routes, auth levels, Prisma models  |
| `.env.example`                 | Required env vars (source of truth for secrets)                              |

---

# ARCHITECTURE

→ Full detail: `.claude/memory/ARCHITECTURE.md`

**Layer rule (no skipping):** Pages → Components → Hooks → `lib/` services → Database

Key skills: `auth-patterns` · `content-pipeline` · `social-integrations` · `route-auditor` · `build-orchestrator`

---

# DATA FETCHING

| Context                     | Pattern                        | Package               |
| --------------------------- | ------------------------------ | --------------------- |
| Hook in `hooks/`            | `useApi()` / `useMutation()`   | `hooks/use-api.ts`    |
| Standalone widget/component | `useSWR(url, fetchJson, opts)` | `swr`                 |
| Server-side                 | `fetch()` directly             | native                |

**SWR rule:** always `credentials: 'include'` — never raw `fetch()` in `'use client'` components.

---

# CODE CONVENTIONS

→ Full detail: `.claude/memory/STANDARDS.md`

- Australian English: colour, organise, recognise, licence (noun), authorise
- Files: React `PascalCase.tsx` · Utils `kebab-case.ts` · Skills `SKILL.md`
- Commits: `type(scope): description` — e.g. `fix(api): resolve auth timeout`
- API mutations: Zod validation required on all POST/PUT/PATCH/DELETE routes

---

# VERIFICATION DISCIPLINE

**Banned phrases:** "should work" · "probably passes" · "seems correct" · "likely fixed"

Before any "done" claim: run the command, paste the actual output, report real pass/fail count.

→ Full CEO directive + curl examples: `CONSTITUTION.md` § Verification Non-Negotiables | `.claude/memory/TESTING.md`

---

# CONTEXT DRIFT PREVENTION

| Pillar             | Mechanism                          | File                                    |
| ------------------ | ---------------------------------- | --------------------------------------- |
| PreCompact hook    | Saves state + injects context      | `.claude/hooks/pre-compact-save.ps1`    |
| Session scratchpad | Progress notes every 10 tool calls | `.claude/scratchpad/current-session.md` |
| Memory file        | Cross-session project state        | `.claude/memory/MEMORY.md`             |

If you notice drift (wrong patterns, ignored rules): re-read `CONSTITUTION.md` and this file.

**Architectural decisions** → append to `.claude/memory/MEMORY.md`
Format: `[DD/MM/YYYY] DECISION: X | REASON: Y | ALTERNATIVES REJECTED: Z`

---

# MULTI-AGENT WORK

→ Full ruleset: `CONSTITUTION.md` § Agent Execution Rules | `.claude/memory/WORKFLOWS.md`

- Max 2 automatic retries per failing step → escalate to human
- Every subagent dispatch requires a Linear issue ID (SYN-XXXX)
- Parallelise independent subagents; sequential only for true data dependencies
- Phase 8 (production) always ends at a **human review gate** — never auto-merge PRs

---

## Karpathy-Inspired Coding Guidelines

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
