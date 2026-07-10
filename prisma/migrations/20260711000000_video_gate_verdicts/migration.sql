-- SYN-1094 (Option C): dedicated persistence table for the nexus-viral video
-- gates (Brief / Broadcast grills).
--
-- Source of truth: prisma/schema.prisma model VideoGateVerdict
-- (@@map("video_gate_verdicts")). Replaces the campaign-coupled
-- MarketingAgencyQaReport path used by lib/video/gates — that model has a
-- required campaign_id FK a video gate run has no natural value for, which left
-- assertGatePassed permanently fail-closed for the derive path. This table has
-- a stable `ref` column (the run/job id for the brief gate, the rendered hero
-- video_asset id for the broadcast gate) and no campaign coupling.
--
-- Additive + idempotent (IF NOT EXISTS throughout). No drops, no renames, no
-- type changes. RLS is service-role only, per the repo convention
-- (mcp_api_keys / client_engagement_events / geo_citation_events).
--
-- Privacy/security: no PII and no secrets at rest — organization_id is an
-- internal id (soft ref, no FK, mirroring mcp_api_keys / promo_codes for a safe
-- additive migration).
--
-- ⚠ ALREADY APPLIED TO PRODUCTION by the founder on 2026-07-11 (Supabase
-- apply_migration, project znyjoyjsvjotlzjppzal). This folder is the repo
-- record of that DDL — do NOT re-run against prod, and never `prisma db push` /
-- `prisma migrate deploy` against prod from CI or a dev box. Idempotent so a
-- Supabase branch / local apply is safe.

-- CreateTable
CREATE TABLE IF NOT EXISTS "video_gate_verdicts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "gate" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'blocked',
    "blocked_reasons" JSONB NOT NULL DEFAULT '[]',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_gate_verdicts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "video_gate_verdicts_ref_gate_created_at_idx"
    ON "video_gate_verdicts"("ref", "gate", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "video_gate_verdicts_organization_id_idx"
    ON "video_gate_verdicts"("organization_id");

-- Service-role only. RLS enabled + a single service_role ALL policy means every
-- read/write is via the API service-role key (which bypasses RLS). Verdicts are
-- only ever written by the gate producers and read by the deterministic
-- enforcer, both server-side — never from a browser-held anon key.
ALTER TABLE "video_gate_verdicts" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "service_role_video_gate_verdicts"
    ON "video_gate_verdicts" FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN datatype_mismatch THEN NULL;
  WHEN undefined_function THEN NULL;
END $$;
