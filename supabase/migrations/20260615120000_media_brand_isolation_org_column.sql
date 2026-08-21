-- =============================================================================
-- DRAFT — Brand isolation for MEDIA surface (media_assets + media_folders)
-- Flagged in #433. NOT YET APPLIED. Founder-gated, out-of-band via Supabase
-- apply_migration (NEVER prisma db push). This file lives under
-- supabase/migrations/ (NOT prisma/migrations/) so it does NOT auto-apply on
-- Vercel deploy.
--
-- WHY: media_assets and media_folders are raw Supabase tables (not in
-- prisma/schema.prisma) scoped by user_id ONLY (lib/services/media-library.ts).
-- A multi-business owner who switches their active brand sees the SAME user's
-- assets across ALL their brands — no brand isolation. This migration is the
-- ADDITIVE, backward-compatible first step: a nullable organization_id column
-- + index on each table. Existing rows keep organization_id = NULL (legacy),
-- which the app-code carve-out preserves so nothing disappears.
--
-- ROLLOUT ORDER: (1) THIS migration adds nullable column + index → (2) backfill
-- → (3) app-code carve-out → (4) LATER optional NOT NULL (separate, gated).
--
-- Scalar column, NO DB FK to organizations: organizations.id has a TEXT/UUID
-- mismatch hazard (per .claude/rules/database/supabase-migrations.md). Org-scope
-- is enforced at the query layer, exactly as StudioContentDraft does.
-- =============================================================================

-- Step 1: add nullable organization_id (TEXT to match users.organization_id /
-- organizations.id text ids; no FK constraint by design).
ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS organization_id TEXT;

ALTER TABLE public.media_folders
  ADD COLUMN IF NOT EXISTS organization_id TEXT;

-- Step 2: indexes for the brand-scoped read path
-- (queries filter by user_id AND organization_id; composite mirrors that).
CREATE INDEX IF NOT EXISTS idx_media_assets_user_org
  ON public.media_assets (user_id, organization_id);

CREATE INDEX IF NOT EXISTS idx_media_folders_user_org
  ON public.media_folders (user_id, organization_id);

-- =============================================================================
-- Step 3: BACKFILL (run AFTER the column is confirmed present; reviewed
-- separately). Populates organization_id from the owning user's HOME org
-- (public.users.organization_id) — the same value getEffectiveOrganizationId()
-- falls back to for non-multi-business users.
--
-- SAFETY / MULTI-ORG AMBIGUITY: a user may be a TeamMember of multiple orgs,
-- but each media row has exactly ONE owning user_id. We deterministically assign
-- the owner's HOME org. Rows whose owner has no home org (users.organization_id
-- IS NULL) stay NULL and remain visible via the app carve-out — zero data loss.
-- Only fills rows that are still NULL (idempotent, re-runnable).
-- =============================================================================
UPDATE public.media_assets a
   SET organization_id = u.organization_id
  FROM public.users u
 WHERE a.user_id = u.id
   AND a.organization_id IS NULL
   AND u.organization_id IS NOT NULL;

UPDATE public.media_folders f
   SET organization_id = u.organization_id
  FROM public.users u
 WHERE f.user_id = u.id
   AND f.organization_id IS NULL
   AND u.organization_id IS NOT NULL;

-- =============================================================================
-- ROLLBACK (additive-only, so rollback is safe to drop the new column + index):
--   DROP INDEX IF EXISTS public.idx_media_assets_user_org;
--   DROP INDEX IF EXISTS public.idx_media_folders_user_org;
--   ALTER TABLE public.media_assets  DROP COLUMN IF EXISTS organization_id;
--   ALTER TABLE public.media_folders DROP COLUMN IF EXISTS organization_id;
-- (Rollback discards backfilled values; app-code carve-out tolerates the column
--  being absent only BEFORE the app-code lane ships — sequence accordingly.)
-- =============================================================================
