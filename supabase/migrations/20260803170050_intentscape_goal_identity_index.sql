-- Build the goal-contract replacement index without blocking reads or writes.
-- A concurrent index must be the only statement in its migration so the
-- Supabase runner executes it outside the PostgreSQL pipeline.

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS intentscape_goal_contracts_context_identity_uidx
  ON public.intentscape_goal_contracts (
    organization_id,
    workspace_id,
    context_version,
    hypothesis_id,
    hypothesis_version
  );
