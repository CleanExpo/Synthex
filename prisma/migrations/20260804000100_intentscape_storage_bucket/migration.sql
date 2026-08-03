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
-- SUPABASE-ONLY. The `storage` schema exists only on Supabase, so every
-- statement is guarded — on a bare PostgreSQL this migration is a no-op rather
-- than an error, matching how the role guards work in its sibling.
--
-- PRECONDITION — expect zero rows:
--   SELECT id FROM storage.buckets WHERE id = 'intentscape-wiki';

DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NULL THEN
    RAISE NOTICE 'storage schema absent (not a Supabase database) — skipping bucket creation';
    RETURN;
  END IF;

  -- private: `public = false`. These artifacts are tenant strategic material and
  -- are served through signed URLs, never anonymously.
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('intentscape-wiki', 'intentscape-wiki', false)
  ON CONFLICT (id) DO NOTHING;
END $$;

-- Tenant read on the objects, scoped by the organisation id in the first path
-- segment. Mirrors supabase/migrations/20260803000000_intentscape_context_field.sql.
-- Guarded on the exact schema-qualified signature of the helper, and on the role,
-- so a database missing either gets no policy rather than a failed migration.
DO $$
BEGIN
  IF to_regclass('storage.objects') IS NOT NULL
     AND to_regprocedure('public.is_team_member(text)') IS NOT NULL
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    BEGIN
      CREATE POLICY intentscape_wiki_tenant_select
        ON storage.objects
        FOR SELECT TO authenticated
        USING (
          bucket_id = 'intentscape-wiki'
          AND public.is_team_member((storage.foldername(name))[1])
        );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- POST-APPLY VERIFICATION (run these; do not assume):
--
--   -- 1. the bucket exists and is PRIVATE (expect one row, public = false)
--   SELECT id, name, public FROM storage.buckets WHERE id = 'intentscape-wiki';
--
--   -- 2. the tenant read policy exists (expect one row)
--   SELECT policyname, cmd, roles FROM pg_policies
--   WHERE schemaname = 'storage' AND tablename = 'objects'
--     AND policyname = 'intentscape_wiki_tenant_select';
--
--   -- 3. end-to-end: create a workspace through the product and confirm the
--   --    artifact object lands. A bucket row alone does not prove the write
--   --    path works — the service role must also be able to upload.
