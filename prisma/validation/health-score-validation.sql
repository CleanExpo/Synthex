-- SYN-613: Health Score Validation Query Suite
-- Run these weekly (Weeks 3-4 of the 4-week internal validation period).
-- Phill reviews output on /admin/health before flipping health_score_client_visible = true.

-- ── 1. Score Distribution ────────────────────────────────────────────────────
-- Expected: std_dev > 15 (meaningful variance across clients).
-- If all clients cluster 50-70, recalibrate dimension weights.
SELECT
  round(avg(overall_score), 1)  AS mean_score,
  round(stddev(overall_score), 1) AS std_dev,
  min(overall_score)            AS min_score,
  max(overall_score)            AS max_score,
  count(*)                      AS total_scores,
  count(DISTINCT organization_id) AS unique_orgs,
  -- Bucket distribution
  count(*) FILTER (WHERE overall_score >= 75) AS healthy_count,
  count(*) FILTER (WHERE overall_score BETWEEN 50 AND 74) AS watch_count,
  count(*) FILTER (WHERE overall_score BETWEEN 25 AND 49) AS at_risk_count,
  count(*) FILTER (WHERE overall_score < 25) AS critical_count
FROM client_health_scores
WHERE week_start >= (CURRENT_DATE - INTERVAL '4 weeks');

-- ── 2. Dimension Correlation Matrix ─────────────────────────────────────────
-- Identifies redundant inputs (dimensions that always move together).
-- If two dimensions have correlation > 0.9, consider merging them.
SELECT
  round(corr(
    (dimensions->>'content_consistency')::text::jsonb->>'score',
    (dimensions->>'engagement_trajectory')::text::jsonb->>'score'
  )::numeric, 2) AS content_vs_engagement,
  round(corr(
    (dimensions->>'review_responsiveness')::text::jsonb->>'score',
    (dimensions->>'authority_momentum')::text::jsonb->>'score'
  )::numeric, 2) AS reviews_vs_authority,
  round(corr(
    (dimensions->>'advisor_engagement')::text::jsonb->>'score',
    (dimensions->>'platform_usage')::text::jsonb->>'score'
  )::numeric, 2) AS advisor_vs_usage,
  round(corr(
    (dimensions->>'content_consistency')::text::jsonb->>'score',
    (dimensions->>'advisor_engagement')::text::jsonb->>'score'
  )::numeric, 2) AS content_vs_advisor
FROM client_health_scores
WHERE week_start >= (CURRENT_DATE - INTERVAL '4 weeks');

-- ── 3. Week-over-Week Stability ──────────────────────────────────────────────
-- Flags orgs with >15 point swings without corresponding behaviour change.
-- Large swings on same data = noisy input signal.
SELECT
  o.name,
  c.overall_score,
  c.score_delta,
  c.risk_level,
  c.week_start
FROM client_health_scores c
JOIN organizations o ON o.id = c.organization_id
WHERE abs(c.score_delta) > 15
ORDER BY abs(c.score_delta) DESC
LIMIT 20;

-- ── 4. Engagement Correlation ────────────────────────────────────────────────
-- Identifies which dimensions predict high engagement (dashboard activity).
-- Cross-joins health scores with engagement events in same week.
SELECT
  round(avg((chs.dimensions->'content_consistency'->>'score')::int), 1) AS avg_content_score,
  round(avg((chs.dimensions->'engagement_trajectory'->>'score')::int), 1) AS avg_engagement_score,
  round(avg((chs.dimensions->'platform_usage'->>'score')::int), 1) AS avg_usage_score,
  count(DISTINCT cee.client_id) AS active_clients
FROM client_health_scores chs
LEFT JOIN client_engagement_events cee
  ON cee.client_id = chs.organization_id
  AND cee.created_at >= chs.week_start
  AND cee.created_at < chs.week_start + INTERVAL '7 days'
WHERE chs.week_start >= (CURRENT_DATE - INTERVAL '4 weeks');

-- ── 5. At-Risk Clients — Action Required ────────────────────────────────────
-- For Phill's review — clients below 50 for 2 consecutive weeks.
SELECT
  o.name,
  o.slug,
  latest.overall_score AS current_score,
  latest.risk_level,
  prev.overall_score AS prev_score,
  latest.week_start AS latest_week
FROM (
  SELECT DISTINCT ON (organization_id)
    organization_id, overall_score, risk_level, week_start
  FROM client_health_scores
  ORDER BY organization_id, week_start DESC
) latest
JOIN (
  SELECT DISTINCT ON (organization_id)
    organization_id, overall_score
  FROM client_health_scores
  WHERE week_start < (
    SELECT max(week_start) FROM client_health_scores
  )
  ORDER BY organization_id, week_start DESC
) prev ON prev.organization_id = latest.organization_id
JOIN organizations o ON o.id = latest.organization_id
WHERE latest.overall_score < 50
  AND prev.overall_score < 50
ORDER BY latest.overall_score ASC;
