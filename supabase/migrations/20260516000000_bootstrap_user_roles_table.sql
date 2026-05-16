-- ============================================================================
-- Migration: 20260516000000_bootstrap_user_roles_table
-- Purpose:   Add `public.user_roles` placeholder for Preview branch resolution.
--
-- The 20260516xxx batch of admin RLS policies (aeo_gate_runs,
-- nap_citation_mention_freshness, etc.) all use:
--   USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()
--                    AND role = 'admin'))
--
-- user_roles is Prisma-managed (cuid TEXT id; user_id + role columns).
-- Place this sequenced before the 20260516xxx admin policies. Same
-- `IF NOT EXISTS` pattern — no-op in real envs.
--
-- Schema needs to include the two columns the EXISTS subquery checks
-- (`user_id`, `role`) or policy creation fails with undefined_column.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_roles (
  id      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT,
  role    TEXT
);
