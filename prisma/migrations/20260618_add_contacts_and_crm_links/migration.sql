-- Migration: Add contacts table + CRM client-link columns (backlog #3 — Unify CRM).
-- Source of truth: prisma/schema.prisma model Contact + the client_id/crm_client_id
-- columns added to DealDeliverable, ClientHealthScore, ClientEngagementEvent, Lead (#532).
--
-- Additive only — one new table + four nullable columns (each indexed). No drops,
-- no type changes, fully backward-compatible. `client_id` / `crm_client_id` are
-- SOFT references to the Supabase `clients` table (no DB FK by design).
--
-- Apply with:
--   npx prisma db execute \
--     --file prisma/migrations/20260618_add_contacts_and_crm_links/migration.sql \
--     --url "$DIRECT_URL"

-- ── 1. contacts ──────────────────────────────────────────────────────────────
-- One row per CRM contact (a person at a client). org-scoped; client_id is a soft
-- ref to the Supabase clients table.
CREATE TABLE IF NOT EXISTS public.contacts (
  id              TEXT        PRIMARY KEY,
  organization_id TEXT        NOT NULL,
  client_id       TEXT,
  name            TEXT        NOT NULL,
  email           TEXT,
  role            TEXT,
  phone           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contacts_org_idx    ON public.contacts (organization_id);
CREATE INDEX IF NOT EXISTS contacts_client_idx ON public.contacts (client_id);

-- ── 2. CRM client-link columns (additive, nullable) ─────────────────────────
ALTER TABLE public.deal_deliverables       ADD COLUMN IF NOT EXISTS client_id     TEXT;
ALTER TABLE public.client_health_scores    ADD COLUMN IF NOT EXISTS client_id     TEXT;
ALTER TABLE public.client_engagement_events ADD COLUMN IF NOT EXISTS crm_client_id TEXT;
ALTER TABLE public.leads                   ADD COLUMN IF NOT EXISTS client_id     TEXT;

CREATE INDEX IF NOT EXISTS deal_deliverables_client_idx
  ON public.deal_deliverables (client_id);
CREATE INDEX IF NOT EXISTS client_health_scores_client_idx
  ON public.client_health_scores (client_id);
CREATE INDEX IF NOT EXISTS client_engagement_events_crm_client_idx
  ON public.client_engagement_events (crm_client_id);
CREATE INDEX IF NOT EXISTS leads_client_idx
  ON public.leads (client_id);

-- ── RLS (new table only) ─────────────────────────────────────────────────────
-- Service role bypasses RLS. Authenticated users see/write only rows for orgs
-- they belong to — gated on contacts.organization_id via business_ownerships
-- (idiom copied from 20260616_add_creator_ugc). The four ALTERed tables already
-- carry their own RLS from earlier migrations; adding a nullable column does not
-- change their policies.
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contacts_org_member" ON public.contacts;
CREATE POLICY "contacts_org_member" ON public.contacts
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.business_ownerships
       WHERE owner_id = auth.uid()::text AND is_active = true
    )
  ) WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.business_ownerships
       WHERE owner_id = auth.uid()::text AND is_active = true
    )
  );

-- ── Updated_at trigger (reuse existing helper from earlier migration) ────────
DROP TRIGGER IF EXISTS contacts_set_updated_at ON public.contacts;
CREATE TRIGGER contacts_set_updated_at BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();

-- ── Verification ───────────────────────────────────────────────────────────
-- After applying, all should return true:
--   SELECT
--     EXISTS (SELECT 1 FROM information_schema.tables
--              WHERE table_schema='public' AND table_name='contacts') AS contacts,
--     EXISTS (SELECT 1 FROM information_schema.columns
--              WHERE table_name='leads' AND column_name='client_id') AS leads_client,
--     EXISTS (SELECT 1 FROM information_schema.columns
--              WHERE table_name='client_engagement_events' AND column_name='crm_client_id') AS cee_crm;
