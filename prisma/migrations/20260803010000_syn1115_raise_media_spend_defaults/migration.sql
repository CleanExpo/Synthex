-- SYN-1115 (founder ruling 2026-08-03, ruling 3) — raise the per-organisation
-- media spend defaults from $5/day and $25/month to $15/day and $75/month.
--
-- Why: admission reserves the WORST CASE a variant can spend, which is roughly
-- 3x typical. The standard ranking flow sends variants: 3 and holds ~$6.24,
-- so a default-quota organisation was refused before spending anything real.
-- The raise is the bridge; per-attempt admission (SYN-1125) is the fix.
--
-- DEFAULT ONLY. Existing rows are deliberately NOT updated: their current
-- values were chosen per organisation, and re-pointing them is a production
-- money decision that belongs to the SYN-1122 cutover runbook, not to a
-- migration that ships with a feature branch.
ALTER TABLE "organization_video_quotas"
  ALTER COLUMN "daily_budget_usd" SET DEFAULT 15;

ALTER TABLE "organization_video_quotas"
  ALTER COLUMN "monthly_budget_usd" SET DEFAULT 75;
