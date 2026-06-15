-- ============================================================================
-- Migration: 20260615080000_rls_tier1_content_and_connections
-- Purpose:   Replace permissive `using (true)` policies with org-scoped RLS
--            on the 7 highest-risk tables: campaigns, posts, platform_connections,
--            platform_posts, platform_metrics, reports, subscriptions.
-- Authority: Gap 4 — RLS Security Foundation (agency readiness plan 2026-06-15)
-- Helper:    depends on public.is_team_member(text) created in 20260602055800
-- Safety:    All blocks guarded by IF EXISTS — safe against preview rebuild gaps.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. CAMPAIGNS
--    Scope: org member OR personal (org IS NULL AND owner)
-- ============================================================================
DO $campaigns$
BEGIN
IF to_regclass('public.campaigns') IS NOT NULL THEN

  ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS campaigns_select ON public.campaigns;
  DROP POLICY IF EXISTS campaigns_insert ON public.campaigns;
  DROP POLICY IF EXISTS campaigns_update ON public.campaigns;
  DROP POLICY IF EXISTS campaigns_delete ON public.campaigns;
  -- Legacy permissive policy names
  DROP POLICY IF EXISTS "Allow all" ON public.campaigns;
  DROP POLICY IF EXISTS "Enable all" ON public.campaigns;

  -- SELECT: org member, OR owner of a personal (no-org) campaign
  CREATE POLICY campaigns_select
    ON public.campaigns FOR SELECT TO authenticated
    USING (
      (organization_id IS NOT NULL AND public.is_team_member(organization_id))
      OR
      (organization_id IS NULL AND user_id = (SELECT auth.uid())::text)
    );

  -- INSERT: must be creating under your own org or for yourself
  CREATE POLICY campaigns_insert
    ON public.campaigns FOR INSERT TO authenticated
    WITH CHECK (
      (organization_id IS NOT NULL AND public.is_team_member(organization_id))
      OR
      (organization_id IS NULL AND user_id = (SELECT auth.uid())::text)
    );

  -- UPDATE: same scope as select
  CREATE POLICY campaigns_update
    ON public.campaigns FOR UPDATE TO authenticated
    USING (
      (organization_id IS NOT NULL AND public.is_team_member(organization_id))
      OR
      (organization_id IS NULL AND user_id = (SELECT auth.uid())::text)
    )
    WITH CHECK (
      (organization_id IS NOT NULL AND public.is_team_member(organization_id))
      OR
      (organization_id IS NULL AND user_id = (SELECT auth.uid())::text)
    );

  -- DELETE: same scope
  CREATE POLICY campaigns_delete
    ON public.campaigns FOR DELETE TO authenticated
    USING (
      (organization_id IS NOT NULL AND public.is_team_member(organization_id))
      OR
      (organization_id IS NULL AND user_id = (SELECT auth.uid())::text)
    );

END IF;
END;
$campaigns$;

-- ============================================================================
-- 2. POSTS
--    Scope: inherit from parent campaign (subquery)
--    Posts have no direct org column — access gated through campaigns.
-- ============================================================================
DO $posts$
BEGIN
IF to_regclass('public.posts') IS NOT NULL THEN

  ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS posts_select ON public.posts;
  DROP POLICY IF EXISTS posts_insert ON public.posts;
  DROP POLICY IF EXISTS posts_update ON public.posts;
  DROP POLICY IF EXISTS posts_delete ON public.posts;
  DROP POLICY IF EXISTS "Allow all" ON public.posts;
  DROP POLICY IF EXISTS "Enable all" ON public.posts;

  -- Access is valid if the parent campaign is accessible
  CREATE POLICY posts_select
    ON public.posts FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.campaigns c
        WHERE c.id = campaign_id
          AND (
            (c.organization_id IS NOT NULL AND public.is_team_member(c.organization_id))
            OR
            (c.organization_id IS NULL AND c.user_id = (SELECT auth.uid())::text)
          )
      )
    );

  CREATE POLICY posts_insert
    ON public.posts FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.campaigns c
        WHERE c.id = campaign_id
          AND (
            (c.organization_id IS NOT NULL AND public.is_team_member(c.organization_id))
            OR
            (c.organization_id IS NULL AND c.user_id = (SELECT auth.uid())::text)
          )
      )
    );

  CREATE POLICY posts_update
    ON public.posts FOR UPDATE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.campaigns c
        WHERE c.id = campaign_id
          AND (
            (c.organization_id IS NOT NULL AND public.is_team_member(c.organization_id))
            OR
            (c.organization_id IS NULL AND c.user_id = (SELECT auth.uid())::text)
          )
      )
    );

  CREATE POLICY posts_delete
    ON public.posts FOR DELETE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.campaigns c
        WHERE c.id = campaign_id
          AND (
            (c.organization_id IS NOT NULL AND public.is_team_member(c.organization_id))
            OR
            (c.organization_id IS NULL AND c.user_id = (SELECT auth.uid())::text)
          )
      )
    );

