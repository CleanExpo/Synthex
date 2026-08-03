-- SYN-1124 — create the six IntentScape tables in the Prisma migration ledger.
--
-- WHY THIS EXISTS
-- The DDL for these tables shipped only in
-- supabase/migrations/20260803000000_intentscape_context_field.sql. The
-- production deploy runs `prisma migrate deploy`, which reads prisma/migrations/
-- ONLY — it has never seen that file, and nobody applied it out of band. Verified
-- against production on 2026-08-04:
--
--   SELECT to_regclass('public.intentscape_workspaces'), ... ;
--   -> all six NULL, while the IntentScape feature code is live on main.
--
-- So every IntentScape route on production fails at the first query. This
-- migration closes that gap through the ledger, where the deploy can see it.
--
-- Generated from prisma/schema.prisma by
--   prisma migrate diff --from-schema <schema minus the six models> \
--                       --to-schema prisma/schema.prisma --script
-- so it matches the schema exactly, including the run/context-scoped identity
-- keys that PR #821 settled. A fresh apply therefore needs none of the
-- 20260803160000 / 170000 / 170050 / 170100 constraint-swap chain: those exist
-- to migrate an ALREADY-CREATED table and are no-ops or failures against a
-- database where these tables never existed.
--
-- PRECONDITION — run this first and expect all six NULL. If any is non-null the
-- tables exist by some other route and this migration must be reviewed again
-- before applying:
--
--   SELECT to_regclass('public.intentscape_workspaces')     AS workspaces,
--          to_regclass('public.intentscape_artifacts')      AS artifacts,
--          to_regclass('public.intentscape_vision_runs')    AS vision_runs,
--          to_regclass('public.intentscape_hypotheses')     AS hypotheses,
--          to_regclass('public.intentscape_goal_contracts') AS goal_contracts,
--          to_regclass('public.intentscape_events')         AS events;
--
-- POST-APPLY VERIFICATION — see ROLLBACK.sql in this directory for the reverse,
-- and the verification block at the foot of this file.
--
-- Every statement is idempotent: IF NOT EXISTS on tables and indexes, and each
-- foreign key wrapped so a re-apply raises nothing. Proven by applying twice to
-- a throwaway database.

CREATE TABLE IF NOT EXISTS "intentscape_workspaces" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'draft',
    "retention_class" TEXT NOT NULL DEFAULT 'standard',
    "origin_signal_hash" TEXT NOT NULL,
    "active_context_version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "intentscape_workspaces_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "intentscape_artifacts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "logical_path" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "parent_version" INTEGER,
    "evidence_state" TEXT NOT NULL DEFAULT 'unverified',
    "lineage" JSONB NOT NULL DEFAULT '{}',
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intentscape_artifacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "intentscape_vision_runs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "context_version" INTEGER NOT NULL,
    "attempt" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "generator_provider" TEXT,
    "generator_model" TEXT,
    "evaluator_provider" TEXT,
    "evaluator_model" TEXT,
    "confidence" DOUBLE PRECISION,
    "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
    "completion_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost_micros" INTEGER,
    "vision_artifact_id" TEXT,
    "anchoring_artifact_id" TEXT,
    "evaluation_artifact_id" TEXT,
    "rejection_reasons" JSONB NOT NULL DEFAULT '[]',
    "error_message" TEXT,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "intentscape_vision_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "intentscape_hypotheses" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "vision_run_id" TEXT NOT NULL,
    "hypothesis_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "causal_mechanism" TEXT NOT NULL,
    "desired_change" TEXT NOT NULL,
    "affected_stakeholders" JSONB NOT NULL,
    "evidence_for" JSONB NOT NULL DEFAULT '[]',
    "evidence_against" JSONB NOT NULL DEFAULT '[]',
    "invalidating_assumption" TEXT NOT NULL,
    "main_risk" TEXT NOT NULL,
    "adjacent_value" TEXT NOT NULL,
    "research_branch_ids" JSONB NOT NULL,
    "rank" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intentscape_hypotheses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "intentscape_goal_contracts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "vision_run_id" TEXT NOT NULL,
    "hypothesis_id" TEXT NOT NULL,
    "hypothesis_version" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "context_version" INTEGER NOT NULL,
    "desired_change" TEXT NOT NULL,
    "primary_stakeholder" TEXT NOT NULL,
    "acceptance_criteria" JSONB NOT NULL,
    "exclusions" JSONB NOT NULL DEFAULT '[]',
    "authority_boundaries" JSONB NOT NULL,
    "evidence_refs" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'approved',
    "approved_by" TEXT NOT NULL,
    "approved_at" TIMESTAMPTZ(6) NOT NULL,
    "artifact_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intentscape_goal_contracts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "intentscape_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "actor_id" TEXT,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "artifact_id" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intentscape_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "intentscape_workspaces_organization_id_state_updated_at_idx" ON "intentscape_workspaces"("organization_id", "state", "updated_at" DESC);

