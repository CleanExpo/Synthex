-- Marketing Extender public acquisition spine.
-- Public scans are deliberately not attached to a client organisation. A scan
-- joins the org-scoped CRM only after consent creates a Lead.
CREATE TABLE "opportunity_map_scans" (
    "id" TEXT NOT NULL,
    "business_name" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "input_evidence" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "fit_score" INTEGER NOT NULL,
    "fit_state" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "lead_id" TEXT,
    "consent_policy_version" TEXT,
    "consented_at" TIMESTAMP(3),
    "handoff_at" TIMESTAMP(3),
    "source" TEXT,
    "medium" TEXT,
    "campaign" TEXT,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunity_map_scans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "opportunity_map_scans_lead_id_key"
    ON "opportunity_map_scans"("lead_id");
CREATE INDEX "opportunity_map_scans_fit_state_completed_at_idx"
    ON "opportunity_map_scans"("fit_state", "completed_at" DESC);
CREATE INDEX "opportunity_map_scans_status_completed_at_idx"
    ON "opportunity_map_scans"("status", "completed_at" DESC);

ALTER TABLE "opportunity_map_scans"
    ADD CONSTRAINT "opportunity_map_scans_lead_id_fkey"
    FOREIGN KEY ("lead_id") REFERENCES "leads"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;


-- ── RLS — service-role only ────────────────────────────────────────────────
-- The table is written and read exclusively server-side through Prisma
-- (app/api/opportunity-map/route.ts, app/api/opportunity-map/handoff/route.ts).
-- Nothing reaches it with a browser-held key. Without RLS it would inherit
-- whatever grants the project gives anon/authenticated, exposing every scan's
-- prospect details, consent record and lead linkage to any holder of the
-- publishable key — and this table has no organization_id to scope a tenant
-- policy against, so the only correct boundary is "server only".
-- Same shape as media_spend_events (20260802000000), including the guards:
-- a bare REVOKE/CREATE POLICY naming a role that does not exist raises
-- invalid_role_specification (0P000) and aborts the migration on any database
-- without the Supabase roles.
ALTER TABLE "opportunity_map_scans" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON TABLE %I FROM %I', 'opportunity_map_scans', r);
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON TABLE "opportunity_map_scans" TO service_role;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE POLICY "service_role_opportunity_map_scans"
      ON "opportunity_map_scans" FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;
