-- SYN-610 / SYN-611 / SYN-612: Client Health Score + Engagement Telemetry
-- Date: 2026-04-02
-- Additive only — no DROPs, no column modifications.

-- ----------------------------------------------------------------------------
-- client_health_scores: weekly marketing health score per organisation
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS client_health_scores (
  id              TEXT        NOT NULL DEFAULT gen_random_uuid()::text PRIMARY KEY,
  organization_id TEXT        NOT NULL,
  week_start      DATE        NOT NULL,
  overall_score   INTEGER     NOT NULL,
  dimensions      JSONB       NOT NULL,
  score_delta     INTEGER     NOT NULL DEFAULT 0,
  risk_level      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT client_health_score_org_week UNIQUE (organization_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_chs_org      ON client_health_scores (organization_id);
CREATE INDEX IF NOT EXISTS idx_chs_week     ON client_health_scores (week_start);
CREATE INDEX IF NOT EXISTS idx_chs_risk     ON client_health_scores (risk_level);

ALTER TABLE client_health_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_chs" ON client_health_scores
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- health_score_config: singleton config row for dimension weights
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS health_score_config (
  id         TEXT        NOT NULL DEFAULT gen_random_uuid()::text PRIMARY KEY,
  weights    JSONB       NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO health_score_config (weights)
SELECT '{
  "content_consistency": 0.25,
  "engagement_trajectory": 0.20,
  "review_responsiveness": 0.15,
  "authority_momentum": 0.15,
  "advisor_engagement": 0.15,
  "platform_usage": 0.10
}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM health_score_config);

ALTER TABLE health_score_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_hsc" ON health_score_config
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- client_engagement_events: dual-write telemetry (GA4 + Supabase)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS client_engagement_events (
  id         TEXT        NOT NULL DEFAULT gen_random_uuid()::text PRIMARY KEY,
  client_id  TEXT        NOT NULL,
  event_type TEXT        NOT NULL,
  event_data JSONB,
  page_path  TEXT,
  session_id TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cee_client_type_time ON client_engagement_events (client_id, event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_cee_client_time       ON client_engagement_events (client_id, created_at);

ALTER TABLE client_engagement_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_cee" ON client_engagement_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);
