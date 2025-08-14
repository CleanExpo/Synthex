-- =================================================================
-- 06_views_materialized.sql - Analytics Views & Materialized Views
-- Generated: 2025-08-13
-- Purpose: Create views for reporting and analytics dashboards
-- =================================================================

BEGIN;

-- =================================================================
-- PART 1: User Analytics Views
-- =================================================================

-- User activity summary view
CREATE OR REPLACE VIEW v_user_activity_summary AS
SELECT 
    u.id AS user_id,
    u.email,
    u.name,
    u."organizationId",
    u."createdAt" AS user_created,
    u."lastLogin",
    COUNT(DISTINCT c.id) AS total_campaigns,
    COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'active') AS active_campaigns,
    COUNT(DISTINCT p.id) AS total_posts,
    COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'published') AS published_posts,
    COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'scheduled') AS scheduled_posts,
    COUNT(DISTINCT proj.id) AS total_projects,
    COUNT(DISTINCT pc.id) AS platform_connections,
    COALESCE(SUM(au.cost), 0) AS total_api_cost,
    COALESCE(SUM(au.tokens), 0) AS total_tokens_used,
    MAX(c."updatedAt") AS last_campaign_activity,
    MAX(p."publishedAt") AS last_post_published
FROM users u
LEFT JOIN campaigns c ON c."userId" = u.id AND c.deleted_at IS NULL
LEFT JOIN posts p ON p."campaignId" = c.id AND p.deleted_at IS NULL
LEFT JOIN projects proj ON proj."userId" = u.id AND proj.deleted_at IS NULL
LEFT JOIN platform_connections pc ON pc."userId" = u.id AND pc.deleted_at IS NULL
LEFT JOIN api_usage au ON au."userId" = u.id
WHERE u.deleted_at IS NULL
GROUP BY u.id, u.email, u.name, u."organizationId", u."createdAt", u."lastLogin";

-- Create index on the view's base tables for better performance
CREATE INDEX IF NOT EXISTS idx_users_activity_view ON users(id) WHERE deleted_at IS NULL;

-- =================================================================
-- PART 2: Campaign Performance Materialized View
-- =================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_campaign_performance AS
SELECT 
    c.id AS campaign_id,
    c."userId",
    c.name AS campaign_name,
    c.platform,
    c.status,
    c."createdAt",
    COUNT(DISTINCT p.id) AS total_posts,
    COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'published') AS published_posts,
    COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'scheduled') AS scheduled_posts,
    COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'failed') AS failed_posts,
    MIN(p."publishedAt") AS first_post_date,
    MAX(p."publishedAt") AS last_post_date,
    AVG(EXTRACT(EPOCH FROM (p."publishedAt" - p."scheduledAt"))/3600)::NUMERIC(10,2) AS avg_publish_delay_hours,
    jsonb_build_object(
        'total_reach', COALESCE(SUM((p.analytics->>'reach')::INT), 0),
        'total_impressions', COALESCE(SUM((p.analytics->>'impressions')::INT), 0),
        'total_engagement', COALESCE(SUM((p.analytics->>'engagement')::INT), 0),
        'avg_engagement_rate', AVG((p.analytics->>'engagementRate')::NUMERIC)
    ) AS performance_metrics
FROM campaigns c
LEFT JOIN posts p ON p."campaignId" = c.id AND p.deleted_at IS NULL
WHERE c.deleted_at IS NULL
GROUP BY c.id, c."userId", c.name, c.platform, c.status, c."createdAt";

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX idx_mv_campaign_performance_id ON mv_campaign_performance(campaign_id);

-- Create additional indexes for queries
CREATE INDEX idx_mv_campaign_performance_user ON mv_campaign_performance("userId");
CREATE INDEX idx_mv_campaign_performance_status ON mv_campaign_performance(status);

-- =================================================================
-- PART 3: Daily Platform Metrics Materialized View
-- =================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_platform_metrics AS
SELECT 
    DATE_TRUNC('day', pm."recordedAt") AS metric_date,
    pc.platform,
    pc."userId",
    COUNT(DISTINCT pp.id) AS posts_count,
    SUM(pm.likes) AS total_likes,
    SUM(pm.shares) AS total_shares,
    SUM(pm.comments) AS total_comments,
    SUM(pm.views) AS total_views,
    SUM(pm.reach) AS total_reach,
    SUM(pm.impressions) AS total_impressions,
    SUM(pm.clicks) AS total_clicks,
    SUM(pm.saves) AS total_saves,
    AVG(pm."engagementRate")::NUMERIC(5,2) AS avg_engagement_rate,
    MAX(pm."engagementRate")::NUMERIC(5,2) AS max_engagement_rate
