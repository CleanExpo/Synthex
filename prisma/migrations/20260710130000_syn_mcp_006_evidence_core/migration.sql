-- SYN-MCP-006: Evidence pipeline core (provider-agnostic source verification).
--
-- Source of truth: prisma/schema.prisma —
--   MarketingAgencySourceRef (+content_hash/retrieved_at/provider/excerpt)
--   ClaimEvidenceScore (@@map("claim_evidence_scores")), NEW.
--
-- STRICTLY CREATE-ONLY + idempotent (IF NOT EXISTS throughout; FK/policy adds
-- wrapped in exception-swallowing DO blocks). No drops, no renames, no type
-- changes, no defaults that force a table rewrite — the four new
-- marketing_agency_source_refs columns are all NULLABLE.
--
-- Apply via the Supabase MCP apply_migration tool against project
--   znyjoyjsvjotlzjppzal
-- PROD apply is the founder's gate (SYN-1085) — never `prisma db push` /
-- `prisma migrate deploy` against prod from CI or a dev box. Apply to a
-- Supabase BRANCH first. This folder may be renamed at merge for timestamp
-- ordering.

-- AlterTable (additive, nullable — no rewrite)
ALTER TABLE "marketing_agency_source_refs" ADD COLUMN IF NOT EXISTS "content_hash" TEXT;
ALTER TABLE "marketing_agency_source_refs" ADD COLUMN IF NOT EXISTS "retrieved_at" TIMESTAMP(3);
ALTER TABLE "marketing_agency_source_refs" ADD COLUMN IF NOT EXISTS "provider" TEXT;
ALTER TABLE "marketing_agency_source_refs" ADD COLUMN IF NOT EXISTS "excerpt" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "claim_evidence_scores" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "claim_id" TEXT NOT NULL,
    "source_ref_id" TEXT NOT NULL,
    "stance" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "scorer" TEXT NOT NULL,
    "rationale" TEXT,
    "scored_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "claim_evidence_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "claim_evidence_scores_claim_id_source_ref_id_scorer_key"
    ON "claim_evidence_scores"("claim_id", "source_ref_id", "scorer");

CREATE INDEX IF NOT EXISTS "claim_evidence_scores_organization_id_claim_id_idx"
    ON "claim_evidence_scores"("organization_id", "claim_id");

CREATE INDEX IF NOT EXISTS "claim_evidence_scores_source_ref_id_idx"
    ON "claim_evidence_scores"("source_ref_id");

-- AddForeignKey (ADD CONSTRAINT has no IF NOT EXISTS — swallow duplicates)
DO $$ BEGIN
  ALTER TABLE "claim_evidence_scores"
    ADD CONSTRAINT "claim_evidence_scores_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "claim_evidence_scores"
    ADD CONSTRAINT "claim_evidence_scores_claim_id_fkey"
    FOREIGN KEY ("claim_id") REFERENCES "marketing_agency_claims"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "claim_evidence_scores"
    ADD CONSTRAINT "claim_evidence_scores_source_ref_id_fkey"
    FOREIGN KEY ("source_ref_id") REFERENCES "marketing_agency_source_refs"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;

-- Service-role only. RLS enabled + no authenticated SELECT/INSERT policy means
-- all access is via the API service-role key (which bypasses RLS). Evidence
-- scores are written server-side only (lib/evidence/entailment.ts via injected
-- Prisma client), never from a browser-held anon key. Canonical pattern per
-- prisma/migrations/20260710000000_client_engagement_events/migration.sql.
ALTER TABLE "claim_evidence_scores" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "service_role_claim_evidence_scores"
    ON "claim_evidence_scores" FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN datatype_mismatch THEN NULL;
  WHEN undefined_function THEN NULL;
END $$;
