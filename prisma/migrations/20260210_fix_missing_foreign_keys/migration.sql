-- Migration: Fix Missing Foreign Keys & Add Performance Indexes
-- Generated: 2026-02-10
-- Purpose: Address schema audit findings - 18+ missing FK constraints
--
-- IMPORTANT: Review each constraint before applying to production
-- Some tables may have orphaned data that needs cleanup first

-- ============================================================================
-- PHASE 1: DATA CLEANUP QUERIES (Run these first to identify orphaned records)
-- ============================================================================

-- Uncomment and run these to find orphaned records before adding FKs:
/*
-- Find analytics_events with invalid userId
SELECT id, "userId" FROM "analytics_events"
WHERE "userId" IS NOT NULL AND "userId" NOT IN (SELECT id FROM "users");

-- Find ab_tests with invalid userId
SELECT id, "userId" FROM "ab_tests"
WHERE "userId" IS NOT NULL AND "userId" NOT IN (SELECT id FROM "users");

-- Find tasks with invalid userId
SELECT id, "userId" FROM "tasks"
WHERE "userId" IS NOT NULL AND "userId" NOT IN (SELECT id FROM "users");

-- Find tasks with invalid campaignId
SELECT id, "campaignId" FROM "tasks"
WHERE "campaignId" IS NOT NULL AND "campaignId" NOT IN (SELECT id FROM "campaigns");

-- Find quotes with invalid userId
SELECT id, "userId" FROM "quotes"
WHERE "userId" IS NOT NULL AND "userId" NOT IN (SELECT id FROM "users");
*/

-- ============================================================================
-- PHASE 2: ADD MISSING FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- -----------------------------------------------------------------------------
-- Analytics & Reporting Tables
-- -----------------------------------------------------------------------------

-- analytics_events.userId -> users.id
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'analytics_events_userId_fkey'
    ) THEN
        ALTER TABLE "analytics_events"
        ADD CONSTRAINT "analytics_events_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- analytics_events.campaignId -> campaigns.id
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'analytics_events_campaignId_fkey'
    ) THEN
        ALTER TABLE "analytics_events"
        ADD CONSTRAINT "analytics_events_campaignId_fkey"
        FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- sentiment_analyses.userId -> users.id
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'sentiment_analyses_userId_fkey'
    ) THEN
        ALTER TABLE "sentiment_analyses"
        ADD CONSTRAINT "sentiment_analyses_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- sentiment_trends.userId -> users.id
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'sentiment_trends_userId_fkey'
    ) THEN
        ALTER TABLE "sentiment_trends"
        ADD CONSTRAINT "sentiment_trends_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- sentiment_trends.organizationId -> organizations.id
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'sentiment_trends_organizationId_fkey'
    ) THEN
        ALTER TABLE "sentiment_trends"
        ADD CONSTRAINT "sentiment_trends_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- engagement_predictions.userId -> users.id
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'engagement_predictions_userId_fkey'
    ) THEN
        ALTER TABLE "engagement_predictions"
        ADD CONSTRAINT "engagement_predictions_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- A/B Testing Tables
-- -----------------------------------------------------------------------------

-- ab_tests.userId -> users.id
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'ab_tests_userId_fkey'
    ) THEN
        ALTER TABLE "ab_tests"
        ADD CONSTRAINT "ab_tests_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- ab_tests.campaignId -> campaigns.id (if column exists)
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ab_tests' AND column_name = 'campaignId'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'ab_tests_campaignId_fkey'
    ) THEN
        ALTER TABLE "ab_tests"
        ADD CONSTRAINT "ab_tests_campaignId_fkey"
        FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Competitor Tracking Tables
-- -----------------------------------------------------------------------------

-- tracked_competitors.userId -> users.id
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'tracked_competitors_userId_fkey'
    ) THEN
        ALTER TABLE "tracked_competitors"
        ADD CONSTRAINT "tracked_competitors_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- competitor_comparisons.userId -> users.id
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'competitor_comparisons_userId_fkey'
    ) THEN
        ALTER TABLE "competitor_comparisons"
        ADD CONSTRAINT "competitor_comparisons_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Task Management Tables
-- -----------------------------------------------------------------------------

