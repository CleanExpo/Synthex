-- SYN-MCP-004-1: scoped MCP key registry (SYN-1080).
--
-- Source of truth: prisma/schema.prisma model McpApiKey (@@map("mcp_api_keys")).
-- Replaces the plaintext SYNTHEX_MCP_KEYS env map as the primary MCP auth path
-- (app/api/mcp/auth.ts): the raw bearer key is NEVER stored — only its sha-256
-- hex digest (key_hash). Keys support per-tool scopes (consumed by SYN-MCP-007),
-- expiry (expires_at), soft revocation (revoked_at) and last-use stamping.
--
-- Additive + idempotent (IF NOT EXISTS throughout). No drops, no renames, no
-- type changes. CREATE TABLE / index bodies follow the canonical
-- `prisma migrate diff --from-empty --to-schema` output for this model; RLS is
-- added on top per the repo's service-role-only convention
-- (client_engagement_events / geo_citation_events).
--
-- Privacy/security: no PII and no secrets at rest — key_hash is a one-way
-- sha-256 digest; organization_id / user_id are internal ids (soft refs, no FK,
-- mirroring promo_codes / creators for a safe additive migration).
--
-- Apply via the Supabase MCP apply_migration tool against project
--   znyjoyjsvjotlzjppzal
-- PROD apply is the founder's gate (SYN-1085) — never `prisma db push` /
-- `prisma migrate deploy` against prod from CI or a dev box. Apply to a
-- Supabase BRANCH first. This folder may be renamed at merge time for
-- monotonic timestamp ordering (after SYN-MCP-001).

-- CreateTable
CREATE TABLE IF NOT EXISTS "mcp_api_keys" (
    "id" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcp_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "mcp_api_keys_key_hash_key"
    ON "mcp_api_keys"("key_hash");

CREATE INDEX IF NOT EXISTS "mcp_api_keys_organization_id_idx"
    ON "mcp_api_keys"("organization_id");

-- Service-role only. RLS enabled + no authenticated/anon policy means all
-- access is via the API service-role key (which bypasses RLS). Key hashes are
-- only ever read server-side by app/api/mcp/auth.ts and written by the
-- admin-gated app/api/admin/mcp-keys route — never from a browser-held anon
-- key. Canonical pattern per
-- supabase/migrations/20260319000001_rls_comprehensive_all_tables.sql and
-- prisma/migrations/20260710000000_client_engagement_events.
ALTER TABLE "mcp_api_keys" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "service_role_mcp_api_keys"
    ON "mcp_api_keys" FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN datatype_mismatch THEN NULL;
  WHEN undefined_function THEN NULL;
END $$;
