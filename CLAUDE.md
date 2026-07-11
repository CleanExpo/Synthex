@../Unite-Hub/.portfolio/PORTFOLIO.yaml

> **⚠ This file was reconstructed 2026-06-15.** The original `CLAUDE.md` was
> ~45% UTF-8-corrupted (4,555 U+FFFD replacement chars) from the _initial
> commit_ — a Windows generation tool wrote it with a broken encoding and the
> original text was overwritten, unrecoverable from git. This is a faithful
> reconstruction from the surviving clean fragments + the (clean) `CONSTITUTION.md`
>
> - `.claude/rules` + the portfolio registry. **`CONSTITUTION.md` remains the
>   immutable source of truth — it overrides this file where they differ.**

## Identity (SSOT)

**Canonical name:** Synthex · **Aliases:** "Marketing Made Easy", "Synthex Marketing"
**GitHub:** `CleanExpo/Synthex` · **Canonical dev path:** `D:\Synthex`
**Stack:** Next.js 16 (App Router) · React 19 · TypeScript 5 · Prisma 6 · PostgreSQL (Supabase) · Vercel · Node 22
**Live:** synthex.social — **internal application** (Unite Group in-house tool, not a public SaaS). Billing/Stripe health, "going public", and launch-readiness are out of scope — never raise them as blockers or next steps.

> Registry: see `D:\Unite-Hub\.portfolio\PORTFOLIO.yaml` (single source of truth)

---

# BUILD METHOD — THE FABEL SYSTEM (read before non-trivial work)

Synthex is built by the **Fabel method** (from `CleanExpo/Fabel-Prompt-Engineer`):
the advanced result, without the bloat. Three always-on artifacts:

- **`.claude/FABEL_PLAYBOOK.md`** — the 10 Fable-5 operating directives (act when
  you have enough info, ground every progress claim against a tool result,
  parallel disjoint-lane subagents, terse-but-re-grounding summaries…). Inject /
  follow it.
- **`.claude/rules/fabel-evidence-standard.md`** — always-on. Every claim and
  every subagent report carries one tag: `[VERIFIED]` / `[INFERENCE]` /
  `[UNCONFIRMED]`. Untagged = defect. A subagent's "all green" is `[UNCONFIRMED]`
  until the orchestrator re-runs the gauntlet.
- **`.claude/skills/fable-engine/`** — spec-first: lock the finish line, research
  the channels, emit an evidence-tagged build-ready spec → human gate, before any
  code. Use for features / waves / risky refactors.

---

# SESSION PROTOCOL — READ FIRST, EVERY SESSION

**Start of session**

1. Read `CONSTITUTION.md` — immutable project rules; they override all other guidance.
2. Before touching any route/page file: check `.planning/ROUTE_REFERENCE.md` for the
   exact path, auth level, and canonical `lib/auth/` function.
3. For feature / refactor / production-readiness work, apply the Close-the-Loop
   protocol (`UNI-2046`): no non-trivial task is done until it is captured,
   grounded, integrated, verified, registered, observed, and closed back to
   Linear/Wiki — or explicitly blocked with the next action.
4. On drift or compaction, save state to `.claude/scratchpad/` immediately.

**Fresh worktree setup (SYN-1070)**

A brand-new git worktree has no `node_modules/` and no `.env.local`, so
`npm run dev` and the startup env-validator can't run. In any new worktree run:

```bash
bash scripts/worktree-bootstrap.sh
```

It's idempotent. Notes: package manager is **npm, never pnpm**; the dev server
serves **http://localhost:3008**; `.env.local` is **symlinked** from the main
repo (resolved dynamically) — never copied, never committed.

**End of session**

- Update memory/scratchpad with what changed and why.
- Commit with the issue identifier. **Never leave uncommitted changes.**

---

# ARCHITECTURE

> Full guide: [`docs/architecture/README.md`](docs/architecture/README.md) · Refactor phases: [`docs/architecture/REFACTOR-ROADMAP.md`](docs/architecture/REFACTOR-ROADMAP.md)

```
Pages:    app/ → Components → Hooks → lib/ services
API:      app/api/ → lib/ services → Prisma → Supabase PostgreSQL
Database: Prisma schema → migrations → Supabase
```

**Rule:** no cross-layer imports — each layer imports only from the one below.

**Auth — Supabase ONLY (non-negotiable):** never Clerk/NextAuth/Auth.js. Auth
lives in `lib/auth/` — always check there first. Flow: Supabase session → JWT →
RBAC permissions → owner bypass. All queries org-scoped via
`getEffectiveOrganizationId(userId)` — never expose cross-organisation data.

---