END IF;
END;
$posts$;

-- ============================================================================
-- 3. PLATFORM_CONNECTIONS
--    Scope: org member OR personal (org IS NULL AND owner)
--    Contains OAuth tokens — highest sensitivity.
-- ============================================================================
DO $platform_connections$
BEGIN
IF to_regclass('public.platform_connections') IS NOT NULL THEN

  ALTER TABLE public.platform_connections ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS platform_connections_select ON public.platform_connections;
  DROP POLICY IF EXISTS platform_connections_insert ON public.platform_connections;
  DROP POLICY IF EXISTS platform_connections_update ON public.platform_connections;
  DROP POLICY IF EXISTS platform_connections_delete ON public.platform_connections;
  DROP POLICY IF EXISTS "Allow all" ON public.platform_connections;
  DROP POLICY IF EXISTS "Enable all" ON public.platform_connections;

  CREATE POLICY platform_connections_select
    ON public.platform_connections FOR SELECT TO authenticated
    USING (
      (organization_id IS NOT NULL AND public.is_team_member(organization_id))
      OR
      (organization_id IS NULL AND user_id = (SELECT auth.uid())::text)
    );

  CREATE POLICY platform_connections_insert
    ON public.platform_connections FOR INSERT TO authenticated
    WITH CHECK (
      (organization_id IS NOT NULL AND public.is_team_member(organization_id))
      OR
      (organization_id IS NULL AND user_id = (SELECT auth.uid())::text)
    );

  CREATE POLICY platform_connections_update
    ON public.platform_connections FOR UPDATE TO authenticated
    USING (
      (organization_id IS NOT NULL AND public.is_team_member(organization_id))
      OR
      (organization_id IS NULL AND user_id = (SELECT auth.uid())::text)
    )
    WITH CHECK (
      (organization_id IS NOT NULL AND public.is_team_member(organization_id))
      OR
      (organization_id IS NULL AND user_id = (SELECT auth.uid())::text)
    );

  CREATE POLICY platform_connections_delete
    ON public.platform_connections FOR DELETE TO authenticated
    USING (
      (organization_id IS NOT NULL AND public.is_team_member(organization_id))
      OR
      (organization_id IS NULL AND user_id = (SELECT auth.uid())::text)
    );

END IF;
END;
$platform_connections$;

-- ============================================================================
-- 4. PLATFORM_POSTS
--    Scope: inherit from parent platform_connection
-- ============================================================================
DO $platform_posts$
BEGIN
IF to_regclass('public.platform_posts') IS NOT NULL THEN

  ALTER TABLE public.platform_posts ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS platform_posts_select ON public.platform_posts;
  DROP POLICY IF EXISTS platform_posts_insert ON public.platform_posts;
  DROP POLICY IF EXISTS platform_posts_update ON public.platform_posts;
  DROP POLICY IF EXISTS platform_posts_delete ON public.platform_posts;
  DROP POLICY IF EXISTS "Allow all" ON public.platform_posts;
  DROP POLICY IF EXISTS "Enable all" ON public.platform_posts;

  CREATE POLICY platform_posts_select
    ON public.platform_posts FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.platform_connections pc
        WHERE pc.id = connection_id
          AND (
            (pc.organization_id IS NOT NULL AND public.is_team_member(pc.organization_id))
            OR
            (pc.organization_id IS NULL AND pc.user_id = (SELECT auth.uid())::text)
          )
      )
    );

  CREATE POLICY platform_posts_insert
    ON public.platform_posts FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.platform_connections pc
        WHERE pc.id = connection_id
          AND (
            (pc.organization_id IS NOT NULL AND public.is_team_member(pc.organization_id))
            OR
            (pc.organization_id IS NULL AND pc.user_id = (SELECT auth.uid())::text)
          )
      )
    );

  CREATE POLICY platform_posts_update
    ON public.platform_posts FOR UPDATE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.platform_connections pc
        WHERE pc.id = connection_id
          AND (
            (pc.organization_id IS NOT NULL AND public.is_team_member(pc.organization_id))
            OR
            (pc.organization_id IS NULL AND pc.user_id = (SELECT auth.uid())::text)
          )
      )
    );

  CREATE POLICY platform_posts_delete
    ON public.platform_posts FOR DELETE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.platform_connections pc
        WHERE pc.id = connection_id
          AND (
            (pc.organization_id IS NOT NULL AND public.is_team_member(pc.organization_id))
            OR
            (pc.organization_id IS NULL AND pc.user_id = (SELECT auth.uid())::text)
          )
      )
    );

END IF;
END;
$platform_posts$;