-- tasks.userId -> users.id
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'tasks_userId_fkey'
    ) THEN
        ALTER TABLE "tasks"
        ADD CONSTRAINT "tasks_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- tasks.assigneeId -> users.id
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tasks' AND column_name = 'assigneeId'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'tasks_assigneeId_fkey'
    ) THEN
        ALTER TABLE "tasks"
        ADD CONSTRAINT "tasks_assigneeId_fkey"
        FOREIGN KEY ("assigneeId") REFERENCES "users"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- tasks.campaignId -> campaigns.id
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tasks' AND column_name = 'campaignId'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'tasks_campaignId_fkey'
    ) THEN
        ALTER TABLE "tasks"
        ADD CONSTRAINT "tasks_campaignId_fkey"
        FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Content Sharing Tables
-- -----------------------------------------------------------------------------

-- content_shares.sharedById -> users.id
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'content_shares_sharedById_fkey'
    ) THEN
        ALTER TABLE "content_shares"
        ADD CONSTRAINT "content_shares_sharedById_fkey"
        FOREIGN KEY ("sharedById") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- content_access_logs.userId -> users.id
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'content_access_logs_userId_fkey'
    ) THEN
        ALTER TABLE "content_access_logs"
        ADD CONSTRAINT "content_access_logs_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- content_access_logs.shareId -> content_shares.id
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'content_access_logs_shareId_fkey'
    ) THEN
        ALTER TABLE "content_access_logs"
        ADD CONSTRAINT "content_access_logs_shareId_fkey"
        FOREIGN KEY ("shareId") REFERENCES "content_shares"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Quotes Tables
-- -----------------------------------------------------------------------------

-- quotes.userId -> users.id
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'quotes_userId_fkey'
    ) THEN
        ALTER TABLE "quotes"
        ADD CONSTRAINT "quotes_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- quotes.campaignId -> campaigns.id
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'quotes' AND column_name = 'campaignId'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'quotes_campaignId_fkey'
    ) THEN
        ALTER TABLE "quotes"
        ADD CONSTRAINT "quotes_campaignId_fkey"
        FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- quote_collections.userId -> users.id
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'quote_collections_userId_fkey'
    ) THEN
        ALTER TABLE "quote_collections"
        ADD CONSTRAINT "quote_collections_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Reporting Tables
-- -----------------------------------------------------------------------------

-- report_templates.userId -> users.id
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'report_templates_userId_fkey'
    ) THEN
        ALTER TABLE "report_templates"
        ADD CONSTRAINT "report_templates_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- report_templates.organizationId -> organizations.id
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'report_templates' AND column_name = 'organizationId'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'report_templates_organizationId_fkey'
    ) THEN
        ALTER TABLE "report_templates"
        ADD CONSTRAINT "report_templates_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- report_deliveries.reportId -> reports.id
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'report_deliveries_reportId_fkey'
    ) THEN
        ALTER TABLE "report_deliveries"
        ADD CONSTRAINT "report_deliveries_reportId_fkey"
        FOREIGN KEY ("reportId") REFERENCES "reports"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- report_deliveries.scheduledReportId -> scheduled_reports.id
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'report_deliveries' AND column_name = 'scheduledReportId'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'report_deliveries_scheduledReportId_fkey'
    ) THEN
        ALTER TABLE "report_deliveries"
        ADD CONSTRAINT "report_deliveries_scheduledReportId_fkey"
        FOREIGN KEY ("scheduledReportId") REFERENCES "scheduled_reports"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- scheduled_reports.templateId -> report_templates.id
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'scheduled_reports' AND column_name = 'templateId'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'scheduled_reports_templateId_fkey'
    ) THEN
        ALTER TABLE "scheduled_reports"
        ADD CONSTRAINT "scheduled_reports_templateId_fkey"
        FOREIGN KEY ("templateId") REFERENCES "report_templates"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Notification Tables
-- -----------------------------------------------------------------------------

-- team_notifications.userId -> users.id
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'team_notifications_userId_fkey'
    ) THEN
        ALTER TABLE "team_notifications"
        ADD CONSTRAINT "team_notifications_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- team_notifications.organizationId -> organizations.id
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'team_notifications' AND column_name = 'organizationId'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'team_notifications_organizationId_fkey'
    ) THEN
        ALTER TABLE "team_notifications"
        ADD CONSTRAINT "team_notifications_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;