# SKILL AUTO-SELECTION (ALWAYS-ON)

Before a non-trivial task, match it to an installed skill in `.claude/skills/`
and follow its `SKILL.md` rather than improvising.

| Task                                | Skill(s)                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------ |
| New feature / wave / risky refactor | `fable-engine` (spec-first)                                              |
| API route / endpoint                | `api-testing`, `architecture-enforcer`, `auth-patterns`                  |
| Database / Prisma                   | `database-prisma`, `sql-hardener`                                        |
| UI component / page                 | `ui-ux`, `ui-review`                                                     |
| Deploy / build                      | `build-orchestrator`                                                     |
| Multi-persona critique              | `boardroom` / `ask-the-board` (a lens, never fact; feeds the human gate) |

---

# COMMANDS

```bash
npm run type-check       # tsc --noEmit
npm run lint             # ESLint (--max-warnings 0)
npm test                 # Jest (jest.worktree.cjs — real per-path coverage floors)
npm run build:vercel     # production build (migrate-on-deploy + drift gate + next build)
npx prisma validate      # before any schema change
```

Run `npm run type-check && npm run lint && npm test` before any PR.

---

# DATA FETCHING

| Layer            | Pattern                      | Lib                |
| ---------------- | ---------------------------- | ------------------ |
| Hook in `hooks/` | `useApi()` / `useMutation()` | `hooks/use-api.ts` |
| Component        | `useApiSWR(key, opts)`       | `swr`              |
| Server-side      | `fetch()` directly           | native             |

SWR/`use-api` keys must be **org-scoped** so a brand switch never serves another
brand's data (SYN-908). Server-side caches must also key by `effectiveOrgId`, not
`userId` alone, and invalidate on write.

---

# CODE CONVENTIONS

- **Australian English** in product copy: colour, organise, recognise, licence
  (noun), authorise. Currency **AUD**. Dates **DD/MM/YYYY**.
- React files `PascalCase.tsx` · utils `kebab-case.ts` · skills `SCREAMING-KEBAB.md`.
- Commits: `type(scope): description` — e.g. `fix(api): resolve auth timeout`.
- **Zod validation required** on all POST/PUT/PATCH/DELETE routes (use
  `lib/api/define-route.ts` for the typed contract). Error shape `{ error, details? }`.
- No new npm packages without stating: name + reason + bundle impact.
- No mock/stub data in product surfaces — every endpoint returns real DB data.

**Database:** never drop/rename/type-change a column without explicit approval;
new columns nullable or defaulted (backward-compatible). Apply migrations out of
band via Supabase `apply_migration` — **never `prisma db push`** (would drop
legacy auth.users-FK tables).

---

# VERIFICATION DISCIPLINE

**Banned phrases:** "should work" · "probably passes" · "seems correct" · "likely fixed".
Before any "done" claim: run the command, paste the actual output, report the real
pass/fail count. (Reinforced by `.claude/rules/verification-gate.md` +
`.claude/rules/fabel-evidence-standard.md`.)

→ Full CEO directive + curl examples: `CONSTITUTION.md` § Verification Non-Negotiables.

---

# CONTEXT DRIFT PREVENTION

- PreCompact hook saves state + injects context (`.claude/hooks/`).
- Memory: one lesson per file, summary on top, corrections AND confirmed
  approaches, no duplicates, delete what's wrong.
- Decision log format: `[DD/MM/YYYY] DECISION: X | REASON: Y | ALTERNATIVES REJECTED: Z`.
- If you notice drift (wrong pattern, wrong path), STOP and re-read `CONSTITUTION.md`.

---

# MULTI-AGENT WORK

- Parallel **disjoint-lane** subagents in isolated worktrees; the orchestrator
  integrates and **re-runs the gauntlet** (build + coverage) before merge — a
  subagent's "green" is `[UNCONFIRMED]` until re-verified.
- Production deploy is a **human gate** — never auto-merge to prod without the
  founder's authorisation (the irreversible decision is theirs).
- Sequential only for true data dependencies; otherwise parallel.

---

# WORKING STYLE (Karpathy-inspired)

**Simplicity first — minimum code that solves the problem, nothing speculative.**

- No features beyond what was asked. No abstractions for single-use code. No
  "flexibility"/"configurability" that wasn't requested.
- **No unrequested tidying** — don't "improve" adjacent code, comments, or
  formatting outside the task.
- Match the surrounding code's idiom, naming, and comment density.

---

# CONTINUAL LEARNING

The repo emits signal to `.harness/learning/` (schema + consumers per RA-1745):
advisories, user corrections, security/lint flags. Capture lessons there and in
the project memory — don't stop mid-task to reason about meta-rules.
