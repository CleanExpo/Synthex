-- SYN-847: Workspace umbrella — Unite-Group parent org with child brand orgs
--
-- Adds nullable self-FK to Organization so a parent (workspace) org can have
-- many child (brand) orgs. Backward-compatible: every existing org gets
-- parent_org_id = NULL by default and continues to behave as a flat tenant.
--
-- Rollback safety:
--   - Column is nullable
--   - FK uses ON DELETE SET NULL so deleting a parent doesn't cascade-delete children
--   - Index is non-unique (multiple children per parent)

-- 1. Add the nullable parent FK column
ALTER TABLE "organizations"
  ADD COLUMN "parent_org_id" TEXT;

-- 2. Self-referential FK with SET NULL on delete
ALTER TABLE "organizations"
  ADD CONSTRAINT "organizations_parent_org_id_fkey"
  FOREIGN KEY ("parent_org_id")
  REFERENCES "organizations"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 3. Index for fast child lookup (workspace dashboard queries)
CREATE INDEX "organizations_parent_org_id_idx"
  ON "organizations"("parent_org_id");
