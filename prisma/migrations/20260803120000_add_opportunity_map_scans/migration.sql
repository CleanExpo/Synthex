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
