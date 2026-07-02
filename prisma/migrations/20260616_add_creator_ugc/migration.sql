-- Migration: Add creators + ugc_submissions (backlog #6 — Influencer / UGC mgmt).
-- Source of truth: prisma/schema.prisma models Creator and UgcSubmission.
--
-- Additive only — two new tables. creators is the parent (FK from
-- ugc_submissions.creator_id → creators.id, ON DELETE SET NULL so a deleted
-- creator leaves its UGC intake intact). Both tables carry organization_id and
-- are RLS-gated directly on that column via business_ownerships.
--
-- Apply with:
--   npx prisma db execute \
--     --file prisma/migrations/20260616_add_creator_ugc/migration.sql \
--     --url "$DIRECT_URL"

-- ── 1. creators ─────────────────────────────────────────────────────────────
-- One row per creator an organisation is tracking for outreach.
-- status flow: prospect → contacted → active | declined.
CREATE TABLE IF NOT EXISTS public.creators (
  id              TEXT        PRIMARY KEY,
  organization_id TEXT        NOT NULL,
  name            TEXT        NOT NULL,
  handle          TEXT,
  platform        TEXT,
  email           TEXT,
  follower_count  INTEGER,
  status          TEXT        NOT NULL DEFAULT 'prospect',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS creators_org_status_idx
  ON public.creators (organization_id, status);

-- ── 2. ugc_submissions ──────────────────────────────────────────────────────
-- One row per UGC asset awaiting moderation. creator_id is nullable (anonymous
-- intake allowed); an approved row is the intended feed into the content pipeline.
-- status flow: pending → approved | rejected.
CREATE TABLE IF NOT EXISTS public.ugc_submissions (
  id              TEXT        PRIMARY KEY,
  organization_id TEXT        NOT NULL,
  creator_id      TEXT,
  asset_url       TEXT,
  caption         TEXT,
  status          TEXT        NOT NULL DEFAULT 'pending',
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ugc_submissions_creator_id_fkey FOREIGN KEY (creator_id)
    REFERENCES public.creators(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ugc_submissions_org_status_idx
  ON public.ugc_submissions (organization_id, status);
CREATE INDEX IF NOT EXISTS ugc_submissions_creator_idx
  ON public.ugc_submissions (creator_id);

-- ── RLS ────────────────────────────────────────────────────────────────────
-- Service role bypasses RLS. Authenticated users see/write only rows for orgs
-- they belong to — gated directly on each table's own organization_id via
-- business_ownerships (idiom copied from 20260503_add_content_calendars_and_publish_queue).
ALTER TABLE public.creators        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ugc_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "creators_org_member" ON public.creators;
CREATE POLICY "creators_org_member" ON public.creators
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

DROP POLICY IF EXISTS "ugc_submissions_org_member" ON public.ugc_submissions;
CREATE POLICY "ugc_submissions_org_member" ON public.ugc_submissions
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
-- ugc_submissions has no updated_at column, so only creators gets the trigger.
DROP TRIGGER IF EXISTS creators_set_updated_at ON public.creators;
CREATE TRIGGER creators_set_updated_at BEFORE UPDATE ON public.creators
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();

-- ── Verification ───────────────────────────────────────────────────────────
-- After applying, both should return true:
--   SELECT
--     EXISTS (SELECT 1 FROM information_schema.tables
--              WHERE table_schema='public' AND table_name='creators') AS creators,
--     EXISTS (SELECT 1 FROM information_schema.tables
--              WHERE table_schema='public' AND table_name='ugc_submissions') AS ugc;
