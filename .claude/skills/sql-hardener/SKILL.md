---
name: sql-hardener
description: >-
  SQL cleanup and security hardening for Supabase. Audits SQL files for missing
  indexes, weak RLS policies, and security gaps. Generates optimised migrations
  using the Supabase CLI. Use when cleaning up schema, strengthening security,
  or preparing for production deployment.
metadata:
  author: synthex
  version: "1.0"
  engine: synthex-ai-agency
  type: database-skill
  triggers:
    - sql cleanup
    - sql hardening
    - rls audit
    - index optimization
    - supabase security
---

# SQL Cleanup & Security Hardening Skill

## Purpose

Automates SQL file cleanup, security hardening, and optimization using the Supabase CLI. Analyzes existing schema for gaps, generates improvements, and safely applies changes.

## When to Use

Activate this skill when:
- Cleaning up messy or inconsistent SQL files
- Auditing RLS policies for security gaps
- Adding missing indexes for performance
- Preparing database for production deployment
- Consolidating multiple schema files into clean migrations
- Strengthening constraint enforcement

## Workflow

### Phase 1: Discovery

```bash
# List all SQL files
find supabase/ -name "*.sql" -type f

# Check current database state
supabase db diff --linked

# List existing tables and their RLS status
supabase db lint
```

### Phase 2: Audit

Analyze SQL files for common issues:

#### 1. Missing Indexes
Check for columns frequently used in WHERE, JOIN, ORDER BY:
- Foreign key columns without indexes
- Timestamp columns used for sorting
- Status/type columns used for filtering

```sql
-- Pattern: Generate missing FK indexes
SELECT
  tc.table_name,
  kcu.column_name,
  'CREATE INDEX IF NOT EXISTS idx_' || tc.table_name || '_' || kcu.column_name ||
  ' ON ' || tc.table_name || '(' || kcu.column_name || ');'
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND NOT EXISTS (
  SELECT 1 FROM pg_indexes
  WHERE tablename = tc.table_name
  AND indexdef LIKE '%' || kcu.column_name || '%'
);
```

#### 2. RLS Policy Gaps
Check for tables missing RLS or with incomplete policies:

```sql
-- Find tables without RLS enabled
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
AND tablename NOT IN (
  SELECT relname FROM pg_class
  WHERE relrowsecurity = true
);

-- Find tables with RLS but missing policies
SELECT c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
AND c.relrowsecurity = true
AND n.nspname = 'public'
AND NOT EXISTS (
  SELECT 1 FROM pg_policies p WHERE p.tablename = c.relname
);
```

#### 3. Constraint Weaknesses
- Missing NOT NULL on required fields
- Missing CHECK constraints for enums
- Missing UNIQUE constraints where appropriate
- Cascade behavior review

#### 4. Security Gaps
- Tables with public access
- Missing auth.uid() checks
- Overly permissive policies

### Phase 3: Generate Improvements

Create migration file with improvements:

```bash
# Generate new migration
supabase migration new sql_hardening_$(date +%Y%m%d)

# Edit the generated file at:
# supabase/migrations/{timestamp}_sql_hardening_{date}.sql
```

### Phase 4: Apply & Validate

```bash
# Test locally first
supabase db reset

# Check for issues
supabase db lint

# Diff against remote
supabase db diff --linked

# Push to remote (with confirmation)
supabase db push
```

## Input Specification

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| operation | string | yes | `audit`, `generate-indexes`, `generate-rls`, `consolidate`, `apply` |
| target | string | no | Specific table or file to focus on |
| dry_run | boolean | no | Generate but don't apply (default: true) |

## Output Specification

| Field | Type | Description |
|-------|------|-------------|
| operation | string | Operation performed |
| issues_found | array | List of issues detected |
| fixes_generated | string | SQL fixes generated |
| migration_path | string | Path to generated migration |
| warnings | array | Potential breaking changes |

## Standard RLS Templates

