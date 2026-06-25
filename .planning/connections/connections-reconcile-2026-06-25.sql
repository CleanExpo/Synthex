-- Connections reconcile (2026-06-25) — one-off ops DML, applied via Supabase MCP
-- execute_sql against prod project znyjoyjsvjotlzjppzal. NOT a Prisma schema
-- migration (no DDL) — kept here as the record of the data change.
--
-- Purges already-soft-deleted, postless drift/orphan platform_connections rows.
-- Guards make it impossible to hit a live connection:
--   * deleted_at IS NOT NULL  → row already soft-deleted (invisible to the app)
--   * NOT EXISTS dependent platform_posts → no cascade loss of post history
-- Idempotent: re-running deletes 0 rows once the ids are gone.
--
-- Verified outcome: 5 rows deleted; 0 soft-deleted / 0 orphan rows remain
-- across all orgs; all active/live connections untouched.

DELETE FROM platform_connections pc
WHERE pc.id IN (
  'cmor42tz4000104jp1tiolzcj',            -- orphan GA (organization_id NULL)
  'pc_nrpg_ga_001',                       -- NRPG GA (business)   — superseded by active personal row
  'be113f9a-0f35-4346-98a2-b1f7f55a1f44', -- NRPG GBP (business)  — superseded by active personal row
  'pc_nrpg_searchconsole_001',            -- NRPG SC (business)   — superseded by active personal row
  'cmpd4o677000004l76a0cx0t7'             -- Unite-Group GA (personal) — superseded by active row
)
  AND pc.deleted_at IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM platform_posts pp WHERE pp.connection_id = pc.id);
