-- =============================================================================
-- Migration: Reconcile the Predictive Seasonal Signal Engine into version control
-- Ticket: SYN-560 (data layer) — builds on SYN-547 (engine) / SYN-549 (dismissals)
-- Purpose:
--   The seasonal_signals + seasonal_signal_dismissals business schema, its
--   indexes, RLS read policy, and the get_seasonal_signals() query function were
--   applied to production out of band and are NOT reproducible from this repo.
--   In version control seasonal_signals exists only as a bootstrap stub
--     (20250101/20250102 -> `CREATE TABLE ... seasonal_signals (id TEXT PRIMARY KEY)`)
--   plus ML columns bolted on by 20260331000001_ml_metadata_scaffold_sprint3.sql.
--   A rebuild-from-repo therefore produces a BROKEN table (no industry_slug /
--   window / source columns) and NO get_seasonal_signals() function, so the
--   query API (/api/seasonal-signals) and the calendar matcher would both 500.
--   This migration restores the repo as the source of truth.
--
-- Strategy — fully additive & idempotent (running against prod is a no-op except
--   for creating the missing get_seasonal_signals() function):
--     * CREATE TABLE IF NOT EXISTS      (fresh envs with no bootstrap stub)
--     * ALTER TABLE ADD COLUMN IF NOT EXISTS   (reconcile the bootstrap stub)
--     * ADD CONSTRAINT guarded by DO $$ ... EXCEPTION WHEN duplicate_object $$
--     * CREATE INDEX IF NOT EXISTS
--     * CREATE POLICY guarded by the canonical duplicate_object exception pattern
--       (see 20260319000001_rls_comprehensive_all_tables.sql)
--     * CREATE OR REPLACE FUNCTION
--
-- Timestamp rationale (20260330000000):
--   Deliberately ordered BEFORE 20260331000001_ml_metadata_scaffold_sprint3.sql.
--   That migration runs `ADD COLUMN IF NOT EXISTS confidence_score FLOAT` and its
--   own comment states "confidence_score already exists as INTEGER (domain-specific)
--   — skipped by IF NOT EXISTS". On a fresh rebuild that assumption only holds if
--   confidence_score is created as INTEGER first — which this migration does. If
--   this ran AFTER ml_metadata, a fresh DB would get confidence_score as FLOAT(0..1),
--   breaking the Prisma `Int` model and the `confidence_score >= 60` filter.
--
-- Access model (per ticket): seasonal_signals are SHARED reference data batched
--   per industry+state, not org-scoped rows. service_role writes (the weekly
--   ingestion job); authenticated reads are allowed via a USING (true) SELECT
--   policy AND via the SECURITY DEFINER get_seasonal_signals() function which
--   filters by industry+state.
-- Verified against znyjoyjsvjotlzjppzal on 2026-07-04.
-- Date: 2026-07-04
-- =============================================================================

BEGIN;

-- =============================================================================
-- SECTION 1: seasonal_signals — industry+state seasonal opportunity windows
-- =============================================================================

-- 1a. Fresh-environment create (no-op where the bootstrap stub already exists).
CREATE TABLE IF NOT EXISTS public.seasonal_signals (
  id                text NOT NULL DEFAULT (gen_random_uuid())::text,
  industry_slug     text NOT NULL DEFAULT 'general',
  sub_industry      text,
  location_state    text NOT NULL DEFAULT 'AU',
  signal_type       text NOT NULL,
  opportunity_label text NOT NULL,
  window_start      date NOT NULL,
  window_end        date NOT NULL,
  confidence_score  integer NOT NULL DEFAULT 0,
  source            text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seasonal_signals_pkey PRIMARY KEY (id)
);

-- 1b. Reconcile the bootstrap stub (id-only) up to the full business schema.
ALTER TABLE IF EXISTS public.seasonal_signals
  ADD COLUMN IF NOT EXISTS industry_slug     text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS sub_industry      text,
  ADD COLUMN IF NOT EXISTS location_state    text NOT NULL DEFAULT 'AU',
  ADD COLUMN IF NOT EXISTS signal_type       text,
  ADD COLUMN IF NOT EXISTS opportunity_label text,
  ADD COLUMN IF NOT EXISTS window_start      date,
  ADD COLUMN IF NOT EXISTS window_end        date,
  ADD COLUMN IF NOT EXISTS confidence_score  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source            text,
  ADD COLUMN IF NOT EXISTS created_at        timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at        timestamptz NOT NULL DEFAULT now();

-- 1c. CHECK constraints (guarded — cannot use ADD CONSTRAINT IF NOT EXISTS).
DO $$ BEGIN
  ALTER TABLE public.seasonal_signals
    ADD CONSTRAINT seasonal_signals_signal_type_chk
    CHECK (signal_type IN ('trend_spike','seasonal_peak','local_event','holiday','school_term'));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.seasonal_signals
    ADD CONSTRAINT seasonal_signals_confidence_chk
    CHECK (confidence_score >= 0 AND confidence_score <= 100);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.seasonal_signals
    ADD CONSTRAINT seasonal_signals_source_chk
    CHECK (source IN ('google_trends','abs_data','school_calendar','public_holiday'));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END $$;

