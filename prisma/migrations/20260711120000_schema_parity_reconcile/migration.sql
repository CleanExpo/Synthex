-- SCHEMA-PARITY RECONCILE — 2026-07-11 full repo⇄prod audit (22-agent sweep, all 231 models
-- + all 42 migrations verified object-by-object against znyjoyjsvjotlzjppzal).
--
-- Two directions of drift are repaired here:
--   A. PROD-FIRST drift (columns/indexes/policies added straight to prod, never in the repo):
--      ML engagement-prediction columns on 5 tables, Sentinel review-workflow columns on
--      algorithm_updates, and prod's organization_video_quotas org-read policy. This file
--      adopts them so fresh environments (CI sandbox, branches) match prod. In prod every
--      section-A statement is a no-op.
--   B. REPO-FIRST drift (declared in the repo, missing in prod): the two pipeline_cost_ledger
--      composite indexes from schema.prisma, and the service_role policy that
--      20260710140000_generative_video_engine declares on organization_video_quotas (whoever
--      hand-applied that migration substituted a different policy).
--   C. Canonical renames: client_engagement_events was hand-created with ad-hoc index/policy
--      names (idx_cee_*, service_role_all_cee); renamed to the names its checked-in migration
--      (20260710000000_client_engagement_events) declares, so the file and prod agree.
--
-- Additive + idempotent throughout (IF NOT EXISTS / guarded DO blocks / guarded renames).
-- No DROP, no type changes, no DML. Known accepted variance NOT repaired here (documented in
-- docs/db/supabase-parity-audit-2026-07-11.md): client_engagement_events.created_at is
-- timestamptz(6) in prod vs timestamp(3) canonical, and its id column carries an extra
-- gen_random_uuid()::text default — both harmless supersets.
--
-- PROD apply is the founder's gate — never `prisma db push` / `prisma migrate deploy`
-- against prod from CI or a dev box. After prod apply, reconcile the _prisma_migrations
-- ledger row using the git-blob checksum (see docs/db/ledger-reconcile-2026-07-11.sql).

