-- D2 — every check must be able to reach all-clear.
--
-- THE DEFECT
-- Three checks called ops.record_finding with no paired ops.resolve_missing:
-- autopilot_timeout, never_published and spend_ceiling. Once fired they stayed
-- open permanently, even after the condition they describe had gone. The three
-- set-based checks (approval_stalled, queue_stalled, token_dead) were already
-- paired and cleared correctly, which is what made the gap visible.
--
-- Measured before the fix, with every underlying condition repaired and the
-- watchdog run twice: approval_stalled, queue_stalled and token_dead closed;
-- autopilot_timeout, never_published and spend_ceiling stayed open.
--
-- WHY IT MATTERS MORE THAN IT LOOKS
-- ops.watchdog_runs.findings_open could never return to zero. "All clear" was
-- an unreachable state, so the number carried no information — and a register
-- that is permanently non-zero is a register people stop reading. The failure
-- mode is not a wrong alert; it is the slow death of attention.
--
-- THE FIX, CHECK BY CHECK
--
--   never_published — subject is the constant 'portfolio'. The check already
--   knows both outcomes; it simply never expressed the negative one. Now sets
--   an empty subject array when a published post exists, and resolve_missing
--   closes the finding.
--
--   spend_ceiling — subject is the organisation. Restructured to collect the
--   over-threshold organisations into v_subjects first, exactly as checks 3-5
--   already do, then record and resolve against that set. An organisation that
--   drops back under 80% now closes on its own.
--
--   autopilot_timeout — the awkward one, and the reason this is not a
--   mechanical change. Resolution cannot be driven by v_reaped alone: the
--   reaper has just cleared everything it could see, so v_reaped = 0 on the
--   very next cycle regardless of health. Worse, a run that timed out ten
--   minutes ago is NOT yet reapable (the reaper requires one hour), so a naive
--   `resolve when v_reaped = 0` would close the finding while a run sat stuck,
--   then reopen it an hour later when the reaper caught up. A check that
--   flaps teaches people to ignore it, which is the same failure as never
--   resolving, reached by a different road.
--
--   So the finding is held open while ANY run is still marked running past the
--   point it should have finished — the 300s ceiling plus generous margin, ten
--   minutes — and closes only when nothing is stuck. That means the check now
--   fires on a stuck-but-not-yet-reapable run as well as on a reap. Detection
--   widened deliberately: you cannot resolve a condition correctly without
--   being able to observe whether it is still present.
--
-- Requires 20260805000000_ops_watchdog.sql. Idempotent: CREATE OR REPLACE only.
-- Independent of the D1 migration; order between them does not matter.
-- Gate: scripts/verify-ops-watchdog.sh (three D2 assertions RED before, green after).

DO $$
BEGIN
  IF to_regprocedure('ops.watchdog()') IS NULL THEN
    RAISE EXCEPTION USING
      MESSAGE = 'ops.watchdog() does not exist',
      HINT    = 'Apply 20260805000000_ops_watchdog.sql first.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION ops.watchdog()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'ops', 'public'
AS $function$
DECLARE
  v_run_id    bigint;
  v_actions   int := 0;
  v_reaped    int := 0;
  v_stuck     int := 0;
  v_open      int;
  v_subjects  text[];
