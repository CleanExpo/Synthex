-- AddColumn: attribution_context to recommended_actions — SYN-623
-- Additive-only: nullable JSONB with default, no destructive changes.

ALTER TABLE "recommended_actions"
  ADD COLUMN "attribution_context" JSONB DEFAULT '{}';
