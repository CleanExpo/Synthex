-- =============================================================================
-- Migration: Reconcile SYN-517 / SYN-525 tables into version control
-- Source: SYN-517 (pipeline_cost_ledger, weekly_digests) + SYN-525 (client_notifications)
-- Purpose:
--   These three tables were applied directly to production on 2026-03-30 via the
--   Supabase migration surface (prod migration history records:
--     20260330021909 syn517_pipeline_cost_ledger_v2
--     20260330021919 syn517_weekly_digests_v2
--     20260330021926 syn525_client_notifications_v2
--   ) but the CREATE TABLE migration files were never committed to this repo
--   (the loose prisma-root drafts were archived under .claude/archived/2026-04-27/
--   sql-drift/ as drift). A rebuild-from-repo would therefore be MISSING all three
--   tables. This migration restores the repo as the source of truth.
-- Strategy:
--   - Fully additive & idempotent: CREATE TABLE IF NOT EXISTS + CREATE INDEX
--     IF NOT EXISTS + policy creation guarded by the canonical
--     DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL ... $$ pattern
--     (see 20260319000001_rls_comprehensive_all_tables.sql).
--   - Schema, indexes, trigger, and RLS policies mirror the live prod definitions
--     exactly (verified against znyjoyjsvjotlzjppzal on 2026-07-04).
--   - Running this against prod is a no-op; it exists so a fresh environment
--     reproduces prod state.
-- Access model (unchanged, documented for clarity):
--   - pipeline_cost_ledger  -> Prisma-managed (model PipelineCostLedger)
--   - weekly_digests        -> raw Supabase table (forward-provisioned SYN-510/518)
--   - client_notifications  -> raw Supabase JS table (.from('client_notifications'))
-- Date: 2026-07-04
-- =============================================================================

BEGIN;

-- =============================================================================
-- SECTION 1: pipeline_cost_ledger (SYN-517 / SYN-518)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.pipeline_cost_ledger (
  id            text NOT NULL DEFAULT (gen_random_uuid())::text,
  pipeline_name text NOT NULL,
  client_id     text,
  run_id        text NOT NULL,
  model         text NOT NULL,
  input_tokens  integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cost_usd      numeric NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pipeline_cost_ledger_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_cost_ledger_pipeline_name ON public.pipeline_cost_ledger USING btree (pipeline_name);
CREATE INDEX IF NOT EXISTS idx_pipeline_cost_ledger_client_id ON public.pipeline_cost_ledger USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_cost_ledger_run_id ON public.pipeline_cost_ledger USING btree (run_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_cost_ledger_created_at ON public.pipeline_cost_ledger USING btree (created_at DESC);

ALTER TABLE IF EXISTS public.pipeline_cost_ledger ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_all_pcl" ON public.pipeline_cost_ledger FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_read_own_costs" ON public.pipeline_cost_ledger FOR SELECT TO authenticated USING (client_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END $$;

-- =============================================================================
-- SECTION 2: weekly_digests (SYN-517, with SYN-510 E-E-A-T + SYN-518 cost cols)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.weekly_digests (
  id                   text NOT NULL DEFAULT (gen_random_uuid())::text,
  user_id              text NOT NULL,
  week_start           date NOT NULL,
  week_end             date NOT NULL,
  total_posts          integer NOT NULL DEFAULT 0,
  total_reach          bigint NOT NULL DEFAULT 0,
  total_engagement     bigint NOT NULL DEFAULT 0,
  avg_engagement_rate  numeric NOT NULL DEFAULT 0,
  top_post_id          text,
  top_post_metric      text,
  top_post_value       bigint,
  insights_json        jsonb,
  recommendations_json jsonb,
  email_sent_at        timestamptz,
  email_opened_at      timestamptz,
  dashboard_viewed_at  timestamptz,
  -- SYN-510: E-E-A-T scoring
  eeat_score           integer,
  eeat_delta           integer,
  eeat_breakdown_json  jsonb,
  -- SYN-518: generation cost tracking
  generation_cost_usd  numeric,
  generation_run_id    text,
  status               text NOT NULL DEFAULT 'pending',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT weekly_digests_pkey PRIMARY KEY (id),
  CONSTRAINT weekly_digests_user_id_week_start_key UNIQUE (user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_digests_user_id ON public.weekly_digests USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_digests_week_start ON public.weekly_digests USING btree (week_start DESC);
CREATE INDEX IF NOT EXISTS idx_weekly_digests_status ON public.weekly_digests USING btree (status);

-- Auto-maintain updated_at
CREATE OR REPLACE FUNCTION public.update_weekly_digests_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_weekly_digests_updated_at ON public.weekly_digests;
CREATE TRIGGER trg_weekly_digests_updated_at
  BEFORE UPDATE ON public.weekly_digests
  FOR EACH ROW EXECUTE FUNCTION public.update_weekly_digests_updated_at();

ALTER TABLE IF EXISTS public.weekly_digests ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_all_wd" ON public.weekly_digests FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_read_own_digests" ON public.weekly_digests FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END $$;

-- =============================================================================
-- SECTION 3: client_notifications (SYN-525)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.client_notifications (
  id         text NOT NULL DEFAULT (gen_random_uuid())::text,
  user_id    text NOT NULL,
  type       text NOT NULL,
  title      text NOT NULL,
  body       text NOT NULL,
  payload    jsonb,
  read       boolean NOT NULL DEFAULT false,
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_notifications_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_client_notifications_user_id ON public.client_notifications USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_client_notifications_type ON public.client_notifications USING btree (type);
CREATE INDEX IF NOT EXISTS idx_client_notifications_created_at ON public.client_notifications USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_notifications_unread ON public.client_notifications USING btree (user_id, read) WHERE (read = false);

ALTER TABLE IF EXISTS public.client_notifications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_all_cn" ON public.client_notifications FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_read_own_notifications" ON public.client_notifications FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_update_own_notifications" ON public.client_notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END $$;

COMMIT;
