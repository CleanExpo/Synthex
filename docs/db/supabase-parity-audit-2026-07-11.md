# Supabase parity audit — 2026-07-11

Full repo ⇄ prod reconciliation of Synthex (`znyjoyjsvjotlzjppzal`), run as a 22-agent
read-only sweep at main `d98289e1`: all 42 `prisma/migrations` verified object-by-object,
all 231 `schema.prisma` models column/index-diffed, prod reverse-diffed for orphans, edge
functions compared, and every legacy `supabase/` file dispositioned. Companion artifacts:

- `prisma/migrations/20260711120000_schema_parity_reconcile/migration.sql` — the repair DDL (both drift directions)
- `docs/db/ledger-reconcile-2026-07-11.sql` — founder prod-apply script (DDL + 9 ledger rows)

## 1. The 9 unledgered Jul-10/11 migrations — ALL applied to prod, NONE ledgered

Prod schema is **ahead** of its `_prisma_migrations` ledger (33 rows, frozen at
`20260704120000_geo_citation_events`). Verdicts:

| Migration                                      | Prod state                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 20260710000000_client_engagement_events        | **partial-by-name**: table+RLS present; 3 indexes + 1 policy existed under ad-hoc names (`idx_cee_*`, `service_role_all_cee`) — renamed to canonical by the reconcile migration. Accepted variance: `created_at` is timestamptz(6)/`now()` vs canonical timestamp(3)/`CURRENT_TIMESTAMP`; `id` carries an extra `gen_random_uuid()::text` default (harmless supersets, left as-is). |
| 20260710100000_add_claim_approval_status       | fully applied, backfill proven executed (15/16 rows grandfathered `approved`)                                                                                                                                                                                                                                                                                                       |
| 20260710120000_mcp_api_keys                    | fully applied, exact shape (17 objects)                                                                                                                                                                                                                                                                                                                                             |
| 20260710130000_syn_mcp_006_evidence_core       | fully applied, exact shape (25 objects)                                                                                                                                                                                                                                                                                                                                             |
| 20260710140000_add_org_budget_policy           | fully applied, exact shape (12 objects)                                                                                                                                                                                                                                                                                                                                             |
| 20260710140000_generative_video_engine         | **partial**: missing its `service_role_organization_video_quotas` policy; prod instead has an undeclared `organization_video_quotas_org_read` (authenticated SELECT, org-scoped). Reconcile migration creates the former and adopts the latter into the repo.                                                                                                                       |
| 20260710150000_syn1090_testimonial_org_fk_text | fully applied: both org columns text, 8 policies live, 3 FKs with exact Prisma names                                                                                                                                                                                                                                                                                                |
| 20260710150000_syn_40_brand_presets            | fully applied, exact shape (18 objects)                                                                                                                                                                                                                                                                                                                                             |
| 20260711000000_video_gate_verdicts             | fully applied; benign extra `DEFAULT CURRENT_TIMESTAMP` on `updated_at`                                                                                                                                                                                                                                                                                                             |

