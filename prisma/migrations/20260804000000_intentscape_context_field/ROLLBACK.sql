-- ROLLBACK for 20260804000000_intentscape_context_field.
--
-- Safe ONLY while these tables are empty, which is the state this migration was
-- written for: the tables do not exist on production at all, so a rollback
-- immediately after applying discards nothing. Check before running:
--
--   SELECT (SELECT count(*) FROM intentscape_workspaces)     AS workspaces,
--          (SELECT count(*) FROM intentscape_artifacts)      AS artifacts,
--          (SELECT count(*) FROM intentscape_vision_runs)    AS vision_runs,
--          (SELECT count(*) FROM intentscape_hypotheses)     AS hypotheses,
--          (SELECT count(*) FROM intentscape_goal_contracts) AS goal_contracts,
--          (SELECT count(*) FROM intentscape_events)         AS events;
--
-- Any non-zero count means a tenant has done real IntentScape work. STOP: that
-- material is the organisation's strategic record and dropping it is a founder
-- decision, not a rollback step.
--
-- Order matters: children before parents, or the foreign keys refuse. CASCADE is
-- deliberately NOT used: child-first ordering already satisfies this migration's
-- own foreign keys, and CASCADE would additionally drop later views or foreign
-- keys that the row-count precondition above cannot see (independent review of
-- 8c567856, P2). Without it, an unexpected dependency fails closed.

DROP TABLE IF EXISTS "intentscape_events"        ;
DROP TABLE IF EXISTS "intentscape_goal_contracts";
DROP TABLE IF EXISTS "intentscape_hypotheses"    ;
DROP TABLE IF EXISTS "intentscape_vision_runs"   ;
DROP TABLE IF EXISTS "intentscape_artifacts"     ;
DROP TABLE IF EXISTS "intentscape_workspaces"    ;

-- Policies and grants fall with the tables; no separate cleanup is needed.
--
-- The ledger row is NOT removed here. If the intent is to re-apply, delete it
-- explicitly so `migrate deploy` runs the migration again:
--
--   DELETE FROM _prisma_migrations
--   WHERE migration_name = '20260804000000_intentscape_context_field';
--
-- POST-ROLLBACK VERIFICATION (expect all six NULL):
--
--   SELECT to_regclass('public.intentscape_workspaces'),
--          to_regclass('public.intentscape_artifacts'),
--          to_regclass('public.intentscape_vision_runs'),
--          to_regclass('public.intentscape_hypotheses'),
--          to_regclass('public.intentscape_goal_contracts'),
--          to_regclass('public.intentscape_events');
