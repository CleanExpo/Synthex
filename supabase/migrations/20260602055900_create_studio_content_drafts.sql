-- ============================================================================
-- Migration: create Client Content Studio drafts table
-- Purpose:   Restore the Prisma-backed studio_content_drafts table creation to
--            repo migrations so Supabase Preview can rebuild from source.
-- Scope:     Schema-only, idempotent. RLS policies are added by 20260602060000.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.studio_content_drafts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  client_slug TEXT NOT NULL,
  topic TEXT NOT NULL,
  script TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'awaiting_approval',
  video_provider TEXT NOT NULL DEFAULT 'heygen',
  video_id TEXT,
  video_url TEXT,
  platforms JSONB NOT NULL DEFAULT '[]'::jsonb,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS studio_content_drafts_org_client_status_idx
  ON public.studio_content_drafts(organization_id, client_slug, status);

CREATE INDEX IF NOT EXISTS studio_content_drafts_org_status_idx
  ON public.studio_content_drafts(organization_id, status);

DROP TRIGGER IF EXISTS studio_content_drafts_touch_updated_at ON public.studio_content_drafts;
CREATE TRIGGER studio_content_drafts_touch_updated_at
BEFORE UPDATE ON public.studio_content_drafts
FOR EACH ROW
EXECUTE FUNCTION public.synthex_touch_updated_at();

COMMIT;
