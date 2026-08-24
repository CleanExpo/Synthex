-- Migration: M12 Slice 3 governed signal persistence (SYN-968).
--
-- Adds durable ontology storage for Marketing Agency intelligence:
-- source-derived signals, promoted opportunities, and outcome-learning events.
-- All tables are additive, organization-scoped, RLS-protected, and preserve the
-- service-layer approval/risk/evidence state from lib/marketing-agency/intelligence.
--
-- Apply with:
--   npx prisma db execute \
--     --file prisma/migrations/20260522_add_marketing_agency_signal_persistence/migration.sql \
--     --url "$DIRECT_URL"
--
-- Then regenerate the client:
--   npx prisma generate

CREATE TABLE IF NOT EXISTS public.marketing_agency_campaigns (
  id              TEXT        PRIMARY KEY,
  organization_id TEXT        NOT NULL,
  created_by_id   TEXT        NOT NULL,
  name            TEXT        NOT NULL,
  slug            TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'draft',
  provider_mode   TEXT        NOT NULL DEFAULT 'mock',
  product_name    TEXT        NOT NULL,
  primary_offer   TEXT        NOT NULL,
  board_memo      JSONB,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT marketing_agency_campaigns_organization_id_fkey FOREIGN KEY (organization_id)
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT marketing_agency_campaigns_created_by_id_fkey FOREIGN KEY (created_by_id)
    REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT marketing_agency_campaigns_org_slug_unique UNIQUE (organization_id, slug)
);

CREATE INDEX IF NOT EXISTS marketing_agency_campaigns_org_status_idx
  ON public.marketing_agency_campaigns (organization_id, status);
CREATE INDEX IF NOT EXISTS marketing_agency_campaigns_created_by_idx
  ON public.marketing_agency_campaigns (created_by_id);
CREATE INDEX IF NOT EXISTS marketing_agency_campaigns_created_at_idx
  ON public.marketing_agency_campaigns (created_at DESC);

CREATE TABLE IF NOT EXISTS public.marketing_agency_signals (
  id                  TEXT        PRIMARY KEY,
  organization_id     TEXT        NOT NULL,
  campaign_id         TEXT,
  external_id         TEXT        NOT NULL,
  source_id           TEXT        NOT NULL,
  source_kind         TEXT        NOT NULL,
  source_label        TEXT        NOT NULL,
  source_url          TEXT,
  source_path         TEXT,
  permission_context  TEXT        NOT NULL,
  captured_at         TIMESTAMPTZ NOT NULL,
  business            TEXT        NOT NULL,
  client              TEXT        NOT NULL,
  product             TEXT        NOT NULL,
  audience_segment    TEXT        NOT NULL,
  narrative           TEXT        NOT NULL,
  content             TEXT        NOT NULL,
  freshness           DOUBLE PRECISION NOT NULL,
  confidence          DOUBLE PRECISION NOT NULL,
  commercial_impact   DOUBLE PRECISION NOT NULL,
  creative_potential  DOUBLE PRECISION NOT NULL,
  risk                DOUBLE PRECISION NOT NULL,
  score_total         DOUBLE PRECISION NOT NULL DEFAULT 0,
  status              TEXT        NOT NULL DEFAULT 'captured',
  risk_state          TEXT        NOT NULL DEFAULT 'blocked',
  risk_reasons        JSONB       NOT NULL DEFAULT '[]'::jsonb,
  approval_status     TEXT        NOT NULL DEFAULT 'blocked',
  blocked_reasons     JSONB       NOT NULL DEFAULT '[]'::jsonb,
  warnings            JSONB       NOT NULL DEFAULT '[]'::jsonb,
  evidence_refs       JSONB       NOT NULL DEFAULT '[]'::jsonb,
  raw_signal          JSONB       NOT NULL,
  metadata            JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT marketing_agency_signals_organization_id_fkey FOREIGN KEY (organization_id)
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT marketing_agency_signals_campaign_id_fkey FOREIGN KEY (campaign_id)
    REFERENCES public.marketing_agency_campaigns(id) ON DELETE SET NULL,
  CONSTRAINT marketing_agency_signals_id_org_unique UNIQUE (id, organization_id),
  CONSTRAINT marketing_agency_signals_org_external_unique UNIQUE (organization_id, external_id)
);

CREATE INDEX IF NOT EXISTS marketing_agency_signals_org_status_idx
  ON public.marketing_agency_signals (organization_id, status);
CREATE INDEX IF NOT EXISTS marketing_agency_signals_org_approval_idx
  ON public.marketing_agency_signals (organization_id, approval_status);
CREATE INDEX IF NOT EXISTS marketing_agency_signals_org_risk_idx
  ON public.marketing_agency_signals (organization_id, risk_state);
