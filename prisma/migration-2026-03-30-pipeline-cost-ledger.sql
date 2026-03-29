-- SYN-517 / SYN-518: pipeline_cost_ledger table
-- Tracks AI pipeline costs per run per client for margin monitoring.
-- Apply with: npx prisma db execute --file prisma/migration-2026-03-30-pipeline-cost-ledger.sql --url "$DIRECT_URL"
-- Query with: scripts/cost-report.sql

CREATE TABLE IF NOT EXISTS "pipeline_cost_ledger" (
  "id"            TEXT NOT NULL,
  "pipeline_name" TEXT NOT NULL,
  "client_id"     TEXT,
  "run_id"        TEXT NOT NULL,
  "model"         TEXT NOT NULL,
  "input_tokens"  INTEGER NOT NULL,
  "output_tokens" INTEGER NOT NULL,
  "cost_usd"      DOUBLE PRECISION NOT NULL,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "pipeline_cost_ledger_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "pipeline_cost_ledger_pipeline_name_created_at_idx"
  ON "pipeline_cost_ledger" ("pipeline_name", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "pipeline_cost_ledger_client_id_created_at_idx"
  ON "pipeline_cost_ledger" ("client_id", "created_at" DESC);
