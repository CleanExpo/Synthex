-- RLS coverage for follower_snapshots (the table added by the #409 follower-growth
-- snapshot migration, 20260615_add_follower_snapshot). That migration created the
-- table but never enabled Row Level Security, leaving it the ONLY uncovered Prisma
-- model and turning the "RLS Coverage (static)" gate red on main. follower_snapshots
-- holds org-scoped audience data (user_id + nullable organization_id), so it MUST be
-- covered to the same standard as every other tenant table.
--
-- Pattern mirrors supabase/migrations/20260319000001_rls_comprehensive_all_tables.sql:
--   * service_role FOR ALL  — the app connects via the service/direct role (Prisma),
--                             which must retain full access.
--   * authenticated SELECT  — defence-in-depth for any direct Supabase-client read,
--                             scoped to the caller's organisation. A `user_id` clause
--                             is added so personal connections (organization_id IS NULL)
--                             are visible to their owner, since the org-IN check alone
--                             never matches a NULL org.
--
-- Idempotent: ALTER ... IF EXISTS + CREATE POLICY wrapped in duplicate_object-tolerant
-- DO blocks, so this is safe to re-run and safe to apply ahead of/behind the table.

-- follower_snapshots
ALTER TABLE IF EXISTS public.follower_snapshots ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_follower_snapshots" ON public.follower_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_org_follower_snapshots" ON public.follower_snapshots FOR SELECT TO authenticated USING (organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text) OR user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
