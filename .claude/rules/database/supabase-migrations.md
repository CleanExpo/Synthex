---
paths: prisma/**/*.{prisma,sql}, lib/db/**/*.ts
effort: high
---

# Database Rules (Prisma + Supabase PostgreSQL)

## Stack

- **ORM**: Prisma 6 (schema at `prisma/schema.prisma`)
- **Database**: PostgreSQL via Supabase
- **Migration workflow**: Prisma (`npx prisma db push` for dev, migrations for prod)
- **Auth**: Supabase auth.users table — linked via `userId` foreign keys

## Schema Safety Rules

These rules apply before ANY schema change:

1. **Validate first**: `npx prisma validate` must pass before any `db push`
2. **Backward compatibility**: New columns MUST have defaults or be nullable
3. **No destructive changes** without explicit human approval:
   - Dropping columns/tables
   - Renaming columns (breaks existing queries)
   - Changing column types (data loss risk)
4. **Rollback**: Every migration must be reversible — document the rollback plan

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
npx prisma validate          # Validate schema — run before any push
npx prisma db push           # Push schema changes to dev DB
npx prisma generate          # Regenerate Prisma client after schema change
npx prisma studio            # GUI for browsing data
npm run db:migrate:dev       # Create a named migration
```

## Anti-Patterns

- ❌ `prisma.model.findMany()` without `where: { orgId }` — data leak risk
- ❌ Schema push without `prisma validate` first
- ❌ Required fields without defaults (breaks existing rows)
- ❌ `prisma migrate reset` — destructive, data loss
