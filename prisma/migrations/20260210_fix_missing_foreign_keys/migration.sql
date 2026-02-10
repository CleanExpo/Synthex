-- Migration: Fix Missing Foreign Keys & Add Performance Indexes
-- Generated: 2026-02-10
-- Purpose: Address schema audit findings - missing FK constraints
--
-- SAFE MIGRATION: Only applies to tables that exist
-- Each constraint is wrapped in existence checks

-- ============================================================================
-- PHASE 1: HELPER FUNCTION FOR SAFE CONSTRAINT ADDITION
-- ============================================================================

-- Function to safely add foreign key (checks table and constraint existence)
CREATE OR REPLACE FUNCTION safe_add_fk(
    p_table TEXT,
    p_constraint TEXT,
    p_column TEXT,
    p_ref_table TEXT,
    p_ref_column TEXT,
    p_on_delete TEXT DEFAULT 'CASCADE'
) RETURNS VOID AS $$
BEGIN
    -- Check if source table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = p_table AND table_schema = 'public') THEN
        RAISE NOTICE 'Table % does not exist, skipping constraint %', p_table, p_constraint;
        RETURN;
    END IF;

    -- Check if referenced table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = p_ref_table AND table_schema = 'public') THEN
        RAISE NOTICE 'Referenced table % does not exist, skipping constraint %', p_ref_table, p_constraint;
        RETURN;
    END IF;

    -- Check if column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = p_table AND column_name = p_column) THEN
        RAISE NOTICE 'Column %.% does not exist, skipping constraint %', p_table, p_column, p_constraint;
        RETURN;
    END IF;

    -- Check if constraint already exists
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = p_constraint) THEN
        RAISE NOTICE 'Constraint % already exists, skipping', p_constraint;
        RETURN;
    END IF;

    -- Add the constraint
    EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I(%I) ON DELETE %s ON UPDATE CASCADE',
        p_table, p_constraint, p_column, p_ref_table, p_ref_column, p_on_delete
    );
    RAISE NOTICE 'Added constraint % on %.%', p_constraint, p_table, p_column;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Failed to add constraint %: %', p_constraint, SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Function to safely create index
CREATE OR REPLACE FUNCTION safe_create_index(
    p_index_name TEXT,
    p_table TEXT,
    p_columns TEXT
) RETURNS VOID AS $$
BEGIN
    -- Check if table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = p_table AND table_schema = 'public') THEN
        RAISE NOTICE 'Table % does not exist, skipping index %', p_table, p_index_name;
        RETURN;
    END IF;

    -- Check if index already exists
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = p_index_name) THEN
        RAISE NOTICE 'Index % already exists, skipping', p_index_name;
        RETURN;
    END IF;

    -- Create the index
    EXECUTE format('CREATE INDEX %I ON %I (%s)', p_index_name, p_table, p_columns);
    RAISE NOTICE 'Created index % on %', p_index_name, p_table;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Failed to create index %: %', p_index_name, SQLERRM;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- PHASE 2: ADD MISSING FOREIGN KEY CONSTRAINTS (SAFE)
-- ============================================================================

-- Analytics & Reporting
SELECT safe_add_fk('AnalyticsEvent', 'AnalyticsEvent_userId_fkey', 'userId', 'User', 'id', 'CASCADE');
SELECT safe_add_fk('AnalyticsEvent', 'AnalyticsEvent_campaignId_fkey', 'campaignId', 'Campaign', 'id', 'SET NULL');
SELECT safe_add_fk('SentimentAnalysis', 'SentimentAnalysis_userId_fkey', 'userId', 'User', 'id', 'CASCADE');
SELECT safe_add_fk('SentimentTrend', 'SentimentTrend_userId_fkey', 'userId', 'User', 'id', 'CASCADE');
SELECT safe_add_fk('SentimentTrend', 'SentimentTrend_organizationId_fkey', 'organizationId', 'Organization', 'id', 'CASCADE');
SELECT safe_add_fk('EngagementPrediction', 'EngagementPrediction_userId_fkey', 'userId', 'User', 'id', 'CASCADE');

-- A/B Testing
SELECT safe_add_fk('ABTest', 'ABTest_userId_fkey', 'userId', 'User', 'id', 'CASCADE');
SELECT safe_add_fk('ABTest', 'ABTest_campaignId_fkey', 'campaignId', 'Campaign', 'id', 'SET NULL');

-- Competitor Tracking
SELECT safe_add_fk('TrackedCompetitor', 'TrackedCompetitor_userId_fkey', 'userId', 'User', 'id', 'CASCADE');
SELECT safe_add_fk('CompetitorComparison', 'CompetitorComparison_userId_fkey', 'userId', 'User', 'id', 'CASCADE');

-- Task Management
SELECT safe_add_fk('Task', 'Task_userId_fkey', 'userId', 'User', 'id', 'CASCADE');
SELECT safe_add_fk('Task', 'Task_assigneeId_fkey', 'assigneeId', 'User', 'id', 'SET NULL');
SELECT safe_add_fk('Task', 'Task_campaignId_fkey', 'campaignId', 'Campaign', 'id', 'SET NULL');

