-- History reconciliation for the PR #821 preview pilot.
--
-- The disposable preview branch received the feedback columns and RLS policy
-- directly for live smoke testing. Their canonical production DDL remains in
-- prisma/migrations/20260803150000_add_opportunity_map_feedback_and_rls/migration.sql;
-- this no-op records the preview-only migration version for Supabase Git.
SELECT 1;
