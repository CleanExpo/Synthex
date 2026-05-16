-- SYN-599: Team engagement analytics + expansion-ready data layer
-- Adds deduplication tracking, page view tracking, and team_analytics view

-- ─────────────────────────────────────────────
-- 1. Add last_weekly_active_fired_at to team_members
-- ─────────────────────────────────────────────
ALTER TABLE IF EXISTS team_members
  ADD COLUMN IF NOT EXISTS last_weekly_active_fired_at TIMESTAMPTZ;

-- ─────────────────────────────────────────────
-- 2. team_member_page_views
--    Lightweight page view tracker for collaborators.
--    Feeds collaborator_weekly_sessions and collaborator_most_viewed_page in the view.
-- ─────────────────────────────────────────────
-- Wrapped in DO/EXECUTE because the FK to team_members(id) fails on Preview
-- (Preview's team_members.id is UUID via unified_schema; this column is TEXT).
-- Real envs have team_members.id TEXT (Prisma). Skip silently if FK fails.
DO $do$ BEGIN
EXECUTE $sql$
CREATE TABLE IF NOT EXISTS team_member_page_views (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id  TEXT        NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  organization_id TEXT        NOT NULL,
  page_path       TEXT        NOT NULL,
  viewed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
$sql$;
EXCEPTION WHEN OTHERS THEN NULL;
END $do$;

DO $$ BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_tmpv_member      ON team_member_page_views(team_member_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_tmpv_org         ON team_member_page_views(organization_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_tmpv_viewed_at   ON team_member_page_views(viewed_at)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_tmpv_org_path    ON team_member_page_views(organization_id, page_path)';
EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN OTHERS THEN NULL; END $$;

-- RLS
ALTER TABLE IF EXISTS team_member_page_views ENABLE ROW LEVEL SECURITY;

-- Service role: full access (internal cron + admin)
DO $$ BEGIN
  CREATE POLICY "service_role_full_access_team_page_views"
    ON team_member_page_views
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- Authenticated insert: own team member record only
DO $$ BEGIN
  CREATE POLICY "collaborators_insert_own_page_views"
    ON team_member_page_views
    FOR INSERT
    TO authenticated
    WITH CHECK (
      team_member_id IN (
        SELECT id FROM team_members WHERE user_id = auth.uid()::text
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- Authenticated read: own org only
DO $$ BEGIN
  CREATE POLICY "org_members_read_page_views"
    ON team_member_page_views
    FOR SELECT
    TO authenticated
    USING (
      organization_id IN (
        SELECT organization_id FROM team_members WHERE user_id = auth.uid()::text
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- ─────────────────────────────────────────────
-- 3. team_analytics VIEW
--    Per-organisation team engagement summary.
--    Used by Sprint 5 retention analysis:
--    "accounts with ≥1 active collaborator → higher 90-day retention?"
-- ─────────────────────────────────────────────
-- Wrapped in DO/EXECUTE so Preview branches (id-only Prisma placeholders
-- lacking columns like organizations.name, team_members.role / last_active_at /
-- accepted_at / invitation_id, team_invitations.sent_at) skip silently.
DO $do$ BEGIN
EXECUTE $sql$
CREATE OR REPLACE VIEW team_analytics AS
SELECT
  o.id                                      AS organization_id,
  o.name                                    AS organization_name,

  -- All non-owner team members
  COUNT(tm.id) FILTER (
    WHERE tm.role != 'owner'
  )                                         AS total_team_members,

  -- Active in last 7 days
  COUNT(tm.id) FILTER (
    WHERE tm.role != 'owner'
      AND tm.last_active_at >= NOW() - INTERVAL '7 days'
  )                                         AS active_team_members_7d,

  -- Avg days from invite to acceptance (uses invitation_id → team_invitations.sent_at)
  ROUND(
    AVG(
      EXTRACT(EPOCH FROM (tm.accepted_at - ti.sent_at)) / 86400.0
    ) FILTER (
      WHERE tm.accepted_at IS NOT NULL AND ti.sent_at IS NOT NULL
    )::NUMERIC, 1
  )                                         AS invite_to_accept_days,

  -- Total collaborator page view sessions in last 7 days (per org)
  COALESCE(pv.weekly_session_count, 0)      AS collaborator_weekly_sessions,

  -- Most viewed page path by collaborators in last 7 days
  mpv.page_path                             AS collaborator_most_viewed_page

FROM organizations o
LEFT JOIN team_members tm
       ON tm.organization_id = o.id
LEFT JOIN team_invitations ti
       ON ti.id = tm.invitation_id
LEFT JOIN (
  SELECT
    organization_id,
    COUNT(*) AS weekly_session_count
  FROM team_member_page_views
  WHERE viewed_at >= NOW() - INTERVAL '7 days'
  GROUP BY organization_id
) pv ON pv.organization_id = o.id
LEFT JOIN LATERAL (
  SELECT page_path
  FROM team_member_page_views
  WHERE organization_id = o.id
    AND viewed_at >= NOW() - INTERVAL '7 days'
  GROUP BY page_path
  ORDER BY COUNT(*) DESC
  LIMIT 1
) mpv ON true
GROUP BY
  o.id,
  o.name,
  pv.weekly_session_count,
  mpv.page_path
$sql$;
EXCEPTION WHEN OTHERS THEN NULL;
END $do$;

-- Grant read access on the view for authenticated users — skip silently on
-- Preview if the view didn't get created (same defensive pattern).
DO $do$ BEGIN
  EXECUTE 'GRANT SELECT ON team_analytics TO authenticated';
  EXECUTE 'GRANT SELECT ON team_analytics TO service_role';
EXCEPTION WHEN OTHERS THEN NULL;
END $do$;
