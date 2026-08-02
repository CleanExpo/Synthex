-- SYN-1115 (round-4 refactor) — append-only media spend event log.
--
-- Replaces mutable-counter accounting for image spend. The counter model
-- required every increment and decrement to happen exactly once across a
-- boundary with no transaction, and four rounds of compensating actions each
-- moved the failure rather than removing it. Spend is now derived:
--
--   spend(window) = SUM(delta_usd) over media_spend_events in the window
--
-- Every event carries a deterministic event_key, so a replayed webhook, retry
-- or sweep re-derives the same key and the unique index makes the insert a
-- no-op. Idempotent by construction rather than by compensation.
--
-- Purely additive: new table only. organization_video_quotas is unchanged and
-- still holds the caps.
--
-- Rollback: see ROLLBACK.sql in this directory.

-- CreateTable
CREATE TABLE "media_spend_events" (
    "id" TEXT NOT NULL,
    "event_key" TEXT NOT NULL,
    "hold_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "initiated_by" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "delta_usd" DECIMAL(10,4) NOT NULL,
    "run_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_spend_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_spend_events_event_key_key" ON "media_spend_events"("event_key");

-- CreateIndex
CREATE INDEX "media_spend_events_organization_id_created_at_idx" ON "media_spend_events"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "media_spend_events_hold_id_idx" ON "media_spend_events"("hold_id");

