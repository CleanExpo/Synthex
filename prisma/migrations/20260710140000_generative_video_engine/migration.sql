-- generative_video_engine — promoted from the loose PENDING-generative_video_engine.sql
-- into a timestamped, ledger-trackable folder (SYN-1002 hygiene).
--
-- STATUS: ALREADY APPLIED TO PRODUCTION (znyjoyjsvjotlzjppzal) — confirmed
-- 2026-07-10 via information_schema (organization_video_quotas present) and by the
-- live generative-video 1→8 exercising these video_generations columns. This folder
-- exists for repo/ledger parity; the DDL below is now IDEMPOTENT (IF NOT EXISTS /
-- guarded) so a re-apply or `migrate resolve --applied` is safe.
--
-- Additive + backward-compatible: every new column is nullable or NOT NULL WITH
-- DEFAULT; no drops / renames / type-changes. Founder-apply gate (SYN-1085) —
-- never `prisma db push` / `migrate deploy` against prod from CI.

-- 1. Extend video_generations with generative-video columns (idempotent)
ALTER TABLE "video_generations" ADD COLUMN IF NOT EXISTS "mode"               TEXT         NOT NULL DEFAULT 'script';
ALTER TABLE "video_generations" ADD COLUMN IF NOT EXISTS "provider"           TEXT;
ALTER TABLE "video_generations" ADD COLUMN IF NOT EXISTS "gen_model"          TEXT;
ALTER TABLE "video_generations" ADD COLUMN IF NOT EXISTS "provider_job_id"    TEXT;
ALTER TABLE "video_generations" ADD COLUMN IF NOT EXISTS "initiated_by"       TEXT         NOT NULL DEFAULT 'studio';
ALTER TABLE "video_generations" ADD COLUMN IF NOT EXISTS "input_prompt"       TEXT;
ALTER TABLE "video_generations" ADD COLUMN IF NOT EXISTS "enhanced_prompt"    TEXT;
ALTER TABLE "video_generations" ADD COLUMN IF NOT EXISTS "input_image_url"    TEXT;
ALTER TABLE "video_generations" ADD COLUMN IF NOT EXISTS "method_card_id"     TEXT;
ALTER TABLE "video_generations" ADD COLUMN IF NOT EXISTS "modifier_ids"       TEXT[]       NOT NULL DEFAULT '{}';
ALTER TABLE "video_generations" ADD COLUMN IF NOT EXISTS "brand_card_id"      TEXT;
ALTER TABLE "video_generations" ADD COLUMN IF NOT EXISTS "aspect_ratio"       TEXT;
ALTER TABLE "video_generations" ADD COLUMN IF NOT EXISTS "duration_seconds"   INTEGER;
ALTER TABLE "video_generations" ADD COLUMN IF NOT EXISTS "audio_enabled"      BOOLEAN      NOT NULL DEFAULT false;
ALTER TABLE "video_generations" ADD COLUMN IF NOT EXISTS "batch_group_id"     TEXT;
ALTER TABLE "video_generations" ADD COLUMN IF NOT EXISTS "seed"               INTEGER;
ALTER TABLE "video_generations" ADD COLUMN IF NOT EXISTS "estimated_cost_usd" DECIMAL(10, 4);
ALTER TABLE "video_generations" ADD COLUMN IF NOT EXISTS "actual_cost_usd"    DECIMAL(10, 4);

-- 2. Indexes for new columns.
-- NOTE: CREATE INDEX CONCURRENTLY cannot run inside a transaction block — apply
-- these two statements INDIVIDUALLY, outside any transaction wrapper (do not paste
-- them into a transactional runner / `prisma migrate deploy`, which wraps in a txn).
CREATE INDEX CONCURRENTLY IF NOT EXISTS "video_generations_provider_job_id_idx"
  ON "video_generations"("provider_job_id")
  WHERE "provider_job_id" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "video_generations_batch_group_id_idx"
  ON "video_generations"("batch_group_id")
  WHERE "batch_group_id" IS NOT NULL;

-- 3. New quota table (idempotent)
CREATE TABLE IF NOT EXISTS "organization_video_quotas" (
  "id"                   TEXT           NOT NULL,
  "organization_id"      TEXT           NOT NULL,
  "monthly_budget_usd"   DECIMAL(10, 4) NOT NULL DEFAULT 25,
  "daily_budget_usd"     DECIMAL(10, 4) NOT NULL DEFAULT 5,
  "spent_usd"            DECIMAL(10, 4) NOT NULL DEFAULT 0,
  "spent_today_usd"      DECIMAL(10, 4) NOT NULL DEFAULT 0,
  "spent_today_mcp_usd"  DECIMAL(10, 4) NOT NULL DEFAULT 0,
  "period_start"         TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "day_start"            TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at"           TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"           TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "organization_video_quotas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "organization_video_quotas_organization_id_key"
  ON "organization_video_quotas"("organization_id");

-- FK (ADD CONSTRAINT has no IF NOT EXISTS — swallow duplicates)
DO $$ BEGIN
  ALTER TABLE "organization_video_quotas"
    ADD CONSTRAINT "organization_video_quotas_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;

-- 4. RLS — service-role only (was missing in the loose PENDING file). Matches the
-- repo's service-role-only convention (mcp_api_keys / claim_evidence_scores). Quota
-- rows are read/written server-side only; never from a browser-held anon key.
ALTER TABLE "organization_video_quotas" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "service_role_organization_video_quotas"
    ON "organization_video_quotas" FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;
