-- Migration: score_accuracy_events + get_score_calibration RPC — SYN-669
-- Apply via: Supabase MCP apply_migration or dashboard SQL editor
-- Project: znyjoyjsvjotlzjppzal

-- ============================================================================
-- score_accuracy_events
-- ============================================================================
-- Tracks every score issued across all three scoring domains (content, geo,
-- health). Outcome fields are backfilled nightly by score-accuracy-matcher
-- (SYN-670). The CI accuracy gate reads from this table to block deployments
-- when prediction accuracy drops below domain thresholds.

CREATE TABLE IF NOT EXISTS score_accuracy_events (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Client (organisation) that received this score
  client_id               UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Scoring domain discriminant
  score_domain            TEXT        NOT NULL CHECK (score_domain IN ('content', 'geo', 'health')),

  -- The composite score value issued (0–100)
  score_value             INTEGER     NOT NULL CHECK (score_value >= 0 AND score_value <= 100),

  -- Confidence tier at time of issue
  confidence              TEXT        NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),

  -- Calibration data points at time of issue
  calibration_data_points INTEGER     NOT NULL DEFAULT 0,

  -- Domain-specific entity identifier for outcome look-up
  -- content/health: organization_id  |  geo: location_id or organization_id
  entity_id               TEXT        NOT NULL,

  -- When this score was delivered to the client
  issued_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Outcome fields — populated by score-accuracy-matcher (SYN-670)
  -- NULL = not yet measured (< 48 hours old or matcher hasn't run)
  outcome_value           NUMERIC,
  outcome_measured_at     TIMESTAMPTZ,

  -- ABS(predicted_percentile - actual_percentile) / 100
  -- Lower is better (0 = perfect prediction, 1 = worst possible)
  accuracy_delta          NUMERIC     CHECK (accuracy_delta IS NULL OR (accuracy_delta >= 0 AND accuracy_delta <= 1)),

  -- Sprint version for regression tracking (e.g. 'sprint-7')
  sprint_version          TEXT
);

-- Query pattern: fetch unmatched events per client + domain for the matcher
CREATE INDEX IF NOT EXISTS idx_score_accuracy_client_domain_issued
  ON score_accuracy_events (client_id, score_domain, issued_at DESC);

-- Query pattern: CI gate aggregation across all domains
CREATE INDEX IF NOT EXISTS idx_score_accuracy_domain_outcome
  ON score_accuracy_events (score_domain, outcome_measured_at)
  WHERE outcome_value IS NOT NULL;

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Service role only — clients never query this table directly.
-- Accuracy data is internal telemetry, not a client-facing product.

ALTER TABLE score_accuracy_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_score_accuracy"
  ON score_accuracy_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- get_score_calibration RPC
-- ============================================================================
-- Returns calibration state for a given client + domain.
-- Called by accuracy-ledger.ts → getScoreCalibration().
-- Reads only rows where outcome_value IS NOT NULL (i.e. matched events).

CREATE OR REPLACE FUNCTION get_score_calibration(
  p_client_id  UUID,
  p_domain     TEXT
)
RETURNS TABLE (
  data_points        INTEGER,
  accuracy_rate      NUMERIC,   -- fraction within 15 pct pts; NULL if no outcomes
  meets_threshold    BOOLEAN,
  threshold_required INTEGER,
  first_scored_at    TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH matched AS (
    SELECT
      accuracy_delta,
      issued_at
    FROM score_accuracy_events
    WHERE client_id   = p_client_id
      AND score_domain = p_domain
      AND outcome_value IS NOT NULL
  ),
  totals AS (
    SELECT
      COUNT(*)                                                          AS total,
      COUNT(*) FILTER (WHERE accuracy_delta < 0.15)                    AS within_threshold,
      MIN(issued_at)                                                    AS first_at
    FROM matched
  )
  SELECT
    totals.total::INTEGER                                               AS data_points,
    CASE
      WHEN totals.total = 0 THEN NULL
      ELSE ROUND(totals.within_threshold::NUMERIC / totals.total, 4)
    END                                                                 AS accuracy_rate,
    -- Domain calibration thresholds:  content=10  geo=5  health=8
    (totals.total >= CASE p_domain
                       WHEN 'content' THEN 10
                       WHEN 'geo'     THEN 5
                       WHEN 'health'  THEN 8
                       ELSE 10
                     END)                                               AS meets_threshold,
    CASE p_domain
      WHEN 'content' THEN 10
      WHEN 'geo'     THEN 5
      WHEN 'health'  THEN 8
      ELSE 10
    END                                                                 AS threshold_required,
    totals.first_at                                                     AS first_scored_at
  FROM totals;
$$;

COMMENT ON FUNCTION get_score_calibration IS
  'Returns calibration metrics for a client+domain scoring system. '
  'Used by accuracy-ledger.ts and ContentScoreCard to determine confidence tier.';

-- ============================================================================
-- get_accuracy_gate_summary RPC
-- ============================================================================
-- Used by the CI accuracy gate (accuracy-gate.yml) to evaluate per-domain
-- prediction accuracy across the last 30 days.

CREATE OR REPLACE FUNCTION get_accuracy_gate_summary()
RETURNS TABLE (
  score_domain          TEXT,
  total_scores          BIGINT,
  mean_accuracy_delta   NUMERIC,
  pct_within_15pct      NUMERIC   -- percentage (0–100) within 15 pct pts
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    score_domain,
    COUNT(*)                                                             AS total_scores,
    ROUND(AVG(accuracy_delta), 4)                                        AS mean_accuracy_delta,
    ROUND(
      COUNT(*) FILTER (WHERE accuracy_delta < 0.15) * 100.0 / COUNT(*),
      2
    )                                                                    AS pct_within_15pct
  FROM score_accuracy_events
  WHERE outcome_value IS NOT NULL
    AND issued_at > NOW() - INTERVAL '30 days'
  GROUP BY score_domain;
$$;

COMMENT ON FUNCTION get_accuracy_gate_summary IS
  'Aggregates prediction accuracy per scoring domain for the last 30 days. '
  'Used by the CI accuracy-gate GitHub Actions workflow (SYN-670).';
