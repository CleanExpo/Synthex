-- SYN-972 Phase 128: Agency task catalog ID on tasks (AT-001 … AT-032)
-- Apply via: npx prisma migrate diff … OR manual db execute (do NOT use db push in CI without approval)

ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "agency_task_id" VARCHAR(10);

CREATE INDEX IF NOT EXISTS "tasks_organization_id_agency_task_id_idx"
  ON "tasks" ("organization_id", "agency_task_id");
