-- SYN-1115 — append-only media spend event log (image AND video).
--
-- Spend is derived rather than counted:
--
--   spend(window) = SUM(delta_usd) over media_spend_events WHERE window_at IN window
--
-- Two events per hold with deterministic keys; the finalize key is shared by
-- settle, release and sweep, so exactly one terminal event can ever exist and a
-- replay conflicts on the unique index instead of double-charging.
--
-- window_at is ALWAYS the reserve instant, copied onto the finalize event, so a
-- hold reserved before midnight and settled after it lands wholly in one window
-- rather than over-counting one day and going negative the next.
--
-- video_generations.spend_hold_id links a job to its reservation so the webhook
-- can finalise idempotently with no compensating unclaim.
--
-- Additive only. organization_video_quotas is unchanged and still holds the caps.
--
-- Rollback: see ROLLBACK.sql in this directory.

-- AlterTable
ALTER TABLE "video_generations" ADD COLUMN     "spend_hold_id" TEXT;

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
CREATE UNIQUE INDEX "media_spend_events_event_key_key" ON "media_spend_events"("event_key");

-- CreateIndex
CREATE INDEX "media_spend_events_organization_id_window_at_idx" ON "media_spend_events"("organization_id", "window_at");

-- CreateIndex
CREATE INDEX "media_spend_events_hold_id_idx" ON "media_spend_events"("hold_id");

