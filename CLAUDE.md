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
