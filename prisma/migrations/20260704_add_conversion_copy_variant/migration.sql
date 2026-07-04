-- Migration: Add users.conversion_copy_variant — the trial-conversion copy A/B arm (SYN-528).
-- Source of truth: prisma/schema.prisma model User field conversionCopyVariant.
--
-- Additive only — one nullable column with a 'control' default. No drops, no type
-- changes, fully backward-compatible. Existing rows default to 'control' (the
-- pre-existing behaviour, since the column was previously absent and the dashboard
-- fell back to 'control'). New signups are assigned 'win' | 'control' 50/50 in
-- app/api/auth/signup/route.ts, making the previously-dead A/B experiment live.
--
-- Apply with:
--   npx prisma db execute \
--     --file prisma/migrations/20260704_add_conversion_copy_variant/migration.sql \
--     --url "$DIRECT_URL"

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "conversion_copy_variant" TEXT DEFAULT 'control';
