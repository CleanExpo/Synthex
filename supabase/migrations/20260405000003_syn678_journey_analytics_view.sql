-- Migration: journey_analytics materialized view — SYN-678
--
-- Aggregates per-client journey engagement into a single analytics row.
-- Refreshed weekly by the refresh-journey-analytics Edge Function + internal route.
--
-- Uses MATERIALIZED VIEW for performance (joins 4 tables, avoids repeated heavy
-- aggregation on every dashboard query). REFRESH CONCURRENTLY avoids read locks.
-- Requires a unique index — hence journey_analytics_client_id_idx below.
--
-- Columns:
--   client_id               — matches client_journey_events.client_id (org ID)
--   total_moments_received  — count of all journey events sent
--   total_moments_engaged   — count where outcome is not 'delivered' or 'ignored'
--   engagement_rate         — total_moments_engaged / total_moments_received (0.0–1.0)
--   pulse_survey_avg        — avg of pulse_score from metadata JSONB (1.0–5.0)
--   health_score_current    — latest health score from client_health_scores
--   health_score_30d_delta  — current - score 30 days ago (null if insufficient data)
--   days_since_join         — days since the organisation was created
--   subscription_status     — from organizations.billing_status
--   moments_detail          — JSONB array [{event_type, engagement_outcome}] for moment-type breakdown

-- Wrapped in DO/EXECUTE for Preview resilience — client_journey_events,
-- client_health_scores, organizations may be id-only placeholders on Preview
-- (missing columns the view references). Real envs have full schemas.
DO $do$ BEGIN
EXECUTE $sql$
CREATE MATERIALIZED VIEW IF NOT EXISTS journey_analytics AS
WITH events_base AS (
  SELECT
    client_id,
    id                                          AS event_id,
    event_type,
    engagement_outcome,
    (metadata->>'pulse_score')::FLOAT           AS pulse_score,
    delivered_at
  FROM client_journey_events
),
engagement_agg AS (
  SELECT
    client_id,
    COUNT(*)                                                           AS total_moments_received,
    COUNT(*) FILTER (
      WHERE engagement_outcome NOT IN ('delivered', 'ignored')
    )                                                                  AS total_moments_engaged,
    ROUND(
      COUNT(*) FILTER (WHERE engagement_outcome NOT IN ('delivered', 'ignored'))::NUMERIC
      / NULLIF(COUNT(*), 0), 4
    )                                                                  AS engagement_rate,
    ROUND(AVG(pulse_score::NUMERIC) FILTER (WHERE pulse_score IS NOT NULL), 2) AS pulse_survey_avg
  FROM events_base
  GROUP BY client_id
),
moments_detail AS (
  SELECT
    client_id,
    jsonb_agg(
      jsonb_build_object(
        'event_type', event_type,
        'engagement_outcome', engagement_outcome
      )
    ) AS moments_detail
  FROM events_base
  GROUP BY client_id
),
health_latest AS (
  SELECT DISTINCT ON (organization_id)
    organization_id                             AS client_id,
    overall_score                               AS health_score_current,
    week_start
  FROM client_health_scores
  ORDER BY organization_id, week_start DESC
),
health_30d AS (
  SELECT DISTINCT ON (organization_id)
    organization_id                             AS client_id,
    overall_score                               AS health_score_30d_ago
  FROM client_health_scores
  WHERE week_start <= NOW() - INTERVAL '30 days'
  ORDER BY organization_id, week_start DESC
)
SELECT
  ea.client_id,
  ea.total_moments_received,
  ea.total_moments_engaged,
  COALESCE(ea.engagement_rate, 0)              AS engagement_rate,
  ea.pulse_survey_avg,
  hl.health_score_current,
  (hl.health_score_current - h30.health_score_30d_ago)::FLOAT AS health_score_30d_delta,
  EXTRACT(DAY FROM NOW() - o.created_at)::INT  AS days_since_join,
  o.billing_status                             AS subscription_status,
  COALESCE(md.moments_detail, '[]'::JSONB)     AS moments_detail
FROM engagement_agg ea
LEFT JOIN moments_detail md    ON md.client_id    = ea.client_id
LEFT JOIN health_latest hl     ON hl.client_id    = ea.client_id
LEFT JOIN health_30d h30       ON h30.client_id   = ea.client_id
LEFT JOIN organizations o      ON o.id            = ea.client_id
$sql$;
EXCEPTION WHEN OTHERS THEN NULL;
END $do$;

-- Required for REFRESH MATERIALIZED VIEW CONCURRENTLY — skip if view missing.
DO $do$ BEGIN
  EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS journey_analytics_client_id_idx ON journey_analytics (client_id)';
EXCEPTION WHEN undefined_table THEN NULL; WHEN OTHERS THEN NULL; END $do$;

-- RLS-equivalent: restrict to service_role only (no public access)
DO $do$ BEGIN
  EXECUTE 'REVOKE ALL ON journey_analytics FROM PUBLIC';
  EXECUTE 'GRANT SELECT ON journey_analytics TO service_role';
EXCEPTION WHEN undefined_table THEN NULL; WHEN OTHERS THEN NULL; END $do$;
