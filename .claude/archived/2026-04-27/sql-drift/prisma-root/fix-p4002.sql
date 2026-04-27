-- ============================================================================
-- Permanent fix for Prisma P4002: cross-schema FK blocking db push
--
-- Root cause: agent_runs.user_id_fkey → auth.users (cross-schema reference)
-- Prisma 6 refuses to introspect any DB that has cross-schema FKs pointing
-- to schemas not listed in the datasource `schemas` property.
-- ============================================================================

-- Drop all cross-schema FKs from public tables pointing to auth schema
-- (safe: uses DROP CONSTRAINT IF EXISTS, skips views)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT tc.constraint_name, tc.table_name
    FROM information_schema.referential_constraints rc
    JOIN information_schema.table_constraints tc
      ON rc.constraint_name = tc.constraint_name
    JOIN information_schema.constraint_column_usage ccu
      ON rc.unique_constraint_name = ccu.constraint_name
    JOIN information_schema.tables t
      ON t.table_name = tc.table_name AND t.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
    WHERE ccu.table_schema = 'auth'
      AND tc.table_schema = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
                   r.table_name, r.constraint_name);
    RAISE NOTICE 'Dropped cross-schema FK: % on table %', r.constraint_name, r.table_name;
  END LOOP;
END $$;
