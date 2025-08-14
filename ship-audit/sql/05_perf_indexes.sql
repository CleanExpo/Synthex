-- =================================================================
-- 05_perf_indexes.sql - Performance Optimization Indexes
-- Generated: 2025-08-13
-- Purpose: Create indexes based on actual query patterns
-- =================================================================

BEGIN;

-- =================================================================
-- PART 1: Authentication & User Lookup Indexes
-- =================================================================

-- Email lookup (case-insensitive) - Most common auth query
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_lower 
ON users(lower(email)) 
WHERE deleted_at IS NULL;

-- Google OAuth lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_googleid 
ON users("googleId") 
WHERE "googleId" IS NOT NULL AND deleted_at IS NULL;

-- Password reset token lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_reset_token 
ON users("resetToken") 
WHERE "resetToken" IS NOT NULL AND deleted_at IS NULL;

-- Verification code lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_verification_code 
ON users("verificationCode") 
WHERE "verificationCode" IS NOT NULL AND deleted_at IS NULL;

-- =================================================================
-- PART 2: Campaign Query Optimization
-- =================================================================

-- User's active campaigns (very common dashboard query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_user_status_active 
ON campaigns("userId", status, "createdAt" DESC) 
WHERE deleted_at IS NULL AND status IN ('active', 'draft');

-- Campaign count by user (for statistics)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_user_count 
ON campaigns("userId") 
WHERE deleted_at IS NULL;

-- Campaigns by platform
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_platform_status 
ON campaigns(platform, status, "createdAt" DESC) 
WHERE deleted_at IS NULL;

-- Recent campaigns (for admin dashboard)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_recent 
ON campaigns("createdAt" DESC) 
WHERE deleted_at IS NULL;

-- =================================================================
-- PART 3: Posts Query Optimization
-- =================================================================

-- Scheduled posts (for cron jobs)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_scheduled 
ON posts("scheduledAt", status) 
WHERE deleted_at IS NULL AND status = 'scheduled' AND "scheduledAt" IS NOT NULL;

-- Posts by campaign (very frequent)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_campaign_status 
ON posts("campaignId", status, "createdAt" DESC) 
WHERE deleted_at IS NULL;

-- Published posts for analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_published 
ON posts("publishedAt" DESC, platform) 
WHERE deleted_at IS NULL AND status = 'published';

-- Posts count by campaign
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_campaign_count 
ON posts("campaignId") 
WHERE deleted_at IS NULL;

-- =================================================================
-- PART 4: Notification Query Optimization
-- =================================================================

