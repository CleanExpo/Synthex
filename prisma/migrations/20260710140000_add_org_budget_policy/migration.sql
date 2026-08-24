-- BUDGET-ENFORCER: per-organisation pre-spend budget ceilings.
--
-- Source of truth: prisma/schema.prisma model OrgBudgetPolicy
-- (@@map("org_budget_policies")). Read by lib/ai/budget-enforcer.ts BEFORE
-- any AI provider call (generate-content single/batch, calendar jobs).
--
-- DEPLOY SAFETY: with ZERO rows in this table (and the
-- SYNTHEX_DEFAULT_*_COST_CEILING_USD env vars unset) the enforcer is a no-op
-- — behaviour is identical to today. Enforcement (fail-closed 402) activates
-- per-org ONLY when a row exists with enforcement_mode = 'enforce'.
-- Rows are founder-seeded via raw SQL this slice — there is no policy-write
-- UI or API. Missing-table reads (P2021) fail open (log-only) by design, so
-- deploying the code before this migration is applied is safe.
--
-- Additive + idempotent (IF NOT EXISTS throughout). No drops, no renames, no
-- type changes. CREATE TABLE / index bodies follow the canonical
-- `prisma migrate diff` output for this model; RLS added per the repo's
-- service-role-only convention (mcp_api_keys / client_engagement_events).
--
-- Soft ref: organization_id references Organization.id logically only (no FK)
-- — same additive-migration convention as mcp_api_keys / promo_codes.
--
-- PROD apply is the founder's gate — never `prisma db push` /
-- `prisma migrate deploy` against prod from CI or a dev box.

-- CreateTable
CREATE TABLE IF NOT EXISTS "org_budget_policies" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "daily_ceiling_usd" DOUBLE PRECISION,
    "monthly_ceiling_usd" DOUBLE PRECISION,
    "enforcement_mode" TEXT NOT NULL DEFAULT 'log_only',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_budget_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "org_budget_policies_organization_id_key"
    ON "org_budget_policies"("organization_id");

-- Service-role only. RLS enabled + no authenticated/anon policy means all
-- access is via the API service-role key (which bypasses RLS). Policies are
-- only ever read server-side by lib/ai/budget-enforcer.ts and surfaced via
-- the admin-gated app/api/admin/org-spend route — never from a browser-held
-- anon key. Canonical pattern per
-- prisma/migrations/20260710120000_mcp_api_keys/migration.sql.
ALTER TABLE "org_budget_policies" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "service_role_org_budget_policies"
    ON "org_budget_policies" FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN datatype_mismatch THEN NULL;
  WHEN undefined_function THEN NULL;
END $$;
