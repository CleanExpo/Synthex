-- =============================================================================
-- Migration: Dunning State Table
-- Purpose: Tracks dunning lifecycle for subscriptions whose payments have
--          failed. Stripe webhook handlers (service_role) upsert state on
--          invoice.payment_failed; the BillingStatusBanner reads scoped to
--          the authenticated user's own subscription via RLS.
-- Date: 2026-05-16
-- Phase: Synthex Phase 3 — Customer Self-Service (PR 3 of 4)
-- Mandate: 493b042a-521c-44af-9cb2-43505593b65c
-- =============================================================================

BEGIN;

-- =============================================================================
-- SECTION 1: dunning_states table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.dunning_states (
    id              TEXT PRIMARY KEY,
    subscription_id TEXT UNIQUE NOT NULL,
    state           TEXT NOT NULL CHECK (state IN (
        'past_due',
        'unpaid',
        'recovered',
        'cancelled'
    )),
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    next_retry_at   TIMESTAMPTZ,
    last_failure_at TIMESTAMPTZ,
    recovered_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dunning_states_state
    ON public.dunning_states(state);

CREATE INDEX IF NOT EXISTS idx_dunning_states_subscription_id
    ON public.dunning_states(subscription_id);

-- =============================================================================
-- SECTION 2: Row Level Security
-- Per Phase 2 mandate: service_role write, authenticated read scoped to
-- their own subscription. The subscriptions table is Prisma-managed; we join
-- through it to map auth.uid() -> user_id -> subscription.id -> dunning_state.
-- =============================================================================

ALTER TABLE public.dunning_states ENABLE ROW LEVEL SECURITY;

-- Authenticated users read ONLY their own subscription's dunning state.
-- Wrapped because public.subscriptions is Prisma-managed (absent on Preview).
DO $$ BEGIN
  CREATE POLICY "Users can view own dunning state"
      ON public.dunning_states FOR SELECT
      USING (
          EXISTS (
              SELECT 1
              FROM public.subscriptions s
              WHERE s.id = public.dunning_states.subscription_id
                AND s.user_id = auth.uid()::text
          )
      );
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- Service role has full access (for Stripe webhook handlers).
DO $$ BEGIN
  CREATE POLICY "Service role has full access to dunning_states"
      ON public.dunning_states FOR ALL
      USING (auth.jwt() ->> 'role' = 'service_role')
      WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; END $$;

-- =============================================================================
-- SECTION 3: updated_at trigger
-- =============================================================================

CREATE TRIGGER dunning_states_updated_at
    BEFORE UPDATE ON public.dunning_states
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;
