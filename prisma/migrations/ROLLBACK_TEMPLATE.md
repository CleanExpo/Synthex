# Migration Rollback Template

## Overview

Each migration should have a corresponding rollback script. Create a `rollback.sql` file alongside each `migration.sql`.

## Template Structure

```
prisma/migrations/
├── YYYYMMDD_HHMMSS_migration_name/
│   ├── migration.sql      # UP migration (created by Prisma)
│   └── rollback.sql       # DOWN migration (manual)
```

## Rollback Script Template

```sql
-- ============================================================================
-- ROLLBACK: YYYYMMDD_HHMMSS_migration_name
-- ============================================================================
-- Description: [What this rollback reverses]
-- Original Migration: [Brief description of what the UP migration did]
-- WARNING: [Any data loss or side effects]
-- ============================================================================

-- Start transaction
BEGIN;

-- ============================================================================
-- REVERSE CHANGES (in opposite order of migration)
-- ============================================================================

-- Example: Drop added columns
-- ALTER TABLE "table_name" DROP COLUMN IF EXISTS "new_column";

-- Example: Drop added tables
-- DROP TABLE IF EXISTS "new_table" CASCADE;

-- Example: Restore removed columns
-- ALTER TABLE "table_name" ADD COLUMN "restored_column" VARCHAR(255);

-- Example: Remove added indexes
-- DROP INDEX IF EXISTS "idx_table_column";

-- Example: Remove added constraints
-- ALTER TABLE "table_name" DROP CONSTRAINT IF EXISTS "fk_constraint_name";

-- Example: Restore dropped enum values (PostgreSQL specific)
-- CREATE TYPE "EnumType_new" AS ENUM ('value1', 'value2', 'restored_value');
-- ALTER TABLE "table_name" ALTER COLUMN "enum_column" TYPE "EnumType_new" USING "enum_column"::text::"EnumType_new";
-- DROP TYPE "EnumType";
-- ALTER TYPE "EnumType_new" RENAME TO "EnumType";

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify rollback was successful
-- SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'table_name' AND column_name = 'column_name');

COMMIT;

-- ============================================================================
-- POST-ROLLBACK NOTES
-- ============================================================================
-- 1. Run: npm run db:status to verify rollback
-- 2. Run: npm run db:integrity-check to verify data integrity
-- 3. Manual cleanup may be required for: [list any manual steps]
```

## Common Rollback Patterns

### 1. Drop Added Table

```sql
-- UP: CREATE TABLE "new_table" (...)
-- DOWN:
DROP TABLE IF EXISTS "new_table" CASCADE;
```

### 2. Drop Added Column

```sql
-- UP: ALTER TABLE "users" ADD COLUMN "new_field" VARCHAR(255);
-- DOWN:
ALTER TABLE "users" DROP COLUMN IF EXISTS "new_field";
```

### 3. Remove Added Index

```sql
-- UP: CREATE INDEX "idx_users_email" ON "users" ("email");
-- DOWN:
DROP INDEX IF EXISTS "idx_users_email";
```

### 4. Remove Added Constraint

```sql
-- UP: ALTER TABLE "posts" ADD CONSTRAINT "fk_posts_user" FOREIGN KEY ("user_id") REFERENCES "users" ("id");
-- DOWN:
ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "fk_posts_user";
```

### 5. Restore Dropped Column (requires data backup)

```sql
-- UP: ALTER TABLE "users" DROP COLUMN "old_field";
-- DOWN: (Data will be lost!)
ALTER TABLE "users" ADD COLUMN "old_field" VARCHAR(255);
-- Note: Original data cannot be automatically restored
```

### 6. Reverse Column Type Change

```sql
-- UP: ALTER TABLE "users" ALTER COLUMN "age" TYPE INTEGER;
-- DOWN:
ALTER TABLE "users" ALTER COLUMN "age" TYPE VARCHAR(10);
```

### 7. Reverse Enum Addition

```sql
-- UP: ALTER TYPE "UserRole" ADD VALUE 'admin';
-- DOWN: (Cannot directly remove enum values in PostgreSQL)
-- Requires recreating the enum type
CREATE TYPE "UserRole_rollback" AS ENUM ('user', 'moderator');
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole_rollback" USING "role"::text::"UserRole_rollback";
DROP TYPE "UserRole";
ALTER TYPE "UserRole_rollback" RENAME TO "UserRole";
```

## Best Practices

1. **Always create rollback scripts** when creating migrations
2. **Test rollbacks in development** before deploying
3. **Document data loss warnings** in rollback scripts
4. **Use transactions** to ensure atomic rollbacks
5. **Back up data** before running rollbacks in production
6. **Verify rollback success** with integrity checks

## Running Rollbacks

```bash
# Preview rollback
npm run db:rollback -- --dry-run

# Execute rollback (with backup)
npm run db:rollback

# Manual rollback using psql
psql $DATABASE_URL < prisma/migrations/YYYYMMDD_HHMMSS_migration_name/rollback.sql
```

## Emergency Procedures

If a migration causes critical issues:

1. **Immediate**: Restore from backup
   ```bash
   npm run db:restore -- backups/latest.sql
   ```

2. **If no backup**: Run rollback script manually
   ```bash
   psql $DATABASE_URL < prisma/migrations/YYYYMMDD_HHMMSS_migration_name/rollback.sql
   ```

3. **Mark migration as not applied**
   ```sql
   DELETE FROM _prisma_migrations WHERE migration_name = 'YYYYMMDD_HHMMSS_migration_name';
   ```

4. **Verify system health**
   ```bash
   npm run db:integrity-check
   curl https://app.synthex.com/api/health/db
   ```
