-- ═══════════════════════════════════════════════════════════════════════════
-- D3 — a RECURRING condition must alert again
-- ═══════════════════════════════════════════════════════════════════════════
--
-- DEFECT (live on production since 20260805000000 landed)
--
-- ops.record_finding() reopens a resolved finding by clearing resolved_at, but
-- leaves notified_at set. ops.notify_pending() selects:
--
--     WHERE resolved_at IS NULL AND notified_at IS NULL
--
-- So the sequence is: condition appears -> alerted once, notified_at stamped ->
-- condition clears -> resolved_at set -> condition RETURNS -> resolved_at
-- cleared, notified_at still stamped -> never selected again.
--
-- Every recurring condition is therefore reported exactly once, ever. That is
-- the worst possible failure for a watchdog, and it is inverted: the conditions
-- most worth alerting on are the ones that keep coming back, and those are
-- precisely the ones it goes silent about. A watcher that stops watching after
-- the first time it speaks.
--
-- Not hypothetical. autopilot_timeout has resolved and recurred on this
-- production database every night since 2026-07-17.
--
-- THE FIX
--
-- Clear notified_at ONLY on a genuine reopen — a row whose resolved_at was not
-- null before this upsert. A still-open finding keeps its notified_at and stays
-- silent, so the every-15-minutes cycle does not spam a condition already
-- reported. Recurrence re-notifies; persistence does not.
--
-- Within ON CONFLICT DO UPDATE, a table-qualified reference reads the EXISTING
-- row, so `ops.health_findings.resolved_at` in the CASE is the pre-update value
-- regardless of the order of the SET clauses. That is what makes the test
-- "was it resolved before now?" rather than the tautology it would otherwise be.
--
-- ROLLBACK: re-apply 20260805000000_ops_watchdog.sql's record_finding body,
-- which is the pre-D3 definition. Deliberately not a separate file: this
-- migration replaces one function and nothing else.

-- ═══════════════════════════════════════════════════════════════════════════
-- 0. WRONG-DATABASE GUARD — refuse to run anywhere but Synthex
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Repeated here rather than assumed from the base migration. Independent review
-- flagged that D1 and D2 omitted it, so a wrong project that had ALREADY taken
-- the base migration would accept a function replacement without challenge —
-- the guard protected the first paste and nothing after it.
--
-- current_database() is 'postgres' on every Supabase project and cannot identify
-- one; see 20260805000000_ops_watchdog.sql for the incident that established
-- this. Assert the tables ops.watchdog() actually reads instead.
DO $$
DECLARE v_missing text[];
BEGIN
  SELECT array_agg(t ORDER BY t) INTO v_missing
  -- Identity only, matching the narrowed core in 20260805000000. The earlier
  -- list included public.publish_queue, which a `with_data: false` Supabase
  -- preview of Synthex does not carry — so this guard rejected the very
  -- database it protects and blocked the migration behind it. ops.health_findings
  -- stays in the list because this migration replaces a function that reads it,
  -- so its absence is a genuine ordering error rather than a preview shape.
  FROM unnest(ARRAY[
    'ops.health_findings',
    'public.autopilot_runs',
    'public.posts',
    'public.platform_connections'
  ]) AS t
  WHERE to_regclass(t) IS NULL;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION USING
      MESSAGE = 'WRONG DATABASE — this is not Synthex. Nothing was changed.',
      DETAIL  = format(
        'current_database() = %L, which is "postgres" on every Supabase project and '
        'so cannot identify one. Missing: %s',
        current_database(), array_to_string(v_missing, ', ')),
      HINT    = 'Intended target: the Synthex project, ref znyjoyjsvjotlzjppzal. '
                'Check the project selector in the Supabase SQL editor before re-running.';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. record_finding — re-notify on reopen, stay quiet while merely open
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION ops.record_finding(
  p_check_key text,
  p_severity  text,
  p_subject   text,
  p_detail    text,
  p_metric    numeric DEFAULT NULL::numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'ops', 'public'
AS $function$
BEGIN
  INSERT INTO ops.health_findings (check_key, severity, subject, detail, metric)
  VALUES (p_check_key, p_severity, p_subject, p_detail, p_metric)
  ON CONFLICT (check_key, subject) DO UPDATE
    SET last_seen_at = now(),
        detail       = EXCLUDED.detail,
        metric       = EXCLUDED.metric,
        severity     = EXCLUDED.severity,
        -- D3. Reads the PRE-UPDATE resolved_at: null it only for a row that was
        -- genuinely closed and is now back. A still-open finding keeps its
        -- notified_at so the 15-minute cycle does not re-send it.
        notified_at  = CASE
                         WHEN ops.health_findings.resolved_at IS NOT NULL
                           THEN NULL
                         ELSE ops.health_findings.notified_at
                       END,
        resolved_at  = NULL;
END $function$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Proof
-- ═══════════════════════════════════════════════════════════════════════════
--
--   -- first detection notifies
--   SELECT ops.record_finding('t','critical','s','d');
--   SELECT ops.notify_pending();                 -- sends, stamps notified_at
--
--   -- persistence does NOT re-notify
--   SELECT ops.record_finding('t','critical','s','d');
--   SELECT count(*) FROM ops.health_findings
--    WHERE resolved_at IS NULL AND notified_at IS NULL;   -- expect 0
--
--   -- resolve, then RECUR: must be notifiable again
--   UPDATE ops.health_findings SET resolved_at = now() WHERE check_key='t';
--   SELECT ops.record_finding('t','critical','s','d');
--   SELECT count(*) FROM ops.health_findings
--    WHERE resolved_at IS NULL AND notified_at IS NULL;   -- expect 1 (was 0)
--
-- scripts/verify-ops-watchdog.sh asserts all three, and SABOTAGE=d3 restores
-- the pre-D3 body to prove the assertions can fail.
