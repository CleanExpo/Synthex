-- SYN-1115 — image generation cost accounting + org attribution
--
-- Adds the two cost columns ImageGeneration was missing (VideoGeneration has
-- carried them since the generative-video engine landed) and tightens
-- organization_id to NOT NULL so image spend always attributes to an org.
--
-- PRECONDITION — re-run this immediately before applying to any environment:
--
--   SELECT count(*) FROM public.image_generations WHERE organization_id IS NULL;
--
-- Founder-run against production 2026-08-01 returned 0. The SET NOT NULL below
-- will fail loudly (not silently corrupt) if that is ever untrue, which is the
-- intended behaviour — backfill first, never guess an owning org.
--
-- Rollback: see ROLLBACK.sql in this directory.

-- AlterTable
ALTER TABLE "image_generations" ADD COLUMN     "actual_cost_usd" DECIMAL(10,4),
ADD COLUMN     "estimated_cost_usd" DECIMAL(10,4),
ALTER COLUMN "organization_id" SET NOT NULL;