-- ============================================================================
-- PHASE 3: ADD MISSING PERFORMANCE INDEXES
-- ============================================================================

-- -----------------------------------------------------------------------------
-- Analytics Indexes (Critical for dashboard performance)
-- -----------------------------------------------------------------------------

-- analytics_events: userId + timestamp compound index
CREATE INDEX CONCURRENTLY IF NOT EXISTS "analytics_events_userId_timestamp_idx"
ON "analytics_events" ("userId", "timestamp" DESC);

-- analytics_events: campaignId + timestamp for campaign analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS "analytics_events_campaignId_timestamp_idx"
ON "analytics_events" ("campaignId", "timestamp" DESC);

-- analytics_events: eventType for filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS "analytics_events_eventType_idx"
ON "analytics_events" ("eventType");

-- sentiment_analyses: userId + analyzedAt
CREATE INDEX CONCURRENTLY IF NOT EXISTS "sentiment_analyses_userId_analyzedAt_idx"
ON "sentiment_analyses" ("userId", "analyzedAt" DESC);

-- sentiment_trends: userId + date compound index
CREATE INDEX CONCURRENTLY IF NOT EXISTS "sentiment_trends_userId_date_idx"
ON "sentiment_trends" ("userId", "date" DESC);

-- sentiment_trends: organizationId + date
CREATE INDEX CONCURRENTLY IF NOT EXISTS "sentiment_trends_organizationId_date_idx"
ON "sentiment_trends" ("organizationId", "date" DESC);

-- engagement_predictions: userId + publishedAt
CREATE INDEX CONCURRENTLY IF NOT EXISTS "engagement_predictions_userId_publishedAt_idx"
ON "engagement_predictions" ("userId", "publishedAt" DESC);

-- -----------------------------------------------------------------------------
-- A/B Testing Indexes
-- -----------------------------------------------------------------------------

-- ab_tests: userId + status for active tests lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ab_tests_userId_status_idx"
ON "ab_tests" ("userId", "status");

-- ab_tests: createdAt for sorting
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ab_tests_createdAt_idx"
ON "ab_tests" ("createdAt" DESC);

-- -----------------------------------------------------------------------------
-- Competitor Tracking Indexes
-- -----------------------------------------------------------------------------

-- tracked_competitors: userId + lastTrackedAt
CREATE INDEX CONCURRENTLY IF NOT EXISTS "tracked_competitors_userId_lastTrackedAt_idx"
ON "tracked_competitors" ("userId", "lastTrackedAt" DESC);

-- competitor_posts: platform + postedAt for platform-specific queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "competitor_posts_platform_postedAt_idx"
ON "competitor_posts" ("platform", "postedAt" DESC);

-- competitor_snapshots: competitorId + capturedAt
CREATE INDEX CONCURRENTLY IF NOT EXISTS "competitor_snapshots_competitorId_capturedAt_idx"
ON "competitor_snapshots" ("competitorId", "capturedAt" DESC);

-- -----------------------------------------------------------------------------
-- Content & Calendar Indexes
-- -----------------------------------------------------------------------------

-- content_shares: sharedById + createdAt
CREATE INDEX CONCURRENTLY IF NOT EXISTS "content_shares_sharedById_createdAt_idx"
ON "content_shares" ("sharedById", "createdAt" DESC);

-- content_shares: shareToken for lookup (unique)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "content_shares_shareToken_key"
ON "content_shares" ("shareToken");

-- calendar_posts: organizationId + scheduledFor (critical for calendar view)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "calendar_posts_organizationId_scheduledFor_idx"
ON "calendar_posts" ("organizationId", "scheduledFor");

-- calendar_posts: userId + status
CREATE INDEX CONCURRENTLY IF NOT EXISTS "calendar_posts_userId_status_idx"
ON "calendar_posts" ("userId", "status");

-- -----------------------------------------------------------------------------
-- Reporting Indexes
-- -----------------------------------------------------------------------------

-- reports: userId + createdAt
CREATE INDEX CONCURRENTLY IF NOT EXISTS "reports_userId_createdAt_idx"
ON "reports" ("userId", "createdAt" DESC);

