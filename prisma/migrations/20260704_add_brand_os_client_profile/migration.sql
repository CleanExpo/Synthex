-- Migration: 3-Layer Prompt System (SYN-515) — Core + Client persistence.
-- Source of truth: prisma/schema.prisma models BrandOperatingSystem, ClientProfile,
-- and PromptTemplate.layer.
--
-- Additive only — two new tables (both 1:1 with organizations, mirroring brand_dna)
-- plus one nullable column on prompt_templates. No drops, no renames, no type
-- changes. Fully backward-compatible; uses IF NOT EXISTS for idempotent execution.
--
-- Column names are camelCase to match the BrandDNA convention (no per-field @map).
--
-- Apply via the Supabase MCP apply_migration tool against project
--   znyjoyjsvjotlzjppzal
-- (PROD apply is the founder's gate — this PR applies to a Supabase BRANCH only).

-- ==============================================================================
-- 1. BRAND OPERATING SYSTEM (Core layer)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "brand_operating_system" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT '',
    "qualityThreshold" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "systemPromptOverride" TEXT,
    "rules" JSONB NOT NULL DEFAULT '[]',
    "outputStructure" JSONB NOT NULL DEFAULT '{}',
    "decisionLogic" JSONB NOT NULL DEFAULT '{}',
    "changelog" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_operating_system_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "brand_operating_system_organizationId_key"
    ON "brand_operating_system"("organizationId");

CREATE INDEX IF NOT EXISTS "brand_operating_system_organizationId_idx"
    ON "brand_operating_system"("organizationId");

DO $$ BEGIN
    ALTER TABLE "brand_operating_system"
        ADD CONSTRAINT "brand_operating_system_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ==============================================================================
-- 2. CLIENT PROFILE (Client layer)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "client_profile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "budgetTier" TEXT,
    "intakeStatus" TEXT NOT NULL DEFAULT 'pending',
    "intakeSource" TEXT,
    "intakeCompletedAt" TIMESTAMP(3),
    "icp" JSONB NOT NULL DEFAULT '{}',
    "offers" JSONB NOT NULL DEFAULT '[]',
    "proofPoints" JSONB NOT NULL DEFAULT '[]',
    "competitors" JSONB NOT NULL DEFAULT '[]',
    "toneKeywords" JSONB NOT NULL DEFAULT '[]',
    "antiPatterns" JSONB NOT NULL DEFAULT '[]',
    "vocabularyBank" JSONB NOT NULL DEFAULT '{}',
    "goals" JSONB NOT NULL DEFAULT '[]',
    "channels" JSONB NOT NULL DEFAULT '[]',
    "constraints" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_profile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "client_profile_organizationId_key"
    ON "client_profile"("organizationId");

CREATE INDEX IF NOT EXISTS "client_profile_organizationId_idx"
    ON "client_profile"("organizationId");

DO $$ BEGIN
    ALTER TABLE "client_profile"
        ADD CONSTRAINT "client_profile_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ==============================================================================
-- 3. PROMPT TEMPLATES — add layer column (3-layer classification)
-- ==============================================================================

ALTER TABLE "prompt_templates"
    ADD COLUMN IF NOT EXISTS "layer" TEXT DEFAULT 'task';
