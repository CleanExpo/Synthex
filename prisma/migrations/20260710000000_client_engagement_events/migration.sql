-- SYN-612: Client Engagement Telemetry Layer.
--
-- Source of truth: prisma/schema.prisma model ClientEngagementEvent
-- (@@map("client_engagement_events")). The model + the dual-write API route
-- (app/api/analytics/engagement-event/route.ts) and the Health Score consumer
-- (lib/health-score/compute.ts) already shipped, but this table's migration was
-- never authored — this file closes that gap so the Prisma migration history
-- matches the schema.
--
-- Additive + idempotent (IF NOT EXISTS throughout). No drops, no renames, no
-- type changes. The CREATE TABLE / index bodies are the canonical output of
-- `prisma migrate diff --from-empty --to-schema` for this model; RLS is added on
-- top per the repo's service-role-only convention (geo_citation_events).
--
-- Privacy: no PII. client_id is Organization.id (internal UUID), event_data is
-- structured metadata only, session_id is a random per-browser-session UUID
-- (not a tracking cookie), crm_client_id is a soft ref to Supabase clients.id.
--
-- Apply via the Supabase MCP apply_migration tool against project
--   znyjoyjsvjotlzjppzal
-- PROD apply is the founder's gate — never `prisma db push` / `prisma migrate
-- deploy` against prod from CI or a dev box. Apply to a Supabase BRANCH first.

-- CreateTable
CREATE TABLE IF NOT EXISTS "client_engagement_events" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_data" JSONB,
    "page_path" TEXT,
    "session_id" TEXT NOT NULL,
    "crm_client_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_engagement_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "client_engagement_events_client_id_event_type_created_at_idx"
    ON "client_engagement_events"("client_id", "event_type", "created_at");

CREATE INDEX IF NOT EXISTS "client_engagement_events_client_id_created_at_idx"
    ON "client_engagement_events"("client_id", "created_at");

CREATE INDEX IF NOT EXISTS "client_engagement_events_crm_client_id_idx"
    ON "client_engagement_events"("crm_client_id");

-- Service-role only. RLS enabled + no authenticated SELECT/INSERT policy means
-- all access is via the API service-role key (which bypasses RLS). The
-- client-facing writes go through the authenticated /api/analytics/engagement-event
-- route (server-side Prisma), never a browser-held anon key. Canonical pattern
-- per supabase/migrations/20260319000001_rls_comprehensive_all_tables.sql and
-- prisma/migrations/20260704120000_geo_citation_events.
ALTER TABLE "client_engagement_events" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "service_role_client_engagement_events"
    ON "client_engagement_events" FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN datatype_mismatch THEN NULL;
  WHEN undefined_function THEN NULL;
END $$;
