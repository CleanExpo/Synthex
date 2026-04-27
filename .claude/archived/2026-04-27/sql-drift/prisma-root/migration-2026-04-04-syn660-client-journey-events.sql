-- ============================================================
-- SYN-660: Client Journey Events — Orchestration Infrastructure
-- Applied: 2026-04-04
--
-- What this does:
--   1. Creates `client_journey_events` table — source of truth for all
--      Sprint 6 journey touchpoints
--   2. RLS: service_role INSERT + UPDATE; clients SELECT own records
--   3. `should_deliver_journey_event(p_client_id, p_event_type)` RPC
--      — 14-day throttle for major moments (excludes monthly_story)
--   4. `quarterly_review_ready(p_client_id)` RPC
--      — checks 5 data availability conditions, returns 0-5 count
--
-- Build this BEFORE SYN-661 (30-Day Check-In) and SYN-662 (Quarterly Review).
-- ============================================================

-- ── client_journey_events ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS client_journey_events (
  id           UUID NOT NULL DEFAULT gen_random_uuid(),
  client_id    TEXT NOT NULL,
  event_type   TEXT NOT NULL,
  delivered_at TIMESTAMPTZ NOT NULL,
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT client_journey_events_pkey PRIMARY KEY (id),
  CONSTRAINT client_journey_events_type_check
    CHECK (event_type IN (
      'personalisation_activated',
      'win_notification',
      'geo_score_introduced',
      'thirty_day_check_in',
      'quarterly_milestone_review',
      'monthly_story'
    ))
);

CREATE INDEX IF NOT EXISTS client_journey_events_client_type_delivered
  ON client_journey_events (client_id, event_type, delivered_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE client_journey_events ENABLE ROW LEVEL SECURITY;

-- Service role: full access (all pipeline writes)
DROP POLICY IF EXISTS "service_role_all_journey_events" ON client_journey_events;
CREATE POLICY "service_role_all_journey_events"
  ON client_journey_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Clients: SELECT their own records (future client portal)
DROP POLICY IF EXISTS "client_select_own_journey_events" ON client_journey_events;
CREATE POLICY "client_select_own_journey_events"
  ON client_journey_events
  FOR SELECT
  USING (client_id = auth.uid()::text);

-- ── should_deliver_journey_event RPC ─────────────────────────────────────────
-- Returns TRUE if no major journey event was delivered for this client in the
-- last 14 days. monthly_story events do NOT count toward the 14-day window.
--
-- Priority ranking (callers must enforce when multiple events eligible):
--   quarterly_milestone_review > geo_score_introduced > thirty_day_check_in
--   > win_notification > personalisation_activated

CREATE OR REPLACE FUNCTION should_deliver_journey_event(
  p_client_id TEXT,
  p_event_type TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM client_journey_events
    WHERE client_id = p_client_id
      AND event_type != 'monthly_story'
      AND delivered_at > NOW() - INTERVAL '14 days'
  );
$$;

-- ── quarterly_review_ready RPC ─────────────────────────────────────────────────
-- Returns count (0–5) of data availability conditions met.
-- Callers gate on >= 3 before triggering the Quarterly Milestone Review send.
--
-- Conditions:
--   1. Synthex IQ: at least 1 published post for this client
--   2. GEO Score: client_geo_scores has >= 4 weekly data points
--   3. Content Intelligence: content_performance_profiles row count >= 8
--   4. Attribution: recommended_actions has >= 1 row with confidence >= 0.80
--   5. Authority Score: authority_scores has >= 2 rows (allows month-on-month delta)

CREATE OR REPLACE FUNCTION quarterly_review_ready(
  p_client_id TEXT
)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT (
    -- 1. Posts table: at least 1 published post
    (EXISTS (
      SELECT 1 FROM posts p
      JOIN campaigns c ON p.campaign_id = c.id
      JOIN organizations o ON c.organization_id = o.id
      WHERE o.id = p_client_id
        AND p.status = 'published'
    ))::int

    -- 2. GEO Score: >= 4 weekly data points in client_geo_scores
    + (
      (SELECT COUNT(*) FROM client_geo_scores WHERE client_id = p_client_id) >= 4
    )::int

    -- 3. Content Intelligence: >= 8 content_performance_profiles rows
    + (
      (SELECT COUNT(*) FROM content_performance_profiles WHERE organization_id = p_client_id) >= 8
    )::int

    -- 4. Attribution confidence: at least 1 recommended_action with confidence >= 0.80
    + (EXISTS (
      SELECT 1 FROM recommended_actions ra
      WHERE ra.organization_id = p_client_id
        AND (ra.result_summary->>'attribution_confidence')::numeric >= 0.80
    ))::int

    -- 5. Authority Score: >= 2 rows for month-on-month delta
    + (
      (SELECT COUNT(*) FROM authority_scores WHERE client_id = p_client_id) >= 2
    )::int
  );
$$;
