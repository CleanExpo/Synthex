-- Scope generated hypothesis and approval identities to the context that
-- produced them. A later Context Field version may legitimately reuse a
-- model-supplied hypothesis id and version without colliding with stale rows.

ALTER TABLE public.intentscape_hypotheses
  DROP CONSTRAINT IF EXISTS intentscape_hypotheses_org_workspace_hypothesis_version_key;

ALTER TABLE public.intentscape_hypotheses
  ADD CONSTRAINT intentscape_hypotheses_org_workspace_run_hypothesis_version_key
  UNIQUE (organization_id, workspace_id, vision_run_id, hypothesis_id, version);

ALTER TABLE public.intentscape_goal_contracts
  DROP CONSTRAINT IF EXISTS intentscape_goal_contracts_hypothesis_version_key;

ALTER TABLE public.intentscape_goal_contracts
  ADD CONSTRAINT intentscape_goal_contracts_context_hypothesis_version_key
  UNIQUE (
    organization_id,
    workspace_id,
    context_version,
    hypothesis_id,
    hypothesis_version
  );
