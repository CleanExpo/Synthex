-- ============================================================================
-- Migration: 20260615080000_rls_tier1_content_and_connections
-- Purpose:   Replace permissive `using (true)` policies with org-scoped RLS
--            on the 7 highest-risk tables: campaigns, posts, platform_connections,
--            platform_posts, platform_metrics, reports, subscriptions.
-- Authority: Gap 4 — RLS Security Foundation (agency readiness plan 2026-06-15)
-- Helper:    depends on public.is_team_member(text) created in 20260602055800
-- Safety:    Column existence guards throughout — the Supabase Preview branch
--            rebuilds from migration history and is missing many columns that were
--            added to production outside of tracked migrations (organization_id,
--            campaign_id, connection_id, post_id, user_id type differences).
--            Preview fallback: permissive TRUE for child tables missing FK columns;
--            user_id::text scope for parent tables missing organization_id.
--            Production (all columns present): full org-scoped policies apply.
--            All user_id comparisons use ::text cast on both sides to handle
--            UUID (preview) vs TEXT (production) column type differences.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. CAMPAIGNS — direct org scope via organization_id / user_id
-- ============================================================================
DO $campaigns$
DECLARE
  has_org_col  boolean;
  has_user_col boolean;
BEGIN
IF to_regclass('public.campaigns') IS NOT NULL THEN

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'campaigns' AND column_name = 'organization_id'
  ) INTO has_org_col;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'campaigns' AND column_name = 'user_id'
  ) INTO has_user_col;

  ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS campaigns_select ON public.campaigns;
  DROP POLICY IF EXISTS campaigns_insert ON public.campaigns;
  DROP POLICY IF EXISTS campaigns_update ON public.campaigns;
  DROP POLICY IF EXISTS campaigns_delete ON public.campaigns;
  DROP POLICY IF EXISTS "Allow all" ON public.campaigns;
  DROP POLICY IF EXISTS "Enable all" ON public.campaigns;

  IF has_org_col AND has_user_col THEN
    -- Production: full org-scoped policies
    CREATE POLICY campaigns_select ON public.campaigns FOR SELECT TO authenticated
      USING (
        (organization_id IS NOT NULL AND public.is_team_member(organization_id))
        OR (organization_id IS NULL AND user_id::text = (SELECT auth.uid())::text)
      );
    CREATE POLICY campaigns_insert ON public.campaigns FOR INSERT TO authenticated
      WITH CHECK (
        (organization_id IS NOT NULL AND public.is_team_member(organization_id))
        OR (organization_id IS NULL AND user_id::text = (SELECT auth.uid())::text)
      );
    CREATE POLICY campaigns_update ON public.campaigns FOR UPDATE TO authenticated
      USING (
        (organization_id IS NOT NULL AND public.is_team_member(organization_id))
        OR (organization_id IS NULL AND user_id::text = (SELECT auth.uid())::text)
      )
      WITH CHECK (
        (organization_id IS NOT NULL AND public.is_team_member(organization_id))
        OR (organization_id IS NULL AND user_id::text = (SELECT auth.uid())::text)
      );
    CREATE POLICY campaigns_delete ON public.campaigns FOR DELETE TO authenticated
      USING (
        (organization_id IS NOT NULL AND public.is_team_member(organization_id))
        OR (organization_id IS NULL AND user_id::text = (SELECT auth.uid())::text)
      );
  ELSIF has_user_col THEN
    -- Preview fallback: user_id scope only (organization_id absent)
    CREATE POLICY campaigns_select ON public.campaigns FOR SELECT TO authenticated
      USING (user_id::text = (SELECT auth.uid())::text);
    CREATE POLICY campaigns_insert ON public.campaigns FOR INSERT TO authenticated
      WITH CHECK (user_id::text = (SELECT auth.uid())::text);
    CREATE POLICY campaigns_update ON public.campaigns FOR UPDATE TO authenticated
      USING (user_id::text = (SELECT auth.uid())::text)
      WITH CHECK (user_id::text = (SELECT auth.uid())::text);
    CREATE POLICY campaigns_delete ON public.campaigns FOR DELETE TO authenticated
      USING (user_id::text = (SELECT auth.uid())::text);
  ELSE
    -- Minimal preview: table exists but no usable scope column — enable RLS only
    CREATE POLICY campaigns_select ON public.campaigns FOR SELECT TO authenticated USING (TRUE);
    CREATE POLICY campaigns_insert ON public.campaigns FOR INSERT TO authenticated WITH CHECK (TRUE);
    CREATE POLICY campaigns_update ON public.campaigns FOR UPDATE TO authenticated USING (TRUE);
    CREATE POLICY campaigns_delete ON public.campaigns FOR DELETE TO authenticated USING (TRUE);
  END IF;

