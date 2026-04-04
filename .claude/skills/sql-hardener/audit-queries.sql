-- =============================================================================
-- SQL Hardener Audit Queries
-- Run these against your Supabase database to identify security and performance gaps
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABLES WITHOUT RLS ENABLED
-- Critical: User data tables should always have RLS
-- -----------------------------------------------------------------------------
SELECT
    schemaname,
    tablename,
    '⚠️ RLS NOT ENABLED' AS issue,
    'ALTER TABLE ' || schemaname || '.' || tablename || ' ENABLE ROW LEVEL SECURITY;' AS fix
FROM pg_tables
WHERE schemaname = 'public'
AND tablename NOT IN (
    SELECT relname::text FROM pg_class
    WHERE relrowsecurity = true
)
ORDER BY tablename;

-- -----------------------------------------------------------------------------
-- 2. TABLES WITH RLS BUT NO POLICIES
-- Danger: RLS enabled but no policies = no access at all
-- -----------------------------------------------------------------------------
SELECT
    c.relname AS table_name,
    '🔒 RLS ENABLED BUT NO POLICIES' AS issue
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
AND c.relrowsecurity = true
AND n.nspname = 'public'
AND NOT EXISTS (
    SELECT 1 FROM pg_policies p WHERE p.tablename = c.relname
)
ORDER BY c.relname;

-- -----------------------------------------------------------------------------
-- 3. FOREIGN KEYS WITHOUT INDEXES
-- Performance: FK columns should be indexed for JOIN performance
-- -----------------------------------------------------------------------------
SELECT
    tc.table_name,
    kcu.column_name AS fk_column,
    'CREATE INDEX IF NOT EXISTS idx_' || tc.table_name || '_' || kcu.column_name ||
    ' ON ' || tc.table_name || '(' || kcu.column_name || ');' AS fix
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public'
AND NOT EXISTS (
    SELECT 1 FROM pg_indexes pi
    WHERE pi.tablename = tc.table_name
    AND pi.schemaname = 'public'
    AND (
        pi.indexdef LIKE '%(' || kcu.column_name || ')%'
        OR pi.indexdef LIKE '%(' || kcu.column_name || ',%'
        OR pi.indexdef LIKE '%, ' || kcu.column_name || ')%'
    )
)
ORDER BY tc.table_name, kcu.column_name;

-- -----------------------------------------------------------------------------
-- 4. TIMESTAMP COLUMNS WITHOUT INDEXES
-- Performance: Columns used for sorting/filtering by date
-- -----------------------------------------------------------------------------
SELECT
    table_name,
    column_name,
    data_type,
    'CREATE INDEX IF NOT EXISTS idx_' || table_name || '_' || column_name ||
    ' ON ' || table_name || '(' || column_name || ' DESC);' AS fix
FROM information_schema.columns
WHERE table_schema = 'public'
AND data_type IN ('timestamp with time zone', 'timestamp without time zone', 'date')
AND column_name IN ('created_at', 'updated_at', 'scheduled_at', 'published_at', 'last_login')
AND NOT EXISTS (
    SELECT 1 FROM pg_indexes pi
    WHERE pi.tablename = table_name
    AND pi.schemaname = 'public'
    AND pi.indexdef LIKE '%' || column_name || '%'
)
ORDER BY table_name, column_name;

-- -----------------------------------------------------------------------------
-- 5. STATUS/TYPE COLUMNS WITHOUT INDEXES
-- Performance: Enum-like columns frequently used in WHERE clauses
-- -----------------------------------------------------------------------------
SELECT
    table_name,
    column_name,
    'CREATE INDEX IF NOT EXISTS idx_' || table_name || '_' || column_name ||
    ' ON ' || table_name || '(' || column_name || ');' AS fix
FROM information_schema.columns
WHERE table_schema = 'public'
AND column_name IN ('status', 'type', 'state', 'platform', 'category', 'role')
AND NOT EXISTS (
    SELECT 1 FROM pg_indexes pi
    WHERE pi.tablename = table_name
    AND pi.schemaname = 'public'
    AND pi.indexdef LIKE '%' || column_name || '%'
)
ORDER BY table_name, column_name;

