-- Build the hypothesis replacement index without blocking reads or writes.
-- Keep concurrent index creation separate from transactional constraint DDL.

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS intentscape_hypotheses_run_identity_uidx
  ON public.intentscape_hypotheses (
    organization_id,
    workspace_id,
    vision_run_id,
    hypothesis_id,
    version
  );