END IF;
END;
$campaigns$;

-- ============================================================================
-- 2. POSTS — inherit scope through campaign_id → campaigns.user_id
-- ============================================================================
DO $posts$
DECLARE
  has_campaign_id boolean;
BEGIN
IF to_regclass('public.posts') IS NOT NULL THEN

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'posts' AND column_name = 'campaign_id'
  ) INTO has_campaign_id;

  ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS posts_select ON public.posts;
  DROP POLICY IF EXISTS posts_insert ON public.posts;
  DROP POLICY IF EXISTS posts_update ON public.posts;
  DROP POLICY IF EXISTS posts_delete ON public.posts;
  DROP POLICY IF EXISTS "Allow all" ON public.posts;
  DROP POLICY IF EXISTS "Enable all" ON public.posts;

  IF has_campaign_id THEN
    CREATE POLICY posts_select ON public.posts FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id
          AND c.user_id::text = (SELECT auth.uid())::text
      ));
    CREATE POLICY posts_insert ON public.posts FOR INSERT TO authenticated
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id
          AND c.user_id::text = (SELECT auth.uid())::text
      ));
    CREATE POLICY posts_update ON public.posts FOR UPDATE TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id
          AND c.user_id::text = (SELECT auth.uid())::text
      ));
    CREATE POLICY posts_delete ON public.posts FOR DELETE TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id
          AND c.user_id::text = (SELECT auth.uid())::text
      ));
  ELSE
    -- Preview fallback: campaign_id absent — enable RLS, allow authenticated
    CREATE POLICY posts_select ON public.posts FOR SELECT TO authenticated USING (TRUE);
    CREATE POLICY posts_insert ON public.posts FOR INSERT TO authenticated WITH CHECK (TRUE);
    CREATE POLICY posts_update ON public.posts FOR UPDATE TO authenticated USING (TRUE);
    CREATE POLICY posts_delete ON public.posts FOR DELETE TO authenticated USING (TRUE);
  END IF;

END IF;
END;
$posts$;

-- ============================================================================
-- 3. PLATFORM_CONNECTIONS — direct org scope (OAuth tokens, highest sensitivity)
-- ============================================================================
DO $platform_connections$
DECLARE
  has_org_col  boolean;
  has_user_col boolean;
