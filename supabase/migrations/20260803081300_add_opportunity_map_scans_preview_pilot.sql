-- History reconciliation for the PR #821 preview pilot.
--
-- The disposable preview branch received the Opportunity Map scan table
-- directly for live smoke testing. Production ownership stays with
-- prisma/migrations/20260803120000_add_opportunity_map_scans/migration.sql;
-- this no-op records the preview-only migration version for Supabase Git.
SELECT 1;
