---
paths: prisma/**/*.{prisma,sql}, lib/db/**/*.ts
effort: high
---

# Database Rules (Prisma + Supabase PostgreSQL)

## Stack

- **ORM**: Prisma 6 (schema at `prisma/schema.prisma`)
- **Database**: PostgreSQL via Supabase (`znyjoyjsvjotlzjppzal.supabase.co`)
- **Migration workflow**: `prisma db execute` — NOT `prisma db push` (see below)
- **Auth**: Supabase auth.users table — linked via `userId` foreign keys

## ⚠️ CRITICAL: Never Use `prisma db push`

`npx prisma db push` is **banned** for this project. It causes two fatal problems:

1. **P4002**: The live DB has legacy tables (`agent_runs`, `agent_task_queue`) with
   cross-schema FKs to `auth.users`. Prisma 6 refuses to introspect any DB with
   cross-schema FKs, so `db push` always fails with P4002.

2. **Data destruction**: `db push` tries to DROP all tables in the DB that are not in
   the Prisma schema. The DB has many legacy tables — they would all be deleted.

## Correct Migration Workflow

```bash
# Step 1: Validate schema
npx prisma validate

# Step 2: Fix P4002 if it has reappeared (run once when needed)
npx prisma db execute --file prisma/fix-p4002.sql --url "$DIRECT_URL"

# Step 3: Generate additive-only migration SQL (no DROPs)
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script \
  2>/dev/null \
  | grep -v "^\[dotenv" \
  | grep -v "^-- DropTable" \
  | grep -v "^DROP TABLE" \
  > prisma/migration-YYYY-MM-DD.sql

# Step 4: Review the generated SQL before applying
cat prisma/migration-YYYY-MM-DD.sql

# Step 5: Apply to production DB
npx prisma db execute --file prisma/migration-YYYY-MM-DD.sql --url "$DIRECT_URL"

# Step 6: Regenerate client
npx prisma generate
```

**Note on FK constraints**: Some new tables may have FK type mismatches with existing
tables (TEXT vs UUID mismatch in organizations.id). If FK constraints fail, apply the
migration a second time with FK lines filtered out:

```bash
grep -v "ADD CONSTRAINT.*FOREIGN KEY" migration.sql | \
grep -v "^-- AddForeignKey" > migration-no-fk.sql
npx prisma db execute --file migration-no-fk.sql --url "$DIRECT_URL"
```

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
npx prisma validate          # Validate schema — run before any migration
npx prisma db execute        # Apply raw SQL (the safe migration method)
npx prisma generate          # Regenerate Prisma client after schema change
npx prisma migrate diff      # Generate SQL diff between two schema states
npx prisma studio            # GUI for browsing data
```

## Anti-Patterns

- ❌ `npx prisma db push` — banned, see CRITICAL section above
- ❌ `prisma.model.findMany()` without `where: { orgId }` — data leak risk
- ❌ Schema push without `prisma validate` first
- ❌ Required fields without defaults (breaks existing rows)
- ❌ `prisma migrate reset` — destructive, data loss
- ❌ FK to `auth.users` — causes P4002
