-- Migration: client_value_scorecard view extension — SYN-730
--
-- Extends the SYN-725 materialised view to include journey moment rollups
-- alongside the existing feature rollups. New rows discriminated by the
-- `source_type` column ('feature' | 'journey_moment'). The view is rebuilt
-- in place — no schema changes to underlying tables.
--
-- Source of journey moment events:
--   `client_engagement_events` rows where `event_type = 'cvml'` AND
--   `event_data ? 'journey_moment_id'`. The journey moment context fields
--   (`journey_moment_id`, `journey_stage`) were added to the CVML event
--   schema in SYN-768 and are emitted by lib/measurement/emit.ts.
--
-- Existing feature rows continue to back the weekly Slack scorecard
-- (.github/workflows/client-value-scorecard.yml) and the Sunset Review
-- gate. Their schema is unchanged — they get `source_type = 'feature'`,
-- `moment_id = NULL`, `journey_stage = NULL`, `retention_correlation =
-- NULL`.
--
-- Refresh schedule: existing pg_cron job at 02:00 AEDT continues to cover
-- this view (SYN-725 set up the schedule by view name, not column shape).
--
-- Retention correlation: the `retention_correlation`, `retention_n`, and
-- `confidence_tier` columns are added with NULL placeholders for journey
-- moment rows. Population requires a Pearson correlation against the
-- Session 31 shadow 7th Health Score dimension data
-- (`client_health_scores.shadow_dimensions->'journey_engagement'`) which
-- is itself in a 4-week validation protocol per SYN-679. Once that lands,
-- a separate refresh function will populate the correlation columns; this
-- migration sets up the schema so that follow-up is purely additive.
--
-- Rollback: drop the view and recreate from
--   supabase/migrations/20260424000001_syn725_client_value_scorecard_view.sql

-- Wrapped in DO/EXECUTE for Preview resilience — client_engagement_events
-- is Prisma-managed and absent on Preview branches.
DO $do$ BEGIN
EXECUTE 'DROP MATERIALIZED VIEW IF EXISTS client_value_scorecard CASCADE';
EXECUTE $sql$
CREATE MATERIALIZED VIEW client_value_scorecard AS
WITH cvml_events AS (
  SELECT
    client_id,
    -- Discriminator: presence of journey_moment_id flips us to the journey track.
    CASE
      WHEN event_data ? 'journey_moment_id' THEN 'journey_moment'
      ELSE 'feature'
    END                                       AS source_type,
    event_data->>'feature_id'                 AS feature_id,
    event_data->>'journey_moment_id'          AS moment_id,
    event_data->>'journey_stage'              AS journey_stage,
    event_data->>'cvml_event_type'            AS cvml_event_type,
    -- Event payload `timestamp` is source-of-truth for bucketing; fall
    -- back to `created_at` if the emitter didn't set it.
    COALESCE(
      (event_data->>'timestamp')::timestamptz,
      created_at
    )                                         AS occurred_at
  FROM client_engagement_events
  WHERE event_type = 'cvml'
    AND event_data ? 'cvml_event_type'
    -- Either feature_id OR journey_moment_id must be present. Rows
    -- carrying neither are malformed and excluded.
    AND (event_data ? 'feature_id' OR event_data ? 'journey_moment_id')
),

-- ── Feature track — unchanged from SYN-725 ────────────────────────────────────
feature_weekly_counts AS (
  SELECT
    client_id,
    'feature'::text                                       AS source_type,
    feature_id,
    NULL::text                                            AS moment_id,
    NULL::text                                            AS journey_stage,
    to_char(date_trunc('week', occurred_at), 'IYYY-IW')   AS iso_week,
    date_trunc('week', occurred_at)::date                 AS week_start,
    COUNT(*) FILTER (WHERE cvml_event_type = 'view')           AS view_count,
    COUNT(*) FILTER (WHERE cvml_event_type = 'interact')       AS interact_count,
    COUNT(*) FILTER (WHERE cvml_event_type = 'act_within_72h') AS act_within_72h_count,
    COUNT(*) FILTER (WHERE cvml_event_type = 'convert')        AS convert_count,
    COUNT(*) FILTER (WHERE cvml_event_type = 'dismiss')        AS dismiss_count,
    COUNT(*) FILTER (WHERE cvml_event_type = 'share')          AS share_count
  FROM cvml_events
  WHERE source_type = 'feature'
  GROUP BY client_id, feature_id, iso_week, week_start
),

