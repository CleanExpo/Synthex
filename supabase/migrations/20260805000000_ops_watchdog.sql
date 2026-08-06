-- ops watchdog — capture live production state into the repo.
--
-- WHY THIS EXISTS
-- On 2026-08-05 an ops watchdog was built DIRECTLY IN PRODUCTION
-- (Supabase project znyjoyjsvjotlzjppzal) through the MCP connector. It is live
-- and running on a 15-minute pg_cron schedule, and it existed in no repository.
-- That is the SYN-1124 defect class: undocumented production state that no
-- review saw and no fresh environment can reproduce. This file closes that gap.
--
-- It is a CAPTURE, not a change. Every object below was dumped from the live
-- database with pg_get_functiondef / information_schema on 2026-08-05, and this
-- script reproduces them exactly. Applying it to production is a NO-OP: the
-- objects already exist there and every statement is idempotent.
--
-- WHERE THIS LIVES AND WHY
-- supabase/migrations, not prisma/migrations. Prisma models `public` only and
-- has no knowledge of an `ops` schema; putting it in the Prisma ledger would
-- make `prisma migrate deploy` responsible for a schema it cannot introspect,
-- and would report permanent drift. Per CLAUDE.md, schema changes outside the
-- Prisma model are applied out of band.
--
-- PRECONDITION — run this first.
--
--   SELECT to_regclass('ops.health_findings') AS health_findings,
--          to_regclass('ops.watchdog_runs')   AS watchdog_runs,
--          to_regclass('ops.config')          AS config,
--          to_regprocedure('ops.watchdog()')  AS watchdog,
--          (SELECT count(*) FROM cron.job WHERE jobname = 'ops-watchdog') AS cron_job;
--
--   * On PRODUCTION expect all five populated (cron_job = 1). This script is
--     then a no-op that re-asserts the definitions — safe, and the point of the
--     exercise is that the repo now says what production already does.
--   * On a FRESH environment expect four NULLs and cron_job = 0. This script
--     builds the watchdog from nothing.
--   * Anything in between means a partial build. Read section 8's verification
--     block before and after, and reconcile the difference rather than assuming.
--
-- IDEMPOTENCE
-- CREATE SCHEMA / TABLE / INDEX all carry IF NOT EXISTS; every function is
-- CREATE OR REPLACE; the cron registration unschedules before scheduling. Every
-- reference to a Supabase role (service_role, anon, authenticated) is wrapped in
-- a pg_roles existence check, because naming a role that does not exist raises
-- invalid_role_specification (0P000) and ABORTS the whole migration on a bare
-- PostgreSQL instance — the failure mode the PR #820 review found the hard way.
--
-- PORTABILITY
-- The function bodies reference pg_net (net.http_post), Supabase Vault
-- (vault.decrypted_secrets) and several `public` tables. All six functions are
-- plpgsql or trivial SQL over ops-owned tables, so PostgreSQL does not resolve
-- those references until run time. This script therefore APPLIES cleanly to a
-- throwaway database that has none of them.
--
-- CALLING them there is a different matter, and the distinction is sharper than
-- it first looks. Verified on PostgreSQL 16 on 2026-08-05:
--   * ops.watchdog() runs once the `public` tables it reads exist.
--   * ops.alert() RAISES `relation "vault.decrypted_secrets" does not exist`.
--     It does NOT fall through to the alerting_unconfigured finding — that
--     branch is reached only when the table exists and the secret is absent,
--     which is the production shape. Do not read a bare-database exception here
--     as the watchdog reporting itself unconfigured; it is a missing extension.
--   * Consequently ops.watchdog_cycle() cannot be exercised end to end on a
--     database without Vault. See the DEFECTS section below — that failure mode
--     matters on production too.
--
-- KNOWN DEFECTS IN THE CAPTURED BEHAVIOUR (carried faithfully, NOT fixed here)
-- This file reproduces production as it stands so the repo and the database
-- agree. Two real faults were found while proving it, and both are recorded
-- rather than silently corrected, because a capture that quietly diverges from
-- what is running is the same drift this file exists to close.
--
-- BOTH ARE NOW FIXED, each in its own reviewed migration. Apply all three in
-- order; this file alone reproduces the defective behaviour on purpose.
--   D1 -> 20260805010000_ops_watchdog_d1_preserve_evidence.sql
--   D2 -> 20260805020000_ops_watchdog_d2_resolvable_checks.sql
-- Gate for both: scripts/verify-ops-watchdog.sh
--
--   D1 — an alert-layer failure DESTROYS the detection work. ops.watchdog_cycle()
--        has no exception handler, and pg_cron runs it as one transaction. When
--        ops.notify_pending() raises, the whole transaction rolls back, taking
--        with it the ops.watchdog_runs row and every finding that cycle recorded.
--        Measured: run count stayed at 2 across a cycle that had inserted run 3.
--        A cycle that fails this way leaves NO evidence it ever ran, defeating
--        ops.watchdog()'s own EXCEPTION handler, which only covers faults raised
--        inside itself.
--
--   D2 — three checks can never auto-resolve. autopilot_timeout, never_published
--        and spend_ceiling call ops.record_finding without a paired
--        ops.resolve_missing, so once fired they stay open permanently even
--        after the condition clears. Measured: with every underlying defect
--        repaired, the three set-based checks (approval_stalled, queue_stalled,
--        token_dead) closed correctly while these three remained open. The
--        practical effect is that open_findings can never return to zero, so
--        "all clear" is an unreachable state and the register stops being read.
--
-- ROLLBACK: supabase/migrations/rollbacks/20260805000000_ops_watchdog.ROLLBACK.sql