FROM platform_metrics pm
JOIN platform_posts pp ON pp.id = pm."postId"
JOIN platform_connections pc ON pc.id = pp."connectionId"
WHERE pp.deleted_at IS NULL 
AND pc.deleted_at IS NULL
GROUP BY DATE_TRUNC('day', pm."recordedAt"), pc.platform, pc."userId";

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX idx_mv_daily_platform_metrics ON mv_daily_platform_metrics(metric_date, platform, "userId");

-- Create additional indexes
CREATE INDEX idx_mv_daily_platform_metrics_date ON mv_daily_platform_metrics(metric_date DESC);
CREATE INDEX idx_mv_daily_platform_metrics_user ON mv_daily_platform_metrics("userId");

-- =================================================================
-- PART 4: Organization Dashboard Materialized View
-- =================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_organization_dashboard AS
SELECT 
    o.id AS org_id,
    o.name AS org_name,
    o.plan,
    o."billingStatus",
    COUNT(DISTINCT u.id) AS total_users,
    COUNT(DISTINCT u.id) FILTER (WHERE u."emailVerified" = true) AS verified_users,
    COUNT(DISTINCT u.id) FILTER (WHERE u."lastLogin" > CURRENT_TIMESTAMP - INTERVAL '30 days') AS active_users_30d,
    COUNT(DISTINCT c.id) AS total_campaigns,
    COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'active') AS active_campaigns,
    COUNT(DISTINCT p.id) AS total_posts,
    COUNT(DISTINCT p.id) FILTER (WHERE p."publishedAt" > CURRENT_TIMESTAMP - INTERVAL '30 days') AS posts_last_30d,
    COALESCE(SUM(au.cost), 0)::NUMERIC(10,2) AS total_api_cost,
    COALESCE(SUM(au.tokens), 0) AS total_tokens,
    jsonb_build_object(
        'platforms', jsonb_agg(DISTINCT c.platform) FILTER (WHERE c.platform IS NOT NULL),
        'top_users', (
            SELECT jsonb_agg(jsonb_build_object(
                'user_id', sub.id,
                'email', sub.email,
                'campaigns', sub.campaign_count
            ))
            FROM (
                SELECT u2.id, u2.email, COUNT(c2.id) AS campaign_count
                FROM users u2
                LEFT JOIN campaigns c2 ON c2."userId" = u2.id
                WHERE u2."organizationId" = o.id
                GROUP BY u2.id, u2.email
                ORDER BY COUNT(c2.id) DESC
                LIMIT 5
            ) sub
        )
    ) AS insights
FROM organizations o
LEFT JOIN users u ON u."organizationId" = o.id AND u.deleted_at IS NULL
LEFT JOIN campaigns c ON c."userId" = u.id AND c.deleted_at IS NULL
LEFT JOIN posts p ON p."campaignId" = c.id AND p.deleted_at IS NULL
LEFT JOIN api_usage au ON au."userId" = u.id
WHERE o.deleted_at IS NULL
GROUP BY o.id, o.name, o.plan, o."billingStatus";

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX idx_mv_organization_dashboard_id ON mv_organization_dashboard(org_id);

-- =================================================================
-- PART 5: API Usage Analytics Materialized View
-- =================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_api_usage_analytics AS
SELECT 
    DATE_TRUNC('day', au."createdAt") AS usage_date,
    au."userId",
    au.endpoint,
    au.model,
    COUNT(*) AS request_count,
    COUNT(*) FILTER (WHERE au.status = 'success') AS successful_requests,
    COUNT(*) FILTER (WHERE au.status = 'error') AS failed_requests,
    COUNT(*) FILTER (WHERE au.status = 'rate_limited') AS rate_limited_requests,
    SUM(au.tokens) AS total_tokens,
    SUM(au.cost)::NUMERIC(10,4) AS total_cost,
    AVG(au.tokens)::NUMERIC(10,2) AS avg_tokens_per_request,
    AVG(au.cost)::NUMERIC(10,4) AS avg_cost_per_request,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY au.tokens) AS median_tokens,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY au.tokens) AS p95_tokens
FROM api_usage au
GROUP BY DATE_TRUNC('day', au."createdAt"), au."userId", au.endpoint, au.model;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX idx_mv_api_usage_analytics ON mv_api_usage_analytics(usage_date, "userId", endpoint, model);

