-- SYN-1196 — Synthex AI runtime, Phase 1 (Governor + Model Scout tables).
--
-- ADDITIVE ONLY. No DROP, no RENAME, no type change. Every added column is
-- either nullable or carries a default, so existing rows and every existing
-- writer (lib/pipelines/track-cost.ts, lib/ai/budget-enforcer.ts) keep working
-- untouched. Both new tables are CREATE TABLE IF NOT EXISTS.
--
-- NOT APPLIED BY THIS BRANCH. Production is read-only for agents and DDL is
-- founder-gated (.claude/rules/database/supabase-migrations.md, subordination
-- ruling 2026-08-04). This file is the authored artifact; the apply is a
-- separate, human action.
--
-- Written by hand rather than by `prisma migrate diff` — the Supabase write
-- gate hook blocks that subcommand by name. Column types, defaults and index
-- names follow Prisma's own PostgreSQL conventions so a later diff against
-- prisma/schema.prisma reports no drift. Verified with `npx prisma validate`.

-- ---------------------------------------------------------------------------
-- 1. pipeline_cost_ledger — AI receipt dimensions (SYN-518 table, extended).
--
-- The Governor writes ONE row per AI action into the ledger that already
-- exists, with client_id = organization_id, so budget-enforcer's existing
-- SUM over (client_id, created_at) already counts Governor spend. A parallel
-- receipts table would have produced two totals, each of which looks
-- affordable on its own.
--
-- `outcome` is NOT NULL DEFAULT 'completed': every pre-existing row describes
-- a call that actually ran, so 'completed' is the truthful backfill value, not
-- a convenience.
-- ---------------------------------------------------------------------------
ALTER TABLE "pipeline_cost_ledger" ADD COLUMN IF NOT EXISTS "provider" TEXT;
ALTER TABLE "pipeline_cost_ledger" ADD COLUMN IF NOT EXISTS "brand_slug" TEXT;
ALTER TABLE "pipeline_cost_ledger" ADD COLUMN IF NOT EXISTS "runner" TEXT;
ALTER TABLE "pipeline_cost_ledger" ADD COLUMN IF NOT EXISTS "outcome" TEXT NOT NULL DEFAULT 'completed';
ALTER TABLE "pipeline_cost_ledger" ADD COLUMN IF NOT EXISTS "provenance" JSONB;

CREATE INDEX IF NOT EXISTS "pipeline_cost_ledger_provider_created_at_idx"
  ON "pipeline_cost_ledger" ("provider", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "pipeline_cost_ledger_outcome_created_at_idx"
  ON "pipeline_cost_ledger" ("outcome", "created_at" DESC);

-- ---------------------------------------------------------------------------
-- 2. org_budget_policies — per-provider daily ceilings.
--
-- One JSONB column rather than four FLOAT columns, so adding a fifth provider
-- is a data change instead of another migration. Shape:
--   { "anthropic": 5.0, "openai": 2.0, "google": 1.0, "openrouter": 3.0 }
-- Absent key = no provider-specific ceiling; the org-wide daily_ceiling_usd
-- still applies. Read by lib/ai/governor/budget.ts, which treats any
-- non-finite or negative value as "no ceiling" rather than coercing it.
-- ---------------------------------------------------------------------------
ALTER TABLE "org_budget_policies" ADD COLUMN IF NOT EXISTS "provider_daily_ceilings_usd" JSONB;

-- ---------------------------------------------------------------------------
-- 3. runner_flags — per-brand runner enablement and kill-switch.
--
-- DEFAULT OFF IS A HARD REQUIREMENT (SYN-1196). `enabled` defaults to false,
-- and lib/ai/governor/flags.ts additionally treats a MISSING ROW as off, so
-- there is no state of this table under which a runner turns itself on.
--
-- The row with runner = '*' is the brand-level kill-switch: setting
-- kill_switch on it stops every runner for that brand in one write.
--
-- Soft reference to organizations.id with NO foreign key — the same additive
-- convention as org_budget_policies and mcp_api_keys, and it avoids the known
-- organizations.id TEXT/UUID mismatch hazard. Org scope is enforced at the
-- query layer.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "runner_flags" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "brand_slug" TEXT NOT NULL,
    "runner" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "kill_switch" BOOLEAN NOT NULL DEFAULT false,
    "kill_switch_reason" TEXT,
    "kill_switch_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "runner_flags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "runner_flags_organization_id_brand_slug_runner_key"
  ON "runner_flags" ("organization_id", "brand_slug", "runner");
CREATE INDEX IF NOT EXISTS "runner_flags_organization_id_brand_slug_idx"
  ON "runner_flags" ("organization_id", "brand_slug");

-- ---------------------------------------------------------------------------
-- 4. model_eval_receipts — Model Scout probe evidence.
--
-- THE MODEL REGISTRY ITSELF STAYS A FILE IN GIT (lib/ai/model-registry.ts).
-- This table deliberately does NOT hold the registry. The Scout's deliverable
-- is "a config PR with an eval receipt", and a database row can never be a
-- pull request — so the decision of which model runs stays in version control,
-- reviewable and revertable, while only the evidence lives here.
--
-- Created in Phase 1 though the Scout is Phase 2, so a Governor receipt can
-- cite an eval by id from the first day rather than after a second migration.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "model_eval_receipts" (
    "id" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "probe_status" TEXT NOT NULL,
    "probe_detail" JSONB,
    "latency_ms" INTEGER,
    "cost_usd" DOUBLE PRECISION,
    "verdict" TEXT NOT NULL,
    "config_pr_url" TEXT,
    "registry_sha" TEXT,
    "observed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_eval_receipts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "model_eval_receipts_provider_observed_at_idx"
  ON "model_eval_receipts" ("provider", "observed_at" DESC);
CREATE INDEX IF NOT EXISTS "model_eval_receipts_model_id_observed_at_idx"
  ON "model_eval_receipts" ("model_id", "observed_at" DESC);

-- ---------------------------------------------------------------------------
-- 5. Row-level security for both new tables.
--
-- Posture is service-role only. Both are written and read exclusively
-- server-side through Prisma (lib/ai/governor/*); nothing reaches them with a
-- browser-held key. Without RLS they would inherit whatever grants the project
-- gives anon/authenticated — which for runner_flags would mean a client-side
-- key could read, and potentially clear, another brand's kill-switch.
--
-- Guards follow 20260803130000_rls_opportunity_map_scans: a bare REVOKE or a
-- GRANT naming a role that does not exist raises invalid_role_specification
-- (0P000) and aborts the whole migration, so every role-bearing statement is
-- wrapped. On a database without the Supabase roles the ALTER still lands and
-- RLS defaults to deny for ordinary roles.
-- ---------------------------------------------------------------------------
ALTER TABLE "runner_flags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "model_eval_receipts" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text; r text;
BEGIN
  FOREACH t IN ARRAY ARRAY['runner_flags', 'model_eval_receipts'] LOOP
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
        EXECUTE format('REVOKE ALL ON TABLE %I FROM %I', t, r);
      END IF;
    END LOOP;
  END LOOP;
END $$;

DO $$
DECLARE t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    FOREACH t IN ARRAY ARRAY['runner_flags', 'model_eval_receipts'] LOOP
      EXECUTE format('GRANT ALL ON TABLE %I TO service_role', t);
    END LOOP;
  END IF;
END $$;