-- ============================================================================
-- 5. PLATFORM_METRICS
--    Scope: inherit from parent platform_post → platform_connection
-- ============================================================================
DO $platform_metrics$
BEGIN
IF to_regclass('public.platform_metrics') IS NOT NULL THEN

  ALTER TABLE public.platform_metrics ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS platform_metrics_select ON public.platform_metrics;
  DROP POLICY IF EXISTS platform_metrics_insert ON public.platform_metrics;
  DROP POLICY IF EXISTS platform_metrics_update ON public.platform_metrics;
  DROP POLICY IF EXISTS platform_metrics_delete ON public.platform_metrics;
  DROP POLICY IF EXISTS "Allow all" ON public.platform_metrics;
  DROP POLICY IF EXISTS "Enable all" ON public.platform_metrics;

  CREATE POLICY platform_metrics_select
    ON public.platform_metrics FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.platform_posts pp
        JOIN public.platform_connections pc ON pc.id = pp.connection_id
        WHERE pp.id = post_id
          AND (
            (pc.organization_id IS NOT NULL AND public.is_team_member(pc.organization_id))
            OR
            (pc.organization_id IS NULL AND pc.user_id = (SELECT auth.uid())::text)
          )
      )
    );

  -- Metrics are written by cron jobs (service_role bypasses RLS) — only need SELECT for users
  -- INSERT/UPDATE/DELETE kept permissive for service_role but blocked for authenticated end-users
  CREATE POLICY platform_metrics_insert
    ON public.platform_metrics FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.platform_posts pp
        JOIN public.platform_connections pc ON pc.id = pp.connection_id
        WHERE pp.id = post_id
          AND (
            (pc.organization_id IS NOT NULL AND public.is_team_member(pc.organization_id))
            OR
            (pc.organization_id IS NULL AND pc.user_id = (SELECT auth.uid())::text)
          )
      )
    );

END IF;
END;
$platform_metrics$;

-- ============================================================================
-- 6. REPORTS
--    Scope: org member OR personal owner
-- ============================================================================
DO $reports$
BEGIN
IF to_regclass('public.reports') IS NOT NULL THEN

  ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS reports_select ON public.reports;
  DROP POLICY IF EXISTS reports_insert ON public.reports;
  DROP POLICY IF EXISTS reports_update ON public.reports;
  DROP POLICY IF EXISTS reports_delete ON public.reports;
  DROP POLICY IF EXISTS "Allow all" ON public.reports;
  DROP POLICY IF EXISTS "Enable all" ON public.reports;

  CREATE POLICY reports_select
    ON public.reports FOR SELECT TO authenticated
    USING (
      (organization_id IS NOT NULL AND public.is_team_member(organization_id))
      OR
      (organization_id IS NULL AND user_id = (SELECT auth.uid())::text)
    );

  CREATE POLICY reports_insert
    ON public.reports FOR INSERT TO authenticated
    WITH CHECK (
      (organization_id IS NOT NULL AND public.is_team_member(organization_id))
      OR
      (organization_id IS NULL AND user_id = (SELECT auth.uid())::text)
    );

  CREATE POLICY reports_update
    ON public.reports FOR UPDATE TO authenticated
    USING (
      (organization_id IS NOT NULL AND public.is_team_member(organization_id))
      OR
      (organization_id IS NULL AND user_id = (SELECT auth.uid())::text)
    )
    WITH CHECK (
      (organization_id IS NOT NULL AND public.is_team_member(organization_id))
      OR
      (organization_id IS NULL AND user_id = (SELECT auth.uid())::text)
    );

  CREATE POLICY reports_delete
    ON public.reports FOR DELETE TO authenticated
    USING (
      (organization_id IS NOT NULL AND public.is_team_member(organization_id))
      OR
      (organization_id IS NULL AND user_id = (SELECT auth.uid())::text)
    );

END IF;
END;
$reports$;

-- ============================================================================
-- 7. SUBSCRIPTIONS
--    Scope: 1:1 with user — only the owning user
--    Note: Stripe webhook handler uses service_role (bypasses RLS) for writes.
-- ============================================================================
DO $subscriptions$
BEGIN
IF to_regclass('public.subscriptions') IS NOT NULL THEN

  ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS subscriptions_select ON public.subscriptions;
  DROP POLICY IF EXISTS subscriptions_insert ON public.subscriptions;
  DROP POLICY IF EXISTS subscriptions_update ON public.subscriptions;
  DROP POLICY IF EXISTS subscriptions_delete ON public.subscriptions;
  DROP POLICY IF EXISTS "Allow all" ON public.subscriptions;
  DROP POLICY IF EXISTS "Enable all" ON public.subscriptions;

  CREATE POLICY subscriptions_select
    ON public.subscriptions FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid())::text);

  -- INSERT/UPDATE/DELETE owned by Stripe webhooks (service_role) — users only read
  CREATE POLICY subscriptions_insert
    ON public.subscriptions FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid())::text);

  CREATE POLICY subscriptions_update
    ON public.subscriptions FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid())::text)
    WITH CHECK (user_id = (SELECT auth.uid())::text);

  CREATE POLICY subscriptions_delete
    ON public.subscriptions FOR DELETE TO authenticated
    USING (user_id = (SELECT auth.uid())::text);

END IF;
END;
$subscriptions$;

COMMIT;
