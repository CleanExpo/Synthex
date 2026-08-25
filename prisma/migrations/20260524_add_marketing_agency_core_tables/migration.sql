-- Migration: Marketing Agency — core gate tables (PREREQUISITE for 20260525).
--
-- The Prisma schema (prisma/schema.prisma) defines 9 MarketingAgency* models,
-- but only 4 of them (campaigns, signals, opportunities, outcome_events) have
-- ever had a CREATE TABLE in any migration file. The other 5 (source_refs,
-- claims, assets, qa_reports, export_packages) were declared in schema.prisma
-- but never migrated. That was a latent gap on main — discovered when applying
-- 20260525_add_marketing_agent failed on prod with:
--   ERROR: 42P01: relation "public.marketing_agency_qa_reports" does not exist
-- because the agent migration's FK to marketing_agency_qa_reports could not
-- resolve.
--
-- This migration creates the 5 missing tables to match the existing Prisma
-- schema so prisma generate / runtime code that references them works, and
-- so the 20260525 agent migration's FK can resolve.
--
-- All 5 tables are organization-scoped, RLS-protected with the same
-- business_ownerships/team_members isolation pattern used by the
-- already-migrated MA tables (20260522).
--
-- Apply with:
--   npx prisma db execute \
--     --file prisma/migrations/20260524_add_marketing_agency_core_tables/migration.sql \
--     --url "$DIRECT_URL"
-- or
--   supabase db query --linked -f prisma/migrations/20260524_add_marketing_agency_core_tables/migration.sql