-- scheduled_reports: userId + nextRunAt for scheduler
CREATE INDEX CONCURRENTLY IF NOT EXISTS "scheduled_reports_userId_nextRunAt_idx"
ON "scheduled_reports" ("userId", "nextRunAt");

-- scheduled_reports: isActive for filtering active schedules
CREATE INDEX CONCURRENTLY IF NOT EXISTS "scheduled_reports_isActive_idx"
ON "scheduled_reports" ("isActive") WHERE "isActive" = true;

-- -----------------------------------------------------------------------------
-- Task Management Indexes
-- -----------------------------------------------------------------------------

-- tasks: userId + status for task list
CREATE INDEX CONCURRENTLY IF NOT EXISTS "tasks_userId_status_idx"
ON "tasks" ("userId", "status");

-- tasks: assigneeId + dueDate for assignment queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "tasks_assigneeId_dueDate_idx"
ON "tasks" ("assigneeId", "dueDate");

-- tasks: campaignId for campaign task lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS "tasks_campaignId_idx"
ON "tasks" ("campaignId");


-- ============================================================================
-- PHASE 4: ADD MISSING CONSTRAINTS
-- ============================================================================

-- -----------------------------------------------------------------------------
-- Add CHECK constraints for status/enum columns
-- -----------------------------------------------------------------------------

-- campaigns.status check
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'campaigns_status_check'
    ) THEN
        ALTER TABLE "campaigns"
        ADD CONSTRAINT "campaigns_status_check"
        CHECK ("status" IN ('draft', 'active', 'paused', 'completed', 'archived'));
    END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ab_tests.status check
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'ab_tests_status_check'
    ) THEN
        ALTER TABLE "ab_tests"
        ADD CONSTRAINT "ab_tests_status_check"
        CHECK ("status" IN ('draft', 'running', 'paused', 'completed', 'archived'));
    END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- tasks.status check
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'tasks_status_check'
    ) THEN
        ALTER TABLE "tasks"
        ADD CONSTRAINT "tasks_status_check"
        CHECK ("status" IN ('pending', 'in_progress', 'completed', 'cancelled'));
    END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- tasks.priority check
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'tasks_priority_check'
    ) THEN
        ALTER TABLE "tasks"
        ADD CONSTRAINT "tasks_priority_check"
        CHECK ("priority" IN ('low', 'medium', 'high', 'urgent'));
    END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- calendar_posts.status check
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'calendar_posts_status_check'
    ) THEN
        ALTER TABLE "calendar_posts"
        ADD CONSTRAINT "calendar_posts_status_check"
        CHECK ("status" IN ('draft', 'scheduled', 'published', 'failed', 'cancelled'));
    END IF;
EXCEPTION WHEN others THEN NULL;
END $$;


-- ============================================================================
-- PHASE 5: VERIFICATION QUERIES
-- ============================================================================

-- Run these after migration to verify success:

-- Count foreign keys added
SELECT
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name;

-- Count indexes created
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Verify no orphaned records exist
-- (Run BEFORE applying FKs if you get constraint violations)


-- ============================================================================
-- ROLLBACK SCRIPT (In case of issues)
-- ============================================================================

