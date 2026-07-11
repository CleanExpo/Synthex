-- =============================================================================
-- FOUNDER PROD-APPLY — Synthex prod (znyjoyjsvjotlzjppzal), 2026-07-11
-- Paste into the Supabase SQL editor (or apply via MCP execute_sql) as ONE run.
-- Produced by the 2026-07-11 full parity audit (22-agent sweep; see
-- docs/db/supabase-parity-audit-2026-07-11.md). Everything is idempotent —
-- safe to re-run.
--
-- WHAT THIS IS: prod's schema is AHEAD of its own _prisma_migrations ledger.
-- All 9 Jul-10/11 migrations were hand-applied (7 exactly, 2 with variances
-- repaired by Step 1 below) but none were ledgered. Checksums below are the
-- git-blob sha256 of each migration.sql at main d98289e1 — the same formula
-- prisma migrate deploy verifies, proven by the 2026-07-09 reconciliation.
-- =============================================================================

-- STEP 1 — parity DDL (identical content to
-- prisma/migrations/20260711120000_schema_parity_reconcile/migration.sql):
-- run that file's contents first, verbatim. It creates the two missing
-- pipeline_cost_ledger composite indexes + the missing
-- service_role_organization_video_quotas policy, and renames the four ad-hoc
-- client_engagement_events objects to canonical names. Everything else in it
-- no-ops against prod.

-- STEP 2 — ledger rows for the 9 hand-applied migrations (33 → 42):
INSERT INTO _prisma_migrations
  (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
SELECT gen_random_uuid()::text, v.checksum, now(), v.name, NULL, NULL, now(), 1
FROM (VALUES
  ('20260710000000_client_engagement_events',        'd4b47afc7d616f2f0c22f95b6a730c9b1906e5b40d3a2726b9f8c2dd2ca81ff3'),
  ('20260710100000_add_claim_approval_status',       'c5971f827e2e727d7cecd501d2ef377c4ee78a394da5425bcc112c68f5f2a987'),
  ('20260710120000_mcp_api_keys',                    'b0ed170f4669428e921b3df6d755b347143896da91cbe1f04a59c02470e92e91'),
  ('20260710130000_syn_mcp_006_evidence_core',       '2999858dfea45bda5fc02a9b2775c0407c3ca4dcf97430a8c3f7d4bb9df65ac2'),
  ('20260710140000_add_org_budget_policy',           '6591ec88ba3deb6783bb5d7e3468acd22d214ddc7947e5ade47972d05bbe08ed'),
  ('20260710140000_generative_video_engine',         '2fd43e776847b49c9d4a11a37ffb350be456c0c7863776f90369cb85f07b9e42'),
  ('20260710150000_syn1090_testimonial_org_fk_text', 'cc6a8948e079b0b4cfa9218579e47fe62b219c31838b2151463a2f6ce355bd65'),
  ('20260710150000_syn_40_brand_presets',            '0d789442cb2ef40ff460821391862d672210a783162d7c06d7ad6c26e4c3a1f1'),
  ('20260711000000_video_gate_verdicts',             '0568d348a1aebf7632062aa1d2e0ff14cbaf88d9bdc12b3e7417aac310ede831')
) AS v(name, checksum)
WHERE NOT EXISTS (
  SELECT 1 FROM _prisma_migrations m WHERE m.migration_name = v.name
);

-- STEP 3 — verify:
SELECT count(*) AS ledger_rows FROM _prisma_migrations;            -- expect 42
SELECT migration_name FROM _prisma_migrations
WHERE migration_name >= '20260710' ORDER BY migration_name;        -- expect the 9 above

-- STEP 4 — AFTER PR "chore/supabase-parity-20260711" merges, ledger the 10th
-- (20260711120000_schema_parity_reconcile) the same way. Its checksum MUST be
-- computed from the MERGED file:
--   git show origin/main:prisma/migrations/20260711120000_schema_parity_reconcile/migration.sql | sha256sum
-- then re-run the STEP 2 INSERT shape with that (name, checksum) pair. Final
-- expected ledger count: 43.
