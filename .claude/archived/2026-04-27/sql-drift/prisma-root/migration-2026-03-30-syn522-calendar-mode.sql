-- Migration: SYN-522 — Add calendarMode to organizations table
-- Generated: 2026-03-30
-- Safe: additive only, default value ensures backward compatibility

ALTER TABLE "organizations"
ADD COLUMN IF NOT EXISTS "calendar_mode" TEXT NOT NULL DEFAULT 'shadow';
