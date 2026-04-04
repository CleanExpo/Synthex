-- ============================================================
-- SYN-664: Content Score History
-- Applied: 2026-04-04
--
-- What this does:
--   1. Creates `content_score_history` table — weekly content score snapshot
--      per organisation, parallel to `client_health_scores`
--   2. RLS: service_role full access; clients SELECT own records
--
-- Score range: 0–100 integer.
-- Components (stored in JSONB):
--   {
--     data_availability:  0–40  (confidenceLevel × 40)
--     engagement_lift:    0–40  (improvement_rate normalised; 20 = no change baseline)
--     volume_bonus:       0–20  (min(postCount / 5, 20))
--   }
--
-- Build this BEFORE SYN-665 (ContentScoreCard UI) and SYN-666 (AI Advisor wire-in).
-- ============================================================

-- ── content_score_history ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS content_score_history (
  id              UUID        NOT NULL DEFAULT gen_random_uuid(),
  organization_id TEXT        NOT NULL,
  week_start      DATE        NOT NULL,
  score           INTEGER     NOT NULL,
  delta           INTEGER     NOT NULL DEFAULT 0,
  components      JSONB       NOT NULL DEFAULT '{}',
  data_points     INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT content_score_history_pkey PRIMARY KEY (id),
  CONSTRAINT content_score_history_score_check CHECK (score >= 0 AND score <= 100)
);

-- One score per org per week
CREATE UNIQUE INDEX IF NOT EXISTS content_score_history_org_week
  ON content_score_history (organization_id, week_start);

-- Fast lookup: latest score for an org
CREATE INDEX IF NOT EXISTS content_score_history_org_created
  ON content_score_history (organization_id, created_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE content_score_history ENABLE ROW LEVEL SECURITY;

-- Service role: full access (all pipeline writes)
DROP POLICY IF EXISTS "service_role_all_content_score_history" ON content_score_history;
CREATE POLICY "service_role_all_content_score_history"
  ON content_score_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Clients: SELECT their own records
DROP POLICY IF EXISTS "client_select_own_content_score_history" ON content_score_history;
CREATE POLICY "client_select_own_content_score_history"
  ON content_score_history
  FOR SELECT
  USING (organization_id = auth.uid()::text);