-- ═══════════════════════════════════════════════════════════════════════════
-- 0. WRONG-DATABASE GUARD — refuse to run anywhere but Synthex
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Added 2026-08-05 after this file was pasted into the CARSI project by mistake.
-- It applied cleanly there, silently, because nothing in it named its target
-- except a comment — and a comment cannot refuse.
--
-- current_database() DOES NOT WORK for this, which is the counter-intuitive part
-- and the reason this guard looks the way it does. Every Supabase project's
-- database is named `postgres`; verified on Synthex production 2026-08-05:
--
--   SELECT current_database();  ->  postgres
--   SELECT current_setting('app.settings.project_ref', true);  ->  NULL
--
-- A `current_database() <> 'synthex'` check would therefore have passed on CARSI
-- too — a guard that cannot fire, which is worse than no guard because it reads
-- like protection.
--
-- So the guard asserts the tables ops.watchdog() actually READS. That is not an
-- arbitrary fingerprint: if these are missing the watchdog cannot function, so
-- the check is a real precondition that happens to also identify the database.
-- On any project without Synthex's schema it aborts before creating anything.
--
-- Deliberately NOT added to the ROLLBACK file: that file must stay runnable on a
-- database where this migration landed by accident, which is precisely a
-- database this guard would reject.
--
-- IDENTITY vs CAPABILITY — these are different questions and conflating them
-- broke a legitimate database.
--
-- The first version asserted all seven tables ops.watchdog() reads. That fails
-- on a Supabase PREVIEW branch of Synthex itself: a `with_data: false` preview
-- carries the Prisma-managed core but not every operational table, so four of
-- the seven were absent and this guard aborted with "WRONG DATABASE" against a
-- database that is unambiguously Synthex. It then blocked every migration
-- behind it. A guard that rejects the database it is protecting is worse than
-- no guard, because it fails in the direction that looks like diligence.
--
-- So identity is asserted on a narrow core that exists in ANY Synthex database
-- and does not exist elsewhere in the estate — autopilot_runs in particular is
-- unique to this product; CARSI, DR and the rest have no such table, which is
-- what the original incident needed to catch.
--
-- The operational tables are a CAPABILITY question, reported as a notice. Their
-- absence means ops.watchdog() cannot run usefully here, which is true and fine
-- on a preview; plpgsql resolves table references at execution, not creation,
-- so the functions install cleanly either way.
DO $$
DECLARE
  v_missing   text[];
  v_degraded  text[];
