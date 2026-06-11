-- PENDING: generative_video_engine
-- Generated manually: dev DB shadow database has pre-existing migration failure
-- (column "effectivenessScore" does not exist in migration 20260204_consolidated_schema).
-- A human must apply this migration to the production/staging database.
-- Once the shadow-DB issue is resolved, run: npm run db:migrate:dev -- --name generative_video_engine

-- 1. Extend video_generations with generative-video columns
ALTER TABLE "video_generations"
  ADD COLUMN "mode"               TEXT         NOT NULL DEFAULT 'script',
  ADD COLUMN "provider"           TEXT,
  ADD COLUMN "gen_model"          TEXT,
  ADD COLUMN "provider_job_id"    TEXT,
  ADD COLUMN "initiated_by"       TEXT         NOT NULL DEFAULT 'studio',
  ADD COLUMN "input_prompt"       TEXT,
  ADD COLUMN "enhanced_prompt"    TEXT,
  ADD COLUMN "input_image_url"    TEXT,
  ADD COLUMN "method_card_id"     TEXT,
  ADD COLUMN "modifier_ids"       TEXT[]       NOT NULL DEFAULT '{}',
  ADD COLUMN "brand_card_id"      TEXT,
  ADD COLUMN "aspect_ratio"       TEXT,
  ADD COLUMN "duration_seconds"   INTEGER,
  ADD COLUMN "audio_enabled"      BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN "batch_group_id"     TEXT,
  ADD COLUMN "seed"               INTEGER,
  ADD COLUMN "estimated_cost_usd" DECIMAL(10, 4),
  ADD COLUMN "actual_cost_usd"    DECIMAL(10, 4);

-- 2. Indexes for new columns
CREATE INDEX "video_generations_provider_job_id_idx" ON "video_generations"("provider_job_id");
CREATE INDEX "video_generations_batch_group_id_idx"  ON "video_generations"("batch_group_id");

-- 3. New quota table
CREATE TABLE "organization_video_quotas" (
  "id"                   TEXT         NOT NULL,
  "organization_id"      TEXT         NOT NULL,
  "monthly_budget_usd"   DECIMAL(10, 4) NOT NULL DEFAULT 25,
  "daily_budget_usd"     DECIMAL(10, 4) NOT NULL DEFAULT 5,
  "spent_usd"            DECIMAL(10, 4) NOT NULL DEFAULT 0,
  "spent_today_usd"      DECIMAL(10, 4) NOT NULL DEFAULT 0,
  "spent_today_mcp_usd"  DECIMAL(10, 4) NOT NULL DEFAULT 0,
  "period_start"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "day_start"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"           TIMESTAMP(3) NOT NULL,

  CONSTRAINT "organization_video_quotas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organization_video_quotas_organization_id_key"
  ON "organization_video_quotas"("organization_id");

ALTER TABLE "organization_video_quotas"
  ADD CONSTRAINT "organization_video_quotas_organization_id_fkey"
  FOREIGN KEY ("organization_id")
  REFERENCES "organizations"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
