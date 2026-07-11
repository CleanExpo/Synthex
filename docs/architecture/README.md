# Synthex Architecture

> Canonical reference for folder layout, layer rules, and engineering conventions.
> Last updated: 11/07/2026

For route-level auth and API inventory, see [`.planning/ROUTE_REFERENCE.md`](../../.planning/ROUTE_REFERENCE.md).
For immutable project rules, see [`docs/governance/CONSTITUTION.md`](../docs/governance/CONSTITUTION.md).

---

## Layer model (non-negotiable)

```
app/ (pages & API routes)
  → components/
    → hooks/
      → lib/ (services, auth, integrations)
        → prisma/ (schema + migrations)
          → PostgreSQL (Supabase)
```

Each layer imports only from the layer directly below it. API route handlers orchestrate; business logic lives in `lib/`.

| Layer         | Responsibility                                         | Must not                                     |
| ------------- | ------------------------------------------------------ | -------------------------------------------- |
| `app/`        | Routing, layouts, thin page shells, API route handlers | Import Prisma directly; embed business logic |
| `components/` | UI composition, client/server components               | Call Prisma or raw `fetch` for mutations     |
| `hooks/`      | Client data fetching (`useApi`, SWR), UI state         | Import from `app/api` handlers               |
| `lib/`        | Services, auth, integrations, domain logic             | Import from `components/` or `app/`          |
| `prisma/`     | Schema, migrations, seeds                              | Contain application business rules           |

---

## Root directory policy

The repository root should contain **only** files required by tooling, deployment, or onboarding.

### Allowed at root

| Category                | Examples                                                                         |
| ----------------------- | -------------------------------------------------------------------------------- |
| App framework           | `next.config.mjs`, `proxy.ts`, `instrumentation.ts`, `next-env.d.ts`             |
| TypeScript / lint       | `tsconfig.json`, `eslint.config.js`, `postcss.config.cjs`, `tailwind.config.cjs` |
| Package manager         | `package.json`, `package-lock.json`, `.npmrc`, `.nvmrc`, `.node-version`         |
| Testing (entry configs) | `config/jest/*.cjs`, `playwright.config.ts`                                      |
| Deployment              | `vercel.json`, `prisma.config.ts`                                                |
| Governance              | `README.md`, symlinks to `docs/governance/` (`CLAUDE.md`, `CONSTITUTION.md`)     |
| Environment template    | `.env.example`                                                                   |

### Belongs elsewhere

| Item                           | Target location                                   |
| ------------------------------ | ------------------------------------------------- |
| Product specs & PRDs           | `docs/planning/`                                  |
| SQL snapshots & legacy schemas | `supabase/archive/`                               |
| Runtime JSON config            | `config/`                                         |
| One-off scripts                | `scripts/`                                        |
| Storybook build output         | `storybook-static/` (gitignored, never committed) |
| Legacy ad-hoc test scripts     | Removed — use `npm test` / `npm run e2e`          |

---

## Directory map

```
Synthex/
├── app/                    # Next.js App Router — pages, layouts, API routes
│   ├── (marketing)/        # Public marketing surfaces
│   ├── dashboard/          # Authenticated product UI
│   └── api/                # REST API (532 routes) — Zod + auth on every mutation
├── components/             # React UI — feature folders + components/ui (shadcn)
├── hooks/                  # Client hooks — useApi, SWR keys, UI state
├── lib/                    # Server-side domain logic
│   ├── auth/               # Supabase session, JWT, RBAC (single auth source)
│   ├── api/                # define-route, shared API utilities
│   ├── db/                 # Database access barrel (re-exports @/lib/prisma)
│   ├── services/           # Application services (content, clients, AI studio)
│   ├── prisma.ts           # Prisma singleton — ONLY place PrismaClient is created
│   └── …                   # Domain modules (social/, ai/, stripe/, …)
├── prisma/
│   ├── schema.prisma       # Source of truth for data models
│   ├── migrations/         # Versioned SQL migrations (never db push in prod)
│   └── seed*.ts            # Seed scripts (see prisma/README.md)
├── config/                 # Static JSON/JS runtime configuration
│   └── jest/               # Jest profiles (unit, worktree, integration)
├── types/                  # Shared TypeScript types (no runtime code)
├── public/                 # Static assets served by Next.js
├── scripts/                # CLI, CI, migration helpers (not imported by app)
├── tests/                  # Integration & E2E tests
├── __tests__/              # Jest unit tests (mirrors lib/ layout)
├── docs/                   # Human documentation (incl. docs/governance/)
├── .planning/              # Route reference, roadmaps, phase plans
└── .claude/                # Agent skills, hooks, memory (not product runtime)
```

