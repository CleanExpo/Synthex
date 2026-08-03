-- Replace the workspace-lifetime identity constraints with the concurrently
-- built run/context-scoped indexes. Attaching an existing index is a short
-- metadata operation rather than an index build under ACCESS EXCLUSIVE.

ALTER TABLE public.intentscape_hypotheses
  DROP CONSTRAINT IF EXISTS intentscape_hypotheses_org_workspace_hypothesis_version_key,
  DROP CONSTRAINT IF EXISTS intentscape_hypotheses_org_workspace_run_hypothesis_version_key;

ALTER TABLE public.intentscape_hypotheses
  ADD CONSTRAINT intentscape_hypotheses_org_workspace_run_hypothesis_version_key
  UNIQUE USING INDEX intentscape_hypotheses_run_identity_uidx;

ALTER TABLE public.intentscape_goal_contracts
  DROP CONSTRAINT IF EXISTS intentscape_goal_contracts_hypothesis_version_key,
  DROP CONSTRAINT IF EXISTS intentscape_goal_contracts_context_hypothesis_version_key;

ALTER TABLE public.intentscape_goal_contracts
  ADD CONSTRAINT intentscape_goal_contracts_context_hypothesis_version_key
  UNIQUE USING INDEX intentscape_goal_contracts_context_identity_uidx;