-- Unread notifications by user (header badge query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_unread 
ON notifications("userId", "createdAt" DESC) 
WHERE read = false;

-- Recent notifications by user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_recent 
ON notifications("userId", "createdAt" DESC);

-- Notification count by user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_count 
ON notifications("userId", read);

-- =================================================================
-- PART 5: Audit Log Query Optimization
-- =================================================================

-- Audit logs by user with date range
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_date 
ON audit_logs("userId", "createdAt" DESC) 
WHERE "userId" IS NOT NULL;

-- Audit logs by resource
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_resource 
ON audit_logs(resource, "resourceId", "createdAt" DESC);

-- Critical security events
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_security 
ON audit_logs(severity, category, "createdAt" DESC) 
WHERE severity IN ('high', 'critical') AND category = 'security';

-- Failed operations for monitoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_failures 
ON audit_logs(outcome, "createdAt" DESC) 
WHERE outcome = 'failure';

-- =================================================================
-- PART 6: API Usage Query Optimization
-- =================================================================

-- API usage by user and date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_usage_user_date 
ON api_usage("userId", "createdAt" DESC);

-- API usage by endpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_usage_endpoint 
ON api_usage(endpoint, "createdAt" DESC);

-- Failed API calls for debugging
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_usage_errors 
ON api_usage(status, "createdAt" DESC) 
WHERE status IN ('error', 'rate_limited');

-- Cost tracking by user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_usage_cost 
ON api_usage("userId", cost) 
WHERE cost IS NOT NULL AND cost > 0;

-- =================================================================
-- PART 7: Platform Connection Optimization
-- =================================================================

-- Active connections by user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_platform_connections_user_active 
ON platform_connections("userId", platform) 
WHERE deleted_at IS NULL AND "isActive" = true;

-- Connections needing refresh
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_platform_connections_refresh 
ON platform_connections("expiresAt") 
WHERE deleted_at IS NULL AND "isActive" = true AND "expiresAt" IS NOT NULL;

-- =================================================================
-- PART 8: Platform Posts Optimization
-- =================================================================

-- Platform posts by connection and status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_platform_posts_connection_status 
ON platform_posts("connectionId", status, "scheduledAt") 
WHERE deleted_at IS NULL;

-- Failed platform posts for retry
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_platform_posts_failed 
ON platform_posts(status, "createdAt" DESC) 
WHERE deleted_at IS NULL AND status = 'failed';

-- =================================================================
-- PART 9: Team & Organization Optimization
-- =================================================================

-- Organization members
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_organization 
ON users("organizationId") 
WHERE deleted_at IS NULL AND "organizationId" IS NOT NULL;

-- Pending invitations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_team_invitations_pending 
ON team_invitations(status, "sentAt" DESC) 
WHERE status = 'sent';

-- Invitations by email
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_team_invitations_email_lookup 
ON team_invitations(lower(email), status);

-- =================================================================
-- PART 10: Psychology & Brand Optimization
-- =================================================================

-- Brand generations by user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_brand_generations_user_status 
ON brand_generations("userId", status, "createdAt" DESC) 
WHERE deleted_at IS NULL;

-- Psychology principles by category
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_psychology_principles_category 
ON psychology_principles(category, "effectivenessScore" DESC);

-- Most used principles
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_psychology_principles_usage 
ON psychology_principles("usageCount" DESC, "effectivenessScore" DESC);

-- =================================================================
-- PART 11: Session Management
-- =================================================================

-- Active sessions lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_token 
ON sessions(token) 
WHERE "expiresAt" > CURRENT_TIMESTAMP;

-- Sessions by user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_user 
ON sessions("userId", "expiresAt" DESC);

-- Expired sessions for cleanup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_expired 
ON sessions("expiresAt") 
WHERE "expiresAt" <= CURRENT_TIMESTAMP;

-- =================================================================
-- PART 12: Composite Indexes for Complex Queries
-- =================================================================

-- Dashboard statistics query
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dashboard_stats 
ON campaigns("userId", status, platform, "createdAt" DESC) 
WHERE deleted_at IS NULL;

-- User activity summary
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_activity 
ON audit_logs("userId", action, "createdAt" DESC) 
WHERE "userId" IS NOT NULL;

-- Content calendar view
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_calendar 
ON posts("campaignId", "scheduledAt", status) 
WHERE deleted_at IS NULL AND "scheduledAt" IS NOT NULL;

-- =================================================================
-- PART 13: Partial Indexes for Common Filters
-- =================================================================

-- Active users only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_active 
ON users(id, email) 
WHERE deleted_at IS NULL AND "emailVerified" = true;

-- Draft content
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_drafts 
ON posts("campaignId", "updatedAt" DESC) 
WHERE deleted_at IS NULL AND status = 'draft';

-- Published content
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_published_content 
ON posts(platform, "publishedAt" DESC) 
WHERE deleted_at IS NULL AND status = 'published';

-- =================================================================
-- PART 14: BRIN Indexes for Time-Series Data
-- =================================================================

-- BRIN indexes are perfect for large tables with natural ordering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_usage_created_brin 
ON api_usage USING BRIN ("createdAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_created_brin 
ON audit_logs USING BRIN ("createdAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_platform_metrics_recorded_brin 
ON platform_metrics USING BRIN ("recordedAt");

-- =================================================================
-- PART 15: Text Search Indexes
-- =================================================================

-- Full-text search on posts content
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_content_search 
ON posts USING GIN (to_tsvector('english', content)) 
WHERE deleted_at IS NULL;

-- Campaign name and description search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_search 
ON campaigns USING GIN (
    to_tsvector('english', name || ' ' || COALESCE(description, ''))
) WHERE deleted_at IS NULL;

-- =================================================================
-- PART 16: Analyze Tables for Query Planner
-- =================================================================

-- Update statistics for query planner
ANALYZE users;
ANALYZE campaigns;
ANALYZE posts;
ANALYZE notifications;
ANALYZE api_usage;
ANALYZE audit_logs;
ANALYZE platform_connections;
ANALYZE platform_posts;
ANALYZE platform_metrics;

COMMIT;

-- =================================================================
-- MONITORING QUERIES
-- =================================================================

-- Check index usage:
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
-- FROM pg_stat_user_indexes
-- ORDER BY idx_scan DESC;

-- Find missing indexes:
-- SELECT schemaname, tablename, attname, n_distinct, correlation
-- FROM pg_stats
-- WHERE schemaname = 'public'
-- AND n_distinct > 100
-- AND correlation < 0.1
-- ORDER BY n_distinct DESC;

-- Check slow queries (requires pg_stat_statements):
-- SELECT query, calls, total_exec_time, mean_exec_time, stddev_exec_time
-- FROM pg_stat_statements
-- WHERE mean_exec_time > 100
-- ORDER BY mean_exec_time DESC
-- LIMIT 20;

-- =================================================================
-- ROLLBACK SCRIPT
-- =================================================================
-- BEGIN;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_users_email_lower;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_users_googleid;
-- -- Continue for all indexes...
-- COMMIT;