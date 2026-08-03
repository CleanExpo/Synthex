-- History marker for the PR #821 preview pilot.
--
-- This version was applied to the disposable preview branch before the
-- zero-downtime production migration was prepared. Future environments build
-- replacement indexes in 20260803170000 and 20260803170050, then attach them
-- as constraints in 20260803170100, avoiding a table scan under ACCESS
-- EXCLUSIVE here.
SELECT 1;
