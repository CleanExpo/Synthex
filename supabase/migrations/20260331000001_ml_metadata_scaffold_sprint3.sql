-- SYN-583: ML Metadata Scaffold — Sprint 3 tables
-- Applied to production (znyjoyjsvjotlzjppzal) on 2026-03-31.
--
-- Adds 4 ML-ready fields to all Sprint 3 data tables.
-- These fields enable Sprint 5 Predictive Content Intelligence engine
-- by accumulating 6+ months of clean training data from Day 1.
--
-- Fields:
--   predicted_engagement     FLOAT     — raw predicted engagement (populated by Sprint 5 inference)
--   confidence_score         FLOAT     — model confidence 0.0–1.0
--   cross_client_percentile_industry  INTEGER  — 0–100 percentile within same industry cohort
--   feature_tags             TEXT[]    — signal labels used as ML model input features
--
-- NOTE: seasonal_signals already has confidence_score as INTEGER (domain-specific signal
-- confidence, NOT ML confidence). ADD COLUMN IF NOT EXISTS skips it safely.
-- ML confidence for seasonal_signals is captured via predicted_engagement + percentile.
--
-- After applying: npx supabase gen types typescript --project-id znyjoyjsvjotlzjppzal > types/supabase.ts

-- ── posts ──────────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.posts
  ADD COLUMN IF NOT EXISTS predicted_engagement FLOAT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS confidence_score FLOAT DEFAULT NULL
    CHECK (confidence_score IS NULL OR (confidence_score >= 0.0 AND confidence_score <= 1.0)),
  ADD COLUMN IF NOT EXISTS cross_client_percentile_industry INTEGER DEFAULT NULL
    CHECK (cross_client_percentile_industry IS NULL OR (cross_client_percentile_industry >= 0 AND cross_client_percentile_industry <= 100)),
  ADD COLUMN IF NOT EXISTS feature_tags TEXT[] NOT NULL DEFAULT '{}';

-- ── calendar_posts ─────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.calendar_posts
  ADD COLUMN IF NOT EXISTS predicted_engagement FLOAT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS confidence_score FLOAT DEFAULT NULL
    CHECK (confidence_score IS NULL OR (confidence_score >= 0.0 AND confidence_score <= 1.0)),
  ADD COLUMN IF NOT EXISTS cross_client_percentile_industry INTEGER DEFAULT NULL
    CHECK (cross_client_percentile_industry IS NULL OR (cross_client_percentile_industry >= 0 AND cross_client_percentile_industry <= 100)),
  ADD COLUMN IF NOT EXISTS feature_tags TEXT[] NOT NULL DEFAULT '{}';

-- ── gbp_reviews ────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.gbp_reviews
  ADD COLUMN IF NOT EXISTS predicted_engagement FLOAT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS confidence_score FLOAT DEFAULT NULL
    CHECK (confidence_score IS NULL OR (confidence_score >= 0.0 AND confidence_score <= 1.0)),
  ADD COLUMN IF NOT EXISTS cross_client_percentile_industry INTEGER DEFAULT NULL
    CHECK (cross_client_percentile_industry IS NULL OR (cross_client_percentile_industry >= 0 AND cross_client_percentile_industry <= 100)),
  ADD COLUMN IF NOT EXISTS feature_tags TEXT[] NOT NULL DEFAULT '{}';

-- ── seasonal_signals ───────────────────────────────────────────────────────
-- confidence_score already exists as INTEGER (domain-specific) — skipped by IF NOT EXISTS
ALTER TABLE IF EXISTS public.seasonal_signals
  ADD COLUMN IF NOT EXISTS predicted_engagement FLOAT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS confidence_score FLOAT DEFAULT NULL
    CHECK (confidence_score IS NULL OR (confidence_score >= 0.0 AND confidence_score <= 1.0)),
  ADD COLUMN IF NOT EXISTS cross_client_percentile_industry INTEGER DEFAULT NULL
    CHECK (cross_client_percentile_industry IS NULL OR (cross_client_percentile_industry >= 0 AND cross_client_percentile_industry <= 100)),
  ADD COLUMN IF NOT EXISTS feature_tags TEXT[] NOT NULL DEFAULT '{}';

-- ── authority_scores ───────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.authority_scores
  ADD COLUMN IF NOT EXISTS predicted_engagement FLOAT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS confidence_score FLOAT DEFAULT NULL
    CHECK (confidence_score IS NULL OR (confidence_score >= 0.0 AND confidence_score <= 1.0)),
  ADD COLUMN IF NOT EXISTS cross_client_percentile_industry INTEGER DEFAULT NULL
    CHECK (cross_client_percentile_industry IS NULL OR (cross_client_percentile_industry >= 0 AND cross_client_percentile_industry <= 100)),
  ADD COLUMN IF NOT EXISTS feature_tags TEXT[] NOT NULL DEFAULT '{}';

-- ── autopilot_runs ─────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.autopilot_runs
  ADD COLUMN IF NOT EXISTS predicted_engagement FLOAT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS confidence_score FLOAT DEFAULT NULL
    CHECK (confidence_score IS NULL OR (confidence_score >= 0.0 AND confidence_score <= 1.0)),
  ADD COLUMN IF NOT EXISTS cross_client_percentile_industry INTEGER DEFAULT NULL
    CHECK (cross_client_percentile_industry IS NULL OR (cross_client_percentile_industry >= 0 AND cross_client_percentile_industry <= 100)),
  ADD COLUMN IF NOT EXISTS feature_tags TEXT[] NOT NULL DEFAULT '{}';

-- ── Indexes for Sprint 5 ML query patterns ────────────────────────────────
DO $$ BEGIN
  IF to_regclass('public.posts') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_posts_ml_engagement
      ON public.posts (predicted_engagement) WHERE predicted_engagement IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_posts_ml_percentile
      ON public.posts (cross_client_percentile_industry) WHERE cross_client_percentile_industry IS NOT NULL;
  END IF;

  IF to_regclass('public.calendar_posts') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_calendar_posts_ml_engagement
      ON public.calendar_posts (predicted_engagement) WHERE predicted_engagement IS NOT NULL;
  END IF;

  IF to_regclass('public.gbp_reviews') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_gbp_reviews_ml_engagement
      ON public.gbp_reviews (predicted_engagement) WHERE predicted_engagement IS NOT NULL;
  END IF;

  IF to_regclass('public.authority_scores') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_authority_scores_ml_percentile
      ON public.authority_scores (cross_client_percentile_industry) WHERE cross_client_percentile_industry IS NOT NULL;
  END IF;
END $$;
