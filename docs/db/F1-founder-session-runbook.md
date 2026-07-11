# F1 — Founder prod session runbook

The single session that applies every founder-gated, prod-mutating step of the parity
remediation (spec `docs/specs/spm-parity-remediation-2026-07-11.md`). Target: Synthex prod
`znyjoyjsvjotlzjppzal`, Supabase SQL editor, run as the service role. Expect ~5 minutes.

The whole SQL is one paste-ready file: **`docs/db/F1-founder-session.sql`**. This page is the
checklist around it.

## Before you start (prerequisites)

1. **Merge PR #724** (`chore/supabase-parity-20260711`) to `main`. It carries the reconcile
   migration that `F1-founder-session.sql` STEP 1 mirrors and whose checksum STEP 2 embeds.
   (The checksum was taken from the #724 tip and a squash-merge preserves file bytes, so it
   stays valid — _unless_ someone edits that migration before merge, in which case regenerate
   the SQL.)
2. **Have a restore point.** Confirm Supabase PITR is on, or take one: `npm run db:backup`
   (real `pg_dump`) and keep the artifact off-box. STEP 4a (the 17 DROPs) is the only
   irreversible action in the session.

## Run order

| #   | Action                                                                                                                                                                                                                                       | Expect                                                                                                                                                                                                                              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Paste **STEP 0** only, run it.                                                                                                                                                                                                               | A `PREFLIGHT OK: ledger=33, all 22 orphan tables empty` NOTICE. If it raises an EXCEPTION instead — **stop**, it means the ledger moved or an orphan gained rows; investigate.                                                      |
| 2   | Paste **STEP 1–5** (the rest of the file), run.                                                                                                                                                                                              | No errors. STEP 3 prints `Disabled cron daily-churn-score`. STEP 5's SELECTs are the proof.                                                                                                                                         |
| 3   | Read the **STEP 5** output.                                                                                                                                                                                                                  | `ledger_rows = 43`; 10 migration names ≥ 20260710; `ml_cols = 16`; 2 pipeline*cost_ledger composite indexes; 2 org_video_quotas policies; `daily-churn-score active = false`; `dead17_remaining = 0`; 5 `zzz_deprecated*\*` tables. |
| 4   | **Delete the churn-scorer function** in the Supabase dashboard (Edge Functions → churn-scorer → delete). No MCP tool for this; the cron is already off so it can't fire. Source is archived at `supabase/functions/_archived/churn-scorer/`. | Function gone.                                                                                                                                                                                                                      |
| 5   | **Apply the P3 re-adoption** migration: `supabase db push` (or `scripts/safe-migrate.sh`). It's a no-op on prod (the 5 tables exist) and records itself in `supabase_migrations.schema_migrations`.                                          | Migration `20260711160000_readopt_syn603_syn675_kb_tables` applied/ledgered.                                                                                                                                                        |

## After the session (repo follow-ups — normal PRs)

- **Merge the three parity PRs** now that their prod side is applied: **#730** (P0 captures),
  **#731** (P2 auth→immutable logging), **#732** (P3 re-adoption migration).
- **Edit `scripts/db_preflight.cjs`**: remove the 17 dropped names from its `expected` list (it
  hardcodes 26; keep the 9 live ones) so the next preflight run doesn't false-alarm "missing".
- **F2** (separate session): edge-function hardening — in-handler per-function secret + the
  atomic pg_cron command update. Not part of F1.

## Rollback (per step)

- **STEP 1 (reconcile DDL):** additive/idempotent; nothing to roll back. To remove the two new
  `pipeline_cost_ledger` composite indexes: `DROP INDEX IF EXISTS pipeline_cost_ledger_pipeline_name_created_at_idx, pipeline_cost_ledger_client_id_created_at_idx;`
- **STEP 2 (ledger):** `DELETE FROM _prisma_migrations WHERE migration_name IN (<the 10 names>);`
  restores 33. Harmless either way (the rows just record already-applied DDL).
- **STEP 3 (cron):** `SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname='daily-churn-score'), active := true);`
- **STEP 4b (renames):** `ALTER TABLE public.zzz_deprecated_<x> RENAME TO <x>;` for each.
- **STEP 4a (drops):** not reversible in-session — restore from the STEP-0-gated backup / PITR,
  or recreate from `supabase/migrations/20250115000001_unified_schema.sql`. This is why the
  backup prerequisite is mandatory.

## The 22 orphan tables (what STEP 4 touches)

- **DROP (17, legacy-dead, 0 rows, no FK references):** ai_training_data, analytics,
  automation_logs, billing_history, collaboration_invites, competitor_analysis,
  content_performance_history, content_queue, content_templates, content_versions,
  hashtag_performance, live_sessions, performance_metrics, trending_topics, user_preferences,
  workspace_members, workspaces.
- **RENAME (5, provenance-resolved, 0 rows) → `zzz_deprecated_*`, 90-day burn-in:** ad_accounts,
  ad_performance_snapshots (ppc_ad_accounts), client_churn_risk (syn618), intervention_logs
  (syn620), post_performance_events (syn658). `client_churn_risk` + `post_performance_events`
  carry `TO public` policies — the rename removes them from the anon API surface (a net gain).
