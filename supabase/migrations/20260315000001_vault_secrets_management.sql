-- ==============================================================================
-- SYNTHEX Vault — Centralised Secrets Management (Supabase Migration)
-- Generated: 2026-03-15
--
-- Creates vault_secrets and vault_access_logs tables with RLS policies.
-- Idempotent: safe to run multiple times.
-- ==============================================================================

-- 1. Vault Secrets
CREATE TABLE IF NOT EXISTS "vault_secrets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "secret_type" TEXT NOT NULL,
    "provider" TEXT,
    "encrypted_value" TEXT NOT NULL,
    "encryption_key_version" INTEGER NOT NULL DEFAULT 1,
    "masked_value" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_rotatable" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "last_rotated_at" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'manual',
    "created_by" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vault_secrets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "vault_secrets_organization_id_slug_key"
    ON "vault_secrets"("organization_id", "slug");
CREATE INDEX IF NOT EXISTS "vault_secrets_organization_id_secret_type_idx"
    ON "vault_secrets"("organization_id", "secret_type");
CREATE INDEX IF NOT EXISTS "vault_secrets_organization_id_provider_idx"
    ON "vault_secrets"("organization_id", "provider");
CREATE INDEX IF NOT EXISTS "vault_secrets_organization_id_is_active_idx"
    ON "vault_secrets"("organization_id", "is_active");
CREATE INDEX IF NOT EXISTS "vault_secrets_expires_at_idx"
    ON "vault_secrets"("expires_at");

-- 2. Vault Access Logs
CREATE TABLE IF NOT EXISTS "vault_access_logs" (
    "id" TEXT NOT NULL,
    "vault_secret_id" TEXT REFERENCES "vault_secrets"("id") ON DELETE SET NULL,
    "organization_id" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "actor_type" TEXT NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT 'success',
    "ip_address" TEXT,
    "user_agent" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vault_access_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "vault_access_logs_vault_secret_id_idx"
    ON "vault_access_logs"("vault_secret_id");
CREATE INDEX IF NOT EXISTS "vault_access_logs_organization_id_created_at_idx"
    ON "vault_access_logs"("organization_id", "created_at");
CREATE INDEX IF NOT EXISTS "vault_access_logs_actor_idx"
    ON "vault_access_logs"("actor");
CREATE INDEX IF NOT EXISTS "vault_access_logs_action_idx"
    ON "vault_access_logs"("action");

-- 3. RLS Policies
ALTER TABLE "vault_secrets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vault_access_logs" ENABLE ROW LEVEL SECURITY;

-- Org isolation
DO $$ BEGIN
    CREATE POLICY "vault_secrets_org_isolation" ON "vault_secrets"
        FOR ALL USING ("organization_id" IN (
            SELECT "organization_id" FROM "users" WHERE "id" = auth.uid()::text
        ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "vault_access_logs_org_isolation" ON "vault_access_logs"
        FOR ALL USING ("organization_id" IN (
            SELECT "organization_id" FROM "users" WHERE "id" = auth.uid()::text
        ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Service role bypass
DO $$ BEGIN
    CREATE POLICY "vault_secrets_service_role" ON "vault_secrets"
        FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "vault_access_logs_service_role" ON "vault_access_logs"
        FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
