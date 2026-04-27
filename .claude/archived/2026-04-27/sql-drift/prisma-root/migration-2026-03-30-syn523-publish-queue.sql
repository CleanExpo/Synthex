-- Migration: SYN-523 — Create publish_queue table
-- Generated: 2026-03-30
-- Safe: additive only — no existing tables modified

CREATE TABLE IF NOT EXISTS "publish_queue" (
  "id"              TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "organization_id" TEXT        NOT NULL,
  "calendar_id"     TEXT        NOT NULL,
  "slot_id"         TEXT        NOT NULL,
  "platform"        TEXT        NOT NULL,
  "scheduled_at"    TIMESTAMPTZ NOT NULL,
  "status"          TEXT        NOT NULL DEFAULT 'pending',
  "attempts"        INTEGER     NOT NULL DEFAULT 0,
  "next_retry_at"   TIMESTAMPTZ,
  "last_error"      TEXT,
  "published_at"    TIMESTAMPTZ,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "publish_queue_pkey" PRIMARY KEY ("id")
);

-- Indexes for the 15-min queue processor hot path
CREATE INDEX IF NOT EXISTS "publish_queue_status_scheduled_at_idx"
  ON "publish_queue" ("status", "scheduled_at");

CREATE INDEX IF NOT EXISTS "publish_queue_organization_id_status_idx"
  ON "publish_queue" ("organization_id", "status");

CREATE INDEX IF NOT EXISTS "publish_queue_calendar_id_idx"
  ON "publish_queue" ("calendar_id");

-- updatedAt trigger (consistent with other tables)
CREATE OR REPLACE FUNCTION update_publish_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_publish_queue_updated_at ON "publish_queue";
CREATE TRIGGER set_publish_queue_updated_at
  BEFORE UPDATE ON "publish_queue"
  FOR EACH ROW EXECUTE FUNCTION update_publish_queue_updated_at();
