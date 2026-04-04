-- Migration: Create edge_function_logs table — SYN-626
-- Tracks aggregate execution outcomes for all Synthex autonomous pipeline Edge Functions.
-- Written by createEdgeFunctionRunner() in lib/pipelines/runner.ts.

CREATE TABLE IF NOT EXISTS "edge_function_logs" (
  "id"                UUID        NOT NULL DEFAULT gen_random_uuid(),
  "function_name"     TEXT        NOT NULL,
  "run_id"            UUID        NOT NULL,
  "client_id"         UUID,
  "status"            TEXT        NOT NULL,
  "duration_ms"       INTEGER,
  "clients_processed" INTEGER     NOT NULL DEFAULT 0,
  "clients_failed"    INTEGER     NOT NULL DEFAULT 0,
  "error_json"        JSONB,
  "output_metadata"   JSONB,
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "edge_function_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "edge_function_logs_status_check" CHECK (
    "status" IN ('success', 'partial', 'failed')
  )
);

-- Index for /api/health/pipelines endpoint (latest run per function_name)
CREATE INDEX IF NOT EXISTS "edge_function_logs_function_name_created_at_idx"
  ON "edge_function_logs" ("function_name", "created_at" DESC);

-- RLS: service role can insert; authenticated users with is_team_member() can read
ALTER TABLE "edge_function_logs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_insert" ON "edge_function_logs"
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "authenticated_read" ON "edge_function_logs"
  FOR SELECT
  TO authenticated
  USING (is_team_member(auth.uid()));
