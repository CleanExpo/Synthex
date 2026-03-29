-- Pipeline Cost Report — SYN-518
-- Run against the Supabase DB to monitor AI pipeline margin.
-- Usage: npx prisma db execute --file scripts/cost-report.sql --url "$DIRECT_URL"

-- Summary by pipeline
SELECT
  pipeline_name,
  COUNT(*) AS total_runs,
  SUM(input_tokens) AS total_input_tokens,
  SUM(output_tokens) AS total_output_tokens,
  ROUND(SUM(cost_usd)::numeric, 4) AS total_cost_usd,
  ROUND(AVG(cost_usd)::numeric, 4) AS avg_cost_per_run
FROM pipeline_cost_ledger
GROUP BY pipeline_name
ORDER BY total_cost_usd DESC;

-- Monthly cost by pipeline (last 90 days)
SELECT
  DATE_TRUNC('month', created_at) AS month,
  pipeline_name,
  COUNT(*) AS runs,
  ROUND(SUM(cost_usd)::numeric, 2) AS cost_usd
FROM pipeline_cost_ledger
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY month, pipeline_name
ORDER BY month DESC, cost_usd DESC;

-- Top 10 most expensive runs
SELECT
  run_id,
  pipeline_name,
  client_id,
  model,
  input_tokens,
  output_tokens,
  ROUND(cost_usd::numeric, 4) AS cost_usd,
  created_at
FROM pipeline_cost_ledger
ORDER BY cost_usd DESC
LIMIT 10;
