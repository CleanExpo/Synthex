-- Scope the IntentScape identity keys to the run and the context that produced
-- them (CodeRabbit critical finding on PR #821).
--
-- Both keys treated a MODEL-SUPPLIED hypothesis id plus version as unique for
-- the whole workspace lifetime. Nothing constrains the model to fresh ids:
-- VisionHypothesisSchema accepts any string id and any positive integer
-- version (lib/intentscape/contracts.ts). So a Context Field change followed by
-- a re-expansion can legitimately emit the same (id, version) pair again, and
-- then:
--   * the new run's hypotheses collide and are silently discarded,
--   * approval binds to the STALE vision run's row, and
--   * a repeat approval violates the goal-contract key and returns HTTP 500.
--
-- Adding vision_run_id and context_version makes each re-expansion its own
-- identity space, which is what "version" was always meant to mean here.
--
-- Shipped as a forward migration rather than an edit to
-- 20260803000000_intentscape_context_field.sql: this repo applies migration SQL
-- out of band before merge, and Prisma never replays an applied migration whose
-- file later changes.

ALTER TABLE public.intentscape_hypotheses
  DROP CONSTRAINT IF EXISTS intentscape_hypotheses_org_workspace_hypothesis_version_key;

ALTER TABLE public.intentscape_hypotheses
  ADD CONSTRAINT intentscape_hypotheses_org_workspace_run_hypothesis_version_key
  UNIQUE (organization_id, workspace_id, vision_run_id, hypothesis_id, version);

ALTER TABLE public.intentscape_goal_contracts
  DROP CONSTRAINT IF EXISTS intentscape_goal_contracts_hypothesis_version_key;

ALTER TABLE public.intentscape_goal_contracts
  ADD CONSTRAINT intentscape_goal_contracts_context_hypothesis_version_key
  UNIQUE (organization_id, workspace_id, context_version, hypothesis_id, hypothesis_version);
