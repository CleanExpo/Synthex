-- =============================================================================
-- 20260429000001 — SYN-822 / SYN-833 / SYN-834 missing tables
-- =============================================================================
--
-- Covers schema for:
--   * SYN-833: SMS provider audit trail (Twilio + future providers)
--   * SYN-834: NRPG contractor onboarding → DR dynamic service-area expansion
--   * SYN-822: AEO verification-gate audit trail (extension)
--
-- All tables are RLS-enabled per Synthex hardening baseline. Service-role and
-- admin-role have full access; no anon/authenticated read access by default.
--
-- Run order: top-to-bottom. Tables with FKs depend on earlier tables in this
-- file. Safe to re-run (CREATE IF NOT EXISTS / ALTER ... ENABLE ROW LEVEL ...).
--
-- Companion file: prisma-models-additions.md (drop these into prisma/schema.prisma
-- then `npx prisma generate` after the SQL is applied).
--
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Section 1 — SYN-834: NRPG → DR dynamic service-area expansion
-- ─────────────────────────────────────────────────────────────────────────────

-- ────────────────────────────────────────────────────────────
-- 1.1 contractor_onboarding_event
--   Audit log of every NRPG onboarding that triggers DR
--   service-area expansion. Source-of-truth job ID per Q3.2.4 H8.
--   Raw address NEVER stored (Q3.2.5 P10 — only addressHash).
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.contractor_onboarding_event (
  id                                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_of_truth_job_id            text NOT NULL UNIQUE,
  contractor_id                     text NOT NULL,
  brand                             text NOT NULL CHECK (brand IN ('NRPG')),
  base_lat                          double precision NOT NULL CHECK (base_lat BETWEEN -90 AND 90),
  base_lng                          double precision NOT NULL CHECK (base_lng BETWEEN -180 AND 180),
  address_hash                      text NOT NULL,
  radius_km                         integer NOT NULL CHECK (radius_km > 0 AND radius_km <= 200),
  service_categories                text[] NOT NULL,
  payment_confirmed_at              timestamptz NOT NULL,
  consent_for_service_area_listing  boolean NOT NULL,
  expected_suburb_count             integer,
  expected_monthly_budget_aud       numeric(10, 2),
  emitted_at                        timestamptz NOT NULL DEFAULT now(),
  created_at                        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contractor_onboarding_event_contractor
  ON public.contractor_onboarding_event(contractor_id);
CREATE INDEX IF NOT EXISTS idx_contractor_onboarding_event_emitted
  ON public.contractor_onboarding_event(emitted_at DESC);

ALTER TABLE public.contractor_onboarding_event ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contractor_onboarding_event_admin_select ON public.contractor_onboarding_event;
CREATE POLICY contractor_onboarding_event_admin_select
  ON public.contractor_onboarding_event FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');
DROP POLICY IF EXISTS contractor_onboarding_event_service_role_all ON public.contractor_onboarding_event;
CREATE POLICY contractor_onboarding_event_service_role_all
  ON public.contractor_onboarding_event FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE public.contractor_onboarding_event IS
  'SYN-834 (SYN-NRPG-DR-2): every NRPG contractor onboarding that triggers DR service-area expansion. Q3.2.4 H8 audit trail. Raw address NEVER stored (P10).';

-- ────────────────────────────────────────────────────────────
-- 1.2 service_area_coverage
--   Which suburbs DR currently covers + provenance (which
--   contractor opened them). SAB-policy-compliant by construction.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.service_area_coverage (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand                       text NOT NULL DEFAULT 'DR' CHECK (brand IN ('DR')),
  postcode                    text NOT NULL,
  suburb                      text NOT NULL,
  state                       text NOT NULL,
  opened_by_contractor_id     text NOT NULL,
  opened_at                   timestamptz NOT NULL DEFAULT now(),
  closed_at                   timestamptz,
  status                      text NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active', 'paused', 'retreated', 'closed')),
  gbp_updated_at              timestamptz,
  bing_updated_at             timestamptz,
  source_of_truth_job_id      text NOT NULL
                                REFERENCES public.contractor_onboarding_event(source_of_truth_job_id),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_area_coverage_brand_postcode_suburb_unique
    UNIQUE (brand, postcode, suburb)
);
CREATE INDEX IF NOT EXISTS idx_service_area_coverage_status
  ON public.service_area_coverage(status, brand);
CREATE INDEX IF NOT EXISTS idx_service_area_coverage_opened_at
  ON public.service_area_coverage(opened_at DESC);

ALTER TABLE public.service_area_coverage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_area_coverage_admin_select ON public.service_area_coverage;
CREATE POLICY service_area_coverage_admin_select
  ON public.service_area_coverage FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');
DROP POLICY IF EXISTS service_area_coverage_service_role_all ON public.service_area_coverage;
CREATE POLICY service_area_coverage_service_role_all
  ON public.service_area_coverage FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE public.service_area_coverage IS
  'SYN-834 (SYN-NRPG-DR-3): per-suburb DR service-area coverage. Q3.2.3 A1 SAB-compliant by construction (every row backed by a real onboarded contractor).';

-- ────────────────────────────────────────────────────────────
-- 1.3 service_area_coverage_contractor (M:N join)
--   A suburb may be covered by multiple contractors over time.
--   Tracks all backers + add/remove timestamps.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.service_area_coverage_contractor (
  service_area_coverage_id    uuid NOT NULL
                                REFERENCES public.service_area_coverage(id) ON DELETE CASCADE,
  contractor_id               text NOT NULL,
  source_of_truth_job_id      text NOT NULL
                                REFERENCES public.contractor_onboarding_event(source_of_truth_job_id),
  added_at                    timestamptz NOT NULL DEFAULT now(),
  removed_at                  timestamptz,
  PRIMARY KEY (service_area_coverage_id, contractor_id)
);

ALTER TABLE public.service_area_coverage_contractor ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_area_coverage_contractor_admin_select ON public.service_area_coverage_contractor;
CREATE POLICY service_area_coverage_contractor_admin_select
  ON public.service_area_coverage_contractor FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');
DROP POLICY IF EXISTS service_area_coverage_contractor_service_role_all ON public.service_area_coverage_contractor;
CREATE POLICY service_area_coverage_contractor_service_role_all
  ON public.service_area_coverage_contractor FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE public.service_area_coverage_contractor IS
  'SYN-834: M:N join — multiple contractors can back the same suburb (overlap support).';

-- ────────────────────────────────────────────────────────────
-- 1.4 location_budget_ledger
--   $55/mo per opened location. Gates the trigger pipeline.
--   Daily cron consults this for monthly cap enforcement.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.location_budget_ledger (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_area_coverage_id    uuid NOT NULL REFERENCES public.service_area_coverage(id),
  source_of_truth_job_id      text NOT NULL
                                REFERENCES public.contractor_onboarding_event(source_of_truth_job_id),
  contractor_id               text NOT NULL,
  postcode                    text NOT NULL,
  suburb                      text NOT NULL,
  monthly_amount_aud          numeric(10, 2) NOT NULL DEFAULT 55.00,
  opened_at                   timestamptz NOT NULL DEFAULT now(),
  paused_at                   timestamptz,
  paused_reason               text,
  closed_at                   timestamptz,
  status                      text NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active', 'paused', 'closed')),
  created_at                  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_location_budget_ledger_status_opened
  ON public.location_budget_ledger(status, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_location_budget_ledger_contractor
  ON public.location_budget_ledger(contractor_id);

ALTER TABLE public.location_budget_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS location_budget_ledger_admin_select ON public.location_budget_ledger;
CREATE POLICY location_budget_ledger_admin_select
  ON public.location_budget_ledger FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');
DROP POLICY IF EXISTS location_budget_ledger_service_role_all ON public.location_budget_ledger;
CREATE POLICY location_budget_ledger_service_role_all
  ON public.location_budget_ledger FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE public.location_budget_ledger IS
  'SYN-834 (SYN-NRPG-DR-5): $55/mo per opened location. Gates trigger pipeline. Monthly cap configurable in env (NRPG_LOCATION_BUDGET_CAP_AUD).';

-- ────────────────────────────────────────────────────────────
-- 1.5 landing_page_generated
--   Audit of per-(service × suburb) landing pages committed
--   to disasterrecovery.com.au.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.landing_page_generated (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_area_coverage_id    uuid NOT NULL REFERENCES public.service_area_coverage(id),
  source_of_truth_job_id      text NOT NULL
                                REFERENCES public.contractor_onboarding_event(source_of_truth_job_id),
  service_category            text NOT NULL,
  url_slug                    text NOT NULL UNIQUE,
  schema_validated_at         timestamptz,
  brand_voice_enforce_passed  boolean NOT NULL DEFAULT false,
  committed_to_repo_at        timestamptz,
  deployed_at                 timestamptz,
  created_at                  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_landing_page_generated_url_slug
  ON public.landing_page_generated(url_slug);
CREATE INDEX IF NOT EXISTS idx_landing_page_generated_committed
  ON public.landing_page_generated(committed_to_repo_at DESC);

ALTER TABLE public.landing_page_generated ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS landing_page_generated_admin_select ON public.landing_page_generated;
CREATE POLICY landing_page_generated_admin_select
  ON public.landing_page_generated FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');
DROP POLICY IF EXISTS landing_page_generated_service_role_all ON public.landing_page_generated;
CREATE POLICY landing_page_generated_service_role_all
  ON public.landing_page_generated FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE public.landing_page_generated IS
  'SYN-834 (SYN-NRPG-DR-4): per-(service × suburb) landing pages generated for disasterrecovery.com.au. Q3.2.3 A4 schema-vs-content match enforced before commit.';

-- ────────────────────────────────────────────────────────────
-- 1.6 location_kpi
--   Per-location attribution for retreat decisions.
--   Fed by performance-attribution-lead.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.location_kpi (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_area_coverage_id    uuid NOT NULL REFERENCES public.service_area_coverage(id),
  measured_at                 timestamptz NOT NULL DEFAULT now(),
  period_days                 integer NOT NULL CHECK (period_days IN (7, 30, 90)),
  impressions                 integer DEFAULT 0,
  clicks                      integer DEFAULT 0,
  conversions                 integer DEFAULT 0,
  revenue_aud                 numeric(10, 2) DEFAULT 0,
  verification_state          text DEFAULT 'directional'
                                CHECK (verification_state IN ('directional', 'verified')),
  verified_at                 timestamptz,
  created_at                  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_location_kpi_measured
  ON public.location_kpi(service_area_coverage_id, measured_at DESC);

ALTER TABLE public.location_kpi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS location_kpi_admin_select ON public.location_kpi;
CREATE POLICY location_kpi_admin_select
  ON public.location_kpi FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');
DROP POLICY IF EXISTS location_kpi_service_role_all ON public.location_kpi;
CREATE POLICY location_kpi_service_role_all
  ON public.location_kpi FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE public.location_kpi IS
  'SYN-834 (SYN-NRPG-DR-8): per-location attribution snapshots. Q3.2.3 A2 directional-not-KPI binding. 90-day verification cadence per performance-attribution-lead.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Section 2 — SYN-833: SMS provider audit trail
-- ─────────────────────────────────────────────────────────────────────────────

-- ────────────────────────────────────────────────────────────
-- 2.1 sms_send_audit
--   Per-send audit log. recipient_hash NEVER raw phone (P10).
--   Body content NEVER stored (length only).
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sms_send_audit (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_of_truth_job_id      text NOT NULL,
  brand                       text NOT NULL
                                CHECK (brand IN ('DR', 'NRPG', 'RestoreAssist', 'CARSI', 'CCW')),
  provider                    text NOT NULL,
  provider_message_id         text,
  recipient_hash              text NOT NULL,
  body_length                 integer,
  status                      text NOT NULL,
  http_status                 integer,
  error_message               text,
  sent_at                     timestamptz NOT NULL DEFAULT now(),
  delivered_at                timestamptz,
  created_at                  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sms_send_audit_job_id
  ON public.sms_send_audit(source_of_truth_job_id);
CREATE INDEX IF NOT EXISTS idx_sms_send_audit_brand_sent
  ON public.sms_send_audit(brand, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_send_audit_status
  ON public.sms_send_audit(status);

ALTER TABLE public.sms_send_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sms_send_audit_admin_select ON public.sms_send_audit;
CREATE POLICY sms_send_audit_admin_select
  ON public.sms_send_audit FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');
DROP POLICY IF EXISTS sms_send_audit_service_role_all ON public.sms_send_audit;
CREATE POLICY sms_send_audit_service_role_all
  ON public.sms_send_audit FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE public.sms_send_audit IS
  'SYN-833: per-send audit for lib/sms/. P10 binding (recipient_hash only, no raw phone). Body length only, no body content. Q3.2.4 H8 source-of-truth job ID required.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Section 3 — SYN-822: Verification gate audit trail extension
-- ─────────────────────────────────────────────────────────────────────────────

-- ────────────────────────────────────────────────────────────
-- 3.1 verification_gate_audit
--   Tracks every VG state change with foundation-keeper
--   attribution + source-doc reference. Supports VG-AEO-1..4
--   (SYN-832) plus existing VG-XX gates portfolio-wide.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.verification_gate_audit (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gate_id                     text NOT NULL,
  brand                       text,
  previous_state              text NOT NULL,
  new_state                   text NOT NULL,
  source_doc_reference        text,
  ceo_confirmation_recorded   boolean NOT NULL DEFAULT false,
  changed_by                  text NOT NULL,
  reasoning                   text,
  changed_at                  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_verification_gate_audit_gate_changed
  ON public.verification_gate_audit(gate_id, changed_at DESC);

ALTER TABLE public.verification_gate_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS verification_gate_audit_admin_select ON public.verification_gate_audit;
CREATE POLICY verification_gate_audit_admin_select
  ON public.verification_gate_audit FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');
DROP POLICY IF EXISTS verification_gate_audit_service_role_all ON public.verification_gate_audit;
CREATE POLICY verification_gate_audit_service_role_all
  ON public.verification_gate_audit FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE public.verification_gate_audit IS
  'SYN-822 / SYN-832: foundation-keeper audit trail of every VG state change. Hard rule 1: no flip without source-doc reference recorded.';

-- ─────────────────────────────────────────────────────────────────────────────

COMMIT;

-- =============================================================================
-- VERIFICATION (run after applying)
-- =============================================================================
--
-- 1. Confirm all 8 tables exist with RLS enabled:
--
--    SELECT tablename, rowsecurity FROM pg_tables
--    WHERE schemaname = 'public'
--      AND tablename IN (
--        'contractor_onboarding_event',
--        'service_area_coverage',
--        'service_area_coverage_contractor',
--        'location_budget_ledger',
--        'landing_page_generated',
--        'location_kpi',
--        'sms_send_audit',
--        'verification_gate_audit'
--      )
--    ORDER BY tablename;
--
--    Expect: 8 rows, every rowsecurity = true.
--
-- 2. Confirm RLS policies are in place:
--
--    SELECT tablename, policyname, cmd FROM pg_policies
--    WHERE schemaname = 'public'
--      AND tablename IN (...same list as above...)
--    ORDER BY tablename, policyname;
--
--    Expect: 16 rows (2 policies × 8 tables — admin_select + service_role_all).
--
-- 3. Confirm FKs are intact:
--
--    SELECT conname, conrelid::regclass, confrelid::regclass
--    FROM pg_constraint
--    WHERE contype = 'f'
--      AND connamespace = 'public'::regnamespace
--      AND conrelid::regclass::text IN (
--        'service_area_coverage',
--        'service_area_coverage_contractor',
--        'location_budget_ledger',
--        'landing_page_generated',
--        'location_kpi'
--      );
--
--    Expect: 8+ FK rows (each child table → parent).
--
-- =============================================================================
-- ROLLBACK (if needed — destroys all data in these 8 tables)
-- =============================================================================
--
-- BEGIN;
-- DROP TABLE IF EXISTS public.location_kpi CASCADE;
-- DROP TABLE IF EXISTS public.landing_page_generated CASCADE;
-- DROP TABLE IF EXISTS public.location_budget_ledger CASCADE;
-- DROP TABLE IF EXISTS public.service_area_coverage_contractor CASCADE;
-- DROP TABLE IF EXISTS public.service_area_coverage CASCADE;
-- DROP TABLE IF EXISTS public.contractor_onboarding_event CASCADE;
-- DROP TABLE IF EXISTS public.sms_send_audit CASCADE;
-- DROP TABLE IF EXISTS public.verification_gate_audit CASCADE;
-- COMMIT;
--
-- =============================================================================
