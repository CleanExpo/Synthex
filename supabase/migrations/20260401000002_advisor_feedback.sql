-- SYN-594: Advisor feedback loop + retention analytics
-- Creates advisor_feedback table, RLS policies, and analytics views.

-- ── advisor_feedback table ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS advisor_feedback (
  id              TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  week_start      DATE        NOT NULL,
  response        TEXT        NOT NULL CHECK (response IN ('useful', 'not_useful', 'skipped')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT advisor_feedback_org_week UNIQUE (organization_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_advisor_feedback_org     ON advisor_feedback (organization_id);
CREATE INDEX IF NOT EXISTS idx_advisor_feedback_week    ON advisor_feedback (week_start);
CREATE INDEX IF NOT EXISTS idx_advisor_feedback_response ON advisor_feedback (response);

ALTER TABLE advisor_feedback ENABLE ROW LEVEL SECURITY;

-- Authenticated users may insert feedback for their own organisation only
DO $$ BEGIN
  CREATE POLICY "users can insert own feedback"
    ON advisor_feedback FOR INSERT TO authenticated
    WITH CHECK (
      organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()::text
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- Service role has full access (for the skip-marking cron)
DO $$ BEGIN
  CREATE POLICY "service role full access"
    ON advisor_feedback TO service_role
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- ── advisor_metrics view ──────────────────────────────────────────────────────
-- Weekly aggregation: usefulness rate, skip rate, action completion rate.
-- Wrapped in DO/EXECUTE so Preview branches (missing recommended_actions
-- columns / etc) skip silently. Real envs always have the dependency.
DO $do$ BEGIN
EXECUTE $sql$
CREATE OR REPLACE VIEW advisor_metrics AS
SELECT
  f.week_start,
  COUNT(*)                                            AS total_responses,
  COUNT(*) FILTER (WHERE f.response = 'useful')       AS useful_count,
  COUNT(*) FILTER (WHERE f.response = 'not_useful')   AS not_useful_count,
  COUNT(*) FILTER (WHERE f.response = 'skipped')      AS skipped_count,
  ROUND(
    COUNT(*) FILTER (WHERE f.response = 'useful')::numeric
    / NULLIF(COUNT(*) FILTER (WHERE f.response IN ('useful', 'not_useful')), 0)
    * 100, 1
  )                                                   AS usefulness_rate_pct,
  ROUND(
    COUNT(*) FILTER (WHERE f.response = 'skipped')::numeric
    / NULLIF(COUNT(*), 0) * 100, 1
  )                                                   AS skip_rate_pct,
  -- Action completion: briefs delivered this week vs actions marked done
  (
    SELECT COUNT(*)
    FROM recommended_actions ra
    CROSS JOIN LATERAL jsonb_array_elements(ra.actions::jsonb) AS action
    WHERE ra.week_start = f.week_start
      AND ra.status = 'delivered'
      AND (action->>'completed_at') IS NOT NULL
  )                                                   AS actions_completed_count,
  (
    SELECT COUNT(*)
    FROM recommended_actions ra
    CROSS JOIN LATERAL jsonb_array_elements(ra.actions::jsonb) AS action
    WHERE ra.week_start = f.week_start
      AND ra.status = 'delivered'
  )                                                   AS actions_total_count
FROM advisor_feedback f
GROUP BY f.week_start
ORDER BY f.week_start DESC
$sql$;
EXCEPTION WHEN OTHERS THEN NULL;
END $do$;

-- ── advisor_retention_correlation view ───────────────────────────────────────
-- Compares 7-day renewal rate for clients who opened their brief vs those who did not.
-- Requires at least 4 weeks of data before meaningful results.
-- Wrapped: references `subscriptions` (Prisma-managed, absent on Preview).
DO $do$ BEGIN
EXECUTE $sql$
CREATE OR REPLACE VIEW advisor_retention_correlation AS
WITH brief_opens AS (
  SELECT
    ra.organization_id,
    ra.week_start,
    ra.read_at IS NOT NULL AS opened_brief
  FROM recommended_actions ra
  WHERE ra.status = 'delivered'
),
renewals AS (
  SELECT
    u.organization_id,
    s.current_period_end::date AS renewal_date
  FROM subscriptions s
  JOIN users u ON u.id = s.user_id
  WHERE s.status = 'active'
    AND u.organization_id IS NOT NULL
),
cohort AS (
  SELECT
    bo.week_start,
    bo.opened_brief,
    COUNT(DISTINCT bo.organization_id) AS org_count,
    COUNT(DISTINCT r.organization_id)  AS renewed_count
  FROM brief_opens bo
  LEFT JOIN renewals r
    ON r.organization_id = bo.organization_id
    AND r.renewal_date BETWEEN bo.week_start AND (bo.week_start + INTERVAL '7 days')
  GROUP BY bo.week_start, bo.opened_brief
)
SELECT
  week_start,
  opened_brief,
  org_count,
  renewed_count,
  ROUND(renewed_count::numeric / NULLIF(org_count, 0) * 100, 1) AS renewal_rate_pct
FROM cohort
ORDER BY week_start DESC, opened_brief DESC
$sql$;
EXCEPTION WHEN OTHERS THEN NULL;
END $do$;
