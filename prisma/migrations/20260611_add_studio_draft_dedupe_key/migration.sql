ALTER TABLE "studio_content_drafts"
  ADD COLUMN IF NOT EXISTS "dedupe_key" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "studio_content_drafts_org_client_dedupe_key"
  ON "studio_content_drafts" ("organization_id", "client_slug", "dedupe_key");