---

## API route pattern

All mutations use Zod validation and org-scoped queries.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/get-user';
import { prisma } from '@/lib/prisma';

const BodySchema = z.object({ name: z.string().min(1) });

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const result = await prisma.example.create({
    data: { ...parsed.data, organizationId: user.orgId },
  });

  return NextResponse.json(result, { status: 201 });
}
```

Error shape: `{ error: string, details?: unknown }` for 4xx; `{ error: string, message?: string }` for 5xx.

Prefer `lib/api/define-route.ts` for new routes with typed contracts.

---

## Database (Prisma)

| Rule             | Detail                                                                                         |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| Client singleton | Import `{ prisma }` from `@/lib/prisma` (or `@/lib/db`) — never `new PrismaClient()` elsewhere |
| Migrations       | `prisma migrate dev` locally; `prisma migrate deploy` in CI/production                         |
| Never            | `prisma db push` against production (drops legacy auth FK tables)                              |
| Org scope        | Every query must filter by `organizationId` / `getEffectiveOrganizationId()`                   |
| Schema changes   | New columns nullable or defaulted; no drop/rename without explicit approval                    |

Connection pooling: Supabase Supavisor (port 6543) via `@prisma/adapter-pg`. See `lib/prisma.ts`.

---

## Auth

**Supabase only** — no Clerk, NextAuth, or Auth.js.

```
Browser → Supabase session cookie → getAuthenticatedUser() → JWT + RBAC → handler
```

- Edge gating: `proxy.ts` (Next.js 16 — replaces legacy `middleware.ts`)
- API auth: `lib/auth/get-user.ts`, `lib/auth/jwt-utils.ts`
- Admin: `verifyAdmin` / `isOwnerEmail()`

---

## Data fetching (client)

| Context    | Pattern                                              |
| ---------- | ---------------------------------------------------- |
| Hooks      | `useApi()` / `useMutation()` from `hooks/use-api.ts` |
| Components | `useSWR` with org-scoped keys                        |
| Server     | Direct `fetch()` or lib service calls                |

SWR keys must be org-scoped so brand switches never leak data (SYN-908).

---

## Configuration

| File                                 | Purpose                                   |
| ------------------------------------ | ----------------------------------------- |
| `config/platform-master-config.json` | Platform algorithm weights, content specs |
| `config/openrouter_settings.json`    | OpenRouter model settings                 |
| `config/pricing_config.json`         | Plan pricing                              |
| `.env.example`                       | Environment variable catalogue            |
| `vercel.json`                        | Cron schedules, headers, deployment       |

---

## Testing

| Command                    | Scope                                                     |
| -------------------------- | --------------------------------------------------------- |
| `npm test`                 | Jest unit tests (`config/jest/jest.worktree.cjs`)         |
| `npm run test:integration` | API integration tests                                     |
| `npm run e2e`              | Playwright (`tests/e2e/`, config: `playwright.config.ts`) |
| `npm run type-check`       | TypeScript strict check                                   |
| `npm run lint`             | ESLint (zero warnings)                                    |

Pre-PR gate: `npm run type-check && npm run lint && npm test`

---

## Refactor backlog (phased)

Large-scale cleanup is intentionally phased to avoid breaking 532 API routes and 100+ dashboard pages.

| Phase | Scope                                                  | Status                                            |
| ----- | ------------------------------------------------------ | ------------------------------------------------- |
| 1     | Root hygiene, architecture docs, config consolidation  | In progress                                       |
| 2     | Dead code & unused dependency audit (`depcheck`, knip) | Planned                                           |
| 3     | `lib/` domain boundary normalisation                   | Planned                                           |
| 4     | Component deduplication & barrel exports               | Planned                                           |
| 5     | TypeScript `any` elimination (SYN-57)                  | Planned — see `.planning/phases/82-code-quality/` |

Track work in Linear; no drive-by refactors outside an issue.