-- ============================================================
-- marketing_agency_source_refs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.marketing_agency_source_refs (
  id                  TEXT        PRIMARY KEY,
  organization_id     TEXT        NOT NULL,
  created_by_id       TEXT        NOT NULL,
  campaign_id         TEXT        NOT NULL,
  label               TEXT        NOT NULL,
  url                 TEXT,
  path                TEXT,
  source_type         TEXT        NOT NULL DEFAULT 'document',
  required_for_claims BOOLEAN     NOT NULL DEFAULT FALSE,
  metadata            JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT marketing_agency_source_refs_organization_id_fkey FOREIGN KEY (organization_id)
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT marketing_agency_source_refs_created_by_id_fkey FOREIGN KEY (created_by_id)
    REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT marketing_agency_source_refs_campaign_id_fkey FOREIGN KEY (campaign_id)
    REFERENCES public.marketing_agency_campaigns(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS marketing_agency_source_refs_org_campaign_idx
  ON public.marketing_agency_source_refs (organization_id, campaign_id);
CREATE INDEX IF NOT EXISTS marketing_agency_source_refs_created_by_id_idx
  ON public.marketing_agency_source_refs (created_by_id);

-- ============================================================
-- marketing_agency_claims
-- ============================================================
CREATE TABLE IF NOT EXISTS public.marketing_agency_claims (
  id                  TEXT        PRIMARY KEY,
  organization_id     TEXT        NOT NULL,
  created_by_id       TEXT        NOT NULL,
  campaign_id         TEXT        NOT NULL,
  source_ref_id       TEXT,
  statement           TEXT        NOT NULL,
  claim_type          TEXT        NOT NULL,
  evidence_status     TEXT        NOT NULL DEFAULT 'blocked',
  evidence_notes      TEXT,
  metadata            JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT marketing_agency_claims_organization_id_fkey FOREIGN KEY (organization_id)
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT marketing_agency_claims_created_by_id_fkey FOREIGN KEY (created_by_id)
    REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT marketing_agency_claims_campaign_id_fkey FOREIGN KEY (campaign_id)
    REFERENCES public.marketing_agency_campaigns(id) ON DELETE CASCADE,
  CONSTRAINT marketing_agency_claims_source_ref_id_fkey FOREIGN KEY (source_ref_id)
    REFERENCES public.marketing_agency_source_refs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS marketing_agency_claims_org_campaign_idx
  ON public.marketing_agency_claims (organization_id, campaign_id);
CREATE INDEX IF NOT EXISTS marketing_agency_claims_source_ref_id_idx
  ON public.marketing_agency_claims (source_ref_id);
CREATE INDEX IF NOT EXISTS marketing_agency_claims_created_by_id_idx
  ON public.marketing_agency_claims (created_by_id);

-- ============================================================
-- marketing_agency_assets
-- ============================================================
CREATE TABLE IF NOT EXISTS public.marketing_agency_assets (
  id                  TEXT        PRIMARY KEY,
  organization_id     TEXT        NOT NULL,
  created_by_id       TEXT        NOT NULL,
  campaign_id         TEXT        NOT NULL,
  provider            TEXT        NOT NULL,
  provider_asset_id   TEXT,
  asset_type          TEXT        NOT NULL,
  title               TEXT        NOT NULL,
  licence_status      TEXT        NOT NULL DEFAULT 'pending',
  licence_url         TEXT,
  metadata            JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT marketing_agency_assets_organization_id_fkey FOREIGN KEY (organization_id)
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT marketing_agency_assets_created_by_id_fkey FOREIGN KEY (created_by_id)
    REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT marketing_agency_assets_campaign_id_fkey FOREIGN KEY (campaign_id)
    REFERENCES public.marketing_agency_campaigns(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS marketing_agency_assets_org_campaign_idx
  ON public.marketing_agency_assets (organization_id, campaign_id);
CREATE INDEX IF NOT EXISTS marketing_agency_assets_provider_asset_idx
  ON public.marketing_agency_assets (provider, provider_asset_id);
CREATE INDEX IF NOT EXISTS marketing_agency_assets_created_by_id_idx
  ON public.marketing_agency_assets (created_by_id);

-- ============================================================
-- marketing_agency_qa_reports
-- ============================================================
CREATE TABLE IF NOT EXISTS public.marketing_agency_qa_reports (
  id                  TEXT        PRIMARY KEY,
  organization_id     TEXT        NOT NULL,
  created_by_id       TEXT        NOT NULL,
  campaign_id         TEXT        NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'blocked',
  blocked_reasons     JSONB       NOT NULL DEFAULT '[]'::jsonb,
  warnings            JSONB       NOT NULL DEFAULT '[]'::jsonb,
  checks              JSONB       NOT NULL DEFAULT '[]'::jsonb,
  metadata            JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT marketing_agency_qa_reports_organization_id_fkey FOREIGN KEY (organization_id)
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT marketing_agency_qa_reports_created_by_id_fkey FOREIGN KEY (created_by_id)
    REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT marketing_agency_qa_reports_campaign_id_fkey FOREIGN KEY (campaign_id)
    REFERENCES public.marketing_agency_campaigns(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS marketing_agency_qa_reports_org_campaign_idx
  ON public.marketing_agency_qa_reports (organization_id, campaign_id);
CREATE INDEX IF NOT EXISTS marketing_agency_qa_reports_status_idx
  ON public.marketing_agency_qa_reports (status);
CREATE INDEX IF NOT EXISTS marketing_agency_qa_reports_created_by_id_idx
  ON public.marketing_agency_qa_reports (created_by_id);

-- ============================================================
-- marketing_agency_export_packages
-- ============================================================
CREATE TABLE IF NOT EXISTS public.marketing_agency_export_packages (
  id                  TEXT        PRIMARY KEY,
  organization_id     TEXT        NOT NULL,
  created_by_id       TEXT        NOT NULL,
  campaign_id         TEXT        NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'blocked',
  formats             TEXT[]      NOT NULL DEFAULT ARRAY[]::TEXT[],
  artifact_manifest   JSONB       NOT NULL,
  handoff_notes       TEXT,
  metadata            JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT marketing_agency_export_packages_organization_id_fkey FOREIGN KEY (organization_id)
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT marketing_agency_export_packages_created_by_id_fkey FOREIGN KEY (created_by_id)
    REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT marketing_agency_export_packages_campaign_id_fkey FOREIGN KEY (campaign_id)
    REFERENCES public.marketing_agency_campaigns(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS marketing_agency_export_packages_org_campaign_idx
  ON public.marketing_agency_export_packages (organization_id, campaign_id);
CREATE INDEX IF NOT EXISTS marketing_agency_export_packages_status_idx
  ON public.marketing_agency_export_packages (status);
CREATE INDEX IF NOT EXISTS marketing_agency_export_packages_created_by_id_idx
  ON public.marketing_agency_export_packages (created_by_id);

-- ============================================================
-- Row-Level Security policies — mirrors 20260522 pattern
-- ============================================================
ALTER TABLE public.marketing_agency_source_refs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_agency_claims          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_agency_assets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_agency_qa_reports      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_agency_export_packages ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'marketing_agency_source_refs',
      'marketing_agency_claims',
      'marketing_agency_assets',
      'marketing_agency_qa_reports',
      'marketing_agency_export_packages'
    ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
      t || '_org_isolation', t);
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
        FOR ALL USING (
          organization_id IN (
            SELECT organization_id FROM public.business_ownerships
             WHERE owner_id = auth.uid()::text AND is_active = true
            UNION
            SELECT organization_id FROM public.team_members
             WHERE user_id = auth.uid()::text AND accepted_at IS NOT NULL
          )
        ) WITH CHECK (
          organization_id IN (
            SELECT organization_id FROM public.business_ownerships
             WHERE owner_id = auth.uid()::text AND is_active = true
            UNION
            SELECT organization_id FROM public.team_members
             WHERE user_id = auth.uid()::text AND accepted_at IS NOT NULL
          )
        )
    $f$, t || '_org_isolation', t);
  END LOOP;
END $$;