-- -----------------------------------------------------------------------------
-- 6. NULLABLE COLUMNS THAT SHOULD BE NOT NULL
-- Data integrity: Required fields should have NOT NULL constraint
-- -----------------------------------------------------------------------------
SELECT
    table_name,
    column_name,
    data_type,
    '-- Consider: ALTER TABLE ' || table_name ||
    ' ALTER COLUMN ' || column_name || ' SET NOT NULL;' AS suggestion
FROM information_schema.columns
WHERE table_schema = 'public'
AND is_nullable = 'YES'
AND column_name IN (
    'user_id', 'organization_id', 'created_at', 'email', 'name', 'status', 'type'
)
ORDER BY table_name, column_name;

-- -----------------------------------------------------------------------------
-- 7. TABLES WITHOUT UPDATED_AT TRIGGER
-- Maintenance: Track when records were last modified
-- -----------------------------------------------------------------------------
SELECT
    t.tablename AS table_name,
    'Missing updated_at trigger' AS issue
FROM pg_tables t
WHERE t.schemaname = 'public'
AND EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_name = t.tablename
    AND c.column_name = 'updated_at'
)
AND NOT EXISTS (
    SELECT 1 FROM pg_trigger tr
    JOIN pg_class c ON tr.tgrelid = c.oid
    WHERE c.relname = t.tablename
    AND tr.tgname LIKE '%updated_at%'
);

-- -----------------------------------------------------------------------------
-- 8. OVERLY PERMISSIVE POLICIES
-- Security: Policies that allow too much access
-- -----------------------------------------------------------------------------
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check,
    CASE
        WHEN qual = 'true' AND cmd IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
        THEN '⚠️ ALLOWS ALL - Review required'
        WHEN qual IS NULL
        THEN '⚠️ NO USING CLAUSE - May be too permissive'
        ELSE '✓ OK'
    END AS security_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- -----------------------------------------------------------------------------
-- 9. JSONB COLUMNS WITHOUT GIN INDEX
-- Performance: JSONB queries benefit from GIN indexes
-- -----------------------------------------------------------------------------
SELECT
    table_name,
    column_name,
    'CREATE INDEX IF NOT EXISTS idx_' || table_name || '_' || column_name || '_gin' ||
    ' ON ' || table_name || ' USING gin(' || column_name || ');' AS fix
FROM information_schema.columns
WHERE table_schema = 'public'
AND data_type = 'jsonb'
AND column_name NOT IN ('raw_response') -- Exclude large blobs
AND NOT EXISTS (
    SELECT 1 FROM pg_indexes pi
    WHERE pi.tablename = table_name
    AND pi.schemaname = 'public'
    AND pi.indexdef LIKE '%gin%'
    AND pi.indexdef LIKE '%' || column_name || '%'
)
ORDER BY table_name, column_name;

-- -----------------------------------------------------------------------------
-- 10. MISSING CASCADE ON DELETE
-- Data integrity: Orphaned records when parent is deleted
-- -----------------------------------------------------------------------------
SELECT
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    rc.delete_rule,
    CASE
        WHEN rc.delete_rule = 'NO ACTION'
        THEN '⚠️ Consider CASCADE or SET NULL'
        ELSE '✓ ' || rc.delete_rule
    END AS recommendation
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- -----------------------------------------------------------------------------
-- 11. SUMMARY: Generate All Index Fixes
-- Run this to get a consolidated list of all index fixes
-- -----------------------------------------------------------------------------
-- Copy/paste output to create migration:
-- supabase migration new add_missing_indexes

-- -----------------------------------------------------------------------------
-- 12. SUMMARY: RLS Status Overview
-- Quick health check of RLS across all tables
-- -----------------------------------------------------------------------------
SELECT
    t.tablename,
    CASE WHEN c.relrowsecurity THEN '✓ Enabled' ELSE '✗ Disabled' END AS rls_status,
    COUNT(p.policyname) AS policy_count
FROM pg_tables t
LEFT JOIN pg_class c ON c.relname = t.tablename AND c.relnamespace = 'public'::regnamespace
LEFT JOIN pg_policies p ON p.tablename = t.tablename AND p.schemaname = 'public'
WHERE t.schemaname = 'public'
GROUP BY t.tablename, c.relrowsecurity
ORDER BY
    CASE WHEN c.relrowsecurity THEN 1 ELSE 0 END,
    policy_count,
    t.tablename;
