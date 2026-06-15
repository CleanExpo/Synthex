-- Migration: 20260615_ppc_ad_accounts
-- Purpose: Add PPC/Paid Ads read-only snapshot store (Gap 1 — agency readiness)
-- Tables: ad_accounts, ad_performance_snapshots

CREATE TABLE IF NOT EXISTS public.ad_accounts (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id  TEXT NOT NULL,
  user_id          TEXT NOT NULL,
  platform         TEXT NOT NULL,
  external_id      TEXT NOT NULL,
  name             TEXT NOT NULL,
  currency_code    TEXT NOT NULL DEFAULT 'AUD',
  time_zone        TEXT NOT NULL DEFAULT 'Australia/Sydney',
  access_token     TEXT NOT NULL,
  refresh_token    TEXT,
  token_expires_at TIMESTAMPTZ,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ad_accounts_platform_external_org_unique UNIQUE (platform, external_id, organization_id)
);

CREATE INDEX IF NOT EXISTS ad_accounts_org_platform_idx ON public.ad_accounts (organization_id, platform);
CREATE INDEX IF NOT EXISTS ad_accounts_user_id_idx ON public.ad_accounts (user_id);

CREATE TABLE IF NOT EXISTS public.ad_performance_snapshots (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  ad_account_id  TEXT NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  date_start     DATE NOT NULL,
  date_end       DATE NOT NULL,
  impressions    INTEGER,
  clicks         INTEGER,
  spend          DECIMAL(12, 2),
  conversions    DECIMAL(10, 4),
  revenue        DECIMAL(12, 2),
  roas           DECIMAL(8, 4),
  ctr            DECIMAL(8, 6),
  cpc            DECIMAL(10, 4),
  cpm            DECIMAL(10, 4),
  cpa            DECIMAL(10, 4),
  campaign_id    TEXT,
  campaign_name  TEXT,
  raw_payload    JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ad_perf_snapshots_account_date_campaign_unique
    UNIQUE (ad_account_id, date_start, date_end, campaign_id)
);

CREATE INDEX IF NOT EXISTS ad_perf_snapshots_account_date_idx
  ON public.ad_performance_snapshots (ad_account_id, date_start, date_end);

-- RLS
ALTER TABLE public.ad_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_performance_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ad_accounts_select ON public.ad_accounts;
DROP POLICY IF EXISTS ad_accounts_insert ON public.ad_accounts;
DROP POLICY IF EXISTS ad_accounts_update ON public.ad_accounts;
DROP POLICY IF EXISTS ad_accounts_delete ON public.ad_accounts;

CREATE POLICY ad_accounts_select ON public.ad_accounts FOR SELECT TO authenticated
  USING (
    (organization_id IS NOT NULL AND public.is_team_member(organization_id))
    OR (organization_id IS NULL AND user_id::text = (SELECT auth.uid())::text)
  );
CREATE POLICY ad_accounts_insert ON public.ad_accounts FOR INSERT TO authenticated
  WITH CHECK (
    (organization_id IS NOT NULL AND public.is_team_member(organization_id))
    OR (organization_id IS NULL AND user_id::text = (SELECT auth.uid())::text)
  );
CREATE POLICY ad_accounts_update ON public.ad_accounts FOR UPDATE TO authenticated
  USING (
    (organization_id IS NOT NULL AND public.is_team_member(organization_id))
    OR (organization_id IS NULL AND user_id::text = (SELECT auth.uid())::text)
  )
  WITH CHECK (
    (organization_id IS NOT NULL AND public.is_team_member(organization_id))
    OR (organization_id IS NULL AND user_id::text = (SELECT auth.uid())::text)
  );
CREATE POLICY ad_accounts_delete ON public.ad_accounts FOR DELETE TO authenticated
  USING (
    (organization_id IS NOT NULL AND public.is_team_member(organization_id))
    OR (organization_id IS NULL AND user_id::text = (SELECT auth.uid())::text)
  );

DROP POLICY IF EXISTS ad_perf_snapshots_select ON public.ad_performance_snapshots;
DROP POLICY IF EXISTS ad_perf_snapshots_insert ON public.ad_performance_snapshots;

CREATE POLICY ad_perf_snapshots_select ON public.ad_performance_snapshots FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ad_accounts a WHERE a.id = ad_account_id
      AND (
        (a.organization_id IS NOT NULL AND public.is_team_member(a.organization_id))
        OR (a.organization_id IS NULL AND a.user_id::text = (SELECT auth.uid())::text)
      )
  ));
CREATE POLICY ad_perf_snapshots_insert ON public.ad_performance_snapshots FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ad_accounts a WHERE a.id = ad_account_id
      AND (
        (a.organization_id IS NOT NULL AND public.is_team_member(a.organization_id))
        OR (a.organization_id IS NULL AND a.user_id::text = (SELECT auth.uid())::text)
      )
  ));
