-- =============================================================================
-- Migration: Create brand_video_jobs table
-- Source: Brand Video Studio feature
-- Purpose:
--   Queue table backing the dashboard "Brand Video Studio" surface.
--   Each row is one styled faceless-video render request (brand + style + topic).
--   A worker (scripts/brand-video-worker.ts) claims queued jobs and runs the
--   ElevenLabs -> per-beat image -> ffmpeg pipeline, then sets status + output_url.
-- Status lifecycle: queued -> rendering -> done | needs_local_render | failed
-- Date: 2026-06-27
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Table
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.brand_video_jobs (
  id          UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  brand       TEXT        NOT NULL,
  style       TEXT        NOT NULL DEFAULT 'flat-line',
  topic       TEXT        NOT NULL,
  count       INTEGER     NOT NULL DEFAULT 1,
  status      TEXT        NOT NULL DEFAULT 'queued',
  output_url  TEXT,
  error       TEXT,
  created_by  UUID        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT brand_video_jobs_status_check
    CHECK (status IN ('queued', 'rendering', 'done', 'needs_local_render', 'failed')),

  CONSTRAINT brand_video_jobs_count_check
    CHECK (count >= 1 AND count <= 10)
);

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS brand_video_jobs_created_by_created_idx
  ON public.brand_video_jobs (created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS brand_video_jobs_status_idx
  ON public.brand_video_jobs (status);

-- -----------------------------------------------------------------------------
-- Row-Level Security (mirrors recommended_actions convention:
--   service_role full access for the Prisma/worker backend, authenticated users
--   scoped to their own rows via auth.uid())
-- -----------------------------------------------------------------------------

ALTER TABLE public.brand_video_jobs ENABLE ROW LEVEL SECURITY;

-- Service role: full access (API route + worker run as service role)
DO $$ BEGIN
  CREATE POLICY "service_role_brand_video_jobs"
    ON public.brand_video_jobs
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Authenticated users: read own jobs only
DO $$ BEGIN
  CREATE POLICY "users_select_own_brand_video_jobs"
    ON public.brand_video_jobs
    FOR SELECT TO authenticated
    USING (created_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Authenticated users: create own jobs only
DO $$ BEGIN
  CREATE POLICY "users_insert_own_brand_video_jobs"
    ON public.brand_video_jobs
    FOR INSERT TO authenticated
    WITH CHECK (created_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
