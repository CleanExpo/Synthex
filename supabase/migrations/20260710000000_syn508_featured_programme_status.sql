-- =============================================================================
-- Migration: 20260710000000_syn508_featured_programme_status
-- Source:    "Featured in Synthex" case-study video programme (SYN-508)
-- Purpose:
--   Add the `featured_programme_status` column to `public.clients` so a client
--   can opt in to the programme from their dashboard and the pipeline can track
--   the video lifecycle.
--     'not_applied'   — default; client has not opted in
--     'applied'       — client opted in (PATCH /api/clients/featured-opt-in)
--     'in_production'  — video script/render underway
--     'published'      — video live; Authority Hub featured badge shows
--
--   CREATE-ONLY: not applied to any live database by this change. Apply is
--   owner-gated (Synthex prod migrations are a manual founder's gate).
--
--   Defensive DO/EXCEPTION block mirrors the repo's Preview-safe pattern: on a
--   Preview branch where `public.clients` does not yet exist this is a no-op
--   rather than a hard failure. Idempotent via ADD COLUMN IF NOT EXISTS.
-- Date: 2026-07-10
-- =============================================================================

BEGIN;

DO $$
BEGIN
  ALTER TABLE public.clients
    ADD COLUMN IF NOT EXISTS featured_programme_status TEXT
      NOT NULL DEFAULT 'not_applied';
EXCEPTION
  WHEN undefined_table THEN NULL; -- Preview branch: clients not bootstrapped yet
END $$;

-- Constrain to the four valid states. Wrapped so a re-run (constraint already
-- present) or a missing table is a no-op rather than an error.
DO $$
BEGIN
  ALTER TABLE public.clients
    ADD CONSTRAINT clients_featured_programme_status_check
      CHECK (
        featured_programme_status IN (
          'not_applied', 'applied', 'in_production', 'published'
        )
      );
EXCEPTION
  WHEN duplicate_object THEN NULL; -- constraint already exists
  WHEN undefined_table THEN NULL;  -- Preview branch: table not present
  WHEN undefined_column THEN NULL; -- column add was skipped (missing table)
END $$;

-- Partial index: production queries filter on the small set of opted-in rows.
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_clients_featured_programme_status
    ON public.clients (featured_programme_status)
    WHERE featured_programme_status <> 'not_applied';
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

COMMIT;
