# CONSTITUTION.md — Synthex Project Rules (IMMUTABLE)
## Re-read at every session start. These rules override all other guidance.

### Identity
- Project: Synthex — AI-powered marketing automation platform
- URL: synthex.social (not yet public — GOD MODE testing only)
- Repo: CleanExpo/Synthex | Local: D:\Synthex
- Stack: Next.js 15 (App Router) | TypeScript 5 | Prisma 6 | PostgreSQL (Supabase) | Vercel | Node 22

### Auth — SUPABASE ONLY (non-negotiable)
- NEVER use Clerk, NextAuth, Auth.js, or any other auth system
- Auth lives in lib/auth/ — always check there first
- Flow: Supabase session → JWT → RBAC permissions → owner bypass

### Architectural Rules
1. No mock data — every endpoint returns real database data
2. All API mutations must have Zod validation
3. All queries must be org-scoped (never expose cross-organisation data)
4. No cross-layer imports — pages → components → hooks → lib services
5. No new npm packages without stating: package name + reason + bundle impact

### Database
- 91 Prisma models — schema at prisma/schema.prisma
- NEVER drop columns, rename columns, or change column types without explicit approval
- New columns must have defaults or be nullable (backward compatible migrations)
- Always run `npx prisma validate` before any schema push

### Code Standards
- Australian English: colour, organise, recognise, licence (noun), authorise
- Currency: AUD | Date format: DD/MM/YYYY
- Commits: `type(scope): description` — e.g. `fix(api): resolve auth timeout`
- React files: PascalCase.tsx | Utils: kebab-case.ts

### Linear Workflow
- All work traces to a Linear issue (UNI-XXXX) — no changes without an issue
- Current milestone: v2.0 Reliable AI Agents (Phases 59-66)
- Project ID: 3125c6e4-b729-48d4-a718-400a2b83ddc5

### Deployment Context
- Stripe integration: ON HOLD (GOD MODE testing — not yet public)
- UNI-1202 (Stripe Price IDs) and UNI-1203 (Encryption keys): human-gated
- Production deploy: synthex.social via Vercel (Vercel project: unite-group/synthex)

### Hard Limits
- Never `git push` without explicit human confirmation in chat
- Never modify .env, .env.local, .env.production without explicit confirmation
- Never delete files — move to .claude/archived/YYYY-MM-DD/ instead
- Never run `prisma migrate reset` (destructive)
- Never skip pre-commit hooks (--no-verify)
