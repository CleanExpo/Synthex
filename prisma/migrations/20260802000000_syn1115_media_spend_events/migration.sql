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


-- ── CUTOVER STEP 1 — carry existing counter spend into the log ──────────────
--
-- Daily and monthly are SEPARATE windows, so the counter's two figures need two
-- events, not one. Emitting the whole monthly total at month-start would make
-- today's portion invisible to the daily cap; emitting both totals in full
-- would double-count today inside the month. So:
--
--   event at month-start : monthly_total - today_total   (the earlier days)
--   event at day-start   : today_total                   (today)
--
-- which sums to monthly_total over the month window and today_total over the
-- day window — matching the counters exactly.
--
-- Recorded as 'reserve' with no finalize so each contributes its full amount,
-- and keyed so re-running the migration is a no-op.
INSERT INTO "media_spend_events"
  (id, event_key, hold_id, organization_id, initiated_by, kind, delta_usd, window_at, created_at)
SELECT
  gen_random_uuid()::text,
  'cutover:' || q.organization_id || ':month',
  'cutover-' || q.organization_id || '-month',
  q.organization_id,
  'studio',
  'reserve',
  q.spent_usd - (
    CASE WHEN date_trunc('day', q.day_start AT TIME ZONE 'UTC')
              = date_trunc('day', now() AT TIME ZONE 'UTC')
         THEN q.spent_today_usd ELSE 0 END
  ),
  date_trunc('month', now() AT TIME ZONE 'UTC'),
  now()
FROM "organization_video_quotas" q
WHERE date_trunc('month', q.period_start AT TIME ZONE 'UTC')
      = date_trunc('month', now() AT TIME ZONE 'UTC')
  AND q.spent_usd - (
        CASE WHEN date_trunc('day', q.day_start AT TIME ZONE 'UTC')
                  = date_trunc('day', now() AT TIME ZONE 'UTC')
             THEN q.spent_today_usd ELSE 0 END
      ) > 0
ON CONFLICT (event_key) DO NOTHING;

INSERT INTO "media_spend_events"
  (id, event_key, hold_id, organization_id, initiated_by, kind, delta_usd, window_at, created_at)
SELECT
  gen_random_uuid()::text,
  'cutover:' || q.organization_id || ':day',
  'cutover-' || q.organization_id || '-day',
  q.organization_id,
  'studio',
  'reserve',
  q.spent_today_usd,
  date_trunc('day', now() AT TIME ZONE 'UTC'),
  now()
FROM "organization_video_quotas" q
WHERE q.spent_today_usd > 0
  AND date_trunc('day', q.day_start AT TIME ZONE 'UTC')
      = date_trunc('day', now() AT TIME ZONE 'UTC')
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
  date_trunc('day', now() AT TIME ZONE 'UTC'),
  now()
FROM "video_generations" v
WHERE v.spend_hold_id LIKE 'adopted-%'
  AND v.organization_id IS NOT NULL
ON CONFLICT (event_key) DO NOTHING;