BEGIN
IF to_regclass('public.platform_connections') IS NOT NULL THEN

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'platform_connections' AND column_name = 'organization_id'
  ) INTO has_org_col;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'platform_connections' AND column_name = 'user_id'
  ) INTO has_user_col;

  ALTER TABLE public.platform_connections ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS platform_connections_select ON public.platform_connections;
  DROP POLICY IF EXISTS platform_connections_insert ON public.platform_connections;
  DROP POLICY IF EXISTS platform_connections_update ON public.platform_connections;
  DROP POLICY IF EXISTS platform_connections_delete ON public.platform_connections;
  DROP POLICY IF EXISTS "Allow all" ON public.platform_connections;
  DROP POLICY IF EXISTS "Enable all" ON public.platform_connections;

  IF has_org_col AND has_user_col THEN
    CREATE POLICY platform_connections_select ON public.platform_connections FOR SELECT TO authenticated
      USING (
        (organization_id IS NOT NULL AND public.is_team_member(organization_id))
        OR (organization_id IS NULL AND user_id::text = (SELECT auth.uid())::text)
      );
    CREATE POLICY platform_connections_insert ON public.platform_connections FOR INSERT TO authenticated
      WITH CHECK (
        (organization_id IS NOT NULL AND public.is_team_member(organization_id))
        OR (organization_id IS NULL AND user_id::text = (SELECT auth.uid())::text)
      );
    CREATE POLICY platform_connections_update ON public.platform_connections FOR UPDATE TO authenticated
      USING (
        (organization_id IS NOT NULL AND public.is_team_member(organization_id))
        OR (organization_id IS NULL AND user_id::text = (SELECT auth.uid())::text)
      )
      WITH CHECK (
        (organization_id IS NOT NULL AND public.is_team_member(organization_id))
        OR (organization_id IS NULL AND user_id::text = (SELECT auth.uid())::text)
      );
    CREATE POLICY platform_connections_delete ON public.platform_connections FOR DELETE TO authenticated
      USING (
        (organization_id IS NOT NULL AND public.is_team_member(organization_id))
        OR (organization_id IS NULL AND user_id::text = (SELECT auth.uid())::text)
      );
  ELSIF has_user_col THEN
    CREATE POLICY platform_connections_select ON public.platform_connections FOR SELECT TO authenticated
      USING (user_id::text = (SELECT auth.uid())::text);
    CREATE POLICY platform_connections_insert ON public.platform_connections FOR INSERT TO authenticated
      WITH CHECK (user_id::text = (SELECT auth.uid())::text);
    CREATE POLICY platform_connections_update ON public.platform_connections FOR UPDATE TO authenticated
      USING (user_id::text = (SELECT auth.uid())::text)
      WITH CHECK (user_id::text = (SELECT auth.uid())::text);
    CREATE POLICY platform_connections_delete ON public.platform_connections FOR DELETE TO authenticated
      USING (user_id::text = (SELECT auth.uid())::text);
  ELSE
    CREATE POLICY platform_connections_select ON public.platform_connections FOR SELECT TO authenticated USING (TRUE);
    CREATE POLICY platform_connections_insert ON public.platform_connections FOR INSERT TO authenticated WITH CHECK (TRUE);
    CREATE POLICY platform_connections_update ON public.platform_connections FOR UPDATE TO authenticated USING (TRUE);
    CREATE POLICY platform_connections_delete ON public.platform_connections FOR DELETE TO authenticated USING (TRUE);
  END IF;

END IF;
END;
$platform_connections$;

-- ============================================================================
-- 4. PLATFORM_POSTS — inherit through connection_id → platform_connections
-- ============================================================================
DO $platform_posts$
DECLARE
  has_connection_id boolean;
BEGIN
IF to_regclass('public.platform_posts') IS NOT NULL THEN

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'platform_posts' AND column_name = 'connection_id'
  ) INTO has_connection_id;

  ALTER TABLE public.platform_posts ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS platform_posts_select ON public.platform_posts;
  DROP POLICY IF EXISTS platform_posts_insert ON public.platform_posts;
  DROP POLICY IF EXISTS platform_posts_update ON public.platform_posts;
  DROP POLICY IF EXISTS platform_posts_delete ON public.platform_posts;
  DROP POLICY IF EXISTS "Allow all" ON public.platform_posts;
  DROP POLICY IF EXISTS "Enable all" ON public.platform_posts;

  IF has_connection_id THEN
    CREATE POLICY platform_posts_select ON public.platform_posts FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.platform_connections pc WHERE pc.id = connection_id
          AND pc.user_id::text = (SELECT auth.uid())::text
      ));
    CREATE POLICY platform_posts_insert ON public.platform_posts FOR INSERT TO authenticated
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.platform_connections pc WHERE pc.id = connection_id
          AND pc.user_id::text = (SELECT auth.uid())::text
      ));
    CREATE POLICY platform_posts_update ON public.platform_posts FOR UPDATE TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.platform_connections pc WHERE pc.id = connection_id
          AND pc.user_id::text = (SELECT auth.uid())::text
      ));
    CREATE POLICY platform_posts_delete ON public.platform_posts FOR DELETE TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.platform_connections pc WHERE pc.id = connection_id
          AND pc.user_id::text = (SELECT auth.uid())::text
      ));
  ELSE
    CREATE POLICY platform_posts_select ON public.platform_posts FOR SELECT TO authenticated USING (TRUE);
    CREATE POLICY platform_posts_insert ON public.platform_posts FOR INSERT TO authenticated WITH CHECK (TRUE);
    CREATE POLICY platform_posts_update ON public.platform_posts FOR UPDATE TO authenticated USING (TRUE);
    CREATE POLICY platform_posts_delete ON public.platform_posts FOR DELETE TO authenticated USING (TRUE);
  END IF;

