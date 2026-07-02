-- Migration: Follower-growth snapshot history (analytics growth chart + follower-growth KPI).
--
-- Adds ONE table that records a daily follower count per PlatformConnection so the
-- analytics growth chart + follower-growth KPI can show REAL follower-growth-over-time
-- from accumulated history, instead of today's proxy (postsChange / reach). The
-- `follower-snapshot` cron writes one row per active connection per run from
-- PlatformConnection.metadata.followers.
--
-- Org-scoping is enforced at the query layer (no DB FK to organizations(id) — that
-- column has a known TEXT/UUID FK-mismatch hazard, see
-- .claude/rules/database/supabase-migrations.md). The table is self-contained (no DB
-- FK to platform_connections either) for a safe additive migration, mirroring
-- studio_content_drafts (20260529). organization_id is NULLABLE (personal connections).
--
-- NOT YET APPLIED to production. The orchestrator applies it out-of-band to
-- znyjoyjsvjotlzjppzal via the Supabase MCP apply_migration tool.
--
-- To apply elsewhere with the Prisma 7 CLI: `db execute` no longer takes --url; it reads
-- the datasource from prisma.config.ts (DIRECT_URL). Because .env is dotenvx-encrypted, the
-- plain dotenv loader injects nothing locally — run it through dotenvx so DIRECT_URL decrypts:
--   npx dotenvx run -- npx prisma@7.7.0 db execute \
--     --file prisma/migrations/20260615_add_follower_snapshot/migration.sql
-- (On Vercel, DIRECT_URL is already in process.env.) Additive + IF NOT EXISTS — safe to re-run.

CREATE TABLE IF NOT EXISTS "follower_snapshots" (
  "id"              TEXT          NOT NULL,
  "connection_id"   TEXT          NOT NULL,
  "user_id"         TEXT          NOT NULL,
  "organization_id" TEXT,
  "platform"        TEXT          NOT NULL,
  "followers"       INTEGER       NOT NULL,
  "captured_at"     TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "follower_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "follower_snapshots_org_platform_captured_idx"
  ON "follower_snapshots" ("organization_id", "platform", "captured_at");

CREATE INDEX IF NOT EXISTS "follower_snapshots_user_captured_idx"
  ON "follower_snapshots" ("user_id", "captured_at");

CREATE INDEX IF NOT EXISTS "follower_snapshots_connection_captured_idx"
  ON "follower_snapshots" ("connection_id", "captured_at");
