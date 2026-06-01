-- ============================================================================
-- Migration: create is_team_member helper
-- Purpose:   Restore the RLS helper function to repo migrations so Supabase
--            Preview can rebuild policy dependencies from source.
-- Scope:     Idempotent helper definition. No table or data changes.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.is_team_member(row_org_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members tm
    WHERE tm.organization_id = row_org_id
      AND tm.user_id = (SELECT auth.uid())::text
  );
$$;

COMMIT;
