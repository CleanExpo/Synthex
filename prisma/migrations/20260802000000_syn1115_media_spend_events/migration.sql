-- SYN-1115 — media spend event log + provider attempt log, with cutover.
--
-- Spend is derived rather than counted:
--   spend(window) = SUM(delta_usd) over media_spend_events WHERE window_at IN window
--
-- media_provider_attempts records ONE ROW PER ACTUAL PAID PROVIDER CALL, so
-- settlement and the stale sweep read what was really charged instead of
-- inferring it. Without it the sweep could not tell "died before spending" from
-- "spent, then died" and wrote paid calls off as zero.
--
-- window_at is always the reserve instant, copied onto the finalize event, so a
-- hold spanning midnight lands wholly in one window instead of over-counting
-- one day and going negative the next.
--
-- CUTOVER (round-6 review finding 1). The new ceiling reads ONLY the event log,
-- so deploying the DDL alone would reset every organisation's effective
-- headroom to zero and orphan in-flight video jobs. The backfill below is part
-- of the same migration and must not be split from it:
--
--   1. seed one synthetic reserve event per organisation carrying its current
--      counter spend, so today's and this month's consumption survive cutover;
--   2. mint a hold id for every video job still 'generating', with a matching
--      reserve event, so its webhook can finalise instead of silently skipping.
--
-- Both steps are idempotent: re-running finds the events already present and
-- the jobs already linked.
--
-- Rollback: see ROLLBACK.sql in this directory.

-- AlterTable
ALTER TABLE "video_generations" ADD COLUMN     "spend_hold_id" TEXT;