END IF;
END;
$platform_posts$;

-- ============================================================================
-- 5. PLATFORM_METRICS — inherit through post_id → platform_posts → connections
-- ============================================================================
DO $platform_metrics$
DECLARE
  has_post_id boolean;
BEGIN
IF to_regclass('public.platform_metrics') IS NOT NULL THEN

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'platform_metrics' AND column_name = 'post_id'
  ) INTO has_post_id;

  ALTER TABLE public.platform_metrics ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS platform_metrics_select ON public.platform_metrics;
  DROP POLICY IF EXISTS platform_metrics_insert ON public.platform_metrics;
  DROP POLICY IF EXISTS "Allow all" ON public.platform_metrics;
  DROP POLICY IF EXISTS "Enable all" ON public.platform_metrics;

  IF has_post_id THEN
    CREATE POLICY platform_metrics_select ON public.platform_metrics FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.platform_posts pp
        JOIN public.platform_connections pc ON pc.id = pp.connection_id
        WHERE pp.id = post_id AND pc.user_id::text = (SELECT auth.uid())::text
      ));
    CREATE POLICY platform_metrics_insert ON public.platform_metrics FOR INSERT TO authenticated
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.platform_posts pp
        JOIN public.platform_connections pc ON pc.id = pp.connection_id
        WHERE pp.id = post_id AND pc.user_id::text = (SELECT auth.uid())::text
      ));
  ELSE
    CREATE POLICY platform_metrics_select ON public.platform_metrics FOR SELECT TO authenticated USING (TRUE);
    CREATE POLICY platform_metrics_insert ON public.platform_metrics FOR INSERT TO authenticated WITH CHECK (TRUE);
  END IF;

END IF;
END;
$platform_metrics$;

-- ============================================================================
-- 6. REPORTS — direct org scope via organization_id / user_id
-- ============================================================================
DO $reports$
DECLARE
  has_org_col  boolean;
  has_user_col boolean;
