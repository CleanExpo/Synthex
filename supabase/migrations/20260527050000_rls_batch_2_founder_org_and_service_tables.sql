-- ============================================================================
-- Migration: 20260527050000_rls_batch_2_founder_org_and_service_tables
-- Purpose:   Cover the remaining Prisma-backed tables with RLS enablement and
--            add scoped policies where the ownership column is unambiguous.
-- Trace:     SYN-971
-- ============================================================================
--
-- Policy posture:
--   - Do not add `USING (true)` policies. The adversarial RLS gate classifies
--     those as broken/open-by-default, even for read-only reference data.
--   - Tables with clear founder/org/parent ownership get authenticated policies.
--   - Platform/reference/sensitive internal tables without an unambiguous
--     row-owner column are intentionally service-role-only for now.
--
-- Service-role access is not granted here because Supabase service_role bypasses
-- RLS. Adding service_role `USING (true)` policies would add noise to the live
-- `pg_policies` security audit without improving access.

-- ---------------------------------------------------------------------------
-- Enable RLS on every remaining Prisma-backed table from the local coverage gap.
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.advisory_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.authority_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.auto_research_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.autopilot_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bookkeeper_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.client_engagement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.client_health_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.connected_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.credentials_vault ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.edge_function_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.experiment_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.founder_outreach_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.gbp_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.generated_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.health_interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.health_score_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.industry_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.industry_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.intervention_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.intervention_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.marketplace_channel_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.marketplace_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.model_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.nexus_databases ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.onboarding_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pipeline_cost_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.platform_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.seasonal_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.social_engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.story_quality_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.testimonial_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.trend_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.video_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.video_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.video_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.video_topic_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.waitlist_entries ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Founder-scoped tables. Prisma user IDs are text unless explicitly UUID typed.
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY advisory_cases_founder_access
    ON public.advisory_cases FOR ALL TO authenticated
    USING (founder_id = auth.uid()::text)
    WITH CHECK (founder_id = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY connected_projects_founder_access
    ON public.connected_projects FOR ALL TO authenticated
    USING (founder_id = auth.uid()::text)
    WITH CHECK (founder_id = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY email_campaigns_founder_access
    ON public.email_campaigns FOR ALL TO authenticated
    USING (founder_id = auth.uid()::text)
    WITH CHECK (founder_id = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY experiments_founder_access
    ON public.experiments FOR ALL TO authenticated
    USING (founder_id = auth.uid()::text)
    WITH CHECK (founder_id = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY generated_content_founder_access
    ON public.generated_content FOR ALL TO authenticated
    USING (founder_id = auth.uid()::text)
    WITH CHECK (founder_id = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY nexus_databases_founder_access
    ON public.nexus_databases FOR ALL TO authenticated
    USING (founder_id = auth.uid()::text)
    WITH CHECK (founder_id = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY platform_analytics_founder_access
    ON public.platform_analytics FOR ALL TO authenticated
    USING (founder_id = auth.uid()::text)
    WITH CHECK (founder_id = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY social_engagements_founder_access
    ON public.social_engagements FOR ALL TO authenticated
    USING (founder_id = auth.uid()::text)
    WITH CHECK (founder_id = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY video_assets_founder_access
    ON public.video_assets FOR ALL TO authenticated
    USING (founder_id = auth.uid()::text)
    WITH CHECK (founder_id = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Tenant/org-scoped tables. Some legacy tables use client_id, org_id,
-- organisation_id, or quoted camelCase `organizationId`; all resolve to the
-- authenticated user's public.users.organization_id value.
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY authority_scores_tenant_access
    ON public.authority_scores FOR ALL TO authenticated
    USING (client_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text))
    WITH CHECK (client_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY auto_research_runs_tenant_access
    ON public.auto_research_runs FOR ALL TO authenticated
    USING ("organizationId" IS NOT NULL AND "organizationId" IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text))
    WITH CHECK ("organizationId" IS NOT NULL AND "organizationId" IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY autopilot_runs_tenant_access
    ON public.autopilot_runs FOR ALL TO authenticated
    USING (is_team_member(organization_id))
    WITH CHECK (is_team_member(organization_id));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY client_engagement_events_tenant_access
    ON public.client_engagement_events FOR ALL TO authenticated
    USING (client_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text))
    WITH CHECK (client_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY client_health_scores_tenant_access
    ON public.client_health_scores FOR ALL TO authenticated
    USING (is_team_member(organization_id))
    WITH CHECK (is_team_member(organization_id));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY founder_outreach_queue_tenant_access
    ON public.founder_outreach_queue FOR ALL TO authenticated
    USING (is_team_member(organization_id))
    WITH CHECK (is_team_member(organization_id));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY gbp_reviews_tenant_access
    ON public.gbp_reviews FOR ALL TO authenticated
    USING (is_team_member(organization_id))
    WITH CHECK (is_team_member(organization_id));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY health_interventions_tenant_access
    ON public.health_interventions FOR ALL TO authenticated
    USING (is_team_member(organization_id))
    WITH CHECK (is_team_member(organization_id));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY marketplace_products_tenant_access
    ON public.marketplace_products FOR ALL TO authenticated
    USING (org_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text))
    WITH CHECK (org_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY marketplace_channel_listings_tenant_access
    ON public.marketplace_channel_listings FOR ALL TO authenticated
    USING (org_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text))
    WITH CHECK (org_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY onboarding_profiles_tenant_access
    ON public.onboarding_profiles FOR ALL TO authenticated
    USING (is_team_member(organization_id) OR user_id = auth.uid()::text)
    WITH CHECK (is_team_member(organization_id) OR user_id = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY push_subscriptions_owner_access
    ON public.push_subscriptions FOR ALL TO authenticated
    USING (
      (organization_id IS NOT NULL AND is_team_member(organization_id))
      OR user_id = auth.uid()::text
    )
    WITH CHECK (
      (organization_id IS NOT NULL AND is_team_member(organization_id))
      OR user_id = auth.uid()::text
    );
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY testimonial_requests_tenant_access
    ON public.testimonial_requests FOR ALL TO authenticated
    USING (organization_id::text IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text))
    WITH CHECK (organization_id::text IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY testimonials_tenant_access
    ON public.testimonials FOR ALL TO authenticated
    USING (organization_id::text IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text))
    WITH CHECK (organization_id::text IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY trend_insights_tenant_access
    ON public.trend_insights FOR ALL TO authenticated
    USING ("organizationId" IS NOT NULL AND "organizationId" IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text))
    WITH CHECK ("organizationId" IS NOT NULL AND "organizationId" IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY video_series_tenant_access
    ON public.video_series FOR ALL TO authenticated
    USING (organisation_id IS NOT NULL AND organisation_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text))
    WITH CHECK (organisation_id IS NOT NULL AND organisation_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Parent-scoped child tables.
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY experiment_results_founder_access
    ON public.experiment_results FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.experiments e
        WHERE e.id = experiment_id AND e.founder_id = auth.uid()::text
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.experiments e
        WHERE e.id = experiment_id AND e.founder_id = auth.uid()::text
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY invoice_line_items_tenant_access
    ON public.invoice_line_items FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.id = invoice_id AND is_team_member(i.organization_id)
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.id = invoice_id AND is_team_member(i.organization_id)
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY story_quality_reviews_tenant_access
    ON public.story_quality_reviews FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.monthly_stories s
        WHERE s.id = story_id AND is_team_member(s.organization_id)
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.monthly_stories s
        WHERE s.id = story_id AND is_team_member(s.organization_id)
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY video_episodes_tenant_access
    ON public.video_episodes FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.video_series s
        WHERE s.id = series_id
          AND s.organisation_id IS NOT NULL
          AND s.organisation_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text)
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.video_series s
        WHERE s.id = series_id
          AND s.organisation_id IS NOT NULL
          AND s.organisation_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text)
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY video_topic_queue_tenant_access
    ON public.video_topic_queue FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.video_series s
        WHERE s.id = series_id
          AND s.organisation_id IS NOT NULL
          AND s.organisation_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text)
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.video_series s
        WHERE s.id = series_id
          AND s.organisation_id IS NOT NULL
          AND s.organisation_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text)
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Intentionally service-role-only pending a per-table product decision:
--   blog_posts, bookkeeper_transactions, credentials_vault, edge_function_logs,
--   health_score_config, industry_baselines, industry_templates,
--   intervention_config, intervention_templates, model_metrics,
--   pipeline_cost_ledger, seasonal_signals, waitlist_entries.
-- ---------------------------------------------------------------------------