-- CreateTable
CREATE TABLE "media_provider_attempts" (
    "id" TEXT NOT NULL,
    "attempt_key" TEXT NOT NULL,
    "hold_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "media_type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "cost_usd" DECIMAL(10,4),
    "output_width" INTEGER,
    "output_height" INTEGER,
    "input_image_count" INTEGER NOT NULL DEFAULT 0,
    "provider_job_id" TEXT,
    "window_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_provider_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_spend_events" (
    "id" TEXT NOT NULL,
    "event_key" TEXT NOT NULL,
    "hold_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "initiated_by" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "delta_usd" DECIMAL(10,4) NOT NULL,
    "window_at" TIMESTAMP(3) NOT NULL,
    "run_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_spend_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_provider_attempts_attempt_key_key" ON "media_provider_attempts"("attempt_key");

-- CreateIndex
CREATE INDEX "media_provider_attempts_hold_id_idx" ON "media_provider_attempts"("hold_id");

-- CreateIndex
CREATE INDEX "media_provider_attempts_organization_id_window_at_idx" ON "media_provider_attempts"("organization_id", "window_at");

-- CreateIndex
CREATE UNIQUE INDEX "media_spend_events_event_key_key" ON "media_spend_events"("event_key");

-- CreateIndex
CREATE INDEX "media_spend_events_organization_id_window_at_idx" ON "media_spend_events"("organization_id", "window_at");

-- CreateIndex
CREATE INDEX "media_spend_events_hold_id_idx" ON "media_spend_events"("hold_id");


-- ── RLS — service-role only ────────────────────────────────────────────────
-- These two tables ARE the admission authority: the ceiling is
-- SUM(delta_usd) over media_spend_events, and settlement reads
-- media_provider_attempts. Created in `public` without this, they inherit
-- whatever grants a Supabase project gives anon/authenticated, so a client
-- holding the publishable key could delete reserve events or insert negative
-- deltas and hand itself budget headroom — defeating both the append-only
-- property and fail-closed admission in one step.
--
-- This is a REGRESSION guard, not defence in depth: the table these replace,
-- organization_video_quotas, already carries exactly this boundary
-- (20260710140000_generative_video_engine/migration.sql:78-86). Matching it
-- keeps the convention the repo already follows for mcp_api_keys and
-- claim_evidence_scores — server-side reads and writes only, never from a
-- browser-held key (release review, pass 9).
ALTER TABLE "media_spend_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "media_provider_attempts" ENABLE ROW LEVEL SECURITY;

-- Belt and braces: RLS does not apply to a table's owner, and default
-- public-schema grants may predate it. Revoking leaves service_role, which
-- bypasses RLS, as the only writer.
REVOKE ALL ON TABLE "media_spend_events" FROM anon, authenticated;
REVOKE ALL ON TABLE "media_provider_attempts" FROM anon, authenticated;

-- ...and GRANT explicitly rather than relying on whatever ambient grants the
-- project happens to give service_role. Verified the hard way: on a database
-- without those defaults the REVOKE above locked out the server too, which
-- would have failed closed in the worst possible place — every reservation
-- erroring at the point of admission.
GRANT ALL ON TABLE "media_spend_events" TO service_role;
GRANT ALL ON TABLE "media_provider_attempts" TO service_role;

DO $$ BEGIN
  CREATE POLICY "service_role_media_spend_events"
    ON "media_spend_events" FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_media_provider_attempts"
    ON "media_provider_attempts" FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

-- ── CUTOVER STEP 1 — carry existing counter spend into the log ──────────────
--
-- Two subtractions, both load-bearing.
--
-- (a) Daily and monthly are SEPARATE windows, so the counter's two figures need
--     two events. Emitting the whole monthly total at month-start would hide
--     today's portion from the daily cap; emitting both totals in full would
--     double-count today inside the month. So the month event carries
--     monthly MINUS today, and the day event carries today.
--
-- (b) The counters ALREADY INCLUDE every in-flight job's estimate — holdQuota
--     incremented them at submit time under the old model. Step 2 below mints a
--     reserve event for each of those jobs so their webhooks can settle, so
--     carrying the counter totals unadjusted would count them TWICE. Each
--     window therefore subtracts the in-flight estimates belonging to it.
--
-- Net effect: every dollar the counters held appears in the log exactly once,
-- attributed to the same window it occupied before.
--
-- Recorded as 'reserve' with no finalize so each contributes its full amount,
-- and keyed so re-running the migration is a no-op.
WITH inflight AS (
  SELECT
    v.organization_id,
    COALESCE(SUM(v.estimated_cost_usd), 0) AS month_usd,
    COALESCE(SUM(v.estimated_cost_usd) FILTER (
      WHERE date_trunc('day', v.created_at AT TIME ZONE 'UTC')
            = date_trunc('day', now() AT TIME ZONE 'UTC')
    ), 0) AS today_usd
  FROM "video_generations" v
  WHERE v.status = 'generating'
    AND v.mode = 'generative'
    AND v.organization_id IS NOT NULL
    AND date_trunc('month', v.created_at AT TIME ZONE 'UTC')
        = date_trunc('month', now() AT TIME ZONE 'UTC')
  GROUP BY v.organization_id
),
carried AS (
  SELECT
    q.organization_id,
    -- today's counter portion, only when the daily counter is current
    CASE WHEN date_trunc('day', q.day_start AT TIME ZONE 'UTC')
              = date_trunc('day', now() AT TIME ZONE 'UTC')
         THEN q.spent_today_usd ELSE 0 END AS today_counter,
    q.spent_usd AS month_counter,
    COALESCE(i.month_usd, 0) AS inflight_month,
    -- Only add today's in-flight back when the daily counter is actually
    -- current. A stale day_start means the day event below never fires, so
    -- adding it back would leave it inside the month event AND minted again
    -- by step 2. Main's holdQuota rolled day_start on every hold, which made
    -- that state unreachable — but this migration should not depend on the
    -- behaviour of a module the same branch rewrites.
    CASE WHEN date_trunc('day', q.day_start AT TIME ZONE 'UTC')
              = date_trunc('day', now() AT TIME ZONE 'UTC')
         THEN COALESCE(i.today_usd, 0) ELSE 0 END AS inflight_today
  FROM "organization_video_quotas" q
  LEFT JOIN inflight i ON i.organization_id = q.organization_id
  WHERE date_trunc('month', q.period_start AT TIME ZONE 'UTC')
        = date_trunc('month', now() AT TIME ZONE 'UTC')
)
INSERT INTO "media_spend_events"
  (id, event_key, hold_id, organization_id, initiated_by, kind, delta_usd, window_at, created_at)
SELECT
  gen_random_uuid()::text,
  'cutover:' || c.organization_id || ':month',
  'cutover-' || c.organization_id || '-month',
  c.organization_id,
  'studio',
  'reserve',
  (c.month_counter - c.today_counter) - (c.inflight_month - c.inflight_today),
  date_trunc('month', now() AT TIME ZONE 'UTC'),
  now()
FROM carried c
-- `<> 0`, not `> 0`. The residual is legitimately NEGATIVE when settlements have
-- pulled a counter below the in-flight total still outstanding against it — a
-- release decrements the counter while the job it belonged to has already left
-- 'generating'. Dropping that row would leave step 2's adopted reserve
-- unopposed and overstate spend by the residual. Zero is the only safe omission.
WHERE (c.month_counter - c.today_counter) - (c.inflight_month - c.inflight_today) <> 0
ON CONFLICT (event_key) DO NOTHING;

WITH inflight_today AS (
  SELECT
    v.organization_id,
    COALESCE(SUM(v.estimated_cost_usd), 0) AS usd
  FROM "video_generations" v
  WHERE v.status = 'generating'
    AND v.mode = 'generative'
    AND v.organization_id IS NOT NULL
    AND date_trunc('day', v.created_at AT TIME ZONE 'UTC')
        = date_trunc('day', now() AT TIME ZONE 'UTC')
  GROUP BY v.organization_id
)
INSERT INTO "media_spend_events"
  (id, event_key, hold_id, organization_id, initiated_by, kind, delta_usd, window_at, created_at)
SELECT
  gen_random_uuid()::text,
  'cutover:' || q.organization_id || ':day',
  'cutover-' || q.organization_id || '-day',
  q.organization_id,
  'studio',
  'reserve',
  q.spent_today_usd - COALESCE(t.usd, 0),
  date_trunc('day', now() AT TIME ZONE 'UTC'),
  now()
FROM "organization_video_quotas" q
LEFT JOIN inflight_today t ON t.organization_id = q.organization_id
WHERE date_trunc('day', q.day_start AT TIME ZONE 'UTC')
      = date_trunc('day', now() AT TIME ZONE 'UTC')
  -- `<> 0` for the same reason as the month event above: a negative day residual
  -- is reachable once today's hold has rolled spent_today_usd forward and an
  -- earlier-day job then settles or releases against it.
  AND q.spent_today_usd - COALESCE(t.usd, 0) <> 0
ON CONFLICT (event_key) DO NOTHING;

-- ── CUTOVER STEP 1c — close the carry holds ────────────────────────────────
-- A carry is already-consumed spend, not an outstanding reservation. But it is
-- SHAPED like one — kind 'reserve', no owning video row, no terminal event —
-- and that is exactly the shape findStaleReservations selects. Left open, every
-- carry sits in the sweep's window forever; being the oldest rows in the table
-- they permanently occupy the head of its `ORDER BY created_at ASC LIMIT 200`
-- and starve genuinely stale reservations behind them.
--
-- (They are not silently cancelled: finalizeSpend resolves the reserve by
-- `hold:{id}:reserve` and the carries are keyed `cutover:{org}:{window}`, so it
-- refuses to write and returns false. The cost is a re-selection and an error
-- log on every sweep run, plus the starvation above — not lost spend.)
--
-- Pairing each carry with a zero-delta terminal event closes the hold without
-- moving any window total, and claims the shared finalize key so no later code
-- path can finalise it either.
INSERT INTO "media_spend_events"
  (id, event_key, hold_id, organization_id, initiated_by, kind, delta_usd, window_at, created_at)
SELECT
  gen_random_uuid()::text,
  'hold:' || r.hold_id || ':final',
  r.hold_id,
  r.organization_id,
  r.initiated_by,
  'settle',
  0,
  r.window_at,
  now()
FROM "media_spend_events" r
WHERE r.kind = 'reserve'
  AND r.event_key LIKE 'cutover:%'
ON CONFLICT (event_key) DO NOTHING;

-- ── CUTOVER STEP 2 — adopt in-flight video jobs ────────────────────────────
-- A job still 'generating' has money reserved under the old counter and no
-- spend_hold_id, so its webhook would skip finalisation entirely. Mint a hold
-- id and a matching reserve event so it settles normally.
UPDATE "video_generations"
SET spend_hold_id = 'adopted-' || id
WHERE status = 'generating'
  AND mode = 'generative'
  AND spend_hold_id IS NULL
  AND organization_id IS NOT NULL;

INSERT INTO "media_spend_events"
  (id, event_key, hold_id, organization_id, initiated_by, kind, delta_usd, window_at, created_at)
SELECT
  gen_random_uuid()::text,
  'hold:' || v.spend_hold_id || ':reserve',
  v.spend_hold_id,
  v.organization_id,
  COALESCE(v.initiated_by, 'studio'),
  'reserve',
  COALESCE(v.estimated_cost_usd, 0),
  -- The job's OWN day, not today: a job submitted yesterday and still
  -- generating belongs to yesterday's window, exactly as the counters had it.
  date_trunc('day', v.created_at AT TIME ZONE 'UTC'),
  now()
FROM "video_generations" v
WHERE v.spend_hold_id LIKE 'adopted-%'
  AND v.organization_id IS NOT NULL
ON CONFLICT (event_key) DO NOTHING;