CREATE INDEX IF NOT EXISTS marketing_agency_signals_org_captured_idx
  ON public.marketing_agency_signals (organization_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS marketing_agency_signals_campaign_idx
  ON public.marketing_agency_signals (campaign_id);

CREATE TABLE IF NOT EXISTS public.marketing_agency_opportunities (
  id                 TEXT        PRIMARY KEY,
  organization_id    TEXT        NOT NULL,
  campaign_id        TEXT,
  signal_id          TEXT        NOT NULL,
  external_id        TEXT        NOT NULL,
  title              TEXT        NOT NULL,
  recommendation     TEXT        NOT NULL,
  score              INTEGER     NOT NULL,
  confidence         DOUBLE PRECISION NOT NULL,
  risk               DOUBLE PRECISION NOT NULL,
  status             TEXT        NOT NULL DEFAULT 'draft',
  approval_status    TEXT        NOT NULL DEFAULT 'blocked',
  blocked_reasons    JSONB       NOT NULL DEFAULT '[]'::jsonb,
  warnings           JSONB       NOT NULL DEFAULT '[]'::jsonb,
  evidence_refs      JSONB       NOT NULL DEFAULT '[]'::jsonb,
  next_action        TEXT        NOT NULL,
  outcome_metric     TEXT        NOT NULL,
  raw_opportunity    JSONB       NOT NULL,
  metadata           JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT marketing_agency_opportunities_organization_id_fkey FOREIGN KEY (organization_id)
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT marketing_agency_opportunities_campaign_id_fkey FOREIGN KEY (campaign_id)
    REFERENCES public.marketing_agency_campaigns(id) ON DELETE SET NULL,
  CONSTRAINT marketing_agency_opportunities_signal_org_fkey FOREIGN KEY (signal_id, organization_id)
    REFERENCES public.marketing_agency_signals(id, organization_id) ON DELETE CASCADE,
  CONSTRAINT marketing_agency_opportunities_id_org_unique UNIQUE (id, organization_id),
  CONSTRAINT marketing_agency_opportunities_org_external_unique UNIQUE (organization_id, external_id)
);

CREATE INDEX IF NOT EXISTS marketing_agency_opportunities_org_status_idx
  ON public.marketing_agency_opportunities (organization_id, status);
CREATE INDEX IF NOT EXISTS marketing_agency_opportunities_org_approval_idx
  ON public.marketing_agency_opportunities (organization_id, approval_status);
CREATE INDEX IF NOT EXISTS marketing_agency_opportunities_signal_idx
  ON public.marketing_agency_opportunities (signal_id);
CREATE INDEX IF NOT EXISTS marketing_agency_opportunities_campaign_idx
  ON public.marketing_agency_opportunities (campaign_id);

CREATE TABLE IF NOT EXISTS public.marketing_agency_outcome_events (
  id              TEXT        PRIMARY KEY,
  organization_id TEXT        NOT NULL,
  campaign_id     TEXT,
  signal_id       TEXT        NOT NULL,
  opportunity_id  TEXT,
  event_type      TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'observed',
  outcome_metric  TEXT,
  observed_value  TEXT,
  confidence      DOUBLE PRECISION,
  notes           TEXT,
  metadata        JSONB,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT marketing_agency_outcome_events_organization_id_fkey FOREIGN KEY (organization_id)
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT marketing_agency_outcome_events_campaign_id_fkey FOREIGN KEY (campaign_id)
    REFERENCES public.marketing_agency_campaigns(id) ON DELETE SET NULL,
  CONSTRAINT marketing_agency_outcome_events_signal_org_fkey FOREIGN KEY (signal_id, organization_id)
    REFERENCES public.marketing_agency_signals(id, organization_id) ON DELETE CASCADE,
  CONSTRAINT marketing_agency_outcome_events_opportunity_org_fkey FOREIGN KEY (opportunity_id, organization_id)
    REFERENCES public.marketing_agency_opportunities(id, organization_id) ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS marketing_agency_outcome_events_org_type_idx
  ON public.marketing_agency_outcome_events (organization_id, event_type);
CREATE INDEX IF NOT EXISTS marketing_agency_outcome_events_org_recorded_idx
  ON public.marketing_agency_outcome_events (organization_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS marketing_agency_outcome_events_signal_idx
  ON public.marketing_agency_outcome_events (signal_id);
CREATE INDEX IF NOT EXISTS marketing_agency_outcome_events_opportunity_idx
  ON public.marketing_agency_outcome_events (opportunity_id);
CREATE INDEX IF NOT EXISTS marketing_agency_outcome_events_campaign_idx
  ON public.marketing_agency_outcome_events (campaign_id);

ALTER TABLE public.marketing_agency_campaigns      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_agency_signals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_agency_opportunities  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_agency_outcome_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketing_agency_campaigns_org_isolation" ON public.marketing_agency_campaigns;
CREATE POLICY "marketing_agency_campaigns_org_isolation" ON public.marketing_agency_campaigns
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
  );

DROP POLICY IF EXISTS "marketing_agency_signals_org_isolation" ON public.marketing_agency_signals;
CREATE POLICY "marketing_agency_signals_org_isolation" ON public.marketing_agency_signals
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
  );

DROP POLICY IF EXISTS "marketing_agency_opportunities_org_isolation" ON public.marketing_agency_opportunities;
CREATE POLICY "marketing_agency_opportunities_org_isolation" ON public.marketing_agency_opportunities
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
  );

DROP POLICY IF EXISTS "marketing_agency_outcome_events_org_isolation" ON public.marketing_agency_outcome_events;
CREATE POLICY "marketing_agency_outcome_events_org_isolation" ON public.marketing_agency_outcome_events
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
  );

DROP TRIGGER IF EXISTS marketing_agency_campaigns_set_updated_at ON public.marketing_agency_campaigns;
DROP TRIGGER IF EXISTS marketing_agency_signals_set_updated_at ON public.marketing_agency_signals;
DROP TRIGGER IF EXISTS marketing_agency_opportunities_set_updated_at ON public.marketing_agency_opportunities;

CREATE TRIGGER marketing_agency_campaigns_set_updated_at BEFORE UPDATE ON public.marketing_agency_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();
CREATE TRIGGER marketing_agency_signals_set_updated_at BEFORE UPDATE ON public.marketing_agency_signals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();
CREATE TRIGGER marketing_agency_opportunities_set_updated_at BEFORE UPDATE ON public.marketing_agency_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();
