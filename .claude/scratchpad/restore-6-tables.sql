-- Restore 6 tables dropped by SYN-857 mistake.
-- CEO ran the broader DROP via Supabase SQL Editor before the Phase 1
-- false-negative was caught. These 6 tables back live routes:
--   /api/competitors/track  (uses _count + include of alerts/posts/snapshots)
--   /api/reports/scheduled  (dynamic prisma.scheduledReport accessor)
--   /api/reports/templates  (dynamic prisma.reportTemplate accessor)
-- Apply via Supabase SQL Editor.

BEGIN;

-- Table: scheduled_reports
CREATE TABLE "scheduled_reports" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "template_id" TEXT,
    "report_type" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "schedule" JSONB NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'pdf',
    "date_range_type" TEXT NOT NULL DEFAULT 'last_period',
    "filters" JSONB,
    "metrics" TEXT[],
    "recipients" TEXT[],
    "webhook_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMP(3),
    "last_run_status" TEXT,
    "last_report_id" TEXT,
    "next_run_at" TIMESTAMP(3),
    "run_count" INTEGER NOT NULL DEFAULT 0,
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_reports_pkey" PRIMARY KEY ("id")
);

-- Table: report_templates
CREATE TABLE "report_templates" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "organization_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "report_type" TEXT NOT NULL,
    "metrics" TEXT[],
    "dimensions" TEXT[],
    "filters" JSONB,
    "visualizations" JSONB,
    "layout" JSONB,
    "branding" JSONB,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_templates_pkey" PRIMARY KEY ("id")
);

-- Table: report_deliveries
CREATE TABLE "report_deliveries" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "scheduled_report_id" TEXT,
    "delivery_type" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_deliveries_pkey" PRIMARY KEY ("id")
);

-- Table: competitor_alerts
CREATE TABLE "competitor_alerts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "competitor_id" TEXT NOT NULL,
    "alert_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "related_post_id" TEXT,
    "metrics" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "is_dismissed" BOOLEAN NOT NULL DEFAULT false,
    "action_taken" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),

    CONSTRAINT "competitor_alerts_pkey" PRIMARY KEY ("id")
);

-- Table: competitor_posts
CREATE TABLE "competitor_posts" (
    "id" TEXT NOT NULL,
    "competitor_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "external_id" TEXT,
    "post_url" TEXT,
    "content" TEXT,
    "media_urls" TEXT[],
    "media_type" TEXT,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER,
    "saves" INTEGER,
    "engagement_rate" DOUBLE PRECISION,
    "sentiment" TEXT,
    "hashtags" TEXT[],
    "mentions" TEXT[],
    "topics" TEXT[],
    "is_top_performing" BOOLEAN NOT NULL DEFAULT false,
    "performance_percentile" DOUBLE PRECISION,
    "posted_at" TIMESTAMP(3),
    "tracked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competitor_posts_pkey" PRIMARY KEY ("id")
);

-- Table: competitor_snapshots
CREATE TABLE "competitor_snapshots" (
    "id" TEXT NOT NULL,
    "competitor_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "followers_count" INTEGER,
    "following_count" INTEGER,
    "follower_growth" INTEGER,
    "total_posts" INTEGER,
    "avg_likes" DOUBLE PRECISION,
    "avg_comments" DOUBLE PRECISION,
    "avg_shares" DOUBLE PRECISION,
    "engagement_rate" DOUBLE PRECISION,
    "post_frequency" DOUBLE PRECISION,
    "top_hashtags" TEXT[],
    "content_types" JSONB,
    "posting_times" JSONB,
    "performance_score" DOUBLE PRECISION,
    "growth_score" DOUBLE PRECISION,
    "engagement_score" DOUBLE PRECISION,
    "snapshot_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_source" TEXT NOT NULL DEFAULT 'api',

    CONSTRAINT "competitor_snapshots_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "scheduled_reports_user_id_idx" ON "scheduled_reports"("user_id");
CREATE INDEX "scheduled_reports_is_active_next_run_at_idx" ON "scheduled_reports"("is_active", "next_run_at");
CREATE INDEX "scheduled_reports_organization_id_idx" ON "scheduled_reports"("organization_id");
CREATE INDEX "report_templates_user_id_idx" ON "report_templates"("user_id");
CREATE INDEX "report_templates_organization_id_idx" ON "report_templates"("organization_id");
CREATE INDEX "report_templates_is_system_idx" ON "report_templates"("is_system");
CREATE INDEX "report_templates_category_idx" ON "report_templates"("category");
CREATE INDEX "report_deliveries_report_id_idx" ON "report_deliveries"("report_id");
CREATE INDEX "report_deliveries_scheduled_report_id_idx" ON "report_deliveries"("scheduled_report_id");
CREATE INDEX "report_deliveries_status_idx" ON "report_deliveries"("status");
CREATE INDEX "competitor_snapshots_competitor_id_idx" ON "competitor_snapshots"("competitor_id");
CREATE INDEX "competitor_snapshots_competitor_id_snapshot_at_idx" ON "competitor_snapshots"("competitor_id", "snapshot_at");
CREATE INDEX "competitor_snapshots_platform_idx" ON "competitor_snapshots"("platform");
CREATE INDEX "competitor_snapshots_snapshot_at_idx" ON "competitor_snapshots"("snapshot_at");
CREATE INDEX "competitor_posts_competitor_id_idx" ON "competitor_posts"("competitor_id");
CREATE INDEX "competitor_posts_platform_idx" ON "competitor_posts"("platform");
CREATE INDEX "competitor_posts_posted_at_idx" ON "competitor_posts"("posted_at");
CREATE INDEX "competitor_posts_is_top_performing_idx" ON "competitor_posts"("is_top_performing");
CREATE UNIQUE INDEX "competitor_posts_competitor_id_platform_external_id_key" ON "competitor_posts"("competitor_id", "platform", "external_id");
CREATE INDEX "competitor_alerts_user_id_idx" ON "competitor_alerts"("user_id");
CREATE INDEX "competitor_alerts_competitor_id_idx" ON "competitor_alerts"("competitor_id");
CREATE INDEX "competitor_alerts_is_read_idx" ON "competitor_alerts"("is_read");
CREATE INDEX "competitor_alerts_created_at_idx" ON "competitor_alerts"("created_at");

-- Foreign keys
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "report_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "competitor_snapshots" ADD CONSTRAINT "competitor_snapshots_competitor_id_fkey" FOREIGN KEY ("competitor_id") REFERENCES "tracked_competitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "competitor_posts" ADD CONSTRAINT "competitor_posts_competitor_id_fkey" FOREIGN KEY ("competitor_id") REFERENCES "tracked_competitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "competitor_alerts" ADD CONSTRAINT "competitor_alerts_competitor_id_fkey" FOREIGN KEY ("competitor_id") REFERENCES "tracked_competitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;