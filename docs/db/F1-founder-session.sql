-- =============================================================================
-- F1 — FOUNDER PROD SESSION (single paste-ready script), Synthex prod
--      znyjoyjsvjotlzjppzal. Parity-remediation spec
--      docs/specs/spm-parity-remediation-2026-07-11.md, gate F1.
--
-- WHAT THIS DOES, in order: preflight checks -> apply the schema-parity reconcile
-- DDL -> reconcile the _prisma_migrations ledger 33 -> 43 -> disable the failing
-- churn cron -> drop 17 dead orphan tables + rename 5 provenance-resolved orphans
-- (reversible) -> verify. Everything is idempotent / guarded.
--
-- PREREQUISITES (do these FIRST — see F1-founder-session-runbook.md):
--   1. PR #724 is MERGED to main (its reconcile migration is the source of STEP 1
--      and of the STEP 2 10th-row checksum below — that checksum was computed from
--      the #724 tip and is stable across a squash-merge; if #724's reconcile
--      migration changed before merge, regenerate this file).
--   2. A prod backup / PITR restore point exists and you have noted it. The DROPs in
--      STEP 4 are the only irreversible actions here.
--
-- HOW TO RUN (Supabase SQL editor, as the service role):
--   Run STEP 0 ALONE first and read its NOTICE/EXCEPTION. Only if it says
--   "PREFLIGHT OK" do you continue with STEP 1..5. STEP 0 hard-STOPs the session
--   if the ledger isn't 33 or if any orphan table has gained rows since the audit.
--
-- Mirrors (as of 2026-07-11): STEP 1 = prisma/migrations/20260711120000_schema_parity_reconcile/migration.sql;
-- STEP 2 = docs/db/ledger-reconcile-2026-07-11.sql. Read-only capture behind the
-- orphan decisions: docs/db/orphan-provenance-and-capture-2026-07-11.sql.
-- =============================================================================


-- =============================================================================
-- STEP 0 — PREFLIGHT (run alone; read-only; hard-STOPs on any mismatch)
-- =============================================================================
DO $$
DECLARE
  t   text;
  n   bigint;
  bad text := '';
  led int;
BEGIN
  SELECT count(*) INTO led FROM _prisma_migrations;
  IF led <> 33 THEN
    RAISE EXCEPTION 'PREFLIGHT STOP: _prisma_migrations = % (expected 33). The ledger already changed — do NOT run STEP 2 blindly; reconcile by hand.', led;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-churn-score') THEN
    RAISE WARNING 'PREFLIGHT: cron daily-churn-score not found (already removed?) — STEP 3 will be a no-op.';
  END IF;

  FOR t IN SELECT unnest(ARRAY[
      'ai_training_data','analytics','automation_logs','billing_history','collaboration_invites',
      'competitor_analysis','content_performance_history','content_queue','content_templates',
      'content_versions','hashtag_performance','live_sessions','performance_metrics','trending_topics',
      'user_preferences','workspace_members','workspaces',
      'ad_accounts','ad_performance_snapshots','client_churn_risk','intervention_logs','post_performance_events'
    ]) LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
      IF n > 0 THEN bad := bad || t || '=' || n || '  '; END IF;
    END IF;
  END LOOP;
  IF bad <> '' THEN
    RAISE EXCEPTION 'PREFLIGHT STOP: orphan tables are NO LONGER empty (rows written since the audit): %. Investigate before any DROP/RENAME.', bad;
  END IF;

  RAISE NOTICE 'PREFLIGHT OK: ledger=33, all 22 orphan tables empty. Proceed to STEP 1..5.';
END $$;


-- =============================================================================
-- STEP 1 — SCHEMA-PARITY RECONCILE DDL (idempotent; no-op on prod objects that
--          exist, builds the repo-first-missing indexes/policy, canonical renames).
--          Mirrors prisma/migrations/20260711120000_schema_parity_reconcile/migration.sql.
-- =============================================================================

-- A1. ML engagement-prediction columns (prod-first)
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
ALTER TABLE "seasonal_signals" ADD COLUMN IF NOT EXISTS "predicted_engagement" DOUBLE PRECISION;
ALTER TABLE "seasonal_signals" ADD COLUMN IF NOT EXISTS "cross_client_percentile_industry" INTEGER;
ALTER TABLE "seasonal_signals" ADD COLUMN IF NOT EXISTS "feature_tags" TEXT[] NOT NULL DEFAULT '{}'::text[];
CREATE INDEX IF NOT EXISTS "idx_posts_ml_engagement" ON "posts" ("predicted_engagement") WHERE "predicted_engagement" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_posts_ml_percentile" ON "posts" ("cross_client_percentile_industry") WHERE "cross_client_percentile_industry" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_calendar_posts_ml_engagement" ON "calendar_posts" ("predicted_engagement") WHERE "predicted_engagement" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_gbp_reviews_ml_engagement" ON "gbp_reviews" ("predicted_engagement") WHERE "predicted_engagement" IS NOT NULL;

