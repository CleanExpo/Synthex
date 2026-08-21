-- Migration: HERMES H-1 init — proactive intelligence layer schema
-- Linear: SYN-909 (HER-1a)
--
-- HERMES is a separate proactive layer ABOVE Synthex. It does not publish.
-- It writes pending_approval drafts to the existing Calendar (posts table)
-- with source='hermes'. Human approves on Calendar before anything ships.
--
-- This migration is purely additive:
--   1. posts: add nullable `source` column + composite index for HERMES metrics
--   2. Four new tables — hermes_config, hermes_discovery_signal,
--      hermes_gap_candidate, hermes_proposal — all RLS-scoped to organization_id
--      via business_ownerships membership (matches existing Synthex pattern,
--      e.g. content_calendars / publish_queue / vault_secrets).
--
-- No drops. No type changes. No renames. Backwards-compatible — existing posts
-- carry source=NULL (= 'human').
--
-- Apply with:
--   npx prisma db execute \
--     --file prisma/migrations/20260506_hermes_h1_init/migration.sql \
--     --url "$DIRECT_URL"
--
-- Then regenerate the client:
--   npx prisma generate

-- ============================================================================
-- 1. posts: add source column + composite index for HERMES success metric
-- ============================================================================

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS source TEXT;

-- Hot path for the HERMES weekly digest (HER-1e):
--   SELECT count(*) FROM posts WHERE source='hermes' AND status='published'
CREATE INDEX IF NOT EXISTS posts_source_status_idx
  ON public.posts (source, status);