-- ============================================================================
-- A1. ML engagement-prediction columns (prod-first ad-hoc ML-pipeline migration)
-- ============================================================================

ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "predicted_engagement" DOUBLE PRECISION;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "confidence_score" DOUBLE PRECISION;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "cross_client_percentile_industry" INTEGER;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "feature_tags" TEXT[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE "calendar_posts" ADD COLUMN IF NOT EXISTS "predicted_engagement" DOUBLE PRECISION;
ALTER TABLE "calendar_posts" ADD COLUMN IF NOT EXISTS "confidence_score" DOUBLE PRECISION;
ALTER TABLE "calendar_posts" ADD COLUMN IF NOT EXISTS "cross_client_percentile_industry" INTEGER;
ALTER TABLE "calendar_posts" ADD COLUMN IF NOT EXISTS "feature_tags" TEXT[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE "gbp_reviews" ADD COLUMN IF NOT EXISTS "predicted_engagement" DOUBLE PRECISION;
ALTER TABLE "gbp_reviews" ADD COLUMN IF NOT EXISTS "confidence_score" DOUBLE PRECISION;
ALTER TABLE "gbp_reviews" ADD COLUMN IF NOT EXISTS "cross_client_percentile_industry" INTEGER;
ALTER TABLE "gbp_reviews" ADD COLUMN IF NOT EXISTS "feature_tags" TEXT[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE "autopilot_runs" ADD COLUMN IF NOT EXISTS "predicted_engagement" DOUBLE PRECISION;
ALTER TABLE "autopilot_runs" ADD COLUMN IF NOT EXISTS "confidence_score" DOUBLE PRECISION;
ALTER TABLE "autopilot_runs" ADD COLUMN IF NOT EXISTS "cross_client_percentile_industry" INTEGER;
ALTER TABLE "autopilot_runs" ADD COLUMN IF NOT EXISTS "feature_tags" TEXT[] NOT NULL DEFAULT '{}'::text[];

-- seasonal_signals already has confidence_score (int, declared) — only the other three
ALTER TABLE "seasonal_signals" ADD COLUMN IF NOT EXISTS "predicted_engagement" DOUBLE PRECISION;
ALTER TABLE "seasonal_signals" ADD COLUMN IF NOT EXISTS "cross_client_percentile_industry" INTEGER;
ALTER TABLE "seasonal_signals" ADD COLUMN IF NOT EXISTS "feature_tags" TEXT[] NOT NULL DEFAULT '{}'::text[];

-- Prod's partial indexes over the ML columns, kept under their existing prod names
-- (Prisma cannot declare partial indexes, so these live in SQL only — do not add @@index for them).
CREATE INDEX IF NOT EXISTS "idx_posts_ml_engagement"
  ON "posts" ("predicted_engagement") WHERE "predicted_engagement" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_posts_ml_percentile"
  ON "posts" ("cross_client_percentile_industry") WHERE "cross_client_percentile_industry" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_calendar_posts_ml_engagement"
  ON "calendar_posts" ("predicted_engagement") WHERE "predicted_engagement" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_gbp_reviews_ml_engagement"
  ON "gbp_reviews" ("predicted_engagement") WHERE "predicted_engagement" IS NOT NULL;

-- ============================================================================
-- A2. algorithm_updates Sentinel review-workflow columns (prod-first, camelCase
--     PHYSICAL column names — matches live prod; schema.prisma fields carry no @map)
-- ============================================================================

ALTER TABLE "algorithm_updates" ADD COLUMN IF NOT EXISTS "detectedDate" DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE "algorithm_updates" ADD COLUMN IF NOT EXISTS "platform" TEXT;
ALTER TABLE "algorithm_updates" ADD COLUMN IF NOT EXISTS "signalsAffected" TEXT[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE "algorithm_updates" ADD COLUMN IF NOT EXISTS "reviewed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "algorithm_updates" ADD COLUMN IF NOT EXISTS "reviewedDate" DATE;
ALTER TABLE "algorithm_updates" ADD COLUMN IF NOT EXISTS "linearIssueId" TEXT;

CREATE INDEX IF NOT EXISTS "idx_algorithm_updates_detected"
  ON "algorithm_updates" ("detectedDate" DESC);
CREATE INDEX IF NOT EXISTS "idx_algorithm_updates_platform"
  ON "algorithm_updates" ("platform");
CREATE INDEX IF NOT EXISTS "idx_algorithm_updates_reviewed"
  ON "algorithm_updates" ("reviewed");

-- ============================================================================
-- B1. pipeline_cost_ledger: the two schema.prisma-declared composite indexes
--     (missing in prod — prod only had single-column variants; 120 rows, instant build)
-- ============================================================================

CREATE INDEX IF NOT EXISTS "pipeline_cost_ledger_pipeline_name_created_at_idx"
  ON "pipeline_cost_ledger" ("pipeline_name", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "pipeline_cost_ledger_client_id_created_at_idx"
  ON "pipeline_cost_ledger" ("client_id", "created_at" DESC);

-- ============================================================================
-- B2. organization_video_quotas policies — both directions:
--     the migration-declared service_role policy (absent in prod) AND prod's
--     org-read policy (absent in the repo). service_role technically bypasses
--     RLS, but the object set should match the checked-in DDL.
-- ============================================================================

DO $$ BEGIN
  CREATE POLICY "service_role_organization_video_quotas"
    ON "organization_video_quotas" FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "organization_video_quotas_org_read"
    ON "organization_video_quotas" FOR SELECT TO authenticated
    USING (organization_id IN (
      SELECT users.organization_id FROM public.users
      WHERE users.id = (SELECT auth.uid())::text
    ));
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_function THEN NULL;
END $$;

-- ============================================================================
-- C. client_engagement_events canonical renames (metadata-only, guarded).
--    In a fresh environment 20260710000000_client_engagement_events already
--    creates the canonical names and every guard here no-ops.
-- ============================================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_cee_client_type_time')
     AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='client_engagement_events_client_id_event_type_created_at_idx') THEN
    ALTER INDEX "idx_cee_client_type_time" RENAME TO "client_engagement_events_client_id_event_type_created_at_idx";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_cee_client_time')
     AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='client_engagement_events_client_id_created_at_idx') THEN
    ALTER INDEX "idx_cee_client_time" RENAME TO "client_engagement_events_client_id_created_at_idx";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='client_engagement_events_crm_client_idx')
     AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='client_engagement_events_crm_client_id_idx') THEN
    ALTER INDEX "client_engagement_events_crm_client_idx" RENAME TO "client_engagement_events_crm_client_id_idx";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='client_engagement_events' AND policyname='service_role_all_cee')
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='client_engagement_events' AND policyname='service_role_client_engagement_events') THEN
    ALTER POLICY "service_role_all_cee" ON public.client_engagement_events RENAME TO "service_role_client_engagement_events";
  END IF;
END $$;

-- ============================================================================
-- Post-apply verification (read-only):
--   SELECT count(*) FROM information_schema.columns
--   WHERE table_name IN ('posts','calendar_posts','gbp_reviews','autopilot_runs')
--     AND column_name IN ('predicted_engagement','confidence_score','cross_client_percentile_industry','feature_tags');
--   -- expect 16
--   SELECT indexname FROM pg_indexes WHERE tablename='pipeline_cost_ledger' ORDER BY 1;
--   -- expect both *_created_at_idx composites present
--   SELECT policyname FROM pg_policies WHERE tablename='organization_video_quotas' ORDER BY 1;
--   -- expect organization_video_quotas_org_read + service_role_organization_video_quotas
--   SELECT indexname FROM pg_indexes WHERE tablename='client_engagement_events' ORDER BY 1;
--   -- expect the three canonical client_engagement_events_* names, no idx_cee_*
-- ============================================================================