-- Content Sharing
SELECT safe_add_fk('ContentShare', 'ContentShare_sharedById_fkey', 'sharedById', 'User', 'id', 'CASCADE');
SELECT safe_add_fk('ContentAccessLog', 'ContentAccessLog_userId_fkey', 'userId', 'User', 'id', 'SET NULL');
SELECT safe_add_fk('ContentAccessLog', 'ContentAccessLog_shareId_fkey', 'shareId', 'ContentShare', 'id', 'CASCADE');

-- Quotes
SELECT safe_add_fk('Quote', 'Quote_userId_fkey', 'userId', 'User', 'id', 'CASCADE');
SELECT safe_add_fk('Quote', 'Quote_campaignId_fkey', 'campaignId', 'Campaign', 'id', 'SET NULL');
SELECT safe_add_fk('QuoteCollection', 'QuoteCollection_userId_fkey', 'userId', 'User', 'id', 'CASCADE');

-- Reporting
SELECT safe_add_fk('ReportTemplate', 'ReportTemplate_userId_fkey', 'userId', 'User', 'id', 'CASCADE');
SELECT safe_add_fk('ReportTemplate', 'ReportTemplate_organizationId_fkey', 'organizationId', 'Organization', 'id', 'CASCADE');
SELECT safe_add_fk('ReportDelivery', 'ReportDelivery_reportId_fkey', 'reportId', 'Report', 'id', 'CASCADE');
SELECT safe_add_fk('ReportDelivery', 'ReportDelivery_scheduledReportId_fkey', 'scheduledReportId', 'ScheduledReport', 'id', 'SET NULL');
SELECT safe_add_fk('ScheduledReport', 'ScheduledReport_templateId_fkey', 'templateId', 'ReportTemplate', 'id', 'SET NULL');

-- Notifications
SELECT safe_add_fk('TeamNotification', 'TeamNotification_userId_fkey', 'userId', 'User', 'id', 'CASCADE');
SELECT safe_add_fk('TeamNotification', 'TeamNotification_organizationId_fkey', 'organizationId', 'Organization', 'id', 'CASCADE');


-- ============================================================================
-- PHASE 3: ADD PERFORMANCE INDEXES (SAFE)
-- ============================================================================

-- Analytics indexes
SELECT safe_create_index('AnalyticsEvent_userId_createdAt_idx', 'AnalyticsEvent', '"userId", "createdAt" DESC');
SELECT safe_create_index('AnalyticsEvent_campaignId_idx', 'AnalyticsEvent', '"campaignId"');
SELECT safe_create_index('SentimentAnalysis_userId_analyzedAt_idx', 'SentimentAnalysis', '"userId", "analyzedAt" DESC');
SELECT safe_create_index('SentimentTrend_userId_date_idx', 'SentimentTrend', '"userId", "date" DESC');
SELECT safe_create_index('SentimentTrend_organizationId_date_idx', 'SentimentTrend', '"organizationId", "date" DESC');
SELECT safe_create_index('EngagementPrediction_userId_idx', 'EngagementPrediction', '"userId"');

-- A/B Testing indexes
SELECT safe_create_index('ABTest_userId_status_idx', 'ABTest', '"userId", "status"');
SELECT safe_create_index('ABTest_createdAt_idx', 'ABTest', '"createdAt" DESC');

-- Competitor indexes
SELECT safe_create_index('TrackedCompetitor_userId_idx', 'TrackedCompetitor', '"userId"');
SELECT safe_create_index('CompetitorSnapshot_competitorId_idx', 'CompetitorSnapshot', '"competitorId", "capturedAt" DESC');
SELECT safe_create_index('CompetitorPost_competitorId_idx', 'CompetitorPost', '"competitorId"');

-- Content indexes
SELECT safe_create_index('ContentShare_sharedById_idx', 'ContentShare', '"sharedById"');
SELECT safe_create_index('CalendarPost_organizationId_scheduledFor_idx', 'CalendarPost', '"organizationId", "scheduledFor"');
SELECT safe_create_index('CalendarPost_userId_status_idx', 'CalendarPost', '"userId", "status"');

-- Task indexes
SELECT safe_create_index('Task_userId_status_idx', 'Task', '"userId", "status"');
SELECT safe_create_index('Task_assigneeId_idx', 'Task', '"assigneeId"');
SELECT safe_create_index('Task_campaignId_idx', 'Task', '"campaignId"');

-- Report indexes
SELECT safe_create_index('Report_userId_createdAt_idx', 'Report', '"userId", "createdAt" DESC');
SELECT safe_create_index('ScheduledReport_userId_nextRunAt_idx', 'ScheduledReport', '"userId", "nextRunAt"');

-- Notification indexes
SELECT safe_create_index('TeamNotification_userId_idx', 'TeamNotification', '"userId"');
SELECT safe_create_index('Notification_userId_isRead_idx', 'Notification', '"userId", "isRead"');


-- ============================================================================
-- PHASE 4: CLEANUP HELPER FUNCTIONS
-- ============================================================================

DROP FUNCTION IF EXISTS safe_add_fk(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS safe_create_index(TEXT, TEXT, TEXT);


-- ============================================================================
-- VERIFICATION: Show what was created
-- ============================================================================

-- List all foreign keys in public schema
SELECT
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name;
