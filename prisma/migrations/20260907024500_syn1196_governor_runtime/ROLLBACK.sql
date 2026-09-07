-- ROLLBACK for 20260907024500_syn1196_governor_runtime (SYN-1196).
--
-- READ THIS BEFORE RUNNING IT. This script is DESTRUCTIVE: it drops two tables
-- and five columns. Dropping runner_flags destroys every brand's enablement
-- and kill-switch state; dropping the ledger columns destroys the provider,
-- brand, outcome and provenance dimension of every AI receipt written since
-- the forward migration was applied. The cost rows themselves survive (id,
-- model, tokens, cost_usd, created_at are untouched) but you can no longer
-- tell a refusal from a served call, which is the whole point of the receipt.
--
-- PREFER A CODE REVERT. The Governor is gated behind RunnerFlag.enabled, which
-- defaults to false, so reverting the application code disables the entire
-- feature with no data loss at all. Reach for this file only if the schema
-- itself must go — and take a backup of both tables first:
--
--   CREATE TABLE runner_flags_backup AS SELECT * FROM runner_flags;
--   CREATE TABLE model_eval_receipts_backup AS SELECT * FROM model_eval_receipts;
--
-- Founder-gated, like the forward migration. An agent never runs this.

-- 1. New tables.
DROP TABLE IF EXISTS "model_eval_receipts";
DROP TABLE IF EXISTS "runner_flags";

-- 2. org_budget_policies column.
ALTER TABLE "org_budget_policies" DROP COLUMN IF EXISTS "provider_daily_ceilings_usd";

-- 3. pipeline_cost_ledger indexes, then columns.
DROP INDEX IF EXISTS "pipeline_cost_ledger_outcome_created_at_idx";
DROP INDEX IF EXISTS "pipeline_cost_ledger_provider_created_at_idx";

ALTER TABLE "pipeline_cost_ledger" DROP COLUMN IF EXISTS "provenance";
ALTER TABLE "pipeline_cost_ledger" DROP COLUMN IF EXISTS "outcome";
ALTER TABLE "pipeline_cost_ledger" DROP COLUMN IF EXISTS "runner";
ALTER TABLE "pipeline_cost_ledger" DROP COLUMN IF EXISTS "brand_slug";
ALTER TABLE "pipeline_cost_ledger" DROP COLUMN IF EXISTS "provider";