-- 1d. Dedup uniqueness (matches Prisma @@unique seasonal_signal_dedup) + indexes.
CREATE UNIQUE INDEX IF NOT EXISTS seasonal_signals_dedup_uq
  ON public.seasonal_signals USING btree (industry_slug, location_state, window_start, source);
CREATE INDEX IF NOT EXISTS idx_seasonal_signals_industry_state
  ON public.seasonal_signals USING btree (industry_slug, location_state);
CREATE INDEX IF NOT EXISTS idx_seasonal_signals_window_start
  ON public.seasonal_signals USING btree (window_start);
CREATE INDEX IF NOT EXISTS idx_seasonal_signals_confidence
  ON public.seasonal_signals USING btree (confidence_score);

-- 1e. Auto-maintain updated_at.
CREATE OR REPLACE FUNCTION public.update_seasonal_signals_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_seasonal_signals_updated_at ON public.seasonal_signals;
CREATE TRIGGER trg_seasonal_signals_updated_at
  BEFORE UPDATE ON public.seasonal_signals
  FOR EACH ROW EXECUTE FUNCTION public.update_seasonal_signals_updated_at();

-- 1f. RLS: service_role writes; authenticated reads (shared reference data).
--     The read policy `seasonal_signals_read` was dropped by
--     20260516000004_rls_batch_1_5 and never recreated — restore it here.
ALTER TABLE IF EXISTS public.seasonal_signals ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "service_role_all_seasonal_signals" ON public.seasonal_signals
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "seasonal_signals_read" ON public.seasonal_signals
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END $$;

-- =============================================================================
-- SECTION 2: seasonal_signal_dismissals — per-org dismissal of a signal (SYN-549)
--   Reconciled here for rebuild-from-repo completeness. RLS enable + tenant
--   policies already exist (20260527043900 / 20260516130242); this only supplies
--   the missing CREATE TABLE. Tenant policies remain the source of truth.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.seasonal_signal_dismissals (
  id              text NOT NULL DEFAULT (gen_random_uuid())::text,
  organization_id text NOT NULL,
  signal_id       text NOT NULL,
  dismissed_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seasonal_signal_dismissals_pkey PRIMARY KEY (id),
  CONSTRAINT seasonal_signal_dismissals_org_signal_key UNIQUE (organization_id, signal_id)
);

CREATE INDEX IF NOT EXISTS idx_seasonal_signal_dismissals_org
  ON public.seasonal_signal_dismissals USING btree (organization_id);

ALTER TABLE IF EXISTS public.seasonal_signal_dismissals ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- SECTION 3: get_seasonal_signals() — the query function (SYN-560 Phase 2)
--   Returns upcoming opportunity windows for an industry+state with
--   confidence_score >= 60, ordered by window_start.
--   Fallbacks (so shared holiday/school_term rows stored under
--   industry_slug='general' / location_state='AU' surface for any client):
--     - industry_slug matches the requested slug OR 'general'
--     - location_state matches the requested state OR 'AU'
--   "Upcoming" = window_end >= CURRENT_DATE (active or future windows).
--   p_limit caps the row count (the committed /api/seasonal-signals caller
--   passes its `limit` here). p_lookahead_weeks optionally bounds how far ahead
--   window_start may be; NULL = no upper bound.
--   SECURITY DEFINER so authenticated clients may read shared reference data
--   through this function regardless of table RLS.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_seasonal_signals(
  p_industry_slug   text,
  p_state_code      text,
  p_limit           integer DEFAULT 10,
  p_lookahead_weeks integer DEFAULT NULL
)
RETURNS TABLE (
  id                text,
  industry_slug     text,
  sub_industry      text,
  location_state    text,
  signal_type       text,
  opportunity_label text,
  window_start      date,
  window_end        date,
  confidence_score  integer,
  source            text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT s.id,
         s.industry_slug,
         s.sub_industry,
         s.location_state,
         s.signal_type,
         s.opportunity_label,
         s.window_start,
         s.window_end,
         s.confidence_score,
         s.source
  FROM   public.seasonal_signals s
  WHERE  s.industry_slug IN (p_industry_slug, 'general')
    AND  s.location_state IN (p_state_code, 'AU')
    AND  s.confidence_score >= 60
    AND  s.window_end >= CURRENT_DATE
    AND  (
           p_lookahead_weeks IS NULL
           OR s.window_start <= CURRENT_DATE + (p_lookahead_weeks * 7)
         )
  ORDER  BY s.window_start ASC, s.confidence_score DESC
  LIMIT  GREATEST(p_limit, 0);
$function$;

GRANT EXECUTE ON FUNCTION public.get_seasonal_signals(text, text, integer, integer)
  TO authenticated, service_role;

COMMIT;