BEGIN
  SELECT array_agg(t ORDER BY t) INTO v_missing
  FROM unnest(ARRAY[
    'public.autopilot_runs',
    'public.posts',
    'public.platform_connections'
  ]) AS t
  WHERE to_regclass(t) IS NULL;

  SELECT array_agg(t ORDER BY t) INTO v_degraded
  FROM unnest(ARRAY[
    'public.content_calendars',
    'public.publish_queue',
    'public.organization_video_quotas',
    'public.media_spend_events'
  ]) AS t
  WHERE to_regclass(t) IS NULL;

  IF v_missing IS NULL AND v_degraded IS NOT NULL THEN
    RAISE NOTICE
      'ops watchdog installed, but these tables are absent so their checks cannot run here: %. Expected on a preview branch; a DEFECT on production.',
      array_to_string(v_degraded, ', ');
  END IF;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION USING
      MESSAGE = 'WRONG DATABASE — this is not Synthex. Nothing was created.',
      DETAIL  = format(
        'current_database() = %L, which is "postgres" on every Supabase project and '
        'so cannot identify one. Missing the tables ops.watchdog() reads: %s',
        current_database(), array_to_string(v_missing, ', ')),
      HINT    = 'Intended target: the Synthex project, ref znyjoyjsvjotlzjppzal. '
                'Check the project selector in the Supabase SQL editor before re-running.';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Schema
-- ═══════════════════════════════════════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS ops;

COMMENT ON SCHEMA ops IS
  'Operational health monitoring. service_role only — never exposed to anon or '
  'authenticated. Captured from live production 2026-08-05.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Tables
-- ═══════════════════════════════════════════════════════════════════════════

-- The open/resolved finding register. UNIQUE (check_key, subject) is the whole
-- design: ops.record_finding() upserts onto it, so a condition that persists
-- across cycles refreshes one row rather than accumulating duplicates, and
-- re-detection after a resolve clears resolved_at instead of inserting again.
CREATE TABLE IF NOT EXISTS ops.health_findings (
  id            bigserial     PRIMARY KEY,
  check_key     text          NOT NULL,
  severity      text          NOT NULL,
  subject       text,
  detail        text          NOT NULL,
  metric        numeric,
  first_seen_at timestamptz   NOT NULL DEFAULT now(),
  last_seen_at  timestamptz   NOT NULL DEFAULT now(),
  resolved_at   timestamptz,
  notified_at   timestamptz
);

-- Guarded rather than inlined in CREATE TABLE: on a database where the table
-- already exists (production) the inline constraint would be skipped silently
-- and a missing unique key would go unnoticed. Asserting it separately means a
-- production apply proves the constraint is there.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'ops.health_findings'::regclass
      AND conname  = 'health_findings_check_key_subject_key'
  ) THEN
    ALTER TABLE ops.health_findings
      ADD CONSTRAINT health_findings_check_key_subject_key UNIQUE (check_key, subject);
  END IF;
END $$;

-- Run history. One row per ops.watchdog() invocation, written on entry so that a
-- crash mid-run still leaves evidence, then completed on exit.
CREATE TABLE IF NOT EXISTS ops.watchdog_runs (
  id            bigserial   PRIMARY KEY,
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz,
  findings_open integer,
  actions_taken integer,
  error         text
);

-- Non-secret configuration only. The Telegram CHAT ID lives here; the Telegram
-- BOT TOKEN does not — it lives in Supabase Vault and is read through
-- vault.decrypted_secrets. Never put a credential in this table.
CREATE TABLE IF NOT EXISTS ops.config (
  key        text        PRIMARY KEY,
  value      text        NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE ops.config IS
  'Non-secret operational config. Secrets belong in Supabase Vault, never here.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Row-level security and privileges
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Posture, exactly as production carries it: RLS ENABLED with NO POLICIES on all
-- three tables. That is deny-all for every role that does not bypass RLS. Only
-- service_role (which holds BYPASSRLS) and the superuser can read or write. The
-- pg_cron job runs as the table owner, so the watchdog itself is unaffected.
--
-- Reachability is gated twice over: anon and authenticated hold no privilege on
-- these tables AND no USAGE on the ops schema, so they cannot even name an
-- object inside it. The findings register describes exactly where the estate is
-- broken — it is not tenant-readable material.

ALTER TABLE ops.health_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.watchdog_runs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.config          ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  v_role  text;
  v_table text;
BEGIN
  -- Withdraw the default PUBLIC privileges CREATE SCHEMA/TABLE may confer, then
  -- withdraw anything anon or authenticated inherited from a default-privilege
  -- rule. Unconditional and safe: REVOKE from a role that holds nothing is a
  -- no-op, but naming a role that does not EXIST aborts, hence the guard.
  EXECUTE 'REVOKE ALL ON SCHEMA ops FROM PUBLIC';

  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_role) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA ops FROM %I', v_role);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA ops FROM %I', v_role);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ops FROM %I', v_role);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA ops FROM %I', v_role);
    END IF;
  END LOOP;

  -- service_role is the only non-superuser principal with any access.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA ops TO service_role';
    FOREACH v_table IN ARRAY ARRAY['health_findings', 'watchdog_runs', 'config'] LOOP
      EXECUTE format('GRANT ALL ON TABLE ops.%I TO service_role', v_table);
    END LOOP;
    EXECUTE 'GRANT ALL ON ALL SEQUENCES IN SCHEMA ops TO service_role';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Finding helpers
