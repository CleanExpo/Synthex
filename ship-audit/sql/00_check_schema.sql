-- =================================================================
-- SCHEMA DISCOVERY SCRIPT - Run this FIRST in Supabase
-- This will show us what tables and columns actually exist
-- =================================================================

-- Check if tables exist and their columns
SELECT 
    t.table_name,
    array_agg(c.column_name ORDER BY c.ordinal_position) as columns
FROM information_schema.tables t
JOIN information_schema.columns c ON c.table_name = t.table_name
WHERE t.table_schema = 'public' 
    AND t.table_type = 'BASE TABLE'
    AND t.table_name IN (
        'users', 'campaigns', 'posts', 'projects', 'api_usage',
        'sessions', 'notifications', 'audit_logs', 'organizations',
        'platform_connections', 'platform_posts', 'platform_metrics',
        'team_invitations', 'brand_generations', 'psychology_metrics',
        'user_psychology_preferences', 'competitive_analyses',
        'psychology_principles'
    )
GROUP BY t.table_name
ORDER BY t.table_name;

-- Check existing foreign keys
SELECT 
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;