-- Create additional indexes
CREATE INDEX idx_mv_api_usage_analytics_date ON mv_api_usage_analytics(usage_date DESC);
CREATE INDEX idx_mv_api_usage_analytics_user ON mv_api_usage_analytics("userId");

-- =================================================================
-- PART 6: Content Calendar View
-- =================================================================

CREATE OR REPLACE VIEW v_content_calendar AS
SELECT 
    p.id AS post_id,
    p."campaignId",
    c.name AS campaign_name,
    c."userId",
    u.email AS user_email,
    p.platform,
    p.status,
    p.content,
    p."scheduledAt",
    p."publishedAt",
    p.metadata,
    DATE_TRUNC('week', COALESCE(p."scheduledAt", p."createdAt")) AS week_start,
    DATE_TRUNC('month', COALESCE(p."scheduledAt", p."createdAt")) AS month_start,
    EXTRACT(DOW FROM COALESCE(p."scheduledAt", p."createdAt")) AS day_of_week,
    EXTRACT(HOUR FROM COALESCE(p."scheduledAt", p."createdAt")) AS hour_of_day
FROM posts p
JOIN campaigns c ON c.id = p."campaignId"
JOIN users u ON u.id = c."userId"
WHERE p.deleted_at IS NULL
AND c.deleted_at IS NULL
AND u.deleted_at IS NULL
AND p.status IN ('scheduled', 'published')
ORDER BY COALESCE(p."scheduledAt", p."publishedAt") DESC;

-- =================================================================
-- PART 7: Psychology Effectiveness Materialized View
-- =================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_psychology_effectiveness AS
SELECT 
    pp.id AS principle_id,
    pp.name AS principle_name,
    pp.category,
    pp."effectivenessScore" AS base_effectiveness,
    COUNT(DISTINCT bg.id) AS times_used,
    COUNT(DISTINCT pm.id) AS metrics_count,
    AVG(pm."engagementScore")::NUMERIC(3,2) AS avg_engagement_score,
    AVG(pm."conversionRate")::NUMERIC(5,2) AS avg_conversion_rate,
    AVG(pm."recallScore")::NUMERIC(3,2) AS avg_recall_score,
    AVG(pm."clickThroughRate")::NUMERIC(5,2) AS avg_ctr,
    AVG(pm."clientSatisfaction")::NUMERIC(3,1) AS avg_satisfaction,
    jsonb_build_object(
        'best_performing_variant', (
            SELECT jsonb_build_object(
                'type', pm2."variantType",
                'content', pm2."variantContent",
                'engagement', pm2."engagementScore"
            )
            FROM psychology_metrics pm2
            WHERE pm2."principleUsed" = pp.name
            ORDER BY pm2."engagementScore" DESC
            LIMIT 1
        ),
        'category_rank', DENSE_RANK() OVER (
            PARTITION BY pp.category 
            ORDER BY pp."effectivenessScore" DESC
        )
    ) AS insights
FROM psychology_principles pp
LEFT JOIN brand_generations bg ON bg."psychologyStrategy" ? pp.name
LEFT JOIN psychology_metrics pm ON pm."principleUsed" = pp.name
GROUP BY pp.id, pp.name, pp.category, pp."effectivenessScore";

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX idx_mv_psychology_effectiveness_id ON mv_psychology_effectiveness(principle_id);

-- =================================================================
-- PART 8: Audit Trail Summary View
-- =================================================================

CREATE OR REPLACE VIEW v_audit_summary AS
SELECT 
    DATE_TRUNC('day', al."createdAt") AS audit_date,
    al."userId",
    u.email AS user_email,
    al.category,
    al.severity,
    COUNT(*) AS event_count,
    COUNT(*) FILTER (WHERE al.outcome = 'success') AS successful_events,
    COUNT(*) FILTER (WHERE al.outcome = 'failure') AS failed_events,
    jsonb_agg(DISTINCT al.action) AS unique_actions,
    jsonb_agg(DISTINCT al.resource) AS affected_resources
FROM audit_logs al
LEFT JOIN users u ON u.id = al."userId"
GROUP BY DATE_TRUNC('day', al."createdAt"), al."userId", u.email, al.category, al.severity
ORDER BY audit_date DESC, event_count DESC;

-- =================================================================
-- PART 9: Health Check Dashboard View
-- =================================================================

CREATE OR REPLACE VIEW v_system_health AS
SELECT 
    'database_size' AS metric,
    pg_database_size(current_database())::BIGINT AS value,
    'bytes' AS unit