-- ═══════════════════════════════════════════════════════════════════════════

-- Upsert a finding. Re-detecting a condition that was previously resolved clears
-- resolved_at, so the row reopens rather than a duplicate appearing.
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
        resolved_at  = NULL;
END $function$;

-- Auto-resolve: close every open finding for this check whose subject is no
-- longer in the active set. This is what stops the register going stale — a
-- condition that fixes itself disappears without anyone touching it.
--
-- COALESCE to an empty array is load-bearing. `NOT (subject = ANY (NULL))` is
-- NULL, never true, so a check that returns no active subjects would resolve
-- NOTHING — the precise case where everything has just been fixed.
CREATE OR REPLACE FUNCTION ops.resolve_missing(
  p_check_key       text,
  p_active_subjects text[]
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'ops', 'public'
AS $function$
  UPDATE ops.health_findings
     SET resolved_at = now()
   WHERE check_key = p_check_key
     AND resolved_at IS NULL
     AND NOT (subject = ANY (COALESCE(p_active_subjects, ARRAY[]::text[])));
$function$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Alerting
-- ═══════════════════════════════════════════════════════════════════════════

-- Send one message to Telegram via pg_net.
--
-- The bot token comes from Supabase Vault and the chat id from ops.config. When
-- either is absent the function does NOT fail silently — it records the
-- alerting_unconfigured finding, which is the watchdog watching itself: a
-- monitor that detects faults but cannot tell anyone is worse than no monitor,
-- because it looks healthy. That finding auto-resolves on the first successful
-- send, at the foot of this function.
--
-- Deliberately fire-and-forget: net.http_post queues the request and returns an
-- id. A Telegram outage must not block or fail the watchdog cycle.
CREATE OR REPLACE FUNCTION ops.alert(p_text text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'ops', 'public', 'vault'
AS $function$
DECLARE
  v_token   text;
  v_chat    text;
  v_request bigint;
BEGIN
  SELECT decrypted_secret INTO v_token
    FROM vault.decrypted_secrets WHERE name = 'telegram_bot_token' LIMIT 1;
  SELECT value INTO v_chat FROM ops.config WHERE key = 'telegram_chat_id';

  IF v_token IS NULL OR v_chat IS NULL THEN
    PERFORM ops.record_finding('alerting_unconfigured','critical','telegram',
      'Watchdog cannot alert: telegram_bot_token (Vault) or telegram_chat_id (ops.config) is missing. Findings are being detected but nobody is being told.', NULL);
    RETURN false;
  END IF;

  SELECT net.http_post(
    url     := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := jsonb_build_object('chat_id', v_chat, 'text', p_text, 'parse_mode', 'HTML', 'disable_web_page_preview', true)
  ) INTO v_request;

  UPDATE ops.health_findings SET resolved_at = now()
   WHERE check_key = 'alerting_unconfigured' AND resolved_at IS NULL;
  RETURN true;
END $function$;

-- Send every open, un-notified finding exactly once, then stamp notified_at.
--
-- alerting_unconfigured is excluded from the message body on purpose: it is the
-- finding that exists BECAUSE alerting is down, so including it would mean
-- trying to send a message about being unable to send messages.
--
-- notified_at is stamped only when ops.alert() returns true, so a failed send
-- leaves the findings pending and the next cycle retries them rather than
-- swallowing the notification.
CREATE OR REPLACE FUNCTION ops.notify_pending()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'ops', 'public'
AS $function$
DECLARE
  v_msg text := '';
  v_ids bigint[];
  v_n int := 0;
  r record;
BEGIN
  SELECT array_agg(id) INTO v_ids FROM ops.health_findings
   WHERE resolved_at IS NULL AND notified_at IS NULL AND check_key <> 'alerting_unconfigured';
  IF v_ids IS NULL THEN RETURN jsonb_build_object('sent',0); END IF;

  v_msg := '<b>Synthex watchdog</b>' || E'\n';
  FOR r IN SELECT severity, check_key, subject, detail FROM ops.health_findings
            WHERE id = ANY(v_ids)
            ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END
  LOOP
    v_n := v_n + 1;
    v_msg := v_msg || E'\n' ||
      CASE r.severity WHEN 'critical' THEN '[CRITICAL] ' WHEN 'warning' THEN '[warning] ' ELSE '[info] ' END ||
      r.check_key || COALESCE(' — ' || r.subject, '') || E'\n' || r.detail || E'\n';
  END LOOP;

  IF ops.alert(v_msg) THEN
    UPDATE ops.health_findings SET notified_at = now() WHERE id = ANY(v_ids);
    RETURN jsonb_build_object('sent', v_n);
  END IF;
  RETURN jsonb_build_object('sent', 0, 'reason', 'alerting unconfigured');
END $function$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. The watchdog
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Six checks plus one self-healing repair. Every check that can produce a SET of
-- subjects pairs record_finding with resolve_missing, so findings close
-- themselves when the underlying condition clears.
--
-- The run row is inserted BEFORE any check and completed after, and the
-- EXCEPTION block stamps finished_at + error before re-raising — so a watchdog
-- that dies mid-cycle still leaves evidence of having run. That is the same
-- always-reach-a-terminal-status discipline the autopilot job is missing, which
-- is what check 1 exists to clean up after.
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
  IF v_reaped > 0 THEN
    PERFORM ops.record_finding('autopilot_timeout','critical','autopilot',
      format('Reaped %s autopilot run(s) killed at the 300s ceiling. The job does not fit in one invocation and must be split per organisation or moved to a queue.', v_reaped), v_reaped);
  END IF;

  -- 2. Nothing has ever published while drafts keep accruing.
  PERFORM 1 FROM posts WHERE published_at IS NOT NULL LIMIT 1;
  IF NOT FOUND THEN
    PERFORM ops.record_finding('never_published','critical','portfolio',
      format('No post has ever published. %s posts exist; %s created in the last 7 days.',
        (SELECT count(*) FROM posts),
        (SELECT count(*) FROM posts WHERE created_at > now() - INTERVAL '7 days')),
      (SELECT count(*) FROM posts));
  END IF;

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

  -- 6. Spend approaching the ceiling.
  PERFORM ops.record_finding('spend_ceiling','warning', q.organization_id,
    format('Media spend at %s%% of the daily cap.', round(q.pct)), q.pct)
  FROM (
    SELECT o.organization_id,
           100.0 * COALESCE((SELECT sum(e.delta_usd) FROM media_spend_events e
                              WHERE e.organization_id=o.organization_id
                                AND e.window_at::date = now()::date),0) / NULLIF(o.daily_budget_usd,0) AS pct
    FROM organization_video_quotas o) q
  WHERE q.pct >= 80;

  SELECT count(*) INTO v_open FROM ops.health_findings WHERE resolved_at IS NULL;
  UPDATE ops.watchdog_runs
     SET finished_at = now(), findings_open = v_open, actions_taken = v_actions
   WHERE id = v_run_id;

  RETURN jsonb_build_object('run_id',v_run_id,'reaped',v_reaped,'actions',v_actions,'open_findings',v_open);
EXCEPTION WHEN OTHERS THEN
  UPDATE ops.watchdog_runs SET finished_at = now(), error = SQLERRM WHERE id = v_run_id;
  RAISE;
END $function$;

-- Detect, then tell. The single entry point pg_cron calls.
CREATE OR REPLACE FUNCTION ops.watchdog_cycle()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'ops', 'public'
AS $function$
DECLARE v_w jsonb; v_n jsonb;
BEGIN
  v_w := ops.watchdog();
  v_n := ops.notify_pending();
  RETURN v_w || v_n;
END $function$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. Function privileges and the schedule
-- ═══════════════════════════════════════════════════════════════════════════
--
-- PostgreSQL confers EXECUTE on PUBLIC for every new function. These are all
-- SECURITY DEFINER and several of them WRITE, so that default is withdrawn and
-- re-conferred on service_role alone. Schema USAGE already blocks anon and
-- authenticated, but defence in depth is warranted for a definer function that
-- can rewrite autopilot_runs.
DO $$
DECLARE v_fn text;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY[
    'ops.record_finding(text,text,text,text,numeric)',
    'ops.resolve_missing(text,text[])',
    'ops.alert(text)',
    'ops.notify_pending()',
    'ops.watchdog()',
    'ops.watchdog_cycle()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', v_fn);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_fn);
    END IF;
  END LOOP;
END $$;

-- Register the 15-minute cycle. Guarded on pg_cron: a throwaway PostgreSQL has
-- no cron schema, and an unguarded cron.schedule would abort the whole script
-- there. Unschedule-then-schedule makes a re-apply idempotent rather than
-- raising on the duplicate job name — and, more importantly, means a re-apply
-- CORRECTS a schedule someone changed by hand, instead of leaving the drift in
-- place while reporting success.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ops-watchdog') THEN
      PERFORM cron.unschedule('ops-watchdog');
    END IF;
    PERFORM cron.schedule('ops-watchdog', '*/15 * * * *', 'SELECT ops.watchdog_cycle();');
  ELSE
    RAISE NOTICE 'pg_cron is not installed — ops-watchdog was NOT scheduled. '
                 'The functions exist and can be called by hand. This is expected '
                 'on a throwaway database and a DEFECT on production.';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. POST-APPLY VERIFICATION — run these, do not assume
-- ═══════════════════════════════════════════════════════════════════════════
--
--   -- 1. three tables, RLS on, ZERO policies (deny-all is the design).
--   SELECT c.relname, c.relrowsecurity AS rls,
--          (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS policies
--   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
--   WHERE n.nspname = 'ops' AND c.relkind = 'r' ORDER BY c.relname;
--   -- expect: config/health_findings/watchdog_runs, rls = true, policies = 0
--
--   -- 2. the upsert key exists and is genuinely UNIQUE on the right columns.
--   --    Name-only matching would pass a differently-scoped index.
--   SELECT c.relname, i.indisunique, pg_get_indexdef(i.indexrelid)
--   FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
--   WHERE c.relname = 'health_findings_check_key_subject_key';
--   -- expect: indisunique = true, UNIQUE (check_key, subject)
--
--   -- 3. all six functions, all SECURITY DEFINER.
--   SELECT p.proname, p.prosecdef FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'ops' ORDER BY p.proname;
--   -- expect 6 rows, prosecdef = true throughout
--
--   -- 4. anon and authenticated hold NOTHING, on the schema or in it.
--   --    Expect ZERO rows. Any row here is a leak of the findings register.
--   SELECT n.nspname AS obj, r.rolname, a.privilege_type
--   FROM pg_namespace n, aclexplode(n.nspacl) a JOIN pg_roles r ON r.oid = a.grantee
--   WHERE n.nspname = 'ops' AND r.rolname IN ('anon','authenticated')
--   UNION ALL
--   SELECT c.relname, r.rolname, a.privilege_type
--   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace,
--        aclexplode(c.relacl) a JOIN pg_roles r ON r.oid = a.grantee
--   WHERE n.nspname = 'ops' AND r.rolname IN ('anon','authenticated');
--
--   -- 5. the schedule is registered and active.
--   SELECT jobname, schedule, active, command FROM cron.job WHERE jobname = 'ops-watchdog';
--   -- expect: */15 * * * *, active = true, SELECT ops.watchdog_cycle();
--
--   -- 6. POSITIVE CONTROL — prove the watchdog actually runs and can detect.
--   --    A verification that only checks objects EXIST would pass against a
--   --    watchdog that throws on every invocation.
--   SELECT ops.watchdog();
--   -- expect a jsonb object carrying run_id, reaped, actions, open_findings
--
--   SELECT id, started_at, finished_at, findings_open, actions_taken, error
--   FROM ops.watchdog_runs ORDER BY id DESC LIMIT 1;
--   -- expect finished_at NOT NULL and error NULL — a row with finished_at set
--   -- and an error is a run that FAILED, which reads as success if you only
--   -- check that a row appeared.
--
--   SELECT check_key, severity, subject, resolved_at IS NULL AS open
--   FROM ops.health_findings ORDER BY severity, check_key;
--   -- Until Telegram is wired, expect alerting_unconfigured OPEN. That finding
--   -- is the watchdog correctly reporting that it cannot reach anybody.