### User-Owned Data Pattern
```sql
-- Enable RLS
ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;

-- CRUD policies for user-owned data
CREATE POLICY "{table_name}_select_own"
  ON {table_name} FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "{table_name}_insert_own"
  ON {table_name} FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "{table_name}_update_own"
  ON {table_name} FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "{table_name}_delete_own"
  ON {table_name} FOR DELETE
  USING (auth.uid() = user_id);
```

### Organization-Scoped Pattern (Multi-Business)
```sql
-- For tables with organization_id
CREATE POLICY "{table_name}_org_access"
  ON {table_name} FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM users
      WHERE id = auth.uid()
    )
    OR
    organization_id IN (
      SELECT organization_id FROM business_ownerships
      WHERE owner_id = auth.uid()
    )
  );
```

### Team-Scoped Pattern
```sql
-- For tables with team_id
CREATE POLICY "{table_name}_team_access"
  ON {table_name} FOR ALL
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid()
    )
  );
```

### Service Role Bypass
```sql
-- Allow service role to bypass RLS
CREATE POLICY "{table_name}_service_bypass"
  ON {table_name} FOR ALL
  USING (auth.role() = 'service_role');
```

## Index Templates

```sql
-- Standard patterns
CREATE INDEX IF NOT EXISTS idx_{table}_{column}
  ON {table}({column});

-- Composite for common queries
CREATE INDEX IF NOT EXISTS idx_{table}_{col1}_{col2}
  ON {table}({col1}, {col2});

-- Partial for filtered queries
CREATE INDEX IF NOT EXISTS idx_{table}_{column}_active
  ON {table}({column})
  WHERE status = 'active';

-- GIN for JSONB columns
CREATE INDEX IF NOT EXISTS idx_{table}_{column}_gin
  ON {table} USING gin({column});

-- Full-text search
CREATE INDEX IF NOT EXISTS idx_{table}_{column}_fts
  ON {table} USING gin(to_tsvector('english', {column}));
```

## Safety Rules

- **NEVER** drop policies without creating replacements
- **ALWAYS** test migrations locally with `supabase db reset`
- **ALWAYS** use `IF NOT EXISTS` for indexes and `DROP POLICY IF EXISTS` for policies
- **REQUIRE** explicit confirmation before `supabase db push`
- **BACKUP** before major changes: `supabase db dump -f backup.sql`
- **NEVER** disable RLS on tables with user data

## Key Files

```
supabase/
├── migrations/              # Timestamped migrations
├── schema-step1-tables.sql  # Base tables
├── schema-step2-rls.sql     # RLS policies
├── schema-step3-advanced-features.sql
├── schema-step4-realtime-automation.sql
├── schema-step5-sample-data.sql
├── complete-schema.sql      # Combined schema
└── prisma-schema-full.sql   # Prisma-generated
```

## CLI Quick Reference

```bash
# Development
supabase start              # Start local instance
supabase db reset           # Reset and apply all migrations
supabase db lint            # Check for issues

# Inspection
supabase db diff            # Show pending changes
supabase db diff --linked   # Compare to remote
supabase inspect db calls   # Analyze query patterns

# Migration
supabase migration new NAME # Create migration file
supabase migration list     # List all migrations
supabase db push            # Apply to remote

# Backup
supabase db dump -f FILE    # Export schema
supabase db dump --data-only -f FILE  # Export data
```

## Example: Full Audit Workflow

```bash
# 1. Connect to project
supabase link --project-ref YOUR_PROJECT_REF

# 2. Run audit
supabase db lint

# 3. Generate diff
supabase db diff --linked > audit_diff.sql

# 4. Create hardening migration
supabase migration new security_hardening

# 5. Edit migration with fixes
# (add indexes, RLS policies, constraints)

# 6. Test locally
supabase db reset

# 7. Verify
supabase db lint

# 8. Apply to remote
supabase db push
```

## Integration Points

- Coordinates with **database-prisma** for ORM sync
- Works with **code-review** for migration review
- References **api-testing** for endpoint data validation
