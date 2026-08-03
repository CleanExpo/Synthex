---
paths: prisma/**/*.{prisma,sql}, lib/db/**/*.ts
effort: high
---

# Database Rules (Prisma + Supabase PostgreSQL)

## Stack

- **ORM**: Prisma 7 (schema at `prisma/schema.prisma`, config at `prisma.config.ts`)
- **Database**: PostgreSQL via Supabase (`znyjoyjsvjotlzjppzal.supabase.co`)
- **Migration workflow**: Supabase MCP `apply_migration` (preferred) OR `prisma db execute` — NOT `prisma db push` (see below)
- **Auth**: Supabase auth.users table — linked via `userId` foreign keys

### ⚠️ Prisma 7 + dotenvx gotchas (read before running any CLI migration)

1. **`prisma db execute` no longer accepts `--url`.** Prisma 7 reads the datasource from
   `prisma.config.ts` (`datasource.url = process.env.DIRECT_URL ?? DATABASE_URL`). Passing
   `--url` errors with "unknown or unexpected option".
2. **`.env` is dotenvx-encrypted.** `prisma.config.ts` loads it with plain `dotenv`, which
   injects **0** vars locally (you'll see `injected env (0)`), so `DIRECT_URL` is empty and
   the CLI fails with **P1013** ("scheme is not recognized"). You MUST run through dotenvx so
   the URL decrypts: `npx dotenvx run -- npx prisma@7.7.0 db execute --file <file>`.
3. **`prisma migrate diff` flags changed:** use `--from-config-datasource` (not
   `--from-schema-datasource`) and `--to-schema <path>` (not `--to-schema-datamodel`).
4. **Easiest path: skip the CLI.** Apply DDL via the Supabase MCP `apply_migration` tool
   against project `znyjoyjsvjotlzjppzal` — no local env/flag fuss, server-side auth.

## ⚠️ CRITICAL: Never Use `prisma db push`

`npx prisma db push` is **banned** for this project. It causes two fatal problems:

1. **P4002**: The live DB has legacy tables (`agent_runs`, `agent_task_queue`) with
   cross-schema FKs to `auth.users`. Prisma 6 refuses to introspect any DB with
   cross-schema FKs, so `db push` always fails with P4002.

2. **Data destruction**: `db push` tries to DROP all tables in the DB that are not in
   the Prisma schema. The DB has many legacy tables — they would all be deleted.

## Correct Migration Workflow

> **SUBORDINATION RULING (2026-08-04).** Everything below describes HOW to apply a
> migration. It does not grant permission to apply one. **Production DDL is
> founder-gated per `CLAUDE.md` and `CONSTITUTION.md`; that gate wins over every
> "apply" instruction in this file.** An agent authors the migration, proves it on a
> throwaway database, and stops — the founder, or a session the founder is
> supervising, runs the apply.
>
> This ruling exists because the two documents disagreed. This file said apply out of
> band; `CLAUDE.md` said production changes are founder-gated. An agent reading only
> this file had written permission to change production, and the permissive document
> is the one that gets obeyed. See `release-path` Law 10, "Rules live where writers
> read them".

### Option A — Supabase MCP (preferred; no local env/flag issues)

1. Write the additive SQL into a dated dir: `prisma/migrations/YYYYMMDD_<name>/migration.sql`
   (`CREATE TABLE IF NOT EXISTS …`, no DROPs).
2. Add the matching model to `prisma/schema.prisma`; run `npx prisma validate` then
   `npx prisma generate` (generate needs no DB and works regardless of the encrypted env).
3. Apply via the Supabase MCP `apply_migration` tool → project `znyjoyjsvjotlzjppzal`,
   passing the SQL. Verify with `execute_sql` (check `information_schema.columns` /
   `pg_indexes`). This is how `studio_content_drafts` (SYN-1005) was applied.

### Option B — Prisma 7 CLI (must go through dotenvx; no `--url`)

```bash
# Validate (no DB needed)
npx prisma validate

# Generate additive-only SQL (note the Prisma 7 flag names)
npx dotenvx run -- npx prisma migrate diff \
  --from-config-datasource \
  --to-schema prisma/schema.prisma \
  --script \
  2>/dev/null \
  | grep -v "^-- DropTable" | grep -v "^DROP TABLE" \
  > prisma/migrations/YYYYMMDD_name/migration.sql

# Review, then apply — dotenvx decrypts DIRECT_URL; db execute reads it from prisma.config.ts
cat prisma/migrations/YYYYMMDD_name/migration.sql
npx dotenvx run -- npx prisma@7.7.0 db execute \
  --file prisma/migrations/YYYYMMDD_name/migration.sql

# Regenerate client
npx prisma generate
```

> Without `npx dotenvx run --`, the `.env` is encrypted → `injected env (0)` → empty
> `DIRECT_URL` → **P1013**. And `--url` is gone in Prisma 7 (it reads `prisma.config.ts`).

**Note on FK constraints**: `organizations.id` has a TEXT/UUID mismatch hazard — prefer a
**scalar `organization_id` with no DB FK**, enforcing org-scope at the query layer (see
`StudioContentDraft`). If you must add a FK and it fails, apply once with FK lines stripped.

## P4002 Root Cause

The `agent_runs` and `agent_task_queue` tables were created outside Prisma and have
FKs pointing to `auth.users` (cross-schema). The fix in `prisma/fix-p4002.sql` drops
all such cross-schema FKs from public schema tables. Run it whenever the issue returns.

## Schema Safety Rules

1. **Validate first**: `npx prisma validate` must pass before any migration
2. **Backward compatibility**: New columns MUST have defaults or be nullable
3. **No destructive changes** without explicit human approval:
   - Dropping columns/tables
   - Renaming columns (breaks existing queries)
   - Changing column types (data loss risk)
4. **Never add FKs to `auth.users`** — use `public.users` instead

## Model Conventions

```prisma
model Example {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Foreign keys — always scope to org
  orgId     String
  org       Organisation @relation(fields: [orgId], references: [id])

  @@index([orgId])
}
```

- Use `cuid()` for IDs (not `uuid()` — already established pattern)
- All timestamps: `createdAt` + `updatedAt`
- All user-scoped data: include `orgId` for org-scoping
- Add `@@index` on all foreign key fields used in queries
- **Never reference `auth.users` in model relations** — use `User` (public.users)

## Query Patterns

```typescript
// ✅ Always org-scope queries
const posts = await prisma.post.findMany({
  where: { orgId: session.orgId },
});

// ❌ Never query without org scope
const posts = await prisma.post.findMany(); // WRONG — cross-org data leak
```

## Commands

```bash
npx prisma validate                              # Validate schema (no DB needed)
npx prisma generate                              # Regenerate client (no DB needed)
npx dotenvx run -- npx prisma db execute --file  # Apply raw SQL (reads DIRECT_URL from config; NO --url)
npx dotenvx run -- npx prisma migrate diff       # SQL diff (--from-config-datasource / --to-schema)
npx dotenvx run -- npx prisma studio             # GUI for browsing data
```

> Every command that touches the DB must be prefixed with `npx dotenvx run --` so the
> encrypted `.env` decrypts. `prisma validate` / `generate` don't need it.

## Anti-Patterns

- ❌ `npx prisma db push` — banned, see CRITICAL section above
- ❌ `prisma.model.findMany()` without `where: { orgId }` — data leak risk
- ❌ Schema push without `prisma validate` first
- ❌ Required fields without defaults (breaks existing rows)
- ❌ `prisma migrate reset` — destructive, data loss
- ❌ FK to `auth.users` — causes P4002
- ❌ `prisma db execute --url …` — removed in Prisma 7; reads `prisma.config.ts` instead
- ❌ Any DB command WITHOUT `npx dotenvx run --` — encrypted `.env` → empty `DIRECT_URL` → P1013
