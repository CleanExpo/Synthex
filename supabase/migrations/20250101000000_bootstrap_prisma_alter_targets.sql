-- ============================================================================
-- Migration: 20250101000000_bootstrap_prisma_alter_targets
-- Purpose:   Second-stage bootstrap. Adds the Prisma-managed tables that
--            later supabase migrations `ALTER TABLE` (rather than FK to).
--
-- WHY THIS IS SEPARATE FROM `00000000000000_bootstrap_prisma_dependencies`
-- -----------------------------------------------------------------------
-- The first bootstrap was applied to Preview before these ALTER-target
-- tables were enumerated. Modifying it after-the-fact would not re-run
-- on Preview (Supabase marks versions applied by name, not hash), so the
-- new tables would never get created.
--
-- New migration name → fresh apply on Preview → tables get created.
--
-- Real envs (prod, dev) already have Prisma's full schemas. `IF NOT EXISTS`
-- makes this a no-op there.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tasks (
  id TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS public.geo_research_reports (
  id TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS public.client_health_scores (
  id TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS public.posts (
  id TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS public.calendar_posts (
  id TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS public.gbp_reviews (
  id TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS public.seasonal_signals (
  id TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS public.authority_scores (
  id TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS public.autopilot_runs (
  id TEXT PRIMARY KEY
);
