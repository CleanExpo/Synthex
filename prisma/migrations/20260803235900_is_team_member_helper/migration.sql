-- SYN-1124 prerequisite — carry public.is_team_member(text) into the Prisma ledger.
--
-- WHY THIS EXISTS
-- Every tenant RLS policy in this estate is written as
-- `USING (public.is_team_member(organization_id))`, but the helper itself ships
-- only in supabase/migrations/20260602055800_create_is_team_member_helper.sql —
-- and production runs `prisma migrate deploy`, which reads prisma/migrations/
-- ONLY. That is the exact gap SYN-1124 exists to close for the IntentScape
-- tables, and the helper had it too (CodeRabbit critical finding on PR #823).
--
-- Left unfixed, a database rebuilt from the Prisma ledger alone would create the
-- six IntentScape tables, enable RLS, grant `authenticated` SELECT, and then
-- silently skip every tenant policy. RLS with a grant and no policy returns zero
-- rows: the feature would look healthy and read nothing.
--
-- Ordered 20260803235900 so it lands immediately BEFORE
-- 20260804000000_intentscape_context_field, which now refuses to run without it.
--
-- NON-DESTRUCTIVE BY DESIGN. Production already carries this function (verified
-- 2026-08-04: to_regprocedure('public.is_team_member(text)') IS NOT NULL), and
-- other tables' policies depend on it. This migration therefore creates it only
-- when ABSENT rather than CREATE OR REPLACE — the ledger becomes self-sufficient
-- without this file ever redefining a live function whose body may have been
-- tuned since. If it exists, this is a no-op.
--
-- Body copied verbatim from the supabase migration cited above.
--
-- PRECONDITION — informational, both outcomes are fine:
--   SELECT to_regprocedure('public.is_team_member(text)') IS NOT NULL AS already_present;

DO $$
BEGIN
  -- Existence is not usability. The body probes for team_members.organization_id
  -- or users.organization_id and returns FALSE when it finds neither — so on a
  -- database lacking both, installing it would satisfy every downstream guard
  -- while denying every authenticated read. That is the silent-zero-rows class
  -- this migration exists to eliminate, reproduced one level down
  -- (independent review of 887835c0, P1).
  --
  -- The Prisma ledger alone does not currently create `team_members`, and it
  -- declares users' column as the camel-case "organizationId", so a ledger-only
  -- rebuild hits exactly that state. Refuse loudly there instead of shipping a
  -- helper that always says no.
  --
  -- Production is unaffected: verified 2026-08-04 that it carries BOTH
  -- team_members.organization_id and users.organization_id.
  IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'team_members'
          AND column_name = 'organization_id')
     AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users'
          AND column_name = 'organization_id') THEN
    RAISE EXCEPTION USING
      MESSAGE = 'No usable membership source for public.is_team_member(text)',
      DETAIL  = 'Neither public.team_members.organization_id nor '
                'public.users.organization_id exists, so the helper would return '
                'false for every caller and every tenant read would be denied '
                'while the migration reported success.',
      HINT    = 'Create the canonical membership schema before this migration. '
                'The helper is only meaningful once one of those columns exists.';
  END IF;

  -- Only now may we short-circuit. Returning before the assertion let a database
  -- with a pre-existing helper and NO usable membership source record this
  -- migration as applied, after which the policies are created and the helper
  -- answers false for every caller (independent review of 05ddb17d, P1). The
  -- assertion is about the DATABASE, not about this file's work, so it must run
  -- whether or not there is anything to create.
  IF to_regprocedure('public.is_team_member(text)') IS NOT NULL THEN
    RAISE NOTICE 'public.is_team_member(text) already present — leaving it untouched';
    RETURN;
  END IF;

  EXECUTE $fn$
    CREATE FUNCTION public.is_team_member(row_org_id text)
    RETURNS boolean
    LANGUAGE plpgsql
    STABLE
    SECURITY DEFINER
    SET search_path = public, auth, pg_temp
    AS $body$
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
    $body$;
  $fn$;
END $$;

-- POST-APPLY VERIFICATION (run it; do not assume):
--
--   -- expect one row, and the signature taking text
--   SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
--          p.prosecdef AS security_definer
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND p.proname = 'is_team_member';
--
--   -- and the resolver the dependent migrations actually use
--   SELECT to_regprocedure('public.is_team_member(text)') IS NOT NULL AS resolvable;
