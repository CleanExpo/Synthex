-- =============================================================================
-- Brand isolation for brand_video_jobs (Brand Video Studio surface). #595.
-- Founder-gated, out-of-band via Supabase apply_migration (NEVER prisma db
-- push). Lives under supabase/migrations/ (NOT prisma/migrations/) so it does
-- NOT auto-apply on Vercel deploy. brand_video_jobs is a raw Supabase table
-- (not in prisma/schema.prisma), so this column is invisible to the drift
-- checker.
--
-- WHY: brand_video_jobs (created in 20260627000000) is scoped by created_by
-- (user) ONLY. A multi-business owner who switches their active brand would see
-- and queue jobs against the same user across ALL their brands — no brand
-- isolation. This is the ADDITIVE, backward-compatible first step: a nullable
-- organization_id column + composite index. Existing rows keep organization_id
-- = NULL (legacy) and stay visible via the created_by path, so nothing breaks.
--
-- Org-scope is enforced primarily at the QUERY layer (the API routes filter by
-- getEffectiveOrganizationId(userId) — the ACTIVE brand, not the home org), and
-- defended in depth by the org-aware RLS SELECT policy below, exactly as
-- studio_content_drafts does. Scalar column, NO DB FK to organizations
-- (organizations.id TEXT/UUID mismatch hazard) — org-scope at the query layer.
-- =============================================================================

BEGIN;

-- Step 1: nullable organization_id (TEXT to match users.organization_id /
-- organizations.id text ids; no FK constraint by design).
ALTER TABLE public.brand_video_jobs
  ADD COLUMN IF NOT EXISTS organization_id TEXT;

-- Step 2: composite index for the brand-scoped read path
-- (queries filter by created_by AND organization_id).
CREATE INDEX IF NOT EXISTS idx_brand_video_jobs_created_by_org
  ON public.brand_video_jobs (created_by, organization_id);

-- Step 3: BACKFILL from the owning user's HOME org (public.users.organization_id),
-- the same value getEffectiveOrganizationId() falls back to for non-multi-business
-- users. Each job has exactly one owning created_by; rows whose owner has no home
-- org stay NULL (legacy) and remain visible via the created_by path — zero data
-- loss. Idempotent: only fills rows still NULL.
--
-- TYPE NOTE: brand_video_jobs.created_by is UUID; public.users.id is TEXT.
-- Cast the UUID side to text (lossless) so the join is type-safe — `uuid = text`
-- has no operator and would otherwise break the shadow-DB replay (Supabase
-- Preview), the same hazard fixed in 20260615120100.
UPDATE public.brand_video_jobs j
   SET organization_id = u.organization_id
  FROM public.users u
 WHERE j.created_by::text = u.id
   AND j.organization_id IS NULL
   AND u.organization_id IS NOT NULL;

-- Step 4: make the authenticated SELECT policy org-aware (defense in depth;
-- the API routes run as service_role and enforce org-scope at the query layer).
-- Keep created_by ownership AND require org-tenancy via is_team_member, while
-- tolerating legacy NULL-org rows so nothing disappears. Mirrors the
-- studio_content_drafts is_team_member() convention. service_role + insert
-- policies from 20260627000000 are unchanged.
DROP POLICY IF EXISTS "users_select_own_brand_video_jobs" ON public.brand_video_jobs;
CREATE POLICY "users_select_own_brand_video_jobs"
  ON public.brand_video_jobs
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    AND (organization_id IS NULL OR public.is_team_member(organization_id))
  );

COMMIT;

-- =============================================================================
-- ROLLBACK (additive-only):
--   DROP INDEX IF EXISTS public.idx_brand_video_jobs_created_by_org;
--   ALTER TABLE public.brand_video_jobs DROP COLUMN IF EXISTS organization_id;
--   -- and restore the prior user-only SELECT policy:
--   DROP POLICY IF EXISTS "users_select_own_brand_video_jobs" ON public.brand_video_jobs;
--   CREATE POLICY "users_select_own_brand_video_jobs" ON public.brand_video_jobs
--     FOR SELECT TO authenticated USING (created_by = auth.uid());
-- =============================================================================