-- A2. algorithm_updates Sentinel review-workflow columns (camelCase physical names)
ALTER TABLE "algorithm_updates" ADD COLUMN IF NOT EXISTS "detectedDate" DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE "algorithm_updates" ADD COLUMN IF NOT EXISTS "platform" TEXT;
ALTER TABLE "algorithm_updates" ADD COLUMN IF NOT EXISTS "signalsAffected" TEXT[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE "algorithm_updates" ADD COLUMN IF NOT EXISTS "reviewed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "algorithm_updates" ADD COLUMN IF NOT EXISTS "reviewedDate" DATE;
ALTER TABLE "algorithm_updates" ADD COLUMN IF NOT EXISTS "linearIssueId" TEXT;
CREATE INDEX IF NOT EXISTS "idx_algorithm_updates_detected" ON "algorithm_updates" ("detectedDate" DESC);
CREATE INDEX IF NOT EXISTS "idx_algorithm_updates_platform" ON "algorithm_updates" ("platform");
CREATE INDEX IF NOT EXISTS "idx_algorithm_updates_reviewed" ON "algorithm_updates" ("reviewed");

-- B1. pipeline_cost_ledger composite indexes (repo-first, missing in prod)
CREATE INDEX IF NOT EXISTS "pipeline_cost_ledger_pipeline_name_created_at_idx" ON "pipeline_cost_ledger" ("pipeline_name", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "pipeline_cost_ledger_client_id_created_at_idx" ON "pipeline_cost_ledger" ("client_id", "created_at" DESC);

-- B2. organization_video_quotas policies (both directions)
DO $$ BEGIN
  CREATE POLICY "service_role_organization_video_quotas" ON "organization_video_quotas"
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "organization_video_quotas_org_read" ON "organization_video_quotas"
    FOR SELECT TO authenticated USING (organization_id IN (
      SELECT users.organization_id FROM public.users WHERE users.id = (SELECT auth.uid())::text));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- C. client_engagement_events canonical renames (metadata-only, guarded)
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


-- =============================================================================
-- STEP 2 — LEDGER RECONCILE  _prisma_migrations 33 -> 43
--   9 rows for the hand-applied Jul-10/11 migrations (-> 42), + the reconcile
--   migration itself (-> 43). Checksums = sha256 of each migration.sql's bytes
--   (git-blob content), the algorithm `prisma migrate deploy` verifies. Idempotent
--   (WHERE NOT EXISTS). See docs/db/ledger-reconcile-2026-07-11.sql.
-- =============================================================================
INSERT INTO _prisma_migrations
  (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
SELECT gen_random_uuid()::text, v.checksum, now(), v.name, NULL, NULL, now(), 1
FROM (VALUES
  ('20260710000000_client_engagement_events',        'd4b47afc7d616f2f0c22f95b6a730c9b1906e5b40d3a2726b9f8c2dd2ca81ff3'),
  ('20260710100000_add_claim_approval_status',       'c5971f827e2e727d7cecd501d2ef377c4ee78a394da5425bcc112c68f5f2a987'),
  ('20260710120000_mcp_api_keys',                    'b0ed170f4669428e921b3df6d755b347143896da91cbe1f04a59c02470e92e91'),
  ('20260710130000_syn_mcp_006_evidence_core',       '2999858dfea45bda5fc02a9b2775c0407c3ca4dcf97430a8c3f7d4bb9df65ac2'),
  ('20260710140000_add_org_budget_policy',           '6591ec88ba3deb6783bb5d7e3468acd22d214ddc7947e5ade47972d05bbe08ed'),
  ('20260710140000_generative_video_engine',         '2fd43e776847b49c9d4a11a37ffb350be456c0c7863776f90369cb85f07b9e42'),
  ('20260710150000_syn1090_testimonial_org_fk_text', 'cc6a8948e079b0b4cfa9218579e47fe62b219c31838b2151463a2f6ce355bd65'),
  ('20260710150000_syn_40_brand_presets',            '0d789442cb2ef40ff460821391862d672210a783162d7c06d7ad6c26e4c3a1f1'),
  ('20260711000000_video_gate_verdicts',             '0568d348a1aebf7632062aa1d2e0ff14cbaf88d9bdc12b3e7417aac310ede831'),
  -- 10th: the reconcile migration from STEP 1 (checksum precomputed from the #724 tip)
  ('20260711120000_schema_parity_reconcile',         '567d4169a80c79caa2acee870baf9abf24a11f91606689ed5c54b8da33b3d7d2')
) AS v(name, checksum)
WHERE NOT EXISTS (SELECT 1 FROM _prisma_migrations m WHERE m.migration_name = v.name);


-- =============================================================================
-- STEP 3 — DISABLE the failing churn cron (reversible: re-enable with
--          `SELECT cron.alter_job(<jobid>, active := true);`). NOT unschedule —
--          the job row is the only surviving definition. Archived source:
--          supabase/functions/_archived/churn-scorer/ (delete the function via the
--          Supabase dashboard separately; there is no MCP delete tool).
-- =============================================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='daily-churn-score') THEN
    PERFORM cron.alter_job((SELECT jobid FROM cron.job WHERE jobname='daily-churn-score'), active := false);
    RAISE NOTICE 'Disabled cron daily-churn-score.';
  ELSE
    RAISE NOTICE 'cron daily-churn-score not present — skipped.';
  END IF;
END $$;


-- =============================================================================
-- STEP 4 — ORPHAN CLEANUP  (IRREVERSIBLE for 4a — confirm your backup first).
--   4a. DROP the 17 legacy-dead tables (0 rows; no FK references them; DDL
--       recoverable from supabase/migrations/20250115000001_unified_schema.sql).
--   4b. RENAME the 5 provenance-resolved orphans to zzz_deprecated_* (REVERSIBLE:
--       `ALTER TABLE public.zzz_deprecated_x RENAME TO x;`). 90-day zero-access
--       burn-in, then a separate founder DROP decision. RLS/policies travel with
--       the rename. Full DDL captured in docs/db/orphan-provenance-and-capture-2026-07-11.sql.
-- =============================================================================

-- 4a — DROP 17 legacy-dead
DROP TABLE IF EXISTS public.ai_training_data CASCADE;
DROP TABLE IF EXISTS public.analytics CASCADE;
DROP TABLE IF EXISTS public.automation_logs CASCADE;
DROP TABLE IF EXISTS public.billing_history CASCADE;
DROP TABLE IF EXISTS public.collaboration_invites CASCADE;
DROP TABLE IF EXISTS public.competitor_analysis CASCADE;
DROP TABLE IF EXISTS public.content_performance_history CASCADE;
DROP TABLE IF EXISTS public.content_queue CASCADE;
DROP TABLE IF EXISTS public.content_templates CASCADE;
DROP TABLE IF EXISTS public.content_versions CASCADE;
DROP TABLE IF EXISTS public.hashtag_performance CASCADE;
DROP TABLE IF EXISTS public.live_sessions CASCADE;
DROP TABLE IF EXISTS public.performance_metrics CASCADE;
DROP TABLE IF EXISTS public.trending_topics CASCADE;
DROP TABLE IF EXISTS public.user_preferences CASCADE;
DROP TABLE IF EXISTS public.workspace_members CASCADE;
DROP TABLE IF EXISTS public.workspaces CASCADE;

-- 4b — RENAME 5 provenance-resolved (reversible)
ALTER TABLE IF EXISTS public.ad_accounts              RENAME TO zzz_deprecated_ad_accounts;
ALTER TABLE IF EXISTS public.ad_performance_snapshots RENAME TO zzz_deprecated_ad_performance_snapshots;
ALTER TABLE IF EXISTS public.client_churn_risk        RENAME TO zzz_deprecated_client_churn_risk;
ALTER TABLE IF EXISTS public.intervention_logs        RENAME TO zzz_deprecated_intervention_logs;
ALTER TABLE IF EXISTS public.post_performance_events  RENAME TO zzz_deprecated_post_performance_events;


-- =============================================================================
-- STEP 5 — VERIFICATION (read-only; run and eyeball)
-- =============================================================================
-- Ledger now 43:
SELECT count(*) AS ledger_rows FROM _prisma_migrations;                    -- expect 43
SELECT migration_name FROM _prisma_migrations WHERE migration_name >= '20260710' ORDER BY 1;  -- expect the 10 names
-- Reconcile objects present:
SELECT count(*) AS ml_cols FROM information_schema.columns
 WHERE table_name IN ('posts','calendar_posts','gbp_reviews','autopilot_runs')
   AND column_name IN ('predicted_engagement','confidence_score','cross_client_percentile_industry','feature_tags');  -- expect 16
SELECT indexname FROM pg_indexes WHERE tablename='pipeline_cost_ledger' AND indexname LIKE '%created_at_idx' ORDER BY 1;  -- expect 2
SELECT policyname FROM pg_policies WHERE tablename='organization_video_quotas' ORDER BY 1;  -- expect the 2 policies
-- Churn cron off:
SELECT jobname, active FROM cron.job WHERE jobname='daily-churn-score';     -- expect active=false (or 0 rows)
-- Orphans gone / renamed:
SELECT count(*) AS dead17_remaining FROM information_schema.tables WHERE table_schema='public'
 AND table_name IN ('ai_training_data','analytics','automation_logs','billing_history','collaboration_invites','competitor_analysis','content_performance_history','content_queue','content_templates','content_versions','hashtag_performance','live_sessions','performance_metrics','trending_topics','user_preferences','workspace_members','workspaces');  -- expect 0
SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'zzz_deprecated_%' ORDER BY 1;  -- expect the 5 renamed
-- =============================================================================
-- DONE. Next: run `supabase db push` (or scripts/safe-migrate.sh) to apply the P3
-- re-adoption migration (no-op on prod, ledgers itself), and land the coupled repo
-- edit removing the 17 dropped names from scripts/db_preflight.cjs. See the runbook.
-- =============================================================================
