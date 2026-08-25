-- ============================================================================
-- Migration: 20260516000002_rls_batch_1_tenant_scoped_no_policy
-- Purpose:   Add tenant-scoped RLS policies to 19 NO_POLICY tables that have
--            an `organization_id text` column matching team_members.
-- Mandate:   a4aae2cf-6a05-4426-9019-3f38137a9b7b (Synthex Phase 2)
-- Batch:     1 of N (NO_POLICY → SECURE, low-risk batch)
-- ============================================================================
--
-- WHY THIS BATCH IS LOW-RISK
-- --------------------------
-- These 19 tables currently have RLS enabled but ZERO policies. That means:
--   - service_role still reads/writes (RLS is bypassed for service_role)
--   - anon and authenticated currently get 0 rows from these tables
--
-- Adding `using (is_team_member(organization_id))` policies for anon/auth:
--   - service_role behaviour: UNCHANGED (still bypassed)
--   - anon/auth behaviour: still gets 0 rows for non-members, NOW gets rows
--     for legitimate team-members of the row's organization
--
-- This is a strict UNLOCK for legitimate users — it cannot break service-role
-- code paths. The blast radius is bounded.
--
-- DEFERRED — NOT IN THIS BATCH
-- ----------------------------
--   - `testimonials` and `testimonial_requests` have `organization_id uuid`,
--     not text. They need a casted predicate or a column-type fix first.
--     Batch 2 handles uuid-typed tenant columns.
--   - Tables with no organization_id column (advisory_cases, leads* would
--     be here but leads HAS org_id, marketplace_*, model_metrics, etc.) are
--     not addressable by a tenant-scoped policy. They need a per-table
--     review — Batch 3.
--
-- PRE-MERGE GATES
-- ---------------
-- Per the mandate's hard rules:
--   1. RLS_ADVERSARIAL=true npx jest tests/security/cross-tenant.spec.ts
--      → SECURE count must move from 18 to 37 after this migration
--   2. No service-role-key route in app/api/** must regress.
--      → checked manually against docs/security/service-role-leaks-2026-05-16.md
--   3. Migration is forward-only. Compensation = drop the policies, not the table.
--
-- ============================================================================

BEGIN;

-- Helper macro: standard tenant-read + tenant-write policy pair.
-- Inline-expanded per table for greppability + per-table audit.

-- ---------------------------------------------------------------------------
-- autopilot_configs
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY autopilot_configs_tenant_read
    ON public.autopilot_configs
    FOR SELECT TO authenticated
    USING (is_team_member(organization_id));
EXCEPTION
  WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY autopilot_configs_tenant_write
    ON public.autopilot_configs
    FOR ALL TO authenticated
    USING (is_team_member(organization_id))
    WITH CHECK (is_team_member(organization_id));
EXCEPTION
  WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- competitor_keyword_gaps
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY competitor_keyword_gaps_tenant_read
    ON public.competitor_keyword_gaps
    FOR SELECT TO authenticated
    USING (is_team_member(organization_id));
EXCEPTION
  WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY competitor_keyword_gaps_tenant_write
    ON public.competitor_keyword_gaps
    FOR ALL TO authenticated
    USING (is_team_member(organization_id))
    WITH CHECK (is_team_member(organization_id));
EXCEPTION
  WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- content_improvement_tracking
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY content_improvement_tracking_tenant_read
    ON public.content_improvement_tracking
    FOR SELECT TO authenticated
    USING (is_team_member(organization_id));
EXCEPTION
  WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY content_improvement_tracking_tenant_write
    ON public.content_improvement_tracking
    FOR ALL TO authenticated
    USING (is_team_member(organization_id))
    WITH CHECK (is_team_member(organization_id));
EXCEPTION
  WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- content_performance_profiles
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY content_performance_profiles_tenant_read
    ON public.content_performance_profiles
    FOR SELECT TO authenticated
    USING (is_team_member(organization_id));
EXCEPTION
  WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY content_performance_profiles_tenant_write
    ON public.content_performance_profiles
    FOR ALL TO authenticated
    USING (is_team_member(organization_id))
    WITH CHECK (is_team_member(organization_id));
EXCEPTION
  WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- content_topic_suggestions
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY content_topic_suggestions_tenant_read
    ON public.content_topic_suggestions
    FOR SELECT TO authenticated
    USING (is_team_member(organization_id));
EXCEPTION
  WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY content_topic_suggestions_tenant_write
    ON public.content_topic_suggestions
    FOR ALL TO authenticated
    USING (is_team_member(organization_id))
    WITH CHECK (is_team_member(organization_id));
EXCEPTION
  WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- ga4_properties
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY ga4_properties_tenant_read
    ON public.ga4_properties
    FOR SELECT TO authenticated
    USING (is_team_member(organization_id));
EXCEPTION
  WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY ga4_properties_tenant_write
    ON public.ga4_properties
    FOR ALL TO authenticated
    USING (is_team_member(organization_id))
    WITH CHECK (is_team_member(organization_id));
EXCEPTION
  WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- gbp_locations
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY gbp_locations_tenant_read
    ON public.gbp_locations
    FOR SELECT TO authenticated
    USING (is_team_member(organization_id));
EXCEPTION
  WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY gbp_locations_tenant_write
    ON public.gbp_locations
    FOR ALL TO authenticated
    USING (is_team_member(organization_id))
    WITH CHECK (is_team_member(organization_id));
EXCEPTION
  WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- gbp_snapshots
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY gbp_snapshots_tenant_read
    ON public.gbp_snapshots
    FOR SELECT TO authenticated
    USING (is_team_member(organization_id));
EXCEPTION
  WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY gbp_snapshots_tenant_write
    ON public.gbp_snapshots
    FOR ALL TO authenticated
    USING (is_team_member(organization_id))
    WITH CHECK (is_team_member(organization_id));
EXCEPTION
  WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- gsc_properties
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY gsc_properties_tenant_read
    ON public.gsc_properties
    FOR SELECT TO authenticated
    USING (is_team_member(organization_id));
EXCEPTION
  WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY gsc_properties_tenant_write
    ON public.gsc_properties
    FOR ALL TO authenticated
    USING (is_team_member(organization_id))
    WITH CHECK (is_team_member(organization_id));
EXCEPTION
  WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- gsc_snapshots
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY gsc_snapshots_tenant_read
    ON public.gsc_snapshots
    FOR SELECT TO authenticated
    USING (is_team_member(organization_id));
EXCEPTION
  WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY gsc_snapshots_tenant_write
    ON public.gsc_snapshots
    FOR ALL TO authenticated
    USING (is_team_member(organization_id))
    WITH CHECK (is_team_member(organization_id));
EXCEPTION
  WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- invoices
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY invoices_tenant_read
    ON public.invoices
    FOR SELECT TO authenticated
    USING (is_team_member(organization_id));
EXCEPTION
  WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY invoices_tenant_write
    ON public.invoices
    FOR ALL TO authenticated
    USING (is_team_member(organization_id))
    WITH CHECK (is_team_member(organization_id));
EXCEPTION
  WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- keyword_rank_snapshots
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY keyword_rank_snapshots_tenant_read
    ON public.keyword_rank_snapshots
    FOR SELECT TO authenticated
    USING (is_team_member(organization_id));
EXCEPTION
  WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY keyword_rank_snapshots_tenant_write
    ON public.keyword_rank_snapshots
    FOR ALL TO authenticated
    USING (is_team_member(organization_id))
    WITH CHECK (is_team_member(organization_id));
EXCEPTION
  WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- keyword_targets
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY keyword_targets_tenant_read
    ON public.keyword_targets
    FOR SELECT TO authenticated
    USING (is_team_member(organization_id));
EXCEPTION
  WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY keyword_targets_tenant_write
    ON public.keyword_targets
    FOR ALL TO authenticated
    USING (is_team_member(organization_id))
    WITH CHECK (is_team_member(organization_id));
EXCEPTION
  WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- leads
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY leads_tenant_read
    ON public.leads
    FOR SELECT TO authenticated
    USING (is_team_member(organization_id));
EXCEPTION
  WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY leads_tenant_write
    ON public.leads
    FOR ALL TO authenticated
    USING (is_team_member(organization_id))
    WITH CHECK (is_team_member(organization_id));
EXCEPTION
  WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- monthly_stories
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY monthly_stories_tenant_read
    ON public.monthly_stories
    FOR SELECT TO authenticated
    USING (is_team_member(organization_id));
EXCEPTION
  WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY monthly_stories_tenant_write
    ON public.monthly_stories
    FOR ALL TO authenticated
    USING (is_team_member(organization_id))
    WITH CHECK (is_team_member(organization_id));
EXCEPTION
  WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- review_requests
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY review_requests_tenant_read
    ON public.review_requests
    FOR SELECT TO authenticated
    USING (is_team_member(organization_id));
EXCEPTION
  WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY review_requests_tenant_write
    ON public.review_requests
    FOR ALL TO authenticated
    USING (is_team_member(organization_id))
    WITH CHECK (is_team_member(organization_id));
EXCEPTION
  WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- seasonal_signal_dismissals
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY seasonal_signal_dismissals_tenant_read
    ON public.seasonal_signal_dismissals
    FOR SELECT TO authenticated
    USING (is_team_member(organization_id));
EXCEPTION
  WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY seasonal_signal_dismissals_tenant_write
    ON public.seasonal_signal_dismissals
    FOR ALL TO authenticated
    USING (is_team_member(organization_id))
    WITH CHECK (is_team_member(organization_id));
EXCEPTION
  WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- story_config
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY story_config_tenant_read
    ON public.story_config
    FOR SELECT TO authenticated
    USING (is_team_member(organization_id));
EXCEPTION
  WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY story_config_tenant_write
    ON public.story_config
    FOR ALL TO authenticated
    USING (is_team_member(organization_id))
    WITH CHECK (is_team_member(organization_id));
EXCEPTION
  WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- visibility_scores
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY visibility_scores_tenant_read
    ON public.visibility_scores
    FOR SELECT TO authenticated
    USING (is_team_member(organization_id));
EXCEPTION
  WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY visibility_scores_tenant_write
    ON public.visibility_scores
    FOR ALL TO authenticated
    USING (is_team_member(organization_id))
    WITH CHECK (is_team_member(organization_id));
EXCEPTION
  WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL;
END $$;

COMMIT;
