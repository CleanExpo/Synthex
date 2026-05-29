-- Migration: Client Content Studio — per-client content drafts (SYN-1005 / VS-6).
--
-- Adds ONE organisation-scoped table that backs the studio dashboard: each row is a
-- prepared avatar+voice update awaiting the human-approval gate. Org-scoping is enforced
-- at the query layer (lib/marketing-agency/studio/draft-store.ts) — no DB FK to
-- organizations(id) because that column has a known TEXT/UUID FK-mismatch hazard
-- (see .claude/rules/database/supabase-migrations.md). Additive only — no DROPs.
--
-- Apply with:
--   npx prisma db execute \
--     --file prisma/migrations/20260529_add_studio_content_drafts/migration.sql \
--     --url "$DIRECT_URL"
-- Then regenerate the client:
--   npx prisma generate

CREATE TABLE IF NOT EXISTS "studio_content_drafts" (
  "id"              TEXT          NOT NULL,
  "organization_id" TEXT          NOT NULL,
  "client_slug"     TEXT          NOT NULL,
  "topic"           TEXT          NOT NULL,
  "script"          TEXT          NOT NULL,
  "status"          TEXT          NOT NULL DEFAULT 'awaiting_approval',
  "video_provider"  TEXT          NOT NULL DEFAULT 'heygen',
  "video_id"        TEXT,
  "video_url"       TEXT,
  "platforms"       JSONB         NOT NULL DEFAULT '[]',
  "approved_by"     TEXT,
  "approved_at"     TIMESTAMPTZ(6),
  "published_at"    TIMESTAMPTZ(6),
  "metadata"        JSONB,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "studio_content_drafts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "studio_content_drafts_org_client_status_idx"
  ON "studio_content_drafts" ("organization_id", "client_slug", "status");

CREATE INDEX IF NOT EXISTS "studio_content_drafts_org_status_idx"
  ON "studio_content_drafts" ("organization_id", "status");
