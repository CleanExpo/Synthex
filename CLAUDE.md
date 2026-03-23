# SESSION PROTOCOL — READ FIRST, EVERY SESSION

## START OF SESSION

1. Read `CONSTITUTION.md` — immutable rules that override all other guidance
2. Check `.claude/scratchpad/current-session.md` — read it and resume interrupted work before starting anything new
3. Read `.claude/memory/MEMORY.md` — cross-session state and architectural decisions
4. Run Linear MCP: list top 5 issues with status "In Progress" for the Synthex project — these are your active priorities
5. Do not start new work until steps 1–4 are complete

## PRE-IMPLEMENTATION (before writing any code)

1. Find the feature/route in `.planning/ROUTE_REFERENCE.md` — confirm the exact file path, HTTP method, auth level, and Prisma models
2. Check "Known issues" for that route — don't re-fix something already fixed
3. If the route or page isn't in the reference, grep for it (`grep -r "routename" app/`) before assuming a path

## POST-IMPLEMENTATION (after code changes are verified)

1. Update `.planning/ROUTE_REFERENCE.md` → add to "Recent Changes" log and any "Known issues" found
2. Do NOT update the full route listing unless routes were added or renamed

## DURING SESSION

- Every 10 tool calls, write a brief progress note to `.claude/scratchpad/current-session.md`
- Format: `## [HH:MM] Progress\n- Done: ...\n- Next: ...\n- Issue: UNI-XXXX`
- If context window warning appears, write full state to scratchpad immediately before stopping

## END OF SESSION

- Update every Linear issue touched: add a comment with files changed and what was done, set status to Done if complete
- Clear `.claude/scratchpad/current-session.md` (empty the file, leave the file)
- Run `git status` — commit any uncommitted changes with issue identifier in message
- Never leave uncommitted changes

---

# HARD LIMITS (NON-NEGOTIABLE)

- **Never `git push`** without explicit human confirmation in chat
- **Never modify** `.env`, `.env.local`, or `.env.production` without explicit human confirmation
- **Never delete files** — move to `.claude/archived/YYYY-MM-DD/` instead
- **Never install npm packages** without stating: package name + reason + bundle size impact
- **Never skip pre-commit hooks** (`--no-verify`)
- **Never use Clerk, NextAuth, Auth.js, or any auth system other than Supabase** — this is absolute
- **All work must trace to a Linear issue (UNI-XXXX)** — no code changes without one

---

# PROJECT IDENTITY

**Synthex** — AI-powered marketing automation platform
Live at `synthex.social` · Repo: `CleanExpo/Synthex` · Local: `D:\Synthex`

**Stack:** Next.js 15 (App Router) · TypeScript 5 · Prisma 6 · PostgreSQL (Supabase) · Vercel · Node 22 · Windows 11

**Auth:** Supabase session → JWT → RBAC permissions → owner bypass
Auth code lives in `lib/auth/` — always check there first before touching anything auth-related.

---

# COMMANDS

```bash
npm run dev              # Dev server (Turbopack) — uses port 3000 by default
npm run build            # Production build (webpack)
npm test                 # Jest unit tests
npm run type-check       # tsc --noEmit
npm run lint             # ESLint
npm run release:check    # Full pre-release validation
npx prisma validate      # Validate schema (run before any db push)
npx prisma db push       # Push schema to DB
npm run routes:refresh   # Regenerate ROUTE_REFERENCE.md Zone 1 — run before any audit, run after adding/renaming routes
```

**Pre-PR gate (run all three):** `npm run type-check && npm run lint && npm test`

---

# KEY DIRECTORIES

| Path                           | Purpose                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `app/`                         | Pages + API routes (App Router)                                                                              |
| `lib/`                         | Services, utilities, integrations                                                                            |
| `components/`                  | React components (Radix UI + Tailwind)                                                                       |
| `lib/auth/`                    | Auth — check here first, always                                                                              |
| `prisma/schema.prisma`         | Prisma schema (source of truth)                                                                              |
| `.claude/skills/`              | Domain skills (invoke via Skill tool)                                                                        |
| `.claude/rules/`               | Context rule domains (auto-loaded by Claude)                                                                 |
| `.claude/memory/MEMORY.md`     | Cross-session project state + decisions                                                                      |
| `.claude/scratchpad/`          | Ephemeral working space                                                                                      |
| `.planning/STATE.md`           | Current phase + active priorities                                                                            |
| `.planning/ROADMAP.md`         | Full milestone roadmap                                                                                       |
| `.planning/ROUTE_REFERENCE.md` | **Read before any implementation** — all 498 API routes, 100 pages, auth levels, Prisma models, known issues |
| `.env.example`                 | Required env vars (source of truth for secrets)                                                              |

