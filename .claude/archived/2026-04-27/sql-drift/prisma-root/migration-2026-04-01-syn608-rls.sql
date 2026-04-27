-- ============================================================
-- SYN-608: team_members RLS foundation
-- Applied: 2026-04-01
--
-- What this does:
--   1. Replaces stale is_team_member(uuid, uuid) with correct
--      is_team_member(text) that matches actual schema
--   2. Enables RLS on gbp_reviews + autopilot_runs
--   3. Adds team-scoped SELECT policies on all target tables
--   4. Replaces public_read_authority_scores with org-scoped policy
--   5. Bootstraps team_members rows for all existing org owners
--
-- Safety:
--   - All CREATE POLICY uses IF NOT EXISTS / DROP IF EXISTS
--   - Bootstrap uses ON CONFLICT DO NOTHING
--   - Service role bypasses RLS by default (no explicit policy needed)
-- ============================================================

-- ── Pre-check: count users whose organization_id has no matching org row ──────
-- (If this returns > 0, investigate before relying on bootstrap)
DO $$
DECLARE
  orphan_count integer;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM users u
  WHERE u.organization_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM organizations o WHERE o.id = u.organization_id
    );
  IF orphan_count > 0 THEN
    RAISE WARNING 'SYN-608 pre-check: % user(s) have organization_id with no matching organization row. Bootstrap will skip them (ON CONFLICT DO NOTHING).', orphan_count;
  ELSE
    RAISE NOTICE 'SYN-608 pre-check: all user organization references are valid.';
  END IF;
END $$;

-- ── 1. Replace is_team_member() function ─────────────────────────────────────

-- Drop old stale signature (uuid, uuid) — references non-existent team_id + is_active
DROP FUNCTION IF EXISTS is_team_member(uuid, uuid);

-- New signature: takes org_id as text (cuid), resolves user from auth.uid()
CREATE OR REPLACE FUNCTION is_team_member(row_org_id text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM team_members tm
    WHERE tm.organization_id = row_org_id
      AND tm.user_id = (auth.uid())::text
  );
$$;

-- ── 2. gbp_reviews — enable RLS + team-scoped SELECT ─────────────────────────

ALTER TABLE gbp_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_members_gbp_reviews_select" ON gbp_reviews;
CREATE POLICY "team_members_gbp_reviews_select"
  ON gbp_reviews
  FOR SELECT
  USING (is_team_member(organization_id));

-- ── 3. autopilot_runs — enable RLS + team-scoped SELECT ──────────────────────

ALTER TABLE autopilot_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_members_autopilot_runs_select" ON autopilot_runs;
CREATE POLICY "team_members_autopilot_runs_select"
  ON autopilot_runs
  FOR SELECT
  USING (is_team_member(organization_id));

-- ── 4. authority_scores — replace public read with org-scoped ────────────────
-- Note: authority_scores uses legacy column name 'client_id' for organization_id

DROP POLICY IF EXISTS "public_read_authority_scores" ON authority_scores;
DROP POLICY IF EXISTS "team_members_authority_scores_select" ON authority_scores;
CREATE POLICY "team_members_authority_scores_select"
  ON authority_scores
  FOR SELECT
  USING (is_team_member(client_id));

-- ── 5. Bootstrap: insert owner TeamMember rows for existing users ─────────────
-- Inserts one 'owner' row per user that has an organization_id set.
-- ON CONFLICT ensures idempotency (safe to re-run).

INSERT INTO team_members (id, user_id, organization_id, role, invited_at)
SELECT
  gen_random_uuid()::text,
  u.id,
  u.organization_id,
  'owner',
  NOW()
FROM users u
WHERE u.organization_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM organizations o WHERE o.id = u.organization_id
  )
ON CONFLICT (user_id, organization_id) DO NOTHING;

-- Report how many rows were bootstrapped
DO $$
DECLARE
  member_count integer;
BEGIN
  SELECT COUNT(*) INTO member_count FROM team_members WHERE role = 'owner';
  RAISE NOTICE 'SYN-608 bootstrap: % owner row(s) now in team_members.', member_count;
END $$;
