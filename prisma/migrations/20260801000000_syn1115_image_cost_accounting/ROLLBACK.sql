-- Rollback for 20260801000000_syn1115_image_cost_accounting (SYN-1115).
--
-- Reverses the forward migration exactly. Dropping the two cost columns
-- discards recorded spend for any generation made while they existed, so
-- export first if that history matters:
--
--   COPY (SELECT id, organization_id, estimated_cost_usd, actual_cost_usd, created_at
--         FROM public.image_generations
--         WHERE actual_cost_usd IS NOT NULL)
--   TO '/tmp/image_cost_backup.csv' CSV HEADER;

ALTER TABLE "image_generations" ALTER COLUMN "organization_id" DROP NOT NULL;
ALTER TABLE "image_generations" DROP COLUMN IF EXISTS "estimated_cost_usd";
ALTER TABLE "image_generations" DROP COLUMN IF EXISTS "actual_cost_usd";
