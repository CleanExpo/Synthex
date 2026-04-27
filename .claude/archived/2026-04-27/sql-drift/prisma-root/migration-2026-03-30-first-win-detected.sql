-- Migration: Add first_win_detected to organizations
-- Issue: SYN-525 — First Win Notification System
-- Date: 2026-03-30
--
-- Apply with:
--   npx prisma db execute --file prisma/migration-2026-03-30-first-win-detected.sql --url "$DIRECT_URL"

ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "first_win_detected" BOOLEAN NOT NULL DEFAULT false;