UNION ALL
SELECT 
    'total_connections',
    COUNT(*)::BIGINT,
    'connections'
FROM pg_stat_activity
UNION ALL
SELECT 
    'active_queries',
    COUNT(*)::BIGINT,
    'queries'
FROM pg_stat_activity
WHERE state = 'active'
UNION ALL
SELECT 
    'longest_query_seconds',
    EXTRACT(EPOCH FROM MAX(now() - query_start))::BIGINT,
    'seconds'
FROM pg_stat_activity
WHERE state = 'active'
UNION ALL
SELECT 
    'cache_hit_ratio',
    ROUND(100.0 * SUM(heap_blks_hit) / NULLIF(SUM(heap_blks_hit) + SUM(heap_blks_read), 0))::BIGINT,
    'percent'
FROM pg_statio_user_tables;

-- =================================================================
-- PART 10: Refresh Functions
-- =================================================================

-- Function to refresh all materialized views
CREATE OR REPLACE FUNCTION refresh_all_materialized_views() 
RETURNS TABLE(view_name TEXT, refresh_time INTERVAL) AS $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
BEGIN
    -- Campaign Performance
    start_time := clock_timestamp();
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_campaign_performance;
    end_time := clock_timestamp();
    RETURN QUERY SELECT 'mv_campaign_performance'::TEXT, end_time - start_time;
    
    -- Daily Platform Metrics
    start_time := clock_timestamp();
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_platform_metrics;
    end_time := clock_timestamp();
    RETURN QUERY SELECT 'mv_daily_platform_metrics'::TEXT, end_time - start_time;
    
    -- Organization Dashboard
    start_time := clock_timestamp();
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_organization_dashboard;
    end_time := clock_timestamp();
    RETURN QUERY SELECT 'mv_organization_dashboard'::TEXT, end_time - start_time;
    
    -- API Usage Analytics
    start_time := clock_timestamp();
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_api_usage_analytics;
    end_time := clock_timestamp();
    RETURN QUERY SELECT 'mv_api_usage_analytics'::TEXT, end_time - start_time;
    
    -- Psychology Effectiveness
    start_time := clock_timestamp();
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_psychology_effectiveness;
    end_time := clock_timestamp();
    RETURN QUERY SELECT 'mv_psychology_effectiveness'::TEXT, end_time - start_time;
END;
$$ LANGUAGE plpgsql;

-- Schedule refresh job
INSERT INTO jobs (job_type, payload, run_at, priority, max_attempts)
VALUES (
    'refresh_materialized_views',
    '{"function": "refresh_all_materialized_views"}',
    CURRENT_TIMESTAMP + INTERVAL '1 hour',
    5,
    3
) ON CONFLICT DO NOTHING;

COMMIT;

-- =================================================================
-- USAGE EXAMPLES
-- =================================================================

-- Get user activity summary:
-- SELECT * FROM v_user_activity_summary WHERE user_id = 'USER_ID';

-- Get campaign performance:
-- SELECT * FROM mv_campaign_performance WHERE "userId" = 'USER_ID' ORDER BY total_posts DESC;

-- Get daily metrics:
-- SELECT * FROM mv_daily_platform_metrics WHERE metric_date >= CURRENT_DATE - INTERVAL '7 days';

-- Get organization dashboard:
-- SELECT * FROM mv_organization_dashboard WHERE org_id = 'ORG_ID';

-- Refresh a specific view manually:
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_campaign_performance;

-- =================================================================
-- ROLLBACK SCRIPT
-- =================================================================
-- BEGIN;
-- DROP VIEW IF EXISTS v_user_activity_summary CASCADE;
-- DROP MATERIALIZED VIEW IF EXISTS mv_campaign_performance CASCADE;
-- DROP MATERIALIZED VIEW IF EXISTS mv_daily_platform_metrics CASCADE;
-- DROP MATERIALIZED VIEW IF EXISTS mv_organization_dashboard CASCADE;
-- DROP MATERIALIZED VIEW IF EXISTS mv_api_usage_analytics CASCADE;
-- DROP VIEW IF EXISTS v_content_calendar CASCADE;
-- DROP MATERIALIZED VIEW IF EXISTS mv_psychology_effectiveness CASCADE;
-- DROP VIEW IF EXISTS v_audit_summary CASCADE;
-- DROP VIEW IF EXISTS v_system_health CASCADE;
-- DROP FUNCTION IF EXISTS refresh_all_materialized_views() CASCADE;
-- COMMIT;