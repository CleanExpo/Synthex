-- Database Performance Optimization Migration
-- Creates optimized indexes for improved query performance
-- Run this migration to add performance indexes to existing tables

-- Enable concurrent index creation to avoid blocking operations
SET maintenance_work_mem = '256MB';

-- Profiles table indexes for user management
-- Email lookup (login, password reset)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_email 
ON profiles (email);

-- User creation date for analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_created_at 
ON profiles (created_at);

-- Plan-based queries for billing and features
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_plan 
ON profiles (plan);

-- Last login tracking for user activity
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_last_login 
ON profiles (last_login_at) 
WHERE last_login_at IS NOT NULL;

-- Profile status for active/inactive users
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_status 
ON profiles (status) 
WHERE status IS NOT NULL;

-- Optimized content table indexes for content management
-- User's content lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_user_id 
ON optimized_content (user_id);

-- Platform-specific content queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_platform 
ON optimized_content (platform);

-- Content creation date for chronological queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_created_at 
ON optimized_content (created_at);

-- Content quality scoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_score 
ON optimized_content (score) 
WHERE score IS NOT NULL;

-- Composite indexes for complex queries
-- User's content by platform
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_user_platform 
ON optimized_content (user_id, platform);

-- User's content by date (for pagination)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_user_date 
ON optimized_content (user_id, created_at DESC);

-- Platform content by score (for leaderboards)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_platform_score 
ON optimized_content (platform, score DESC) 
WHERE score IS NOT NULL;

-- Content search by keywords (using GIN for full-text search)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_search 
ON optimized_content USING GIN (to_tsvector('english', original_content || ' ' || COALESCE(optimized_content, '')));

-- Analytics table indexes for performance tracking
-- User analytics lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_user_id 
ON analytics (user_id);

-- Platform analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_platform 
ON analytics (platform);

-- Time-based analytics queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_timestamp 
ON analytics (timestamp);

-- Event type analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_event_type 
ON analytics (event_type) 
WHERE event_type IS NOT NULL;

-- Composite indexes for analytics dashboards
-- User analytics by time (for user dashboard)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_user_time 
ON analytics (user_id, timestamp DESC);

-- Platform analytics by time (for platform insights)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_platform_time 
ON analytics (platform, timestamp DESC);

-- Event analytics by time (for system monitoring)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_event_time 
ON analytics (event_type, timestamp DESC) 
WHERE event_type IS NOT NULL;

-- Campaigns table indexes for campaign management
-- User's campaigns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_user_id 
ON campaigns (user_id);

-- Campaign status for filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_status 
ON campaigns (status);

-- Campaign creation date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_created_at 
ON campaigns (created_at);

-- Scheduled campaigns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_scheduled_at 
ON campaigns (scheduled_at) 
WHERE scheduled_at IS NOT NULL;

-- Composite indexes for campaign queries
-- User's campaigns by status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_user_status 
ON campaigns (user_id, status);

-- Active campaigns by schedule
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_active_schedule 
ON campaigns (status, scheduled_at) 
WHERE status = 'active' AND scheduled_at IS NOT NULL;

-- User sessions table indexes for session management
-- User session lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_user_id 
ON user_sessions (user_id);

-- Session expiration cleanup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_expires_at 
ON user_sessions (expires_at);

-- Session creation tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_created_at 
ON user_sessions (created_at);

-- Active sessions lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_active 
ON user_sessions (user_id, expires_at) 
WHERE expires_at > NOW();

-- Feature usage table indexes for usage analytics
-- User feature usage
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feature_usage_user_id 
ON feature_usage (user_id);

-- Feature popularity tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feature_usage_feature 
ON feature_usage (feature_name);

-- Usage timestamp for analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feature_usage_timestamp 
ON feature_usage (timestamp);

-- Composite index for user feature tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feature_usage_user_feature 
ON feature_usage (user_id, feature_name);

-- Feature usage by time for trends
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feature_usage_feature_time 
ON feature_usage (feature_name, timestamp DESC);

-- API usage table indexes for API monitoring
-- User API usage
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_usage_user_id 
ON api_usage (user_id);

-- Endpoint usage tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_usage_endpoint 
ON api_usage (endpoint);

-- API usage timestamp
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_usage_timestamp 
ON api_usage (timestamp);

-- Response status for error tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_usage_status 
ON api_usage (response_status);

-- Composite indexes for API analytics
-- User API usage by time
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_usage_user_time 
ON api_usage (user_id, timestamp DESC);

-- Endpoint usage by time
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_usage_endpoint_time 
ON api_usage (endpoint, timestamp DESC);

-- Error tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_usage_errors 
ON api_usage (endpoint, response_status, timestamp DESC) 
WHERE response_status >= 400;

-- Notifications table indexes for notification system
-- User notifications
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_id 
ON notifications (user_id);

-- Unread notifications for user interface
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_read 
ON notifications (read);

-- Notification creation date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_created_at 
ON notifications (created_at);

-- Notification type for filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_type 
ON notifications (type) 
WHERE type IS NOT NULL;

-- Composite indexes for notification queries
-- User's unread notifications
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_read 
ON notifications (user_id, read, created_at DESC);

-- Recent notifications by type
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_type_time 
ON notifications (type, created_at DESC) 
WHERE type IS NOT NULL;

