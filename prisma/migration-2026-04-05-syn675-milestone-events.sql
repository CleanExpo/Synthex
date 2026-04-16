-- ============================================================
-- SYN-675: Milestone Events — Table, Triggers, RLS
-- Applied: 2026-04-05
--
-- What this does:
--   1. Creates `milestone_events` table — tracks when a client hits
--      a significant usage milestone (100 posts, 1yr anniversary,
--      1,000 local views)
--   2. Unique constraint per (organization_id, milestone_type)
--      so milestones fire exactly once per org
--   3. RLS: service_role full access; clients SELECT own records
--   4. DB trigger: `check_posts_milestone_trigger` — fires on
--      `posts` INSERT/UPDATE; inserts milestone when org crosses 100
--      published posts
--   5. DB trigger: `check_views_milestone_trigger` — fires on
--      `platform_metrics` INSERT/UPDATE; inserts milestone when
--      org's total content reach crosses 1,000
--   6. Anniversary milestone (anniversary_1yr) is handled by the
--      daily `deliver-milestone-notifications` cron, not a DB trigger,
--      because it depends on wall-clock date matching org created_at
--
-- Callers:
--   supabase/functions/deliver-milestone-notifications (daily cron)
--   app/api/internal/deliver-milestone-notifications/route.ts
-- ============================================================

-- ── milestone_events ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS milestone_events (
  id              UUID        NOT NULL DEFAULT gen_random_uuid(),
  organization_id TEXT        NOT NULL,
  milestone_type  TEXT        NOT NULL,
  triggered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  email_sent_at   TIMESTAMPTZ,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT milestone_events_pkey PRIMARY KEY (id),

  -- One milestone per type per org (idempotent triggers use ON CONFLICT DO NOTHING)
  CONSTRAINT milestone_events_org_type_unique
    UNIQUE (organization_id, milestone_type),

  CONSTRAINT milestone_events_type_check
    CHECK (milestone_type IN (
      'posts_100',
      'anniversary_1yr',
      'local_views_1000'
    ))
);

CREATE INDEX IF NOT EXISTS milestone_events_unsent_idx
  ON milestone_events (organization_id, email_sent_at)
  WHERE email_sent_at IS NULL;

CREATE INDEX IF NOT EXISTS milestone_events_org_type_idx
  ON milestone_events (organization_id, milestone_type);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE milestone_events ENABLE ROW LEVEL SECURITY;

-- Service role: full access for all pipeline operations
DROP POLICY IF EXISTS "service_role_all_milestone_events" ON milestone_events;
CREATE POLICY "service_role_all_milestone_events"
  ON milestone_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Clients: SELECT their own records (future client portal)
DROP POLICY IF EXISTS "client_select_own_milestone_events" ON milestone_events;
CREATE POLICY "client_select_own_milestone_events"
  ON milestone_events
  FOR SELECT
  USING (organization_id = auth.uid()::text);

-- ── posts milestone trigger ───────────────────────────────────────────────────
-- Fires after any post status changes to 'published'.
-- Counts all published, non-deleted posts for the org. Inserts the posts_100
-- milestone the first time that count crosses 100.

CREATE OR REPLACE FUNCTION check_posts_milestone()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id     TEXT;
  v_post_count BIGINT;
BEGIN
  -- Only proceed if the post is becoming published
  IF NEW.status != 'published' THEN
    RETURN NEW;
  END IF;
  -- Skip if already published (no status change)
  IF OLD IS NOT NULL AND OLD.status = 'published' THEN
    RETURN NEW;
  END IF;

  -- Resolve organization via campaign
  SELECT c.organization_id INTO v_org_id
  FROM campaigns c
  WHERE c.id = NEW.campaign_id;

  IF v_org_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Count published posts for this org
  SELECT COUNT(*) INTO v_post_count
  FROM posts p
  JOIN campaigns c ON c.id = p.campaign_id
  WHERE c.organization_id = v_org_id
    AND p.status = 'published'
    AND p.deleted_at IS NULL;

  IF v_post_count >= 100 THEN
    INSERT INTO milestone_events (organization_id, milestone_type, triggered_at, metadata)
    VALUES (
      v_org_id,
      'posts_100',
      NOW(),
      jsonb_build_object('post_count', v_post_count, 'triggering_post_id', NEW.id)
    )
    ON CONFLICT (organization_id, milestone_type) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_posts_milestone_trigger ON posts;
CREATE TRIGGER check_posts_milestone_trigger
  AFTER INSERT OR UPDATE OF status ON posts
  FOR EACH ROW
  EXECUTE FUNCTION check_posts_milestone();

-- ── platform reach milestone trigger ─────────────────────────────────────────
-- Fires after any platform_metrics insert/update.
-- Sums reach across all platform posts for the org. Inserts the
-- local_views_1000 milestone the first time total reach crosses 1,000.

CREATE OR REPLACE FUNCTION check_views_milestone()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id     TEXT;
  v_total_reach BIGINT;
BEGIN
  -- Resolve organization via platform_post → platform_connection
  SELECT pc.organization_id INTO v_org_id
  FROM platform_posts pp
  JOIN platform_connections pc ON pc.id = pp.connection_id
  WHERE pp.id = NEW.post_id;

  IF v_org_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Sum reach across all platform posts for this org
  SELECT COALESCE(SUM(pm.reach), 0) INTO v_total_reach
  FROM platform_metrics pm
  JOIN platform_posts pp ON pp.id = pm.post_id
  JOIN platform_connections pc ON pc.id = pp.connection_id
  WHERE pc.organization_id = v_org_id;

  IF v_total_reach >= 1000 THEN
    INSERT INTO milestone_events (organization_id, milestone_type, triggered_at, metadata)
    VALUES (
      v_org_id,
      'local_views_1000',
      NOW(),
      jsonb_build_object('total_reach', v_total_reach, 'triggering_metric_id', NEW.id)
    )
    ON CONFLICT (organization_id, milestone_type) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_views_milestone_trigger ON platform_metrics;
CREATE TRIGGER check_views_milestone_trigger
  AFTER INSERT OR UPDATE OF reach ON platform_metrics
  FOR EACH ROW
  EXECUTE FUNCTION check_views_milestone();

-- ── get_anniversary_orgs RPC ──────────────────────────────────────────────────
-- Returns organization IDs that crossed their 1-year anniversary today
-- AND have not yet had an anniversary_1yr milestone event.
-- Called by the daily cron rather than a trigger (wall-clock date comparison).

CREATE OR REPLACE FUNCTION get_anniversary_orgs()
RETURNS TABLE (organization_id TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT o.id AS organization_id
  FROM organizations o
  WHERE
    -- Anniversary falls today (UTC): created_at between 1 year ago today 00:00 and 23:59
    DATE(o.created_at AT TIME ZONE 'UTC') = DATE((NOW() - INTERVAL '1 year') AT TIME ZONE 'UTC')
    -- Not yet milestoned
    AND NOT EXISTS (
      SELECT 1 FROM milestone_events me
      WHERE me.organization_id = o.id
        AND me.milestone_type = 'anniversary_1yr'
    )
    -- Active org: has at least one active business owner
    AND EXISTS (
      SELECT 1 FROM business_ownerships bo
      WHERE bo.organization_id = o.id
        AND bo.is_active = true
        AND bo.billing_status = 'active'
    );
$$;
