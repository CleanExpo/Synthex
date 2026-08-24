-- SYN-656: client_geo_scores — Monthly GEO citation score history per client organisation
--
-- Stores the normalised GEO score (0–100) for each client organisation on a monthly basis.
-- Score is derived from GEO dark run data: AI search engine queries are run against the
-- client's content and the citation rate across platforms is normalised to 0–100.
--
-- Trend direction (up/down/stable) is computed by comparing the current month's score
-- to the previous month's score stored in this table.

CREATE TABLE client_geo_scores (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      text        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  score          integer     NOT NULL CHECK (score >= 0 AND score <= 100),
  score_breakdown jsonb      NOT NULL DEFAULT '{}',
  trend          text        NOT NULL DEFAULT 'stable' CHECK (trend IN ('up', 'down', 'stable')),
  trend_delta    integer     NOT NULL DEFAULT 0,
  month          date        NOT NULL,  -- first day of the month (e.g. 2026-04-01)
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, month)
);

-- RLS: Synthex uses a custom JWT (not Supabase Auth), so all access goes through the
-- service_role. No authenticated-user policy is needed here — the application layer
-- enforces org-scoping before inserting or reading scores.
ALTER TABLE client_geo_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all"
  ON client_geo_scores
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Indexes for the two most common query patterns:
--   1. "Fetch all scores for a given client" (latest first)
--   2. "Fetch all clients ordered by most recent score month"
CREATE INDEX idx_client_geo_scores_client_id ON client_geo_scores(client_id);
CREATE INDEX idx_client_geo_scores_month     ON client_geo_scores(month DESC);
