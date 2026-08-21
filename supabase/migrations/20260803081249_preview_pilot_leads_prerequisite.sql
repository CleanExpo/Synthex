-- History reconciliation for the PR #821 preview pilot.
--
-- This version was applied directly to the disposable Supabase preview branch
-- to provide the existing Prisma-managed `leads` prerequisite for smoke tests.
-- The canonical production DDL remains in the Prisma migration history. This
-- no-op keeps Supabase Git migration history consistent without attempting to
-- create the same enum and table through two migration systems.
SELECT 1;
