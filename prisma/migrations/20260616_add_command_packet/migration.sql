-- Migration: Command Centre durable command packets (SYN-1032).
--
-- Adds ONE table that persists a Command Centre intake request. Previously the
-- intake route was draft-only (mode:'draft', persisted:false). This table makes a
-- plain-language request a durable, tracked work item that survives refresh/relogin
-- and is visible to background workers, with a lifecycle status and evidence links.
--
-- Org-scoping: a scalar organization_id column, NO DB FK to organizations (the
-- organizations.id TEXT/UUID mismatch is a known FK hazard — see
-- .claude/rules/database/supabase-migrations.md and StudioContentDraft). created_by_id
-- is likewise a scalar (no FK), matching the same pattern. Access is enforced at the
-- query layer (getEffectiveOrganizationId) AND by the command_packets_org_member RLS
-- policy below, which re-derives org membership via business_ownerships — the same
-- subquery proven by the content_calendars / publish_queue org-member policies
-- (20260503) and the marketing_agency_* core tables (20260524). Service role bypasses
-- RLS, so server-side route writes keep working.
--
-- Additive only: a single CREATE TABLE + two indexes + RLS enablement and an
-- org-isolation policy. No DROP, no RENAME, no column type change. IF NOT EXISTS
-- throughout — safe to re-run.
--
-- NOT YET APPLIED to production. The orchestrator applies it out-of-band to
-- znyjoyjsvjotlzjppzal via the Supabase MCP apply_migration tool ON MERGE.

CREATE TABLE IF NOT EXISTS public.command_packets (
  "id"               TEXT          NOT NULL,
  "organization_id"  TEXT          NOT NULL,
  "created_by_id"    TEXT          NOT NULL,
  "source"           TEXT          NOT NULL,
  "speaker"          TEXT          NOT NULL,
  "raw_text"         TEXT          NOT NULL,
  "cleaned_text"     TEXT          NOT NULL,
  "sensitivity"      TEXT          NOT NULL,
  "board_input_id"   TEXT          NOT NULL,
  "title"            TEXT          NOT NULL,
  "ontology_refs"    TEXT[]        NOT NULL DEFAULT ARRAY[]::TEXT[],
  "team_route"       TEXT[]        NOT NULL DEFAULT ARRAY[]::TEXT[],
  "scenario_state"   TEXT          NOT NULL,
  "approval_gate"    TEXT          NOT NULL,
  "risks"            TEXT[]        NOT NULL DEFAULT ARRAY[]::TEXT[],
  "next_action"      TEXT          NOT NULL,
  "outcome_metric"   TEXT          NOT NULL,
  "status"           TEXT          NOT NULL DEFAULT 'pending',
  "safety_flags"     TEXT[]        NOT NULL DEFAULT ARRAY[]::TEXT[],
  "routing_hints"    JSONB,
  "evidence_refs"    TEXT[]        NOT NULL DEFAULT ARRAY[]::TEXT[],
  "created_at"       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "command_packets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "command_packets_organization_id_status_idx"
  ON public.command_packets ("organization_id", "status");

CREATE INDEX IF NOT EXISTS "command_packets_created_by_id_idx"
  ON public.command_packets ("created_by_id");

-- RLS: a packet is visible/writable only to members of the organisation that owns
-- it. Org membership is derived via business_ownerships (owner_id = auth.uid()).
ALTER TABLE public.command_packets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'command_packets'
      AND policyname = 'command_packets_org_member'
  ) THEN
    CREATE POLICY command_packets_org_member ON public.command_packets
      USING (
        organization_id IN (
          SELECT organization_id FROM public.business_ownerships
           WHERE owner_id = auth.uid()::text AND is_active = true
        )
      )
      WITH CHECK (
        organization_id IN (
          SELECT organization_id FROM public.business_ownerships
           WHERE owner_id = auth.uid()::text AND is_active = true
        )
      );
  END IF;
END $$;
