# Prisma / Database

PostgreSQL (Supabase) schema and migrations for Synthex.

## Layout

| Path                                         | Purpose                                                                 |
| -------------------------------------------- | ----------------------------------------------------------------------- |
| `schema.prisma`                              | Production schema (source of truth)                                     |
| `migrations/`                                | Versioned SQL migrations — apply via CI/deploy, never `db push` in prod |
| `seed.ts` / `seed-brand.ts`                  | Seed scripts                                                            |
| `schema.dev.prisma` / `schema.sqlite.prisma` | Local/dev variants only                                                 |

Root [`prisma.config.ts`](../prisma.config.ts) configures the Prisma CLI (schema path, `DIRECT_URL` for migrations).

## Application access

Import the singleton client only:

```typescript
import { prisma } from '@/lib/prisma';
// or
import { prisma } from '@/lib/db';
```

Do **not** instantiate `new PrismaClient()` elsewhere. See `lib/prisma.ts` for pooling (Supavisor + `@prisma/adapter-pg`).

## Commands

```bash
npx prisma validate          # before any schema change
npm run db:migrate:dev        # local migration (prisma migrate dev)
npm run db:migrate:deploy     # production deploy
npm run db:status             # migration history
npm run db:studio             # Prisma Studio GUI
npm run db:drift-check        # schema drift gate
```

## Rules (from CONSTITUTION)

- New columns: nullable or defaulted — no breaking renames/drops without approval
- All queries org-scoped in application code
- Never `prisma db push` against production Supabase (legacy auth FK risk)
