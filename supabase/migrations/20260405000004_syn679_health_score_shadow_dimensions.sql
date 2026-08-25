-- Migration: shadow_dimensions column on client_health_scores — SYN-679
--
-- Adds a JSONB column to store shadow dimension scores that are computed
-- each Health Score cycle but NOT included in the composite overallScore
-- until promoted via the JOURNEY_DIMENSION_ACTIVE flag.
--
-- Shadow dimensions are logged for 4+ weekly cycles before promotion.
-- Promotion criteria: ≤20% of clients cross an intervention threshold
-- solely due to the journey_engagement signal.
--
-- Initial shadow dimensions structure:
--   {
--     "journey_engagement": {
--       "score": 0-100,
--       "raw_value": 0.0-1.0,   -- engagement rate from journey_analytics
--       "description": "string"
--     } | null
--   }

ALTER TABLE IF EXISTS client_health_scores
  ADD COLUMN IF NOT EXISTS shadow_dimensions JSONB DEFAULT NULL;
