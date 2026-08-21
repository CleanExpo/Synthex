-- SYN-40: Brand presets (overlay-spec customisation).
--
-- Source of truth: prisma/schema.prisma — BrandPreset (@@map("brand_presets")),
-- NEW, appended at schema end with the // SYN-40 marker.
--
-- STRICTLY CREATE-ONLY + idempotent (IF NOT EXISTS throughout; FK/policy adds
-- wrapped in exception-swallowing DO blocks). No drops, no renames, no type
-- changes, no alterations to any existing table.
--
-- PROD apply is the founder's gate — never `prisma db push` / `prisma migrate
-- deploy` against prod from CI or a dev box. Apply via the Supabase MCP
-- apply_migration tool (project znyjoyjsvjotlzjppzal) to a BRANCH first. This
-- folder may be renamed at merge for timestamp ordering.

-- CreateTable
CREATE TABLE IF NOT EXISTS "brand_presets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "primary_color" TEXT NOT NULL,
    "secondary_color" TEXT,
    "accent_color" TEXT,
    "font" TEXT NOT NULL,
    "logo_url" TEXT,
    "cta_text" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_presets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (non-unique — many presets per org)
CREATE INDEX IF NOT EXISTS "brand_presets_organization_id_idx"
    ON "brand_presets"("organization_id");

-- AddForeignKey (ADD CONSTRAINT has no IF NOT EXISTS — swallow duplicates)
DO $$ BEGIN
  ALTER TABLE "brand_presets"
    ADD CONSTRAINT "brand_presets_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;

-- Service-role only. RLS enabled + no authenticated SELECT/INSERT policy means
-- all access is via the API service-role key (which bypasses RLS). Presets are
-- read/written server-side only through the tenant-filtered
-- /api/brand-presets routes (withAuth → organizationId = clientId), never from
-- a browser-held anon key. Canonical pattern per
-- prisma/migrations/20260710130000_syn_mcp_006_evidence_core/migration.sql.
ALTER TABLE "brand_presets" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "service_role_brand_presets"
    ON "brand_presets" FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN datatype_mismatch THEN NULL;
  WHEN undefined_function THEN NULL;
END $$;
