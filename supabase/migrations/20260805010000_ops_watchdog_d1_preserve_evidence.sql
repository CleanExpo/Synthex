-- D1 — a failure anywhere in the cycle must never destroy the detection work.
--
-- THE DEFECT
-- pg_cron runs `SELECT ops.watchdog_cycle();` as a single transaction, and
-- ops.watchdog_cycle() had no exception handler. So when ops.notify_pending()
-- raised — an unreachable Telegram, a pg_net fault, a missing Vault — the raise
-- unwound the whole transaction and took ops.watchdog()'s run row and every
-- finding that cycle recorded with it. A cycle that failed that way left NO
-- evidence it had ever run. The watchdog could silently erase its own
-- observations, which is worse than not observing: an empty register reads as a
-- healthy estate.
--
-- Measured before the fix, on a throwaway with the alert path broken:
--   run count stayed at 0 across a cycle that had inserted a run row;
--   0 findings survived, from a fixture in which all six checks fire.
--
-- THE SECOND HALF, which the original header did not name
-- ops.watchdog() has its own EXCEPTION handler that stamps finished_at and error
-- on the run row and then RAISEs. That stamp is written INSIDE the transaction
-- the raise then unwinds, so it never survives either. The handler looks like
-- durable failure reporting and is, in fact, a no-op whenever the caller does
-- not catch. Fixing only the notify path would have left this one live.
--
-- THE FIX
-- Wrap each call in its own exception block. A PL/pgSQL BEGIN...EXCEPTION block
-- is a subtransaction: catching there rolls back only what the failing call did
-- and leaves everything committed before it intact. ops.watchdog()'s work
-- therefore survives a notify failure, and a raise inside ops.watchdog() unwinds
-- only its own subtransaction, after which the handler — now running in the
-- outer transaction — can write a durable record of what happened.
--
-- WHAT THIS DELIBERATELY DOES NOT DO
-- It does not swallow the failure. Preserving the work while hiding the fault
-- would trade "no evidence" for the worse "false all-clear": every cycle would
-- report success while nobody was ever told. So each caught failure BOTH lands
-- on the run row and opens its own finding, and both findings auto-resolve on
-- the next clean cycle. The trade being made consciously: pg_cron's
-- job_run_details will now show success for a cycle that partly failed, because
-- the function no longer re-raises. That is acceptable only because the failure
-- is recorded in the register the watchdog itself alerts on — which is read —
-- rather than in a cron log, which is not.
--
-- PRECONDITION — the function exists and currently has no handler:
--
--   SELECT pg_get_functiondef(p.oid) ~ 'EXCEPTION' AS has_handler
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'ops' AND p.proname = 'watchdog_cycle';
--   -- expect false BEFORE this migration, true after
--
-- Requires 20260805000000_ops_watchdog.sql. Idempotent: CREATE OR REPLACE only,
-- no schema change, nothing to roll back beyond restoring the prior body.
-- Gate: scripts/verify-ops-watchdog.sh (RED before this file, green after).

DO $$
BEGIN
  IF to_regprocedure('ops.watchdog_cycle()') IS NULL THEN
    RAISE EXCEPTION USING
      MESSAGE = 'ops.watchdog_cycle() does not exist',
      HINT    = 'Apply 20260805000000_ops_watchdog.sql first.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION ops.watchdog_cycle()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'ops', 'public'
AS $function$
DECLARE
  v_w      jsonb;
  v_n      jsonb;
  v_run_id bigint;
BEGIN
  -- ── Detect ───────────────────────────────────────────────────────────────
  BEGIN
    v_w      := ops.watchdog();
    v_run_id := (v_w->>'run_id')::bigint;
    PERFORM ops.resolve_missing('watchdog_failed', ARRAY[]::text[]);
  EXCEPTION WHEN OTHERS THEN
    -- ops.watchdog() re-raised, so its own run row and error stamp were unwound
    -- with this subtransaction. Write the record again out here, where it will
    -- survive. The sequence has already advanced past the discarded id; a gap in
    -- ops.watchdog_runs.id is the expected signature of a cycle that failed this
    -- way, not a bug.
    INSERT INTO ops.watchdog_runs (started_at, finished_at, error)
    VALUES (now(), now(), format('watchdog() raised: %s (SQLSTATE %s)', SQLERRM, SQLSTATE));

    PERFORM ops.record_finding('watchdog_failed', 'critical', 'watchdog',
      format('ops.watchdog() raised: %s (SQLSTATE %s). NO checks ran this cycle, so the absence of other findings means nothing was looked at — not that nothing is wrong.',
             SQLERRM, SQLSTATE), NULL);

    v_w := jsonb_build_object('checks_ran', false, 'error', SQLERRM);
  END;

  -- ── Tell ─────────────────────────────────────────────────────────────────
  -- Runs even when detection failed: watchdog_failed is precisely the finding
  -- somebody needs to hear about, and waiting for the next cycle to report a
  -- blind watchdog would be fifteen minutes of unearned silence.
  BEGIN
    v_n := ops.notify_pending();
    PERFORM ops.resolve_missing('alert_dispatch_failed', ARRAY[]::text[]);
  EXCEPTION WHEN OTHERS THEN
    -- Only a RAISE lands here. ops.notify_pending() returning
    -- {"sent":0,"reason":"alerting unconfigured"} is the ordinary
    -- not-yet-configured path and is reported by the alerting_unconfigured
    -- finding instead — conflating the two would mask a genuine dispatch fault
    -- behind a known-benign one.
    IF v_run_id IS NOT NULL THEN
      UPDATE ops.watchdog_runs
         SET error = format('notify_pending() raised: %s (SQLSTATE %s)', SQLERRM, SQLSTATE)
       WHERE id = v_run_id;
    END IF;

    PERFORM ops.record_finding('alert_dispatch_failed', 'critical', 'telegram',
      format('Notification dispatch raised: %s (SQLSTATE %s). Detection results were PRESERVED and the findings remain un-notified, so the next cycle retries them.',
             SQLERRM, SQLSTATE), NULL);

    v_n := jsonb_build_object('sent', 0, 'reason', 'alert dispatch raised', 'error', SQLERRM);
  END;

  RETURN v_w || v_n;
END $function$;

-- POST-APPLY VERIFICATION — behaviour, not existence.
--
-- Checking that the function now contains the word EXCEPTION proves nothing
-- about whether the evidence survives. Run the real control:
--
--   scripts/verify-ops-watchdog.sh
--
-- and confirm it detects the defect it guards, which a control that has only
-- ever run against fixed code cannot tell you:
--
--   SABOTAGE=1 scripts/verify-ops-watchdog.sh   # MUST fail
--
-- On production, after applying:
--
--   -- 1. a cycle completes and leaves a terminal run row
--   SELECT ops.watchdog_cycle();
--   SELECT id, started_at, finished_at, findings_open, actions_taken, error
--   FROM ops.watchdog_runs ORDER BY id DESC LIMIT 3;
--
--   -- 2. neither failure finding is open on a healthy cycle. A row here means
--   --    the cycle partly failed — which is now visible instead of erased, and
--   --    is the whole point of this migration.
--   SELECT check_key, subject, detail, first_seen_at
--   FROM ops.health_findings
--   WHERE check_key IN ('watchdog_failed','alert_dispatch_failed')
--     AND resolved_at IS NULL;
