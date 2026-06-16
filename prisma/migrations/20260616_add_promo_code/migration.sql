-- Migration: Discount / promo codes (backlog #14).
--
-- Adds ONE table that stores org-scoped, usage-capped discount codes redeemable
-- at Stripe checkout. A submitted code is validated (active, not expired, under
-- usage_cap, belongs to the redeeming organisation), translated into a Stripe
-- coupon, applied as a checkout discount, and its usage_count is incremented.
--
-- discount_type is 'percent' (discount_value 1–100) or 'amount' (discount_value
-- in cents AUD). `code` carries a UNIQUE index so each code maps to a single
-- Stripe coupon.
--
-- Org-scoping is enforced at the query layer (no DB FK to organizations(id) —
-- that column has a known TEXT/UUID FK-mismatch hazard, see
-- .claude/rules/database/supabase-migrations.md). The table is self-contained,
-- mirroring follower_snapshots (20260615) and studio_content_drafts (20260529),
-- for a safe additive migration.
--
-- NOT YET APPLIED to production. The orchestrator applies it out-of-band to
-- znyjoyjsvjotlzjppzal via the Supabase MCP apply_migration tool.
--
-- To apply elsewhere with the Prisma 7 CLI: `db execute` no longer takes --url; it reads
-- the datasource from prisma.config.ts (DIRECT_URL). Because .env is dotenvx-encrypted, the
-- plain dotenv loader injects nothing locally — run it through dotenvx so DIRECT_URL decrypts:
--   npx dotenvx run -- npx prisma@7.7.0 db execute \
--     --file prisma/migrations/20260616_add_promo_code/migration.sql
-- (On Vercel, DIRECT_URL is already in process.env.) Additive + IF NOT EXISTS — safe to re-run.

CREATE TABLE IF NOT EXISTS "promo_codes" (
  "id"              TEXT          NOT NULL,
  "code"            TEXT          NOT NULL,
  "discount_type"   TEXT          NOT NULL,
  "discount_value"  INTEGER       NOT NULL,
  "usage_cap"       INTEGER       NOT NULL,
  "usage_count"     INTEGER       NOT NULL DEFAULT 0,
  "active"          BOOLEAN       NOT NULL DEFAULT true,
  "expires_at"      TIMESTAMP(3),
  "organization_id" TEXT          NOT NULL,
  "created_at"      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "promo_codes_code_key"
  ON "promo_codes" ("code");

CREATE INDEX IF NOT EXISTS "promo_codes_org_active_idx"
  ON "promo_codes" ("organization_id", "active");