---

# ARCHITECTURE

**Auth:** `auth-patterns` skill — JWT, Supabase session, RBAC, owner bypass, PKCE
**AI/Content:** `content-pipeline` skill — model registry, provider abstraction, BYOK, scoring
**Social:** `social-integrations` skill — 9 platforms, OAuth, webhooks, token encryption
**API security:** `route-auditor` skill — Zod validation, org scoping, APISecurityChecker
**Database:** `database-prisma` skill — schema patterns, migrations, query conventions
**Security:** `security-hardener` skill — CSP, CORS, rate limiting, audit logging
**Deploy:** `build-orchestrator` skill — Vercel, crons, env management

**Layer rule (no skipping):** Pages → Components → Hooks → `lib/` services → Database

**Database safety:**

- Never drop columns, rename columns, or change column types without explicit human approval
- New columns must have defaults or be nullable (backward-compatible migrations only)
- All queries must be org-scoped — never expose cross-organisation data
- `npx prisma validate` must pass before any `db push`

---

# DATA FETCHING PATTERN

Three patterns — use the right one for the context:

| Context                                | Pattern                        | Package                       |
| -------------------------------------- | ------------------------------ | ----------------------------- |
| Hook in `hooks/`                       | `useApi()` / `useMutation()`   | `hooks/use-api.ts` (internal) |
| Standalone widget/component            | `useSWR(url, fetchJson, opts)` | `swr`                         |
| Server-side (API route, server action) | `fetch()` directly             | native                        |

**SWR rule:** Always use `credentials: 'include'` fetcher.
Reference implementation: `components/dashboard/GamificationWidget.tsx`

**Never:** raw `fetch()` inside `'use client'` components — use SWR instead
**Never:** add new custom fetch abstractions — use the three patterns above only

---

# CODE CONVENTIONS

- **Language:** Australian English — colour, organise, recognise, licence (noun), authorise
- **Currency:** AUD · **Dates:** DD/MM/YYYY
- **Files:** React `PascalCase.tsx` · Utils `kebab-case.ts` · Skills `SKILL.md`
- **Commits:** `type(scope): description` — e.g. `fix(api): resolve auth timeout`
- **API mutations:** Zod validation required on all POST/PUT/PATCH/DELETE routes

**Known Turbopack quirk:** `@heroicons/react` ESM build has missing files. The `resolveAlias` in `next.config.mjs` (turbopack section) fixes this — do not remove or modify those alias entries.

---

# VERIFICATION DISCIPLINE

**Banned phrases** — run the command and report actual output instead:

- "should work" · "probably passes" · "seems correct" · "likely fixed"

**Before any "Done" or completion claim:**

1. Run the relevant check (`npm run type-check`, `npm test`, `npm run lint`)
2. Read the full output
3. Report actual pass/fail count — no assumptions

---

# CONTEXT DRIFT PREVENTION

Context drift occurs when project rules are lost during automatic context compaction.

| Pillar             | Mechanism                               | File                                    |
| ------------------ | --------------------------------------- | --------------------------------------- |
| PreCompact hook    | Saves state + injects additionalContext | `.claude/hooks/pre-compact-context.py`  |
| Session scratchpad | Progress notes every 10 tool calls      | `.claude/scratchpad/current-session.md` |
| Memory file        | Cross-session project state             | `.claude/memory/MEMORY.md`              |

If you notice drift (wrong patterns, ignored rules): re-read `CONSTITUTION.md` and this file.

**Architectural Decisions:** Significant architectural choices are recorded in `.claude/memory/MEMORY.md`.
Format: `[DD/MM/YYYY] DECISION: X | REASON: Y | ALTERNATIVES REJECTED: Z`
Append entries — never delete existing ones.

---

# MULTI-AGENT WORK

See `CONSTITUTION.md` → "Agent Execution Rules" for the full authoritative ruleset.

**Quick reference:**

- Max 2 automatic retries per failing step → escalate to human
- Every subagent dispatch requires a Linear issue ID (UNI-XXXX)
- Parallelise independent subagents; sequential only when there is a true data dependency
- Phase 8 (production) always ends at a **human review gate** — never auto-merge PRs

**Scope routing:**

- Trivial (copy, config): direct execution → verify → commit
- Standard (new component, endpoint): plan → execute → verify → PR
- Complex (migration, new system): full multi-agent harness with extended discovery phase
