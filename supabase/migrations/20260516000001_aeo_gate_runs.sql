-- =============================================================================
-- SYN-822 Phase 4 · VG-AEO — brand-voice-enforce audit trail.
-- Spec: docs/aeo/brand-voice-enforce-spec-2026-05-16.md
-- Mandate: 27e98e38-a6fd-4269-b223-db00f5e0e629
--
-- Persists every brand-voice-enforce gate run. Q3.2.5 P10 binding:
-- candidate body NEVER stored — sha256 hash only.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.aeo_gate_runs (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand                    TEXT NOT NULL,
    surface                  TEXT NOT NULL,
    pass                     BOOLEAN NOT NULL,
    reasons                  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    evidence_urls            TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    candidate_hash           TEXT NOT NULL,
    candidate_length         INTEGER NOT NULL,
    source_of_truth_job_id   TEXT,
    duration_ms              INTEGER NOT NULL,
    rule_set_version         TEXT NOT NULL DEFAULT '2026-05-16',
    brand_config_sha         TEXT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT aeo_gate_runs_surface_check
        CHECK (surface IN ('sms', 'outreach', 'landing-page', 'schema-faq', 'gbp-post'))
);

CREATE INDEX IF NOT EXISTS idx_aeo_gate_runs_brand_created
    ON public.aeo_gate_runs(brand, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aeo_gate_runs_surface_created
    ON public.aeo_gate_runs(surface, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aeo_gate_runs_pass_created
    ON public.aeo_gate_runs(pass, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aeo_gate_runs_job_id
    ON public.aeo_gate_runs(source_of_truth_job_id)
    WHERE source_of_truth_job_id IS NOT NULL;

ALTER TABLE public.aeo_gate_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS aeo_gate_runs_admin_select ON public.aeo_gate_runs;
DO $$ BEGIN
  CREATE POLICY aeo_gate_runs_admin_select
      ON public.aeo_gate_runs FOR SELECT
      TO authenticated
      USING (
          EXISTS (
              SELECT 1 FROM public.user_roles ur
              WHERE ur.user_id = auth.uid()::text AND ur.role = 'admin'
          )
      );
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

DROP POLICY IF EXISTS aeo_gate_runs_service_role_all ON public.aeo_gate_runs;
DO $$ BEGIN
  CREATE POLICY aeo_gate_runs_service_role_all
      ON public.aeo_gate_runs FOR ALL
      TO service_role
      USING (TRUE)
      WITH CHECK (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; END $$;

COMMENT ON TABLE public.aeo_gate_runs IS
    'brand-voice-enforce mechanical gate audit trail. Spec: docs/aeo/brand-voice-enforce-spec-2026-05-16.md. P10-bound: candidate body NEVER stored.';
COMMENT ON COLUMN public.aeo_gate_runs.candidate_hash IS
    'sha256(candidate) hex — full 64-char digest. Body itself is never persisted (Q3.2.5 P10).';
COMMENT ON COLUMN public.aeo_gate_runs.rule_set_version IS
    'Date of the rule-set version that produced this decision. Bump when rules.ts changes shape.';

-- Verification query (run after migration):
--   SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename='aeo_gate_runs';
--   SELECT polname FROM pg_policy WHERE polrelid = 'public.aeo_gate_runs'::regclass;