BEGIN
  INSERT INTO ops.watchdog_runs DEFAULT VALUES RETURNING id INTO v_run_id;

  -- 1. SELF-HEAL: autopilot runs killed by the 300s Vercel ceiling before writing
  --    a terminal status. Root cause confirmed 2026-08-05 from runtime logs.
  UPDATE autopilot_runs
     SET status = 'failed',
         completed_at = started_at + INTERVAL '300 seconds',
         duration_ms = 300000,
         error_message = COALESCE(error_message,'') ||
           ' [ops.watchdog] reaped: exceeded the 300s function ceiling without a terminal write.'
   WHERE status = 'running' AND started_at < now() - INTERVAL '1 hour';
  GET DIAGNOSTICS v_reaped = ROW_COUNT;
  v_actions := v_actions + v_reaped;

  -- Runs still marked running past the point they should have finished. The
  -- ceiling is 300s; ten minutes is that plus margin. These are not yet old
  -- enough for the reaper above, so counting them separately is what keeps the
  -- finding open across the gap instead of flapping shut and back open.
  SELECT count(*) INTO v_stuck FROM autopilot_runs
   WHERE status = 'running' AND started_at < now() - INTERVAL '10 minutes';

  IF v_reaped > 0 THEN
    PERFORM ops.record_finding('autopilot_timeout','critical','autopilot',
      format('Reaped %s autopilot run(s) killed at the 300s ceiling. The job does not fit in one invocation and must be split per organisation or moved to a queue.', v_reaped), v_reaped);
    v_subjects := ARRAY['autopilot'];
  ELSIF v_stuck > 0 THEN
    PERFORM ops.record_finding('autopilot_timeout','critical','autopilot',
      format('%s autopilot run(s) still marked running past the 300s ceiling, not yet old enough to reap. The job does not fit in one invocation and must be split per organisation or moved to a queue.', v_stuck), v_stuck);
    v_subjects := ARRAY['autopilot'];
  ELSE
    v_subjects := ARRAY[]::text[];
  END IF;
  PERFORM ops.resolve_missing('autopilot_timeout', v_subjects);

  -- 2. Nothing has ever published while drafts keep accruing.
  PERFORM 1 FROM posts WHERE published_at IS NOT NULL LIMIT 1;
  IF NOT FOUND THEN
    PERFORM ops.record_finding('never_published','critical','portfolio',
      format('No post has ever published. %s posts exist; %s created in the last 7 days.',
        (SELECT count(*) FROM posts),
        (SELECT count(*) FROM posts WHERE created_at > now() - INTERVAL '7 days')),
      (SELECT count(*) FROM posts));
    v_subjects := ARRAY['portfolio'];
  ELSE
    -- The first post to publish closes this. It is a milestone finding, not a
    -- recurring one: once the path works, it should never reopen.
    v_subjects := ARRAY[]::text[];
  END IF;
  PERFORM ops.resolve_missing('never_published', v_subjects);

  -- 3. Approval has stalled: drafts newer than the newest approved calendar.
  SELECT array_agg(DISTINCT c.organization_id::text) INTO v_subjects
  FROM content_calendars c
  WHERE c.status = 'draft'
    AND c.created_at > COALESCE(
      (SELECT max(a.created_at) FROM content_calendars a
        WHERE a.status='approved' AND a.organization_id=c.organization_id),
      '-infinity'::timestamp) ;
  IF v_subjects IS NOT NULL THEN
    PERFORM ops.record_finding('approval_stalled','warning', s,
      format('Drafts awaiting approval; newest approval %s.',
        COALESCE((SELECT max(a.created_at)::text FROM content_calendars a WHERE a.status='approved' AND a.organization_id=s),'never')),
      (SELECT count(*) FROM content_calendars d WHERE d.status='draft' AND d.organization_id=s))
    FROM unnest(v_subjects) AS s;
  END IF;
  PERFORM ops.resolve_missing('approval_stalled', v_subjects);

  -- 4. Publish queue not draining.
  SELECT array_agg(DISTINCT organization_id::text) INTO v_subjects
  FROM publish_queue WHERE status='pending' AND scheduled_at < now() - INTERVAL '24 hours';
  IF v_subjects IS NOT NULL THEN
    PERFORM ops.record_finding('queue_stalled','critical', s,
      format('%s queue item(s) past their scheduled time by more than 24h; oldest %s.',
        (SELECT count(*) FROM publish_queue q WHERE q.status='pending' AND q.organization_id=s),
        (SELECT min(scheduled_at)::text FROM publish_queue q WHERE q.status='pending' AND q.organization_id=s)),
      (SELECT count(*) FROM publish_queue q WHERE q.status='pending' AND q.organization_id=s))
    FROM unnest(v_subjects) AS s;
  END IF;
  PERFORM ops.resolve_missing('queue_stalled', v_subjects);

  -- 5. Platform tokens expired or inactive.
  SELECT array_agg(DISTINCT platform) INTO v_subjects
  FROM platform_connections
  WHERE deleted_at IS NULL AND (is_active = false OR (expires_at IS NOT NULL AND expires_at < now()));
  IF v_subjects IS NOT NULL THEN
    PERFORM ops.record_finding('token_dead','warning', s,
      format('%s connection(s) inactive or expired on %s. Publishing and analytics will fail.',
        (SELECT count(*) FROM platform_connections p WHERE p.platform=s AND p.deleted_at IS NULL
           AND (p.is_active=false OR (p.expires_at IS NOT NULL AND p.expires_at < now()))), s),
      (SELECT count(*) FROM platform_connections p WHERE p.platform=s AND p.deleted_at IS NULL
         AND (p.is_active=false OR (p.expires_at IS NOT NULL AND p.expires_at < now()))))
    FROM unnest(v_subjects) AS s;
  END IF;
  PERFORM ops.resolve_missing('token_dead', v_subjects);

  -- 6. Spend approaching the ceiling. Subject-collected first, then recorded and
  --    resolved against that set — the shape checks 3-5 already use.
  SELECT array_agg(q.organization_id) INTO v_subjects
  FROM (
    SELECT o.organization_id,
           100.0 * COALESCE((SELECT sum(e.delta_usd) FROM media_spend_events e
                              WHERE e.organization_id=o.organization_id
                                AND e.window_at::date = now()::date),0) / NULLIF(o.daily_budget_usd,0) AS pct
    FROM organization_video_quotas o) q
  WHERE q.pct >= 80;
  IF v_subjects IS NOT NULL THEN
    PERFORM ops.record_finding('spend_ceiling','warning', q.organization_id,
      format('Media spend at %s%% of the daily cap.', round(q.pct)), q.pct)
    FROM (
      SELECT o.organization_id,
             100.0 * COALESCE((SELECT sum(e.delta_usd) FROM media_spend_events e
                                WHERE e.organization_id=o.organization_id
                                  AND e.window_at::date = now()::date),0) / NULLIF(o.daily_budget_usd,0) AS pct
      FROM organization_video_quotas o) q
    WHERE q.pct >= 80;
  END IF;
  PERFORM ops.resolve_missing('spend_ceiling', v_subjects);

  SELECT count(*) INTO v_open FROM ops.health_findings WHERE resolved_at IS NULL;
  UPDATE ops.watchdog_runs
     SET finished_at = now(), findings_open = v_open, actions_taken = v_actions
   WHERE id = v_run_id;

  RETURN jsonb_build_object('run_id',v_run_id,'reaped',v_reaped,'stuck',v_stuck,'actions',v_actions,'open_findings',v_open);
