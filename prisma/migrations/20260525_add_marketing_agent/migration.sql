-- Migration: Marketing Agency — Agentic Loop (MVP).
--
-- Adds two organization-scoped tables that power the per-Organization
-- MarketingAgent feature. Agents read the existing
-- marketing_agency_opportunities ledger, LLM-propose claims, and write
-- a MarketingAgencyQaReport per run. They do NOT bypass any gate.
--
-- See app/dashboard/marketing-agency/AGENT_SPEC.md for the full design.
--
-- Apply with:
--   npx prisma db execute \
--     --file prisma/migrations/20260525_add_marketing_agent/migration.sql \
--     --url "$DIRECT_URL"
--
-- Then regenerate the client:
--   npx prisma generate

CREATE TABLE IF NOT EXISTS public.marketing_agents (
  id                  TEXT        PRIMARY KEY,
  organization_id     TEXT        NOT NULL,
  created_by_id       TEXT        NOT NULL,
  name                TEXT        NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'active',
  goal                TEXT        NOT NULL,
  max_claims_per_run  INTEGER     NOT NULL DEFAULT 5,
  cadence             TEXT        NOT NULL DEFAULT 'manual',
  config              JSONB,
  last_run_at         TIMESTAMPTZ,
  next_run_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT marketing_agents_organization_id_fkey FOREIGN KEY (organization_id)
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT marketing_agents_created_by_id_fkey FOREIGN KEY (created_by_id)
    REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS marketing_agents_organization_id_status_idx
  ON public.marketing_agents (organization_id, status);
CREATE INDEX IF NOT EXISTS marketing_agents_created_by_id_idx
  ON public.marketing_agents (created_by_id);

CREATE TABLE IF NOT EXISTS public.marketing_agent_runs (
  id                       TEXT        PRIMARY KEY,
  agent_id                 TEXT        NOT NULL,
  organization_id          TEXT        NOT NULL,
  triggered_by_id          TEXT        NOT NULL,
  status                   TEXT        NOT NULL DEFAULT 'running',
  started_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at             TIMESTAMPTZ,
  opportunities_considered INTEGER     NOT NULL DEFAULT 0,
  claims_proposed          INTEGER     NOT NULL DEFAULT 0,
  evidence_gaps_flagged    INTEGER     NOT NULL DEFAULT 0,
  qa_report_id             TEXT,
  summary                  TEXT,
  artifacts                JSONB       NOT NULL DEFAULT '{}'::jsonb,
  error_message            TEXT,
  CONSTRAINT marketing_agent_runs_agent_id_fkey FOREIGN KEY (agent_id)
    REFERENCES public.marketing_agents(id) ON DELETE CASCADE,
  CONSTRAINT marketing_agent_runs_organization_id_fkey FOREIGN KEY (organization_id)
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT marketing_agent_runs_triggered_by_id_fkey FOREIGN KEY (triggered_by_id)
    REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT marketing_agent_runs_qa_report_id_fkey FOREIGN KEY (qa_report_id)
    REFERENCES public.marketing_agency_qa_reports(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS marketing_agent_runs_agent_id_started_at_idx
  ON public.marketing_agent_runs (agent_id, started_at DESC);
CREATE INDEX IF NOT EXISTS marketing_agent_runs_organization_id_status_idx
  ON public.marketing_agent_runs (organization_id, status);
CREATE INDEX IF NOT EXISTS marketing_agent_runs_triggered_by_id_idx
  ON public.marketing_agent_runs (triggered_by_id);

ALTER TABLE public.marketing_agents     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_agent_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketing_agents_org_isolation" ON public.marketing_agents;
CREATE POLICY "marketing_agents_org_isolation" ON public.marketing_agents
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

DROP POLICY IF EXISTS "marketing_agent_runs_org_isolation" ON public.marketing_agent_runs;
CREATE POLICY "marketing_agent_runs_org_isolation" ON public.marketing_agent_runs
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