BEGIN
IF to_regclass('public.reports') IS NOT NULL THEN

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reports' AND column_name = 'organization_id'
  ) INTO has_org_col;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reports' AND column_name = 'user_id'
  ) INTO has_user_col;

  ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS reports_select ON public.reports;
  DROP POLICY IF EXISTS reports_insert ON public.reports;
  DROP POLICY IF EXISTS reports_update ON public.reports;
  DROP POLICY IF EXISTS reports_delete ON public.reports;
  DROP POLICY IF EXISTS "Allow all" ON public.reports;
  DROP POLICY IF EXISTS "Enable all" ON public.reports;

  IF has_org_col AND has_user_col THEN
    CREATE POLICY reports_select ON public.reports FOR SELECT TO authenticated
      USING (
        (organization_id IS NOT NULL AND public.is_team_member(organization_id))
        OR (organization_id IS NULL AND user_id::text = (SELECT auth.uid())::text)
      );
    CREATE POLICY reports_insert ON public.reports FOR INSERT TO authenticated
      WITH CHECK (
        (organization_id IS NOT NULL AND public.is_team_member(organization_id))
        OR (organization_id IS NULL AND user_id::text = (SELECT auth.uid())::text)
      );
    CREATE POLICY reports_update ON public.reports FOR UPDATE TO authenticated
      USING (
        (organization_id IS NOT NULL AND public.is_team_member(organization_id))
        OR (organization_id IS NULL AND user_id::text = (SELECT auth.uid())::text)
      )
      WITH CHECK (
        (organization_id IS NOT NULL AND public.is_team_member(organization_id))
        OR (organization_id IS NULL AND user_id::text = (SELECT auth.uid())::text)
      );
    CREATE POLICY reports_delete ON public.reports FOR DELETE TO authenticated
      USING (
        (organization_id IS NOT NULL AND public.is_team_member(organization_id))
        OR (organization_id IS NULL AND user_id::text = (SELECT auth.uid())::text)
      );
  ELSIF has_user_col THEN
    CREATE POLICY reports_select ON public.reports FOR SELECT TO authenticated
      USING (user_id::text = (SELECT auth.uid())::text);
    CREATE POLICY reports_insert ON public.reports FOR INSERT TO authenticated
      WITH CHECK (user_id::text = (SELECT auth.uid())::text);
    CREATE POLICY reports_update ON public.reports FOR UPDATE TO authenticated
      USING (user_id::text = (SELECT auth.uid())::text)
      WITH CHECK (user_id::text = (SELECT auth.uid())::text);
    CREATE POLICY reports_delete ON public.reports FOR DELETE TO authenticated
      USING (user_id::text = (SELECT auth.uid())::text);
  ELSE
    CREATE POLICY reports_select ON public.reports FOR SELECT TO authenticated USING (TRUE);
    CREATE POLICY reports_insert ON public.reports FOR INSERT TO authenticated WITH CHECK (TRUE);
    CREATE POLICY reports_update ON public.reports FOR UPDATE TO authenticated USING (TRUE);
    CREATE POLICY reports_delete ON public.reports FOR DELETE TO authenticated USING (TRUE);
  END IF;

END IF;
END;
$reports$;

-- ============================================================================
-- 7. SUBSCRIPTIONS — 1:1 with user (Stripe writes via service_role)
-- ============================================================================
DO $subscriptions$
DECLARE
  has_user_col boolean;
BEGIN
IF to_regclass('public.subscriptions') IS NOT NULL THEN

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'user_id'
  ) INTO has_user_col;

  ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS subscriptions_select ON public.subscriptions;
  DROP POLICY IF EXISTS subscriptions_insert ON public.subscriptions;
  DROP POLICY IF EXISTS subscriptions_update ON public.subscriptions;
  DROP POLICY IF EXISTS subscriptions_delete ON public.subscriptions;
  DROP POLICY IF EXISTS "Allow all" ON public.subscriptions;
  DROP POLICY IF EXISTS "Enable all" ON public.subscriptions;

  IF has_user_col THEN
    CREATE POLICY subscriptions_select ON public.subscriptions FOR SELECT TO authenticated
      USING (user_id::text = (SELECT auth.uid())::text);
    CREATE POLICY subscriptions_insert ON public.subscriptions FOR INSERT TO authenticated
      WITH CHECK (user_id::text = (SELECT auth.uid())::text);
    CREATE POLICY subscriptions_update ON public.subscriptions FOR UPDATE TO authenticated
      USING (user_id::text = (SELECT auth.uid())::text)
      WITH CHECK (user_id::text = (SELECT auth.uid())::text);
    CREATE POLICY subscriptions_delete ON public.subscriptions FOR DELETE TO authenticated
      USING (user_id::text = (SELECT auth.uid())::text);
  ELSE
    CREATE POLICY subscriptions_select ON public.subscriptions FOR SELECT TO authenticated USING (TRUE);
    CREATE POLICY subscriptions_insert ON public.subscriptions FOR INSERT TO authenticated WITH CHECK (TRUE);
    CREATE POLICY subscriptions_update ON public.subscriptions FOR UPDATE TO authenticated USING (TRUE);
    CREATE POLICY subscriptions_delete ON public.subscriptions FOR DELETE TO authenticated USING (TRUE);
  END IF;

END IF;
END;
$subscriptions$;

COMMIT;
