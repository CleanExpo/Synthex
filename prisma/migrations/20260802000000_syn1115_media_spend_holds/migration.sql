-- SYN-1115 (round-2 review finding 2) — durable media spend holds.
--
-- A quota hold was previously recorded only in a local variable inside the
-- request. If settlement or release then failed transiently, the estimate
-- stayed charged against the organisation with nothing able to find it again.
-- This table makes a hold a durable fact: written before the provider call,
-- closed on settle/release, and reconciled by /api/cron/video-sweep when it is
-- left open past the sweep threshold.
--
-- Purely additive: new table only, no changes to existing columns, so it is
-- backward-compatible and safe to apply ahead of the code that reads it.
--
-- Rollback: see ROLLBACK.sql in this directory.

-- CreateTable
CREATE TABLE "media_spend_holds" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "initiated_by" TEXT NOT NULL,
    "held_usd" DECIMAL(10,4) NOT NULL,
    "settled_usd" DECIMAL(10,4),
    "status" TEXT NOT NULL DEFAULT 'open',
    "run_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_spend_holds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_spend_holds_status_created_at_idx" ON "media_spend_holds"("status", "created_at");

-- CreateIndex
CREATE INDEX "media_spend_holds_organization_id_created_at_idx" ON "media_spend_holds"("organization_id", "created_at");