/*
-- To rollback foreign keys:
ALTER TABLE "analytics_events" DROP CONSTRAINT IF EXISTS "analytics_events_userId_fkey";
ALTER TABLE "analytics_events" DROP CONSTRAINT IF EXISTS "analytics_events_campaignId_fkey";
ALTER TABLE "sentiment_analyses" DROP CONSTRAINT IF EXISTS "sentiment_analyses_userId_fkey";
ALTER TABLE "sentiment_trends" DROP CONSTRAINT IF EXISTS "sentiment_trends_userId_fkey";
ALTER TABLE "sentiment_trends" DROP CONSTRAINT IF EXISTS "sentiment_trends_organizationId_fkey";
ALTER TABLE "engagement_predictions" DROP CONSTRAINT IF EXISTS "engagement_predictions_userId_fkey";
ALTER TABLE "ab_tests" DROP CONSTRAINT IF EXISTS "ab_tests_userId_fkey";
ALTER TABLE "ab_tests" DROP CONSTRAINT IF EXISTS "ab_tests_campaignId_fkey";
ALTER TABLE "tracked_competitors" DROP CONSTRAINT IF EXISTS "tracked_competitors_userId_fkey";
ALTER TABLE "competitor_comparisons" DROP CONSTRAINT IF EXISTS "competitor_comparisons_userId_fkey";
ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_userId_fkey";
ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_assigneeId_fkey";
ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_campaignId_fkey";
ALTER TABLE "content_shares" DROP CONSTRAINT IF EXISTS "content_shares_sharedById_fkey";
ALTER TABLE "content_access_logs" DROP CONSTRAINT IF EXISTS "content_access_logs_userId_fkey";
ALTER TABLE "content_access_logs" DROP CONSTRAINT IF EXISTS "content_access_logs_shareId_fkey";
ALTER TABLE "quotes" DROP CONSTRAINT IF EXISTS "quotes_userId_fkey";
ALTER TABLE "quotes" DROP CONSTRAINT IF EXISTS "quotes_campaignId_fkey";
ALTER TABLE "quote_collections" DROP CONSTRAINT IF EXISTS "quote_collections_userId_fkey";
ALTER TABLE "report_templates" DROP CONSTRAINT IF EXISTS "report_templates_userId_fkey";
ALTER TABLE "report_templates" DROP CONSTRAINT IF EXISTS "report_templates_organizationId_fkey";
ALTER TABLE "report_deliveries" DROP CONSTRAINT IF EXISTS "report_deliveries_reportId_fkey";
ALTER TABLE "report_deliveries" DROP CONSTRAINT IF EXISTS "report_deliveries_scheduledReportId_fkey";
ALTER TABLE "scheduled_reports" DROP CONSTRAINT IF EXISTS "scheduled_reports_templateId_fkey";
ALTER TABLE "team_notifications" DROP CONSTRAINT IF EXISTS "team_notifications_userId_fkey";
ALTER TABLE "team_notifications" DROP CONSTRAINT IF EXISTS "team_notifications_organizationId_fkey";

-- To rollback indexes:
DROP INDEX CONCURRENTLY IF EXISTS "analytics_events_userId_timestamp_idx";
DROP INDEX CONCURRENTLY IF EXISTS "analytics_events_campaignId_timestamp_idx";
DROP INDEX CONCURRENTLY IF EXISTS "analytics_events_eventType_idx";
DROP INDEX CONCURRENTLY IF EXISTS "sentiment_analyses_userId_analyzedAt_idx";
DROP INDEX CONCURRENTLY IF EXISTS "sentiment_trends_userId_date_idx";
DROP INDEX CONCURRENTLY IF EXISTS "sentiment_trends_organizationId_date_idx";
DROP INDEX CONCURRENTLY IF EXISTS "engagement_predictions_userId_publishedAt_idx";
DROP INDEX CONCURRENTLY IF EXISTS "ab_tests_userId_status_idx";
DROP INDEX CONCURRENTLY IF EXISTS "ab_tests_createdAt_idx";
DROP INDEX CONCURRENTLY IF EXISTS "tracked_competitors_userId_lastTrackedAt_idx";
DROP INDEX CONCURRENTLY IF EXISTS "competitor_posts_platform_postedAt_idx";
DROP INDEX CONCURRENTLY IF EXISTS "competitor_snapshots_competitorId_capturedAt_idx";
DROP INDEX CONCURRENTLY IF EXISTS "content_shares_sharedById_createdAt_idx";
DROP INDEX CONCURRENTLY IF EXISTS "content_shares_shareToken_key";
DROP INDEX CONCURRENTLY IF EXISTS "calendar_posts_organizationId_scheduledFor_idx";
DROP INDEX CONCURRENTLY IF EXISTS "calendar_posts_userId_status_idx";
DROP INDEX CONCURRENTLY IF EXISTS "reports_userId_createdAt_idx";
DROP INDEX CONCURRENTLY IF EXISTS "scheduled_reports_userId_nextRunAt_idx";
DROP INDEX CONCURRENTLY IF EXISTS "scheduled_reports_isActive_idx";
DROP INDEX CONCURRENTLY IF EXISTS "tasks_userId_status_idx";
DROP INDEX CONCURRENTLY IF EXISTS "tasks_assigneeId_dueDate_idx";
DROP INDEX CONCURRENTLY IF EXISTS "tasks_campaignId_idx";
*/