CREATE INDEX IF NOT EXISTS "intentscape_workspaces_created_by_id_idx" ON "intentscape_workspaces"("created_by_id");

CREATE UNIQUE INDEX IF NOT EXISTS "intentscape_workspaces_id_org_key" ON "intentscape_workspaces"("id", "organization_id");

CREATE UNIQUE INDEX IF NOT EXISTS "intentscape_artifacts_storage_path_key" ON "intentscape_artifacts"("storage_path");

CREATE INDEX IF NOT EXISTS "intentscape_artifacts_organization_id_workspace_id_kind_cre_idx" ON "intentscape_artifacts"("organization_id", "workspace_id", "kind", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "intentscape_artifacts_organization_id_content_hash_idx" ON "intentscape_artifacts"("organization_id", "content_hash");

CREATE UNIQUE INDEX IF NOT EXISTS "intentscape_artifacts_org_workspace_path_version_key" ON "intentscape_artifacts"("organization_id", "workspace_id", "logical_path", "version");

CREATE INDEX IF NOT EXISTS "intentscape_vision_runs_organization_id_workspace_id_status_idx" ON "intentscape_vision_runs"("organization_id", "workspace_id", "status", "created_at" DESC);

CREATE UNIQUE INDEX IF NOT EXISTS "intentscape_vision_runs_id_org_key" ON "intentscape_vision_runs"("id", "organization_id");

CREATE UNIQUE INDEX IF NOT EXISTS "intentscape_vision_runs_org_workspace_context_attempt_key" ON "intentscape_vision_runs"("organization_id", "workspace_id", "context_version", "attempt");

CREATE INDEX IF NOT EXISTS "intentscape_hypotheses_organization_id_workspace_id_vision__idx" ON "intentscape_hypotheses"("organization_id", "workspace_id", "vision_run_id", "rank");

CREATE UNIQUE INDEX IF NOT EXISTS "intentscape_hypotheses_org_workspace_run_hypothesis_version_key" ON "intentscape_hypotheses"("organization_id", "workspace_id", "vision_run_id", "hypothesis_id", "version");

CREATE INDEX IF NOT EXISTS "intentscape_goal_contracts_organization_id_workspace_id_sta_idx" ON "intentscape_goal_contracts"("organization_id", "workspace_id", "status", "approved_at" DESC);

CREATE UNIQUE INDEX IF NOT EXISTS "intentscape_goal_contracts_org_workspace_version_key" ON "intentscape_goal_contracts"("organization_id", "workspace_id", "version");

CREATE UNIQUE INDEX IF NOT EXISTS "intentscape_goal_contracts_context_hypothesis_version_key" ON "intentscape_goal_contracts"("organization_id", "workspace_id", "context_version", "hypothesis_id", "hypothesis_version");

CREATE INDEX IF NOT EXISTS "intentscape_events_organization_id_workspace_id_created_at_idx" ON "intentscape_events"("organization_id", "workspace_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "intentscape_events_organization_id_entity_type_entity_id_idx" ON "intentscape_events"("organization_id", "entity_type", "entity_id");

DO $$ BEGIN
  ALTER TABLE "intentscape_artifacts" ADD CONSTRAINT "intentscape_artifacts_workspace_id_organization_id_fkey" FOREIGN KEY ("workspace_id", "organization_id") REFERENCES "intentscape_workspaces"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "intentscape_vision_runs" ADD CONSTRAINT "intentscape_vision_runs_workspace_id_organization_id_fkey" FOREIGN KEY ("workspace_id", "organization_id") REFERENCES "intentscape_workspaces"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "intentscape_hypotheses" ADD CONSTRAINT "intentscape_hypotheses_workspace_id_organization_id_fkey" FOREIGN KEY ("workspace_id", "organization_id") REFERENCES "intentscape_workspaces"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "intentscape_hypotheses" ADD CONSTRAINT "intentscape_hypotheses_vision_run_id_organization_id_fkey" FOREIGN KEY ("vision_run_id", "organization_id") REFERENCES "intentscape_vision_runs"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "intentscape_goal_contracts" ADD CONSTRAINT "intentscape_goal_contracts_workspace_id_organization_id_fkey" FOREIGN KEY ("workspace_id", "organization_id") REFERENCES "intentscape_workspaces"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "intentscape_goal_contracts" ADD CONSTRAINT "intentscape_goal_contracts_vision_run_id_organization_id_fkey" FOREIGN KEY ("vision_run_id", "organization_id") REFERENCES "intentscape_vision_runs"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "intentscape_events" ADD CONSTRAINT "intentscape_events_workspace_id_organization_id_fkey" FOREIGN KEY ("workspace_id", "organization_id") REFERENCES "intentscape_workspaces"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;


-- ── RLS — service-role only, with a tenant read ────────────────────────────
-- Same posture and the same guards as media_spend_events
-- (prisma/migrations/20260802000000_syn1115_media_spend_events/migration.sql).
--
-- These tables hold the Context Field, vision runs, hypotheses and approved
-- goal contracts — an organisation's strategic working material. Created in
-- `public` without RLS they inherit whatever grants the project gives
-- anon/authenticated, so any holder of the publishable key could read every
-- tenant's workspace.
--
-- Guarded per role throughout. A bare REVOKE or CREATE POLICY naming a role
-- that does not exist raises invalid_role_specification (0P000) and ABORTS the
-- whole migration — the failure mode PR #820's review found the hard way on a
-- database without the Supabase roles.
ALTER TABLE "intentscape_workspaces"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "intentscape_artifacts"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "intentscape_vision_runs"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "intentscape_hypotheses"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "intentscape_goal_contracts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "intentscape_events"         ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r text; t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['intentscape_workspaces','intentscape_artifacts',
                           'intentscape_vision_runs','intentscape_hypotheses',
                           'intentscape_goal_contracts','intentscape_events'] LOOP
    FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
        EXECUTE format('REVOKE ALL ON TABLE %I FROM %I', t, r);
      END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('GRANT ALL ON TABLE %I TO service_role', t);
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['intentscape_workspaces','intentscape_artifacts',
                           'intentscape_vision_runs','intentscape_hypotheses',
                           'intentscape_goal_contracts','intentscape_events'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      BEGIN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
          t || '_service_role_all', t);
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
    END IF;
  END LOOP;
END $$;

-- Tenant read, only where the estate's helper exists. Matches
-- supabase/migrations/20260803000000_intentscape_context_field.sql. Skipped
-- rather than invented on a database without public.is_team_member, so this
-- migration stays applicable to a bare PostgreSQL instance.
DO $$
DECLARE t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_team_member')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    FOREACH t IN ARRAY ARRAY['intentscape_workspaces','intentscape_artifacts',
                             'intentscape_vision_runs','intentscape_hypotheses',
                             'intentscape_goal_contracts','intentscape_events'] LOOP
      BEGIN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_team_member(organization_id))',
          t || '_tenant_select', t);
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
    END LOOP;
  END IF;
