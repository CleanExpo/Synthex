-- ============================================================================
-- Migration: 20260516000001_immutable_audit_log
-- Purpose:   Create append-only audit_events_immutable table for SOC 2-class
--            compliance events (auth, security, data, compliance categories).
-- Mandate:   a4aae2cf-6a05-4426-9019-3f38137a9b7b (Synthex Phase 2)
-- Author:    Senior Security Engineer
-- ============================================================================
--
-- Design contract
-- ---------------
--   - service_role INSERT only — no SELECT/UPDATE/DELETE for anon or authenticated.
--   - SELECT allowed for service_role only (audit retrieval is a backend op).
--   - UPDATE and DELETE are blocked at TWO layers:
--       1. No GRANT for UPDATE/DELETE to any role (defence in depth)
--       2. A row-level trigger raises an exception on UPDATE/DELETE attempts
--   - This is the realistic Supabase-only path to immutability.
--     AWS S3 Object Lock COMPLIANCE mode is gold standard but out of scope
--     (Margot Q1: bucket recreation required).
--
-- Reversibility
-- -------------
-- This migration is DESTRUCTIVE to roll back (DROP TRIGGER + DROP TABLE).
-- The trigger pattern intentionally makes a `DROP TABLE` the only path out.
-- That is the point — immutability is a design constraint, not a soft default.
--
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Step 1: Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_events_immutable (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  text        NOT NULL,
  actor_id    uuid        NULL,
  payload     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.audit_events_immutable IS
  'Append-only audit ledger for SOC 2 compliance categories (auth, security, data, compliance). UPDATE and DELETE blocked by trigger AND grant. See migration 20260516000001.';
COMMENT ON COLUMN public.audit_events_immutable.event_type IS
  'Dot-namespaced event identifier — auth.login, security.injection_attempt, data.export, compliance.gdpr_request, etc.';
COMMENT ON COLUMN public.audit_events_immutable.actor_id IS
  'The auth.users.id of the actor when known. NULL for system-initiated events.';

CREATE INDEX IF NOT EXISTS audit_events_immutable_event_type_idx
  ON public.audit_events_immutable (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_immutable_actor_idx
  ON public.audit_events_immutable (actor_id, created_at DESC)
  WHERE actor_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Step 2: RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.audit_events_immutable ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events_immutable FORCE ROW LEVEL SECURITY;

-- service_role can INSERT
DO $$ BEGIN
  CREATE POLICY audit_events_immutable_service_role_insert
    ON public.audit_events_immutable
    FOR INSERT
    TO service_role
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- service_role can SELECT (backend audit retrieval)
DO $$ BEGIN
  CREATE POLICY audit_events_immutable_service_role_select
    ON public.audit_events_immutable
    FOR SELECT
    TO service_role
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- NO UPDATE policy. NO DELETE policy. Anon + authenticated have NO policies at all.

-- ---------------------------------------------------------------------------
-- Step 3: Grant revocation (defence in depth)
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.audit_events_immutable FROM PUBLIC;
REVOKE ALL ON public.audit_events_immutable FROM anon;
REVOKE ALL ON public.audit_events_immutable FROM authenticated;

GRANT  INSERT, SELECT ON public.audit_events_immutable TO service_role;

-- ---------------------------------------------------------------------------
-- Step 4: Trigger — final layer that raises on any UPDATE/DELETE attempt
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_events_immutable_block_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'audit_events_immutable is append-only. % is not permitted. (row id=%)',
    TG_OP,
    COALESCE(OLD.id::text, 'unknown')
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_events_immutable_block_update
  ON public.audit_events_immutable;
DROP TRIGGER IF EXISTS trg_audit_events_immutable_block_delete
  ON public.audit_events_immutable;

CREATE TRIGGER trg_audit_events_immutable_block_update
  BEFORE UPDATE ON public.audit_events_immutable
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_events_immutable_block_mutation();

CREATE TRIGGER trg_audit_events_immutable_block_delete
  BEFORE DELETE ON public.audit_events_immutable
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_events_immutable_block_mutation();

COMMIT;
