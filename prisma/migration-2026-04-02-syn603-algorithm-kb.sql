-- ============================================================
-- SYN-603: Algorithm Knowledge Base foundation tables
-- Applied: 2026-04-02
--
-- What this does:
--   1. platform_algorithms — canonical platform + last_verified metadata
--   2. ranking_signals — individual signals with category + weight tier
--   3. signal_weights — per-platform weight assignments
--   4. source_provenance — tracks evidence chain for each signal
--
-- Safety:
--   - All tables use IF NOT EXISTS
--   - All new columns nullable or have defaults
--   - No destructive operations
-- ============================================================

-- ── 1. platform_algorithms ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_algorithms (
  id                  TEXT        NOT NULL DEFAULT gen_random_uuid()::text PRIMARY KEY,
  platform            TEXT        NOT NULL,  -- e.g. 'google_search', 'instagram', 'linkedin'
  surface             TEXT,                  -- e.g. 'reels', 'feed', 'explore' — null = platform-wide
  algorithm_name      TEXT        NOT NULL,
  description         TEXT,
  last_verified_date  DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT platform_algorithms_platform_surface_unique UNIQUE (platform, surface)
);

CREATE INDEX IF NOT EXISTS idx_platform_algorithms_platform ON platform_algorithms(platform);

-- ── 2. ranking_signals ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ranking_signals (
  id                  TEXT        NOT NULL DEFAULT gen_random_uuid()::text PRIMARY KEY,
  platform_id         TEXT        NOT NULL REFERENCES platform_algorithms(id) ON DELETE CASCADE,
  signal_name         TEXT        NOT NULL,
  category            TEXT        NOT NULL,  -- CQ, EV, UB, AT, TK, FR, DS, PS
  confidence_level    TEXT        NOT NULL,  -- CONFIRMED, LEAKED, INFERRED, SPECULATIVE
  weight_tier         TEXT        NOT NULL DEFAULT 'unknown',  -- critical, strong, moderate, minor, unknown
  description         TEXT,
  implication         TEXT,
  last_verified_date  DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ranking_signals_platform_name_unique UNIQUE (platform_id, signal_name),
  CONSTRAINT ranking_signals_category_check CHECK (
    category IN ('CQ', 'EV', 'UB', 'AT', 'TK', 'FR', 'DS', 'PS')
  ),
  CONSTRAINT ranking_signals_confidence_check CHECK (
    confidence_level IN ('CONFIRMED', 'LEAKED', 'INFERRED', 'SPECULATIVE')
  ),
  CONSTRAINT ranking_signals_weight_check CHECK (
    weight_tier IN ('critical', 'strong', 'moderate', 'minor', 'unknown')
  )
);

CREATE INDEX IF NOT EXISTS idx_ranking_signals_platform ON ranking_signals(platform_id);
CREATE INDEX IF NOT EXISTS idx_ranking_signals_confidence ON ranking_signals(confidence_level);
CREATE INDEX IF NOT EXISTS idx_ranking_signals_category ON ranking_signals(category);

-- ── 3. signal_weights ──────────────────────────────────────────────────────────
-- Allows per-surface weight overrides (e.g. watch_time is critical on Reels but
-- less relevant on Stories)
CREATE TABLE IF NOT EXISTS signal_weights (
  id                  TEXT        NOT NULL DEFAULT gen_random_uuid()::text PRIMARY KEY,
  signal_id           TEXT        NOT NULL REFERENCES ranking_signals(id) ON DELETE CASCADE,
  surface             TEXT,                  -- null = applies to all surfaces
  weight_tier         TEXT        NOT NULL DEFAULT 'unknown',
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT signal_weights_confidence_check CHECK (
    weight_tier IN ('critical', 'strong', 'moderate', 'minor', 'unknown')
  )
);

CREATE INDEX IF NOT EXISTS idx_signal_weights_signal ON signal_weights(signal_id);

-- ── 4. source_provenance ────────────────────────────────────────────────────────
-- Tracks the evidence chain for each signal's confidence rating
CREATE TABLE IF NOT EXISTS source_provenance (
  id                  TEXT        NOT NULL DEFAULT gen_random_uuid()::text PRIMARY KEY,
  signal_id           TEXT        NOT NULL REFERENCES ranking_signals(id) ON DELETE CASCADE,
  source_type         TEXT        NOT NULL,  -- 'official_statement', 'leaked_doc', 'corroborating', 'academic'
  source_name         TEXT        NOT NULL,
  source_url          TEXT,
  source_date         DATE,
  excerpt             TEXT,
  confidence_level    TEXT        NOT NULL DEFAULT 'INFERRED',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT source_provenance_type_check CHECK (
    source_type IN ('official_statement', 'leaked_doc', 'corroborating', 'academic')
  ),
  CONSTRAINT source_provenance_confidence_check CHECK (
    confidence_level IN ('CONFIRMED', 'LEAKED', 'INFERRED', 'SPECULATIVE')
  )
);

CREATE INDEX IF NOT EXISTS idx_source_provenance_signal ON source_provenance(signal_id);

-- ── Seed: platform_algorithms rows ────────────────────────────────────────────
INSERT INTO platform_algorithms (platform, surface, algorithm_name, description, last_verified_date)
VALUES
  ('google_search', NULL,     'Google Core Web Ranking',   'Google''s primary web search ranking system — 200+ signals', '2026-04-01'),
  ('instagram',     'reels',  'Instagram Reels Algorithm', 'Instagram Reels distribution ranking — watch_time + sends primary signals', '2026-04-01'),
  ('instagram',     'feed',   'Instagram Feed Algorithm',  'Instagram Feed ranking — relationship + interest + recency', '2026-04-01'),
  ('instagram',     'stories','Instagram Stories Algorithm','Instagram Stories ranking — completion rate + tap-forward', '2026-04-01'),
  ('instagram',     'explore','Instagram Explore Algorithm','Instagram Explore distribution — account velocity + topic relevance', '2026-04-01'),
  ('linkedin',      'feed',   'LinkedIn Feed Algorithm',   'LinkedIn 4-stage ranking pipeline — consumption_rate + early engagement', '2026-04-01'),
  ('linkedin',      'search', 'LinkedIn Search Algorithm', 'LinkedIn Search — profile completeness + keyword in headline', '2026-04-01')
ON CONFLICT (platform, surface) DO NOTHING;

-- Report
DO $$
DECLARE
  platform_count integer;
BEGIN
  SELECT COUNT(*) INTO platform_count FROM platform_algorithms;
  RAISE NOTICE 'SYN-603: % platform_algorithm rows now present.', platform_count;
END $$;
