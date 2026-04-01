-- =============================================================================
-- Migration: Create recommended_actions table
-- Source: SYN-593 — AI Marketing Advisor backend
-- Purpose:
--   Weekly AI-generated action brief per organisation.
--   3 ranked, data-specific actions with dollar attribution,
--   competitor micro-insight, and GEO teaser.
--   7-day quality gate: status=generated → manual review → delivered.
-- Date: 2026-04-01
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Table
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.recommended_actions (
  id                      TEXT        NOT NULL PRIMARY KEY,
  organization_id         TEXT        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  week_start              DATE        NOT NULL,
  actions                 JSONB       NOT NULL,
  dollar_attribution      TEXT        NOT NULL,
  job_count_attribution   INTEGER     NOT NULL DEFAULT 0,
  competitor_micro_insight TEXT,
  geo_teaser_text         TEXT,
  results_summary         JSONB       NOT NULL,
  status                  TEXT        NOT NULL DEFAULT 'generated',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at            TIMESTAMPTZ,
  read_at                 TIMESTAMPTZ,

  CONSTRAINT recommended_actions_status_check
    CHECK (status IN ('generated', 'delivered', 'read', 'archived')),

  CONSTRAINT recommended_action_org_week
    UNIQUE (organization_id, week_start)
);

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS recommended_actions_org_created_idx
  ON public.recommended_actions (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS recommended_actions_status_idx
  ON public.recommended_actions (status);

-- -----------------------------------------------------------------------------
-- Row-Level Security
-- -----------------------------------------------------------------------------

ALTER TABLE public.recommended_actions ENABLE ROW LEVEL SECURITY;

-- Service role: full access (Prisma backend)
DO $$ BEGIN
  CREATE POLICY "service_role_recommended_actions"
    ON public.recommended_actions
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Authenticated users: read own org's actions only
DO $$ BEGIN
  CREATE POLICY "users_select_own_org_recommended_actions"
    ON public.recommended_actions
    FOR SELECT TO authenticated
    USING (
      organization_id IN (
        SELECT organization_id FROM public.users WHERE id = auth.uid()::text
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
