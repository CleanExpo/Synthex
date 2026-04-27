-- ============================================================================
-- Sprint 1 Migration: SYN-472, SYN-473, SYN-474, SYN-475, SYN-476
-- Applied via: npx prisma db execute --file prisma/sprint1-migration.sql --url $DIRECT_URL
-- ============================================================================

-- SYN-474: Add phone_number to organizations
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "phone_number" TEXT;

-- SYN-474: Add new_review_uri to gbp_locations
ALTER TABLE "gbp_locations" ADD COLUMN IF NOT EXISTS "new_review_uri" TEXT;

-- SYN-475: Create SeoContentType enum
DO $$ BEGIN
  CREATE TYPE "SeoContentType" AS ENUM (
    'blog_local_authority',
    'how_to',
    'listicle',
    'news_item',
    'comparison',
    'case_study'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- SYN-475: Add seo_content_type + layout_data to generated_content
ALTER TABLE "generated_content"
  ADD COLUMN IF NOT EXISTS "seo_content_type" "SeoContentType",
  ADD COLUMN IF NOT EXISTS "layout_data" JSONB;

-- SYN-474: review_requests table
CREATE TABLE IF NOT EXISTS "review_requests" (
  "id"                  TEXT        NOT NULL,
  "organization_id"     TEXT        NOT NULL,
  "location_id"         TEXT        NOT NULL,
  "recipient_name"      TEXT        NOT NULL,
  "recipient_email"     TEXT        NOT NULL,
  "review_link"         TEXT        NOT NULL,
  "status"              TEXT        NOT NULL DEFAULT 'pending',
  "sent_at"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "follow_up_sent_at"   TIMESTAMPTZ,
  "review_received_at"  TIMESTAMPTZ,
  "created_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "review_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "review_requests_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "review_requests_organization_id_idx"
  ON "review_requests"("organization_id");
CREATE INDEX IF NOT EXISTS "review_requests_organization_id_status_idx"
  ON "review_requests"("organization_id", "status");

-- SYN-472: content_topic_suggestions table
CREATE TABLE IF NOT EXISTS "content_topic_suggestions" (
  "id"               TEXT             NOT NULL,
  "organization_id"  TEXT             NOT NULL,
  "keyword"          TEXT             NOT NULL,
  "impressions"      INTEGER          NOT NULL DEFAULT 0,
  "current_rank"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "opportunity_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "used_at"          TIMESTAMPTZ,
  "created_at"       TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  CONSTRAINT "content_topic_suggestions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "content_topic_suggestions_org_keyword_key"
    UNIQUE ("organization_id", "keyword"),
  CONSTRAINT "content_topic_suggestions_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "content_topic_suggestions_organization_id_idx"
  ON "content_topic_suggestions"("organization_id");
CREATE INDEX IF NOT EXISTS "content_topic_suggestions_org_used_at_idx"
  ON "content_topic_suggestions"("organization_id", "used_at");

-- SYN-476: keyword_targets table
CREATE TABLE IF NOT EXISTS "keyword_targets" (
  "id"             TEXT        NOT NULL,
  "organization_id" TEXT       NOT NULL,
  "keyword"        TEXT        NOT NULL,
  "location"       TEXT,
  "is_active"      BOOLEAN     NOT NULL DEFAULT TRUE,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "keyword_targets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "keyword_targets_organization_id_keyword_key"
    UNIQUE ("organization_id", "keyword"),
  CONSTRAINT "keyword_targets_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "keyword_targets_organization_id_idx"
  ON "keyword_targets"("organization_id");

-- SYN-476: keyword_rank_snapshots table
CREATE TABLE IF NOT EXISTS "keyword_rank_snapshots" (
  "id"                TEXT             NOT NULL,
  "organization_id"   TEXT             NOT NULL,
  "keyword_target_id" TEXT             NOT NULL,
  "position"          DOUBLE PRECISION,
  "impressions"       INTEGER,
  "clicks"            INTEGER,
  "ctr"               DOUBLE PRECISION,
  "snapshot_date"     DATE             NOT NULL,
  "created_at"        TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  CONSTRAINT "keyword_rank_snapshots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "keyword_rank_snapshots_target_date_key"
    UNIQUE ("keyword_target_id", "snapshot_date"),
  CONSTRAINT "keyword_rank_snapshots_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "keyword_rank_snapshots_keyword_target_id_fkey"
    FOREIGN KEY ("keyword_target_id") REFERENCES "keyword_targets"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "keyword_rank_snapshots_org_date_idx"
  ON "keyword_rank_snapshots"("organization_id", "snapshot_date");
CREATE INDEX IF NOT EXISTS "keyword_rank_snapshots_target_idx"
  ON "keyword_rank_snapshots"("keyword_target_id");

-- SYN-473: visibility_scores table
CREATE TABLE IF NOT EXISTS "visibility_scores" (
  "id"             TEXT        NOT NULL,
  "organization_id" TEXT       NOT NULL,
  "score"          INTEGER     NOT NULL,
  "review_score"   INTEGER     NOT NULL,
  "gbp_score"      INTEGER     NOT NULL,
  "content_score"  INTEGER     NOT NULL,
  "rank_score"     INTEGER     NOT NULL,
  "calculated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "visibility_scores_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "visibility_scores_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "visibility_scores_org_calculated_at_idx"
  ON "visibility_scores"("organization_id", "calculated_at");
