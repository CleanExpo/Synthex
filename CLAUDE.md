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
| `prisma/` | Schema (68 models) + migrations |
| `.claude/skills/` | 18 domain skills (auto-triggered) |
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
- **DB**: `database-prisma` skill — 68 models, migrations, query patterns
- **Security**: `security-hardener` skill — CSP, CORS, rate limiting, audit logging
- **Deploy**: `build-orchestrator` skill — Vercel, crons, env management

## Memory

Read `.claude/memory/MEMORY.md` at session start. Update when priorities change.

## Conventions

- Commits: `<type>(<scope>): <description>` — e.g., `fix(api): resolve auth timeout`
- React: `PascalCase.tsx` | Utils: `kebab-case.ts` | Skills: `SKILL.md`
- Pre-PR: `npm run type-check && npm run lint && npm test`
