-- ============================================================
-- Synthex Pipeline Cost Monitoring Queries
-- Run against Supabase: pipeline_cost_ledger table
-- ============================================================

-- 1. Pipeline summary — total runs, tokens, cost
SELECT
  pipeline_name,
  COUNT(*)                                     AS total_runs,
  SUM(input_tokens)                            AS total_input_tokens,
  SUM(output_tokens)                           AS total_output_tokens,
  ROUND(SUM(cost_usd)::numeric, 4)             AS total_cost_usd,
  ROUND(AVG(cost_usd)::numeric, 6)             AS avg_cost_per_run,
  MIN(created_at)                              AS first_run,
  MAX(created_at)                              AS last_run
FROM pipeline_cost_ledger
GROUP BY pipeline_name
ORDER BY total_cost_usd DESC;

-- 2. Weekly cost trend — last 4 weeks by pipeline
SELECT
  DATE_TRUNC('week', created_at)::date         AS week_start,
  pipeline_name,
  COUNT(*)                                     AS run_count,
  SUM(input_tokens)                            AS input_tokens,
  SUM(output_tokens)                           AS output_tokens,
  ROUND(SUM(cost_usd)::numeric, 4)             AS weekly_cost_usd
FROM pipeline_cost_ledger
WHERE created_at >= NOW() - INTERVAL '4 weeks'
GROUP BY DATE_TRUNC('week', created_at), pipeline_name
ORDER BY week_start DESC, weekly_cost_usd DESC;

-- 3. Top 10 most expensive individual runs
SELECT
  created_at,
  pipeline_name,
  client_id,
  run_id,
  model,
  input_tokens,
  output_tokens,
  ROUND(cost_usd::numeric, 6)                  AS cost_usd
FROM pipeline_cost_ledger
ORDER BY cost_usd DESC
LIMIT 10;

-- 4. Monthly cost projection (based on last 7 days run rate)
SELECT
  pipeline_name,
  COUNT(*)                                     AS runs_last_7d,
  ROUND(SUM(cost_usd)::numeric, 4)             AS cost_last_7d_usd,
  ROUND((SUM(cost_usd) / 7 * 30)::numeric, 2) AS projected_monthly_usd
FROM pipeline_cost_ledger
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY pipeline_name
ORDER BY projected_monthly_usd DESC;