-- ============================================================================
-- 2. hermes_config — per-org HERMES configuration
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.hermes_config (
  id              TEXT        PRIMARY KEY,
  organization_id TEXT        NOT NULL UNIQUE,
  enabled         BOOLEAN     NOT NULL DEFAULT false,
  brand_slug      TEXT        NOT NULL,
  daily_quota     INTEGER     NOT NULL DEFAULT 5,
  voice_floor     INTEGER     NOT NULL DEFAULT 70,
  last_run_at     TIMESTAMPTZ,
  next_run_at     TIMESTAMPTZ,
  -- H-1 use: stores traffic baseline for >30% drop detection.
  -- Shape: { trafficBaseline: { date: string, value: number }[] }
  -- MUST be manually seeded before first discovery sweep — see lib/hermes/discovery/README.md.
  metadata        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hermes_config_organization_id_fkey FOREIGN KEY (organization_id)
    REFERENCES public.organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS hermes_config_organization_id_idx
  ON public.hermes_config (organization_id);

-- ============================================================================
-- 3. hermes_discovery_signal — raw signals captured by the discovery sweep
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.hermes_discovery_signal (
  id              TEXT        PRIMARY KEY,
  organization_id TEXT        NOT NULL,
  signal_type     TEXT        NOT NULL, -- 'traffic_drop' | 'competitor' | 'regulatory' | 'gap'
  source          TEXT        NOT NULL,
  payload         JSONB       NOT NULL,
  severity        TEXT        NOT NULL DEFAULT 'routine', -- 'routine' | 'urgent'
  processed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hermes_discovery_signal_organization_id_fkey FOREIGN KEY (organization_id)
    REFERENCES public.organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS hermes_discovery_signal_org_created_idx
  ON public.hermes_discovery_signal (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS hermes_discovery_signal_org_type_idx
  ON public.hermes_discovery_signal (organization_id, signal_type);

-- ============================================================================
-- 4. hermes_gap_candidate — content gaps identified by the gap engine
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.hermes_gap_candidate (
  id              TEXT        PRIMARY KEY,
  organization_id TEXT        NOT NULL,
  topic           TEXT        NOT NULL,
  rationale       TEXT        NOT NULL,
  -- Denormalised FKs into hermes_discovery_signal.id (one signal can seed many gaps).
  signal_ids      TEXT[]      NOT NULL DEFAULT '{}',
  priority        INTEGER     NOT NULL DEFAULT 0,
  status          TEXT        NOT NULL DEFAULT 'open', -- 'open' | 'drafted' | 'rejected'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hermes_gap_candidate_organization_id_fkey FOREIGN KEY (organization_id)
    REFERENCES public.organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS hermes_gap_candidate_org_status_priority_idx
  ON public.hermes_gap_candidate (organization_id, status, priority DESC);

-- ============================================================================
-- 5. hermes_proposal — drafts generated for gap candidates
-- ============================================================================
-- metadata JSON keys (NOT separate columns):
--   readabilityWarning: boolean — true when FK grade is in warn band (6–8)
--   readabilityGrade:   number  — actual FK grade score
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.hermes_proposal (
  id                   TEXT        PRIMARY KEY,
  organization_id      TEXT        NOT NULL,
  gap_candidate_id     TEXT,
  post_id              TEXT        UNIQUE,
  content              TEXT        NOT NULL,
  voice_score          INTEGER,
  voice_gate_decision  TEXT,                                -- 'pass' | 'warn' | 'fail'
  voice_failed_rules   TEXT[]      NOT NULL DEFAULT '{}',
  metadata             JSONB       NOT NULL DEFAULT '{}'::jsonb,
  status               TEXT        NOT NULL DEFAULT 'pending', -- 'pending' | 'queued' | 'rejected'
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hermes_proposal_organization_id_fkey FOREIGN KEY (organization_id)
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT hermes_proposal_gap_candidate_id_fkey FOREIGN KEY (gap_candidate_id)
    REFERENCES public.hermes_gap_candidate(id) ON DELETE SET NULL,
  CONSTRAINT hermes_proposal_post_id_fkey FOREIGN KEY (post_id)
    REFERENCES public.posts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS hermes_proposal_org_status_created_idx
  ON public.hermes_proposal (organization_id, status, created_at DESC);

-- ============================================================================
-- 6. Row-Level Security
-- ============================================================================
-- Pattern matches existing Synthex tables (e.g. content_calendars, publish_queue,
-- vault_secrets): authenticated users see rows for orgs they own via
-- business_ownerships. Service role bypasses RLS implicitly (Supabase platform).
-- ============================================================================

ALTER TABLE public.hermes_config            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hermes_discovery_signal  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hermes_gap_candidate     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hermes_proposal          ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hermes_config_org_isolation"           ON public.hermes_config;
DROP POLICY IF EXISTS "hermes_discovery_signal_org_isolation" ON public.hermes_discovery_signal;
DROP POLICY IF EXISTS "hermes_gap_candidate_org_isolation"    ON public.hermes_gap_candidate;
DROP POLICY IF EXISTS "hermes_proposal_org_isolation"         ON public.hermes_proposal;

CREATE POLICY "hermes_config_org_isolation" ON public.hermes_config
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

CREATE POLICY "hermes_discovery_signal_org_isolation" ON public.hermes_discovery_signal
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

CREATE POLICY "hermes_gap_candidate_org_isolation" ON public.hermes_gap_candidate
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

CREATE POLICY "hermes_proposal_org_isolation" ON public.hermes_proposal
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

-- ============================================================================
-- 7. Verification queries (run after migration)
-- ============================================================================
--
--   -- 1. New columns present on posts:
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='posts' AND column_name='source';
--
--   -- 2. All four HERMES tables exist:
--   SELECT table_name FROM information_schema.tables
--    WHERE table_schema='public' AND table_name LIKE 'hermes_%';
--
--   -- 3. RLS enabled on all four:
--   SELECT tablename, rowsecurity FROM pg_tables
--    WHERE schemaname='public' AND tablename LIKE 'hermes_%';
--
--   -- 4. Policies attached:
--   SELECT polname, tablename FROM pg_policies
--    WHERE schemaname='public' AND tablename LIKE 'hermes_%';
