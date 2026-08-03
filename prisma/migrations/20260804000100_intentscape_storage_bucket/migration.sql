-- SYN-1124 companion — the private `intentscape-wiki` storage bucket.
--
-- WHY THIS EXISTS
-- 20260804000000 creates the six IntentScape tables, but the tables are only
-- half the feature. Artifacts (the Context Field, vision attempts, accepted
-- visions, goal contracts, work packets) are markdown objects written to a
-- private Supabase bucket by lib/intentscape/markdown-store.ts. Without the
-- bucket, createWorkspace inserts a workspace row and then FAILS on the first
-- artifact upload — a worse state than the feature being cleanly absent.
--
-- Like the tables, this shipped only in
-- supabase/migrations/20260803000000_intentscape_context_field.sql, which
-- production has never run. Verified against production 2026-08-04:
--
--   SELECT id, name, public FROM storage.buckets WHERE id = 'intentscape-wiki';
--   -> zero rows
--
-- This was missed on the first pass of the table migration: the production
-- evidence checked the six tables and stopped there (independent review of
-- 8c567856, P1).
--
-- SUPABASE-ONLY, ALL-OR-NOTHING. On a bare PostgreSQL (no storage schema) this
-- migration is a clean no-op. On a Supabase database it is all-or-nothing: if the
-- storage schema is present but the tenant helper or the authenticated role is
-- not, it RAISES rather than creating a bucket it cannot protect.
--
-- PRECONDITION — expect zero rows:
--   SELECT id FROM storage.buckets WHERE id = 'intentscape-wiki';

-- All-or-nothing on a Supabase database. The first version inserted the bucket
-- whenever storage existed but skipped the policy independently when the helper
-- or the role was missing — Prisma would then record the migration as applied,
-- and installing the prerequisite later would never create the policy. That is a
-- permanent partial state, not a no-op (independent review of 2b21d606, P2).
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NULL THEN
    RAISE NOTICE 'storage schema absent (not a Supabase database) — skipping bucket and policy';
    RETURN;
  END IF;

  IF to_regclass('storage.objects') IS NULL
     OR to_regprocedure('public.is_team_member(text)') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    RAISE EXCEPTION USING
      MESSAGE = 'IntentScape storage prerequisites missing on a Supabase database',
      DETAIL  = 'storage.buckets present, but storage.objects, '
                'public.is_team_member(text) or the authenticated role is absent, '
                'so the tenant read policy cannot be created.',
      HINT    = 'Install the helper and the role first. Creating the bucket without '
                'its policy would record this migration as applied and leave tenant '
                'reads permanently unavailable.';
  END IF;

  -- Converge, do not merely tolerate. ON CONFLICT DO NOTHING preserved an
  -- existing PUBLIC bucket of the same id, which would expose tenant strategic
  -- artifacts while the migration reported success (same review, P2).
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('intentscape-wiki', 'intentscape-wiki', false)
  ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        public = EXCLUDED.public;
END $$;

-- Tenant read on the objects, scoped by the organisation id in the first path
-- segment. Mirrors supabase/migrations/20260803000000_intentscape_context_field.sql.
--
-- DROP then CREATE rather than swallowing duplicate_object: a stale policy of the
-- same name with a weaker USING clause would otherwise survive and be reported as
-- correct (same review, P2). This converges on the exact definition every time.
DO $$
BEGIN
  IF to_regclass('storage.objects') IS NOT NULL
     AND to_regprocedure('public.is_team_member(text)') IS NOT NULL
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    DROP POLICY IF EXISTS intentscape_wiki_tenant_select ON storage.objects;
    CREATE POLICY intentscape_wiki_tenant_select
      ON storage.objects
      FOR SELECT TO authenticated
      USING (
        bucket_id = 'intentscape-wiki'
        AND public.is_team_member((storage.foldername(name))[1])
      );
  END IF;
END $$;

-- POST-APPLY VERIFICATION (run these; do not assume):
--
--   -- 1. the bucket exists and is PRIVATE (expect one row, public = false)
--   SELECT id, name, public FROM storage.buckets WHERE id = 'intentscape-wiki';
--
--   -- 2. the tenant read policy exists AND carries the right clause (expect one
--   --    row; assert the qual, not just the name — a stale permissive policy of
--   --    the same name would otherwise pass)
--   SELECT policyname, cmd, roles, qual FROM pg_policies
--   WHERE schemaname = 'storage' AND tablename = 'objects'
--     AND policyname = 'intentscape_wiki_tenant_select';
--   -- expected qual: ((bucket_id = 'intentscape-wiki'::text) AND
--   --                 is_team_member((storage.foldername(name))[1]))
--
--   -- 3. end-to-end: create a workspace through the product and confirm the
--   --    artifact object lands. A bucket row alone does not prove the write
--   --    path works — the service role must also be able to upload.
