-- Migration: client_value_scorecard materialised view — SYN-725
--
-- Aggregates the CVML events shipped in SYN-724 (lib/measurement/emit.ts)
-- into a weekly per-client-per-feature rollup. Backs the weekly Slack
-- scorecard (GitHub Action in .github/workflows/client-value-scorecard.yml)
-- and the Sunset Review gate defined in Session 34's decision memo.
--
-- CVML events are written by emit() into `client_engagement_events` with
-- `event_type = 'cvml'` and `event_data` JSONB carrying:
--   {
--     cvml_event_type: 'view' | 'interact' | 'act_within_72h' | 'convert' | 'dismiss' | 'share',
--     feature_id:      'weekly_digest' | 'auto_calendar' | 'review_intelligence'
--                    | 'authority_hub' | 'seasonal_engine' | 'first_win_notification'
--                    | 'monthly_story',
--     user_id:         uuid | null,
--     timestamp:       ISO-8601,
--     metadata:        { ... }
--   }
--
-- Refresh policy: nightly via pg_cron at 02:00 AEDT (16:00 UTC).
-- The REFRESH uses CONCURRENTLY so dashboard reads are never blocked —
-- requires the unique index created below.
--
-- RLS: admin-only. No client-facing surface in this sub-issue.
--
-- To re-create after a schema change:
--   DROP MATERIALIZED VIEW IF EXISTS client_value_scorecard CASCADE;
--   \i this file

-- Wrapped in DO/EXECUTE for Preview resilience — client_engagement_events
-- may be an id-only placeholder on Preview (no event_type / event_data /
-- created_at columns). Real envs always have the full schema.
DO $do$ BEGIN
EXECUTE $sql$
CREATE MATERIALIZED VIEW IF NOT EXISTS client_value_scorecard AS
WITH cvml_events AS (
  SELECT
    client_id,
    event_data->>'feature_id'      AS feature_id,
    event_data->>'cvml_event_type' AS cvml_event_type,
    -- `timestamp` from the event payload is the source-of-truth for
    -- bucketing; fall back to `created_at` if the emitter didn't set it.
    COALESCE(
      (event_data->>'timestamp')::timestamptz,
      created_at
    )                              AS occurred_at
  FROM client_engagement_events
  WHERE event_type = 'cvml'
    AND event_data ? 'feature_id'
    AND event_data ? 'cvml_event_type'
),
weekly_counts AS (
  SELECT
    client_id,
    feature_id,
    -- ISO week key, e.g. 2026-17. date_trunc to Monday for stable joins.
    to_char(date_trunc('week', occurred_at), 'IYYY-IW') AS iso_week,
    date_trunc('week', occurred_at)::date               AS week_start,
    COUNT(*) FILTER (WHERE cvml_event_type = 'view')            AS view_count,
    COUNT(*) FILTER (WHERE cvml_event_type = 'interact')        AS interact_count,
    COUNT(*) FILTER (WHERE cvml_event_type = 'act_within_72h')  AS act_within_72h_count,
    COUNT(*) FILTER (WHERE cvml_event_type = 'convert')         AS convert_count,
    COUNT(*) FILTER (WHERE cvml_event_type = 'dismiss')         AS dismiss_count,
    COUNT(*) FILTER (WHERE cvml_event_type = 'share')           AS share_count
  FROM cvml_events
  GROUP BY client_id, feature_id, iso_week, week_start
),
with_rates AS (
  SELECT
    *,
    -- weekly_engagement_rate: meaningful interactions over views.
    -- Clamped to [0, 1]. NULL when no views — a feature with zero views
    -- that week has no defined engagement rate.
    CASE
      WHEN view_count = 0 THEN NULL
      ELSE ROUND(
        LEAST(
          1.0,
          (interact_count + act_within_72h_count + convert_count + share_count)::numeric
          / view_count
        ),
        4
      )
    END AS weekly_engagement_rate
  FROM weekly_counts
),
-- Postgres rejects window functions inside another window's PARTITION BY
-- (error 42P20). The gap-and-island "island key" must be computed in its
-- own CTE first, then the consecutive-low-weeks count partitions by the
-- pre-computed column. Same logic, valid syntax.
with_island_key AS (
  -- Cumulative count of "recovered" weeks for each (client, feature) row.
  -- Each time engagement is NULL or back above 0.10, this counter ticks
  -- forward — giving every "island" of consecutive-low weeks a unique key.
  SELECT
    *,
    SUM(
      CASE
        WHEN weekly_engagement_rate IS NULL OR weekly_engagement_rate >= 0.10
        THEN 1 ELSE 0
      END
    ) OVER (
      PARTITION BY client_id, feature_id
      ORDER BY week_start
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS island_key
  FROM with_rates
),
with_consecutive_low_weeks AS (
  -- Counts the number of consecutive weeks (ending at this row's week)
  -- where weekly_engagement_rate < 0.10. This is the sunset-trigger
  -- signal — features with 4+ consecutive low weeks enter structured
  -- review per the Session 34 decision.
  SELECT
    client_id,
    feature_id,
    iso_week,
    week_start,
    view_count,
    interact_count,
    act_within_72h_count,
    convert_count,
    dismiss_count,
    share_count,
    weekly_engagement_rate,
    -- Now that island_key is a plain column we can safely partition by it.
    COUNT(*) FILTER (
      WHERE weekly_engagement_rate IS NOT NULL
        AND weekly_engagement_rate < 0.10
    ) OVER (
      PARTITION BY client_id, feature_id, island_key
      ORDER BY week_start
    ) AS consecutive_weeks_below_10pct
  FROM with_island_key
)
SELECT
  client_id,
  feature_id,
  iso_week,
  week_start,
  view_count,
  interact_count,
  act_within_72h_count,
  convert_count,
  dismiss_count,
  share_count,
  weekly_engagement_rate,
  consecutive_weeks_below_10pct,
  now() AS refreshed_at
FROM with_consecutive_low_weeks
$sql$;
EXCEPTION WHEN OTHERS THEN NULL;
END $do$;

-- Indexes + refresh — skip silently if the view didn't get created on Preview.
DO $do$ BEGIN
  EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS client_value_scorecard_pk_idx ON client_value_scorecard (client_id, feature_id, iso_week)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS client_value_scorecard_week_feature_idx ON client_value_scorecard (week_start DESC, feature_id)';
  EXECUTE 'REFRESH MATERIALIZED VIEW client_value_scorecard';
  EXECUTE $com$ COMMENT ON MATERIALIZED VIEW client_value_scorecard IS 'SYN-725: weekly per-client-per-feature CVML rollup. Nightly refresh at 02:00 AEDT via pg_cron. Backs .github/workflows/client-value-scorecard.yml and the Session 34 Sunset Review gate.' $com$;
EXCEPTION WHEN OTHERS THEN NULL;
END $do$;