EXCEPTION WHEN OTHERS THEN
  -- Retained from the capture. On its own this stamp does not survive the RAISE
  -- that follows it — the raise unwinds the transaction it was written in. It is
  -- load-bearing only because ops.watchdog_cycle() now catches, per the D1
  -- migration (20260805010000). Do not remove that handler believing this one
  -- covers the case.
  UPDATE ops.watchdog_runs SET finished_at = now(), error = SQLERRM WHERE id = v_run_id;
  RAISE;
END $function$;

-- POST-APPLY VERIFICATION — behaviour, not existence.
--
--   scripts/verify-ops-watchdog.sh
--
-- The three D2 assertions are RED without this file and green with it. The
-- positive half ("all six checks fire while their defects are present") runs
-- first on purpose: without it, checks that never fired would trivially
-- "resolve" and the negative half would be vacuous.
--
-- On production, after applying:
--
--   -- 1. all-clear is now reachable. This number could previously only rise.
--   SELECT findings_open FROM ops.watchdog_runs ORDER BY id DESC LIMIT 1;
--
--   -- 2. which findings are open, and whether any has been open since before
--   --    this migration — those are the ones that were stuck.
--   SELECT check_key, subject, first_seen_at, last_seen_at
--   FROM ops.health_findings WHERE resolved_at IS NULL ORDER BY first_seen_at;
--
--   -- 3. autopilot_timeout specifically: it should now be open only while a run
--   --    is genuinely stuck. Cross-check against the source of truth.
--   SELECT count(*) FILTER (WHERE status = 'running' AND started_at < now() - INTERVAL '10 minutes') AS stuck_now
--   FROM autopilot_runs;
--   -- stuck_now = 0 with autopilot_timeout still open means the finding is
--   -- stale and this migration did not take effect.
