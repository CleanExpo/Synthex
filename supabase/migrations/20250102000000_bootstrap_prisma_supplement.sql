-- ============================================================================
-- Migration: 20250102000000_bootstrap_prisma_supplement
-- Purpose:   Third-stage bootstrap. Adds 6 more Prisma-managed tables hit by
--            non-defensive `ALTER TABLE` statements in subsequent supabase
--            migrations (`20260331000001_ml_metadata_scaffold_sprint3` etc.).
--
-- WHY THIS IS SEPARATE FROM `20250101000000_bootstrap_prisma_alter_targets`
-- ------------------------------------------------------------------------
-- Same reason as the 00000000000000 → 20250101000000 split: the prior file
-- was already marked applied on the Preview project before this batch of
-- tables was enumerated. Supabase tracks applied migrations by version
-- name, not file hash, so editing a previously-applied file does not re-run
-- it. New file → fresh apply.
--
-- After this supplement, all 10 Prisma-managed tables hit by non-defensive
-- ALTER statements have placeholders:
--
--   FK targets (in 00000000000000):  organizations, users, team_invitations
--   ALTER targets (in 20250101000000): tasks, geo_research_reports,
--                                       client_health_scores
--   ALTER targets (in 20250102000000): posts, calendar_posts, gbp_reviews,
--                                       seasonal_signals, authority_scores,
--                                       autopilot_runs
--
-- Real envs already have Prisma's full schemas; `IF NOT EXISTS` makes this
-- a no-op there.
-- ============================================================================

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
