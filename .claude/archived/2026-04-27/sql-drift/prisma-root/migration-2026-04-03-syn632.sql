-- Migration: SYN-632 Content Improvement Tracking
-- Creates content_improvement_tracking table.
-- Apply via: npx prisma db execute --file prisma/migration-2026-04-03-syn632.sql --url "$DIRECT_URL"

CREATE TABLE IF NOT EXISTS "content_improvement_tracking" (
    "id"                         TEXT             NOT NULL,
    "organization_id"            TEXT             NOT NULL,
    "week_start"                 DATE             NOT NULL,
    "informed_avg_engagement"    DOUBLE PRECISION,
    "baseline_avg_engagement"    DOUBLE PRECISION,
    "improvement_rate"           DOUBLE PRECISION,
    "intelligence_signals_used"  JSONB            NOT NULL DEFAULT '[]',
    "created_at"                 TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "content_improvement_tracking_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "content_improvement_dedup"
    ON "content_improvement_tracking"("organization_id", "week_start");

CREATE INDEX IF NOT EXISTS "content_improvement_tracking_org_week_idx"
    ON "content_improvement_tracking"("organization_id", "week_start" DESC);

-- AddForeignKey: content_improvement_tracking -> organizations
ALTER TABLE "content_improvement_tracking"
    ADD CONSTRAINT "content_improvement_tracking_organization_id_fkey"
    FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
