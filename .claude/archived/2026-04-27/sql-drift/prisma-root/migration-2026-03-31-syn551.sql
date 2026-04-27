-- Migration: SYN-551 — Autonomous Post Trust Architecture Layer
-- Date: 2026-03-31
-- Adds auto_publish_paused + cancellation fields to organizations table.
-- Backward-compatible: all new columns have defaults or are nullable.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS auto_publish_paused BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