**Action (founder gate):** run `docs/db/ledger-reconcile-2026-07-11.sql` → ledger 33 → 42
(then 43 once this PR's reconcile migration merges and is ledgered per its Step 4).

## 2. schema.prisma parity (231 models vs prod)

- **0 Prisma models missing a prod table.** Column/index/enum parity is exact for ~220 models.
- **Prod-first drift, now adopted into schema.prisma + the reconcile migration:**
  - ML engagement-prediction column set (`predicted_engagement` float8, `confidence_score` float8,
    `cross_client_percentile_industry` int4, `feature_tags` text[] default `{}`) on
    `posts`, `calendar_posts`, `gbp_reviews`, `autopilot_runs`, and (minus confidence*score, which
    it already declared as int) `seasonal_signals` — mirrors the set already declared on
    `authority_scores`. Their prod partial indexes (`idx*_*ml*_`) are adopted in SQL only
(Prisma can't declare partial indexes — deliberately no `@@index` for them).
  - `algorithm_updates`: 6 Sentinel review-workflow columns with **camelCase physical names**
    (`detectedDate`, `platform`, `signalsAffected`, `reviewed`, `reviewedDate`, `linearIssueId`)
    - 3 prod indexes.
  - `team_member_page_views.id` is uuid in prod → model now carries `@db.Uuid`.
- **Repo-first drift, repaired in prod by the reconcile migration:** `pipeline_cost_ledger`
  was missing both declared composite indexes (`pipelineName+createdAt DESC`,
  `clientId+createdAt DESC`) — prod only had single-column variants.
- **Accepted benign variance (documented, not repaired):** scattered prod-extra redundant
  indexes (e.g. `vault_secrets`/`vault_access_logs` duplicates, `dunning_states.subscription_id`,
  `idx_posts_scheduled_at`, `idx_calendar_posts_pending`, `idx_nap_citation_canonical`);
  `pipeline_cost_ledger` `created_at` timestamptz / `cost_usd` numeric vs Prisma's
  timestamp(3)/float8 (same families); partial-vs-plain index variants on
  `video_generations`, `aeo_gate_runs`, `geo_citation_events`.

## 3. Reverse diff — 63 real prod orphans (no Prisma model)

All 65 orphan tables (incl. the 2 expected ledgers) have RLS enabled. Classes:

- **32 active supabase-runtime layer** (live `.from()`/raw-SQL usage; e.g. `media_assets`,
  `client_journey_events`, `scheduled_posts`, `profiles`, `clients`, `platform_algorithms`) —
  **keep**; deliberate non-Prisma layer.
- **17 legacy-era dead** (Jan-2025 schema-step\*/unified_schema origin, 0 rows, only referenced
  by `scripts/db_preflight.cjs`): `ai_training_data`, `analytics`, `automation_logs`,
  `billing_history`, `collaboration_invites`, `competitor_analysis`, `content_performance_history`,
  `content_queue`, `content_templates`, `content_versions`, `hashtag_performance`, `live_sessions`,
  `performance_metrics`, `trending_topics`, `user_preferences`, `workspace_members`, `workspaces`.
  Drop candidates — **founder decision**.
- **9 dormant-but-migrated** (committed migration, no live refs, 0 rows): `agent_runs`,
  `agent_task_queue`, `landing_page_generated`, `service_area_coverage_contractor`,
  `sms_send_audit`, `verification_gate_audit`, `weekly_digests`, `signal_weights`,
  `source_provenance`. Keep (parked features).
- **5 unknown-origin** (no CREATE TABLE anywhere in the repo, 0 rows): `ad_accounts`,
  `ad_performance_snapshots`, `client_churn_risk`, `intervention_logs`, `post_performance_events`.
  Created straight in prod, likely aborted spikes. Drop candidates — **founder decision**.

⚠️ Flags:

- `platform_algorithms` / `ranking_signals` / `milestone_events` / `signal_weights` /
  `source_provenance` have live or dormant usage but their only DDL lives in
  `.claude/archived/2026-04-27/sql-drift/` — a fresh environment rebuild would miss them.
  Candidate: re-adopt as an idempotent `supabase/migrations` file (follow-up).
- `auth_events`: live writes from `lib/auth/monitoring.ts`, but RLS-on with **0 policies and
  0 rows** — if that path uses a non-service-role client, auth-event logging is silently
  failing. Verify the client (follow-up).

## 4. Edge functions (prod: 6 deployed, repo: 25 dirs)

- **`churn-scorer` (MAJOR):** deployed v3 + nightly pg_cron `daily-churn-score` (0 2 \* \* \*),
  but has **no source anywhere in git history** and proxies to
  `synthex.social/api/internal/churn-scorer` — a route that does not exist. Almost certainly
  404-ing nightly since ~2026-04-09. **Founder decision:** disable the cron + delete the
  function, or rebuild the route.
- 20 repo function dirs are undeployed thin Deno.cron→`/api/internal/*` proxies, superseded by
  ~50 Vercel crons in `vercel.json` (tree untouched since 2026-04-16). **Founder decision:**
  delete the stale dirs and declare Vercel cron canonical (recommended), or redeploy.
- 5 name-matches have no functional drift (one byte-identical, one log-string-only diff).
- All 6 deployed functions run `verify_jwt=false` with unauthenticated triggers (cost/DoS
  surface — they fire internal jobs using their own CRON_SECRET). Recommend an in-handler
  shared-secret check (follow-up).

## 5. Legacy `supabase/` files — dispositions (applied in this PR)

- **KEEP:** `supabase/migrations/` (canonical raw-SQL/RLS dir — CI `rls-checks.yml` +
  `scripts/safe-migrate.sh` depend on it), `supabase/functions/` (pending the edge-function
  decision above), `supabase/.audit/`.
- **DELETED (dead/stale/misleading; git history preserves everything):**
  `complete-schema.sql` + `schema.sql` (11-table pre-Prisma hand schemas; repo's own audit
  calls them severely outdated — recreating them would resurrect orphan tables),
  `schema-step1..4-*.sql` (concatenated into `migrations/20250115000001_unified_schema.sql`),
  `schema-step5-sample-data{,-safe,-fixed}.sql` (legacy seeds; real seeding = `prisma/seed.ts`),
  `prisma-schema-full.sql` (regenerable, 5-months-stale `prisma migrate diff` export),
  `run-migrations.sh` (**no-op placebo** — echoes success, the actual command is commented out;
  its promised tables verified absent in prod), `migrations-backup/` (unreferenced snapshot),
  plus their dead reference chain: `scripts/deploy-database.sh`, `scripts/deploy-database.ps1`,
  `scripts/setup-production.js`; de-wired `package.json` `setup:db` and
  `scripts/complete-integration.ts` guidance that told users to paste the legacy schema.
- **Hygiene:** `supabase/.temp/` (Supabase CLI state incl. pooler URL — username+host, no
  password) untracked from git + added to `.gitignore`.
- Credential scan of all `supabase/` files: **clean**.

## 6. Founder decision queue (from this audit)

1. Run `docs/db/ledger-reconcile-2026-07-11.sql` (DDL + 9 ledger rows; then the 10th post-merge).
2. `churn-scorer`: disable `daily-churn-score` cron + delete the sourceless function, or rebuild.
3. Drop (or keep) the 17 legacy-dead + 5 unknown-origin orphan tables (all 0 rows, all RLS-on).
4. Declare Vercel cron canonical and delete the 20 stale edge-function dirs, or redeploy them.
5. Unrelated but still queued: §17.4 Track B founder packet (drafted + premise-verified, separate).
