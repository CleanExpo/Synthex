-- ROLLBACK for supabase/migrations/20260805000000_ops_watchdog.sql
--
-- IN A SUBDIRECTORY ON PURPOSE. supabase/migrations/*.sql is applied in
-- filename order; a rollback sitting alongside its own migration would be run
-- as the next migration and immediately undo it. It lives here so no tool picks
-- it up by accident. Run it by hand, deliberately.
--
-- READ THIS BEFORE RUNNING IT ON PRODUCTION
-- The watchdog described by that migration is LIVE on production and running
-- every 15 minutes. Rolling it back does not revert a change — it DELETES a
-- working monitor and the accumulated record of what it found. Production is
-- not the case this rollback was written for; a throwaway verification database
-- is.
--
-- PRECONDITION — what would be destroyed:
--
--   SELECT (SELECT count(*) FROM ops.health_findings) AS findings,
--          (SELECT count(*) FROM ops.health_findings WHERE resolved_at IS NULL) AS open_findings,
--          (SELECT count(*) FROM ops.watchdog_runs)   AS runs,
--          (SELECT count(*) FROM ops.config)          AS config_rows;
--
-- A non-zero open_findings count means the estate has unresolved faults that
-- only this register is tracking. Dropping it does not fix them; it stops
-- anyone knowing about them. Export first:
--
--   SELECT * FROM ops.health_findings ORDER BY id;
--
-- ORDER MATTERS. The cron job is unscheduled FIRST. Dropping the schema while
-- the job is still registered leaves pg_cron firing `SELECT ops.watchdog_cycle()`
-- against a function that no longer exists, which logs an error every 15 minutes
-- forever — a rollback that leaves noise behind is not a clean rollback.

-- 1. Stop the schedule before removing what it calls.
--
-- The two conditions are NESTED, not combined with AND, and that is load-bearing.
-- PL/pgSQL plans an IF condition as a single SQL query, so
--   IF EXISTS (... pg_extension ...) AND EXISTS (SELECT 1 FROM cron.job ...)
-- is parsed as a whole before either half is evaluated. On a database without
-- pg_cron there is no cron.job relation, the parse fails, and the script ABORTS
-- HERE — leaving the schema fully intact while appearing to have run. That is
-- exactly what happened on the first verification pass; the negative control at
-- the foot of this file is what caught it, because `SELECT ops.watchdog_cycle()`
-- kept succeeding after a "completed" rollback.
--
-- Nesting works because PL/pgSQL compiles statements lazily: the inner IF is
-- never reached, so its reference to cron.job is never parsed.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ops-watchdog') THEN
      PERFORM cron.unschedule('ops-watchdog');
    END IF;
  END IF;
END $$;

-- 2. Drop the schema and everything in it.
--
-- CASCADE is required here and is safe in a way it is not for `public` tables:
-- the objects being dropped are entirely self-contained — three tables, two
-- sequences and six functions, with no view, foreign key or policy elsewhere
-- depending on them. The watchdog READS public tables; nothing in public reads
-- ops. Verified 2026-08-05.
--
-- Confirm that is still true before running, so an unexpected dependant is
-- found rather than silently destroyed (expect zero rows):
--
--   SELECT DISTINCT dn.nspname AS dependent_schema, dc.relname AS dependent_object
--   FROM pg_depend d
--   JOIN pg_class dc ON dc.oid = d.objid
--   JOIN pg_namespace dn ON dn.oid = dc.relnamespace
--   JOIN pg_class rc ON rc.oid = d.refobjid
--   JOIN pg_namespace rn ON rn.oid = rc.relnamespace
--   WHERE rn.nspname = 'ops' AND dn.nspname <> 'ops';

DROP SCHEMA IF EXISTS ops CASCADE;

-- POST-ROLLBACK VERIFICATION (run these; do not assume):
--
--   -- 1. the schema is gone — expect zero rows
--   SELECT nspname FROM pg_namespace WHERE nspname = 'ops';
--
--   -- 2. no orphaned functions survived the CASCADE — expect zero rows
--   SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'ops';
--
--   -- 3. the schedule is gone — expect zero rows. Checking only the schema
--   --    would leave a job firing into the void every 15 minutes.
--   SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'ops-watchdog';
--
--   -- 4. NEGATIVE CONTROL — prove the drop actually took effect rather than the
--   --    check being aimed at the wrong name. Expect an error:
--   --    "schema \"ops\" does not exist"
--   SELECT ops.watchdog_cycle();
