-- ============================================================================
-- Migration: create is_team_member helper
-- Purpose:   Restore the RLS helper function to repo migrations so Supabase
--            Preview can rebuild policy dependencies from source.
-- Scope:     Idempotent helper definition. No table or data changes.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.is_team_member(row_org_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  current_user_id text;
  has_team_org_column boolean;
  has_users_org_column boolean;
  allowed boolean;
BEGIN
  current_user_id := (SELECT auth.uid())::text;

  IF row_org_id IS NULL OR current_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'team_members'
      AND column_name = 'organization_id'
  )
  INTO has_team_org_column;

  IF has_team_org_column THEN
    EXECUTE '
      SELECT EXISTS (
        SELECT 1
        FROM public.team_members tm
        WHERE tm.organization_id = $1
          AND tm.user_id = $2
      )
    '
    INTO allowed
    USING row_org_id, current_user_id;

    RETURN COALESCE(allowed, false);
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'organization_id'
  )
  INTO has_users_org_column;

  IF has_users_org_column THEN
    EXECUTE '
      SELECT EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = $1
          AND u.organization_id = $2
      )
    '
    INTO allowed
    USING current_user_id, row_org_id;

    RETURN COALESCE(allowed, false);
  END IF;

  RETURN false;
END;
$$;

COMMIT;