-- Performance monitoring views
-- Create materialized view for user statistics (refreshed periodically)
CREATE MATERIALIZED VIEW IF NOT EXISTS user_stats AS
SELECT 
    p.id as user_id,
    p.email,
    p.plan,
    p.created_at as user_created_at,
    COUNT(DISTINCT oc.id) as total_content,
    COUNT(DISTINCT c.id) as total_campaigns,
    AVG(oc.score) as avg_content_score,
    MAX(oc.created_at) as last_content_created,
    COUNT(DISTINCT a.id) as total_analytics_events,
    MAX(a.timestamp) as last_activity
FROM profiles p
LEFT JOIN optimized_content oc ON p.id = oc.user_id
LEFT JOIN campaigns c ON p.id = c.user_id
LEFT JOIN analytics a ON p.id = a.user_id
GROUP BY p.id, p.email, p.plan, p.created_at;

-- Index on the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_stats_user_id 
ON user_stats (user_id);

CREATE INDEX IF NOT EXISTS idx_user_stats_plan 
ON user_stats (plan);

CREATE INDEX IF NOT EXISTS idx_user_stats_activity 
ON user_stats (last_activity) 
WHERE last_activity IS NOT NULL;

-- Platform performance view
CREATE MATERIALIZED VIEW IF NOT EXISTS platform_stats AS
SELECT 
    platform,
    COUNT(*) as total_content,
    AVG(score) as avg_score,
    MAX(created_at) as last_created,
    COUNT(DISTINCT user_id) as unique_users,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY score) as median_score,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY score) as score_95th_percentile
FROM optimized_content
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY platform;

-- Index on platform stats
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_stats_platform 
ON platform_stats (platform);

-- Partial indexes for specific use cases
-- Recent high-scoring content
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_recent_high_score 
ON optimized_content (platform, created_at DESC) 
WHERE score >= 80 AND created_at > NOW() - INTERVAL '7 days';

-- Active premium users
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_premium_active 
ON profiles (created_at, last_login_at) 
WHERE plan IN ('pro', 'enterprise') AND last_login_at > NOW() - INTERVAL '30 days';

-- Recent API errors
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_usage_recent_errors 
ON api_usage (timestamp DESC, endpoint, response_status) 
WHERE response_status >= 400 AND timestamp > NOW() - INTERVAL '1 day';

-- Performance optimization settings
-- Update table statistics
ANALYZE profiles;
ANALYZE optimized_content;
ANALYZE analytics;
ANALYZE campaigns;
ANALYZE user_sessions;
ANALYZE feature_usage;
ANALYZE api_usage;
ANALYZE notifications;

-- Set up automatic statistics collection
ALTER TABLE profiles SET (autovacuum_analyze_scale_factor = 0.05);
ALTER TABLE optimized_content SET (autovacuum_analyze_scale_factor = 0.05);
ALTER TABLE analytics SET (autovacuum_analyze_scale_factor = 0.02);

-- Comments for documentation
COMMENT ON INDEX idx_profiles_email IS 'Unique index for user login and email lookups';
COMMENT ON INDEX idx_content_user_platform IS 'Composite index for user content by platform queries';
COMMENT ON INDEX idx_analytics_user_time IS 'Composite index for user analytics dashboard queries';
COMMENT ON MATERIALIZED VIEW user_stats IS 'Aggregated user statistics for dashboard performance';
COMMENT ON MATERIALIZED VIEW platform_stats IS 'Platform performance metrics refreshed periodically';

-- Create function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_performance_views() 
RETURNS void 
LANGUAGE plpgsql 
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW user_stats;
    REFRESH MATERIALIZED VIEW platform_stats;
    
    -- Log the refresh
    INSERT INTO analytics (user_id, platform, event_type, metadata, timestamp)
    VALUES (NULL, 'system', 'view_refresh', '{"views": ["user_stats", "platform_stats"]}', NOW());
END;
$$;

-- Schedule materialized view refresh (requires pg_cron extension)
-- This would typically be set up separately or via application scheduling
-- SELECT cron.schedule('refresh-performance-views', '0 */6 * * *', 'SELECT refresh_performance_views();');

-- Create index usage monitoring function
CREATE OR REPLACE FUNCTION get_index_usage_stats() 
RETURNS TABLE (
    schemaname text,
    tablename text,
    indexname text,
    idx_scan bigint,
    idx_tup_read bigint,
    idx_tup_fetch bigint,
    usage_ratio numeric
) 
LANGUAGE sql 
AS $$
    SELECT 
        schemaname,
        tablename,
        indexname,
        idx_scan,
        idx_tup_read,
        idx_tup_fetch,
        CASE 
            WHEN idx_scan = 0 THEN 0
            ELSE ROUND((idx_tup_fetch::numeric / idx_tup_read::numeric) * 100, 2)
        END as usage_ratio
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public'
    ORDER BY idx_scan DESC;
$$;

COMMENT ON FUNCTION get_index_usage_stats() IS 'Monitor index usage statistics for optimization';

-- Performance monitoring queries (as comments for reference)
/*
-- Query to find unused indexes:
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'public' AND idx_scan = 0
ORDER BY schemaname, tablename, indexname;

-- Query to find slow queries (requires pg_stat_statements extension):
SELECT query, calls, total_time, mean_time, stddev_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 20;

-- Query to check index usage efficiency:
SELECT * FROM get_index_usage_stats()
WHERE usage_ratio < 50
ORDER BY idx_scan DESC;
*/

-- Commit the migration
COMMIT;