-- Migration: Add organization_id to tasks and geo_research_reports
-- Purpose: Enable org-scoped queries for multi-business owners (SYN-391, SYN-392)
-- Safety: All columns are nullable — no existing rows affected

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tasks_organization_id_idx ON tasks(organization_id);

ALTER TABLE geo_research_reports
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS geo_research_reports_organization_id_idx ON geo_research_reports(organization_id);
