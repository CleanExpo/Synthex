-- ═══════════════════════════════════════════════════════════════════════════
-- Autopilot: lower Disaster Recovery's auto-approve threshold from 100 to 80
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Founder ruling, 2026-08-06. This is a deliberate commercial-posture change,
-- not a bug fix — recorded here rather than applied by hand so it leaves an
-- artifact, per the repo's change-management rule.
--
-- WHY
--
-- `autopilot_configs.auto_approve_threshold = 100` on Disaster Recovery was a
-- default nobody revisited, not a hold-everything posture. Two things establish
-- that:
--
--   * Unite-Group, the only other autopilot config, already sits at 80.
--   * The highest quality score ever produced is 87. Measured across all 240
--     autopilot posts on production (2026-07-17 → 2026-08-06):
--
--         min 71 · mean 78.7 · max 87
--         >= 80 : 84 posts (35.0%)
--         >= 85 : 13 posts
--         >= 90 : 0 posts
--
--     A threshold of 100 was therefore not merely strict, it was unreachable.
--
-- CONSEQUENCE
--
-- `app/api/cron/autopilot/route.ts` maps the gate decision straight to post
-- status: `bestDecision === 'schedule' ? 'scheduled' : 'draft'`. Because
-- 'schedule' never fired, all 240 autopilot posts are `draft` and none has ever
-- been published — the `never_published` finding ops.watchdog() reports as
-- critical. At 80, roughly 35% of each night's ~12 posts become `scheduled`.
--
-- COST NOTE — read before applying.
--
-- The same route gates grounded image generation on `postStatus === 'scheduled'`
-- (route.ts:568). Lowering this threshold therefore starts generating images for
-- ~4 posts per night, which is new recurring spend, and the Real-Images-Only
-- pipeline BLOCKS when no owned reference exists for a subject. Until the
-- autopilot terminal-status defect is fixed, a block thrown there can strand the
-- run at status='running'. Apply this together with those fixes, not ahead of
-- them.
--
-- IDEMPOTENT: only moves a threshold that is still exactly 100, so re-running
-- after any later tuning is a no-op rather than a clobber.

-- ═══════════════════════════════════════════════════════════════════════════
-- 0. WRONG-DATABASE GUARD — refuse to run anywhere but Synthex
-- ═══════════════════════════════════════════════════════════════════════════
--
-- current_database() is 'postgres' on every Supabase project and so cannot
-- identify one; see 20260805000000_ops_watchdog.sql for the incident that
-- established this. Assert the tables this migration actually touches instead.
DO $$
DECLARE v_missing text[];
BEGIN
  SELECT array_agg(t ORDER BY t) INTO v_missing
  -- Identity only. public.autopilot_configs is NOT asserted here: a
  -- `with_data: false` Supabase preview of Synthex does not carry it, and an
  -- earlier version of this list rejected that preview as "wrong database" and
  -- blocked the migration behind it. Its absence is handled below as "nothing
  -- to change here", which is the truthful reading — a database with no
  -- autopilot config has no threshold to lower.
  FROM unnest(ARRAY[
    'public.organizations',
    'public.campaigns',
    'public.posts'
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
-- 1. Apply
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_org_id   text := 'cmm2kuyrz0000jl04jqhtjvji';  -- Disaster Recovery
  v_before   integer;
  v_after    integer;
  v_org_name text;
BEGIN
  -- Absent table or absent org means there is nothing here to change, which is
  -- the normal shape of a preview branch or any Synthex database that has never
  -- run autopilot. Raising in that case turns a correct no-op into a failed
  -- migration and blocks everything behind it — which is exactly what an
  -- earlier version of this file did to PR #886's Supabase preview.
  --
  -- Skipping is safe because the protection that matters is NOT "does the row
  -- exist" but "is the row I am about to write the right one", and that check
  -- is below and unchanged: the update is refused unless the id resolves to an
  -- organisation actually named Disaster Recovery.
  IF to_regclass('public.autopilot_configs') IS NULL THEN
    RAISE NOTICE 'No public.autopilot_configs here — no autopilot threshold to lower. Skipped.';
    RETURN;
  END IF;

  SELECT name INTO v_org_name FROM organizations WHERE id = v_org_id;

  IF v_org_name IS NULL THEN
    RAISE NOTICE 'Disaster Recovery organisation (%) not present here — nothing to change. Skipped.', v_org_id;
    RETURN;
  END IF;

  IF v_org_name <> 'Disaster Recovery' THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Organisation id does not belong to Disaster Recovery — nothing was changed.',
      DETAIL  = format('organizations.id %L is named %L.', v_org_id, v_org_name);
  END IF;

  SELECT auto_approve_threshold INTO v_before
  FROM autopilot_configs WHERE organization_id = v_org_id;

  UPDATE autopilot_configs
  SET auto_approve_threshold = 80
  WHERE organization_id = v_org_id
    AND auto_approve_threshold = 100;

  SELECT auto_approve_threshold INTO v_after
  FROM autopilot_configs WHERE organization_id = v_org_id;

  IF v_before = 100 AND v_after = 80 THEN
    RAISE NOTICE 'Disaster Recovery auto_approve_threshold: 100 -> 80 (applied).';
  ELSIF v_before = 80 THEN
    RAISE NOTICE 'Disaster Recovery auto_approve_threshold already 80 — no change.';
  ELSE
    RAISE NOTICE 'Disaster Recovery auto_approve_threshold left at % — not 100, so not touched.', v_after;
  END IF;
END $$;
