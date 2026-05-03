-- Migration: Add 2 missing columns to organizations.
-- Source of truth for these column definitions is prisma/schema.prisma
-- (Organization model lines 504 + 631).
--
-- Why these specifically: production postgres logs were showing repeated
-- ERROR rows for both column names; every dashboard page that read them
-- triggered the failure. Fully additive; safe defaults match the Prisma
-- schema's @default() so existing rows don't need a backfill.
--
-- Apply with:
--   npx prisma db execute \
--     --file prisma/migrations/20260503_fix_organizations_columns/migration.sql \
--     --url "$DIRECT_URL"

-- ── 1. first_win_detected (Boolean, default false) ──────────────────────────
-- Used by: SYN-525 engagement-milestone tracking.
-- Reads in production were failing with:
--   ERROR: column organizations.first_win_detected does not exist
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS first_win_detected BOOLEAN NOT NULL DEFAULT false;

-- ── 2. calendar_mode (Text, default 'shadow') ───────────────────────────────
-- Used by: SYN-522 content-calendar autonomy.
--   'shadow' = review all posts before publishing (default, safe)
--   'live'   = auto-publish posts at scheduled time
-- Reads in production were failing with:
--   ERROR: column organizations.calendar_mode does not exist
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS calendar_mode TEXT NOT NULL DEFAULT 'shadow';

-- ── Verification ────────────────────────────────────────────────────────────
-- After applying, both should return one row each:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='organizations'
--      AND column_name IN ('first_win_detected', 'calendar_mode');
