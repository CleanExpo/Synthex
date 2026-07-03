-- =============================================================================
-- Migration: 20260704000000_rls_organization_video_quotas
-- Purpose:   Close the static RLS coverage gap for the Prisma model
--            OrganizationVideoQuota (@@map("organization_video_quotas")).
--            Enables RLS + adds org-scoped authenticated policies.
-- Trace:     fix/main-green-tests (RLS Coverage static gate).
-- =============================================================================
--
-- Founder-gated, applied OUT OF BAND via Supabase apply_migration (NEVER
-- `prisma db push`). Lives under supabase/migrations/ so it does NOT auto-apply
-- on Vercel deploy. ADDITIVE and backward-compatible only: enables RLS and adds
-- policies; no DROP/RENAME/type-change of any column or table.
--
-- Ownership column: organization_id (TEXT, NOT NULL, UNIQUE — one quota row per
-- organisation). Org-scope is enforced primarily at the QUERY layer (routes run
-- as service_role, which BYPASSES RLS, and filter by
-- getEffectiveOrganizationId(userId) — the ACTIVE brand). The policies below are
-- defense-in-depth for any authenticated direct access, mirroring the
-- studio_content_drafts / campaigns is_team_member() convention.
--
-- Environment-safe: the table is created by Prisma, so in a migrations-only
-- preview DB it may not exist yet. ENABLE RLS uses IF EXISTS (no-op when absent);
-- the policy block is guarded by a table-existence check so this migration
-- applies cleanly whether or not the table (and is_team_member) are present.
--
-- Policy posture (matches 20260527050000 batch-2):
--   - No `USING (true)` policies — the adversarial RLS gate treats those as
--     broken/open-by-default.
--   - No service_role policy — service_role bypasses RLS, so such a policy would
--     only add noise to the live pg_policies audit without changing access.
-- =============================================================================

BEGIN;

-- Enable RLS on the quota table (IF EXISTS: additive, safe if applied before the
-- table is present in a given environment).
ALTER TABLE IF EXISTS public.organization_video_quotas ENABLE ROW LEVEL SECURITY;

-- Org-scoped authenticated policies. Guarded on table presence so a fresh /
-- migrations-only DB (e.g. a Supabase preview branch, where the Prisma-created
-- table does not yet exist) applies this migration without error. In production
-- the table exists, so the policies are created. Idempotent: drop-if-exists then
-- create. organization_id is NOT NULL, so every row has an unambiguous tenant;
-- membership gated via is_team_member(text) (created in 20260602055800).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'organization_video_quotas'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS organization_video_quotas_select ON public.organization_video_quotas';
    EXECUTE 'CREATE POLICY organization_video_quotas_select ON public.organization_video_quotas
      FOR SELECT TO authenticated USING (public.is_team_member(organization_id))';

    EXECUTE 'DROP POLICY IF EXISTS organization_video_quotas_insert ON public.organization_video_quotas';
    EXECUTE 'CREATE POLICY organization_video_quotas_insert ON public.organization_video_quotas
      FOR INSERT TO authenticated WITH CHECK (public.is_team_member(organization_id))';

    EXECUTE 'DROP POLICY IF EXISTS organization_video_quotas_update ON public.organization_video_quotas';
    EXECUTE 'CREATE POLICY organization_video_quotas_update ON public.organization_video_quotas
      FOR UPDATE TO authenticated USING (public.is_team_member(organization_id))
      WITH CHECK (public.is_team_member(organization_id))';

    EXECUTE 'DROP POLICY IF EXISTS organization_video_quotas_delete ON public.organization_video_quotas';
    EXECUTE 'CREATE POLICY organization_video_quotas_delete ON public.organization_video_quotas
      FOR DELETE TO authenticated USING (public.is_team_member(organization_id))';
  END IF;
END $$;

COMMIT;

-- =============================================================================
-- ROLLBACK (additive-only):
--   DROP POLICY IF EXISTS organization_video_quotas_select ON public.organization_video_quotas;
--   DROP POLICY IF EXISTS organization_video_quotas_insert ON public.organization_video_quotas;
--   DROP POLICY IF EXISTS organization_video_quotas_update ON public.organization_video_quotas;
--   DROP POLICY IF EXISTS organization_video_quotas_delete ON public.organization_video_quotas;
--   ALTER TABLE IF EXISTS public.organization_video_quotas DISABLE ROW LEVEL SECURITY;
-- =============================================================================