END $$;

-- POST-APPLY VERIFICATION (run these; do not assume):
--
--   -- 1. all six tables exist
--   SELECT to_regclass('public.intentscape_workspaces'),
--          to_regclass('public.intentscape_artifacts'),
--          to_regclass('public.intentscape_vision_runs'),
--          to_regclass('public.intentscape_hypotheses'),
--          to_regclass('public.intentscape_goal_contracts'),
--          to_regclass('public.intentscape_events');
--
--   -- 2. RLS enabled on all six (expect six rows, relrowsecurity = true)
--   SELECT relname, relrowsecurity FROM pg_class
--   WHERE relname LIKE 'intentscape_%' AND relkind = 'r' ORDER BY relname;
--
--   -- 3. service_role policy present on each (expect six)
--   SELECT tablename, policyname FROM pg_policies
--   WHERE tablename LIKE 'intentscape_%' ORDER BY tablename, policyname;
--
--   -- 4. anon/authenticated hold no table privileges (expect zero rows)
--   SELECT table_name, grantee, privilege_type
--   FROM information_schema.role_table_grants
--   WHERE table_name LIKE 'intentscape_%' AND grantee IN ('anon','authenticated');
--
--   -- 5. the identity keys are the run/context-scoped ones (expect both rows)
--   --    NOTE: these are UNIQUE INDEXES, not table constraints — Prisma's
--   --    @@unique emits CREATE UNIQUE INDEX here, so pg_constraint is empty for
--   --    them and querying it would return zero rows on a correctly migrated
--   --    database. Ask pg_indexes.
--   SELECT indexname FROM pg_indexes
--   WHERE indexname IN ('intentscape_hypotheses_org_workspace_run_hypothesis_version_key',
--                       'intentscape_goal_contracts_context_hypothesis_version_key')
--   ORDER BY indexname;