-- ── Journey moment track — new in SYN-730 ─────────────────────────────────────
moment_weekly_counts AS (
  SELECT
    client_id,
    'journey_moment'::text                                AS source_type,
    NULL::text                                            AS feature_id,
    moment_id,
    -- For a given (client, moment, week), all rows share one stage. Take
    -- MAX so the value is deterministic even if metadata drifts.
    MAX(journey_stage)                                    AS journey_stage,
    to_char(date_trunc('week', occurred_at), 'IYYY-IW')   AS iso_week,
    date_trunc('week', occurred_at)::date                 AS week_start,
    COUNT(*) FILTER (WHERE cvml_event_type = 'view')           AS view_count,
    COUNT(*) FILTER (WHERE cvml_event_type = 'interact')       AS interact_count,
    COUNT(*) FILTER (WHERE cvml_event_type = 'act_within_72h') AS act_within_72h_count,
    COUNT(*) FILTER (WHERE cvml_event_type = 'convert')        AS convert_count,
    COUNT(*) FILTER (WHERE cvml_event_type = 'dismiss')        AS dismiss_count,
    COUNT(*) FILTER (WHERE cvml_event_type = 'share')          AS share_count
  FROM cvml_events
  WHERE source_type = 'journey_moment'
  GROUP BY client_id, moment_id, iso_week, week_start
),

-- ── Combined ──────────────────────────────────────────────────────────────────
all_weekly_counts AS (
  SELECT * FROM feature_weekly_counts
  UNION ALL
  SELECT * FROM moment_weekly_counts
),

with_rates AS (
  SELECT
    *,
    -- weekly_engagement_rate: meaningful interactions over views.
    -- Clamped to [0, 1]. NULL when no views.
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
  FROM all_weekly_counts
),

-- Island key for the gap-and-island computation of consecutive low-engagement weeks.
-- Window function inside another window's PARTITION BY isn't allowed, so the
-- island key is materialised in its own CTE first. Same logic, valid syntax.
with_island_key AS (
  SELECT
    *,
    SUM(
      CASE
        WHEN weekly_engagement_rate IS NULL OR weekly_engagement_rate >= 0.10
        THEN 1 ELSE 0
      END
    ) OVER (
      -- Partition includes source_type so feature islands and moment islands
      -- never bleed into each other.
      PARTITION BY client_id, source_type, COALESCE(feature_id, moment_id)
      ORDER BY week_start
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS island_key
  FROM with_rates
),

with_consecutive_low_weeks AS (
  SELECT
    client_id,
    source_type,
    feature_id,
    moment_id,
    journey_stage,
    iso_week,
    week_start,
    view_count,
    interact_count,
    act_within_72h_count,
    convert_count,
    dismiss_count,
    share_count,
    weekly_engagement_rate,
    COUNT(*) FILTER (
      WHERE weekly_engagement_rate IS NOT NULL
        AND weekly_engagement_rate < 0.10
    ) OVER (
      PARTITION BY client_id, source_type, COALESCE(feature_id, moment_id), island_key
      ORDER BY week_start
    ) AS consecutive_weeks_below_10pct
  FROM with_island_key
)

SELECT
  client_id,
  source_type,
  feature_id,
  moment_id,
  journey_stage,
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
  -- Retention correlation columns — populated by a separate refresh function
  -- once the Session 31 shadow 7th Health Score dimension (SYN-679) is in
  -- the active validation window. Feature rows leave these NULL by design;
  -- feature retention is a separate question handled outside this view.
  NULL::numeric                       AS retention_correlation,
  NULL::integer                       AS retention_n,
  NULL::text                          AS confidence_tier,
  now()                               AS refreshed_at
FROM with_consecutive_low_weeks
$sql$;
EXCEPTION WHEN OTHERS THEN NULL;
END $do$;

-- Indexes + refresh + comment — skip silently if the view wasn't recreated.
DO $do$ BEGIN
  EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS client_value_scorecard_pk_idx ON client_value_scorecard (client_id, source_type, COALESCE(feature_id, moment_id), iso_week)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS client_value_scorecard_week_feature_idx ON client_value_scorecard (week_start DESC, source_type, feature_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS client_value_scorecard_week_moment_idx ON client_value_scorecard (week_start DESC, source_type, moment_id)';
  EXECUTE 'REFRESH MATERIALIZED VIEW client_value_scorecard';
  EXECUTE $com$ COMMENT ON MATERIALIZED VIEW client_value_scorecard IS 'SYN-725 + SYN-730: weekly per-client per-slot CVML rollup. source_type discriminates feature vs journey_moment rows; feature_id + moment_id are exclusive (one is always NULL). Refreshed nightly at 02:00 AEDT via pg_cron. Backs .github/workflows/client-value-scorecard.yml plus the journey-moment Slack section landing in SYN-731.' $com$;
EXCEPTION WHEN OTHERS THEN NULL;
END $do$;
