-- ============================================================================
-- Migration: 20260516000003_rls_batch_1_5_drop_broken_using_true_policies
-- Purpose:   Drop 4 broken `using (true)` policies that grant anon /
--            authenticated / public read across tenant data.
-- Mandate:   a4aae2cf-6a05-4426-9019-3f38137a9b7b (Synthex Phase 2)
-- Batch:     1.5 of N (between Batch 1 (NO_POLICY → SECURE) and Batch 2
--            (uuid-typed tenant columns: testimonials, testimonial_requests))
-- ============================================================================
--
-- WHY THIS BATCH EXISTS
-- ---------------------
-- Batch 1's adversarial spec re-run surfaced 4 `using (true)` policies that
-- grant cross-tenant reads to non-service_role roles. The other 147 USING_TRUE
-- policies are service_role-only (RLS already bypassed for service_role —
-- redundant but harmless). These 4 are the only ones that actually leak.
--
-- POLICIES BEING DROPPED
-- ----------------------
--   1. agent_task_queue."Public can view agent tasks" (role: public, SELECT)
--      - Origin: copied verbatim from NodeJS-Starter-V1 starter kit in
--        20260317000001_agent_runs_and_workflow_rls.sql with comment
--        "useful for admin dashboards and transparency".
--      - Risk: title / description / error_message / pr_url / result jsonb
--        all carry work content. anon enumerates all agent activity.
--      - Code consumers: none (table is not read from app code).
--      - Also REVOKE the explicit `GRANT SELECT TO anon` belt-and-suspenders.
--
--   2. client_videos."public_read_client_videos" (roles: anon + authenticated, SELECT)
--      - Origin: UN-ATTRIBUTABLE. Not in any committed migration.
--      - Risk: leaks Synthex client → YouTube channel mapping (customer list).
--        Video metadata itself is YouTube-public, but the mapping is not.
--      - Code consumers: lib/videos/getClientVideos.ts uses service_role.
--
--   3. edge_function_logs."authenticated_select" (role: authenticated, SELECT)
--      - Origin: REGRESSION. Original SYN-626 migration shipped with
--        `USING (is_team_member(auth.uid()))`. Was dropped and replaced
--        out-of-band with `USING (true)`. Source of replacement unknown.
--      - Risk: cross-tenant pipeline logs visible to every logged-in user.
--        error_json + output_metadata jsonb columns carry payloads.
--      - Code consumers: lib/pipelines/runner.ts, app/api/health/pipelines/
--        route.ts, 5 internal API routes — all use service_role.
--
--   4. seasonal_signals."seasonal_signals_read" (role: authenticated, SELECT)
--      - Origin: UN-ATTRIBUTABLE. Not in any committed migration.
--      - Risk: lowest of the 4 — industry / state-level reference data, not
--        tenant-scoped. Dropping for consistency; can re-add an explicit
--        policy if Supabase-client access is needed later.
--      - Code consumers: app/api/seasonal-signals/route.ts uses Prisma
--        $queryRaw which runs as postgres (RLS-exempt), so policy is unused.
--
-- BLAST RADIUS
-- ------------
-- Zero app-code-path impact. Every code consumer of these 4 tables uses
-- service_role, which bypasses RLS regardless of policies. service_role
-- ALL-policies on each table are untouched.
--
-- After this migration:
--   - anon: 0 rows from all 4 tables (was: client_videos + agent_task_queue)
--   - authenticated: 0 rows from all 4 (was: client_videos + edge_function_logs
--     + seasonal_signals)
--   - service_role: unchanged (still reads/writes everything)
--
-- The adversarial spec's non-service_role USING_TRUE count goes from 5 to 0.
--
-- ROLLBACK
-- --------
-- If a UI surface needs read access, re-add an EXPLICIT policy with a
-- proper predicate — never `using (true)`. Templates:
--
--   -- edge_function_logs: original SYN-626 pattern (re-create if needed)
--   CREATE POLICY "authenticated_read" ON public.edge_function_logs
--     FOR SELECT TO authenticated
--     USING (client_id IS NOT NULL AND is_team_member(client_id::text));
--
--   -- client_videos: tenant-scoped (client_id is text)
--   CREATE POLICY "client_videos_tenant_read" ON public.client_videos
--     FOR SELECT TO authenticated
--     USING (is_team_member(client_id));
--
-- ============================================================================

-- Each DROP wrapped so missing tables on Preview don't fail (real envs have them all).
-- 1. agent_task_queue — public-readable agent backlog
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Public can view agent tasks" ON public.agent_task_queue';
  EXECUTE 'REVOKE SELECT ON public.agent_task_queue FROM anon';
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- 2. client_videos — anon+authenticated readable
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "public_read_client_videos" ON public.client_videos';
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- 3. edge_function_logs — authenticated readable (regression from SYN-626)
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "authenticated_select" ON public.edge_function_logs';
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- 4. seasonal_signals — authenticated readable (low-risk reference data)
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "seasonal_signals_read" ON public.seasonal_signals';
EXCEPTION WHEN undefined_table THEN NULL; END $$;
