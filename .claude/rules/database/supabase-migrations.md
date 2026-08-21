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

### ⚠️ Prisma 7 CLI gotchas (read before running any CLI migration)

_Rechecked 21/08/2026. Items 2 and 5 below replace guidance that was wrong and had been
costing sessions real time._

1. **`prisma db execute` no longer accepts `--url`.** Prisma 7 reads the datasource from
   `prisma.config.ts`. Passing `--url` errors with "unknown or unexpected option".
2. **The CLI must use `DIRECT_URL`, not `DATABASE_URL`.** `DATABASE_URL` is Supabase's
   pgBouncer pooler (`:6543`, transaction mode). The migrate engine uses prepared statements
   and session state, so any migrate command pointed there fails with
   `Schema engine error: ERROR: prepared statement "s0" does not exist`. `DIRECT_URL` is the
   session connection (`:5432`). `prisma.config.ts` therefore resolves
   `process.env.DIRECT_URL || process.env.DATABASE_URL || ''` — `||`, not `??`, so an
   empty-string `DIRECT_URL` falls through instead of winning.
   _This drifted once: the config was `DATABASE_URL`-only, which silently broke
   `prisma migrate deploy` inside `scripts/build-with-migrations.sh` and left production
   undeployable from 18/08/2026 until 21/08/2026. If migrate commands start failing on
   prepared statements, check this line first._
3. **`prisma migrate diff` flags changed:** use `--from-config-datasource` (not
   `--from-schema-datasource`) and `--to-schema <path>` (not `--to-schema-datamodel`).
4. **Easiest path: skip the CLI.** Apply DDL via the Supabase MCP `apply_migration` tool
   against project `znyjoyjsvjotlzjppzal` — no local env/flag fuss, server-side auth.
5. **`.env` is NOT encrypted, and `dotenvx` is NOT installed.** Earlier revisions of this
   file said `.env` was dotenvx-encrypted, that plain `dotenv` would inject `0` vars, that
   the CLI would fail with **P1013**, and that every DB command had to be prefixed with
   `npx dotenvx run --`. All four are false as of 21/08/2026:
   - `.env` is plaintext — no `.env.keys`, no `.env.vault`, zero `encrypted:` values, no
     `DOTENV_PRIVATE_KEY` anywhere.
   - `prisma.config.ts` loads it with plain `dotenv` and it works: Prisma prints
     `injected env (28) from .env`.
   - `dotenvx` is not in `package.json`; `npx dotenvx run --` fails with a registry **404**
     (the published package is `@dotenvx/dotenvx`). The `dotenvx.com` string in Prisma's
     output is Prisma 7's own bundled loader branding, not proof of encryption.
   - Plain `npx prisma <cmd>` works from a checkout that HAS `.env`. Git worktrees under
     `.claude/worktrees/` usually do not — their `.env.local` carries no DB URL, so the CLI
     reports `Connection url is empty`. Run DB commands from the main checkout, or pass
     `--config <path-to-worktree>/prisma.config.ts` from the main checkout to combine that
     checkout's `.env` with the worktree's schema.
   - Node scripts that read `process.env` directly (e.g. `scripts/check-schema-drift.mjs`)
     load no env of their own. Run them as
     `node -r dotenv/config <script> dotenv_config_path=<abs path to .env>`.

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

### Option B — Prisma 7 CLI (run from the main checkout; no `--url`)

```bash
# Validate (no DB needed)
npx prisma validate

# Generate additive-only SQL (note the Prisma 7 flag names)
npx prisma migrate diff \
  --from-config-datasource \
  --to-schema prisma/schema.prisma \
  --script \
  2>/dev/null \
  | grep -v "^-- DropTable" | grep -v "^DROP TABLE" \
  > prisma/migrations/YYYYMMDD_name/migration.sql

# Review, then apply — db execute reads DIRECT_URL from prisma.config.ts
cat prisma/migrations/YYYYMMDD_name/migration.sql
npx prisma db execute \
  --file prisma/migrations/YYYYMMDD_name/migration.sql

# Regenerate client
npx prisma generate
```

> Run these from the main checkout — it is the one with `.env`. `--url` is gone in Prisma 7
> (it reads `prisma.config.ts`), and no `dotenvx` prefix is needed: see gotcha 5.

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
npx prisma validate                  # Validate schema (no DB needed)
npx prisma generate                  # Regenerate client (no DB needed)
npx prisma migrate status            # What the ledger says vs prisma/migrations
npx prisma db execute --file <file>  # Apply raw SQL (reads DIRECT_URL from config; NO --url)
npx prisma migrate diff              # SQL diff (--from-config-datasource / --to-schema)
npx prisma studio                    # GUI for browsing data
```

> Run DB commands from the main checkout — that is where `.env` lives. From a
> `.claude/worktrees/` worktree the CLI reports `Connection url is empty`; pass
> `--config <worktree>/prisma.config.ts` from the main checkout instead. No `dotenvx`
> prefix is needed (gotcha 5). `prisma validate` / `generate` need no DB at all.

## Anti-Patterns

- ❌ `npx prisma db push` — banned, see CRITICAL section above
- ❌ `prisma.model.findMany()` without `where: { orgId }` — data leak risk
- ❌ Schema push without `prisma validate` first
- ❌ Required fields without defaults (breaks existing rows)
- ❌ `prisma migrate reset` — destructive, data loss
- ❌ FK to `auth.users` — causes P4002
- ❌ `prisma db execute --url …` — removed in Prisma 7; reads `prisma.config.ts` instead
- ❌ Pointing the CLI at `DATABASE_URL` (`:6543` pooler) — migrate engine dies with
  `prepared statement "s0" does not exist`. The CLI uses `DIRECT_URL` (`:5432`); see gotcha 2
- ❌ `npx dotenvx run -- …` — not installed, 404s on the registry; `.env` is plaintext (gotcha 5)
