# RLS Adversarial Baseline — 2026-05-16

**Mandate:** `450be04c-504d-4824-bd3f-f62178721c0b` (Synthex Phase 1, Deliverable 1)
**Source of truth:** live Supabase Postgres (`znyjoyjsvjotlzjppzal`), `pg_policies` view.
**Test:** `tests/security/cross-tenant.spec.ts` (run via `npm run rls:adversarial`).
**Companion:** `scripts/validate-rls-coverage.ts` (schema-presence CI gate from PR #232).

## TL;DR

**Actually-secure tables: 18 / 234** (7.7%).

The CI validator landed in PR #232 (`e8ee73a1`) reports `179 rls-enabled` and
`62 uncovered` — but that check is schema-presence, not policy-correctness.
Querying `pg_policies` directly tells the truer story: most "RLS enabled"
tables ship with `using (true)` policies, which are open-by-default.

This sits above the P0 gate threshold (< 5 actually-secure), so Phase 1 is
NOT halted. But it is far below the Board memo's stated baseline of
"16/131 user-data tables verified" — that number was schema-presence, not
policy-correctness, and the denominator is wrong (Synthex has 234 public
tables, not 131). See "Contradictions" at the bottom.

## Method

1. Enumerate every table in `public` schema, with its `pg_tables.rowsecurity`
   flag.
2. Left-join `pg_policies` to count per-table policies, broken down by
   predicate shape (`qual` and `with_check`):
   - `using_true_count` — policies with `qual = 'true'` or `with_check = 'true'`
   - `null_predicate_count` — policies with both qual and with_check NULL
   - `tenant_scoped_count` — predicate mentions `organization_id`
   - `user_scoped_count` — predicate mentions `auth.uid`
3. Classify each table:

| verdict          | criteria                                                          |
|------------------|-------------------------------------------------------------------|
| `SECURE`         | RLS on, ≥1 policy, no `using (true)` or null, ≥1 tenant/user clause |
| `USING_TRUE`     | RLS on, ≥1 `using (true)` policy (broken — open-by-default)        |
| `NO_POLICY`      | RLS on, zero policies (service-role only; broken for anon/auth keys) |
| `NULL_PREDICATE` | RLS on, policy exists, both predicates NULL (broken)              |
| `OTHER`          | RLS on, has a policy that doesn't reference `organization_id` or `auth.uid` |

## Ground-truth counts (2026-05-16)

| verdict          | tables |
|------------------|--------|
| `SECURE`         |     18 |
| `USING_TRUE`     |    147 |
| `NO_POLICY`      |     61 |
| `OTHER`          |      8 |
| **total**        |    234 |

Cross-check: `pg_tables` reports `rowsecurity=true` on all 234 / 234 public
tables (0 RLS-off). The exposure is in the policies, not the flag.

## The 18 actually-secure tables

```
agent_runs
analytics_metrics
analytics_summary
anomalies
anomaly_detection_configs
autopilot_runs
client_churn_risk
content_calendars
gbp_reviews
hermes_config
hermes_discovery_signal
hermes_gap_candidate
hermes_proposal
post_performance_events
profiles
publish_queue
scheduled_posts
user_settings
```

These either use `organization_id` matching (`is_team_member(organization_id)`,
`organization_id = current_setting(...)`) or `auth.uid()`-scoped predicates.

## High-exposure tables flagged by PR #232 — current state

Per the PR #232 commit message, "highest-tenant-data-exposure models in the
gap" were: `email_campaigns, leads, testimonials, testimonial_requests,
generated_content, content_performance_profiles, gbp_locations, gbp_reviews,
gsc_snapshots, keyword_targets, keyword_rank_snapshots, founder_outreach_queue,
invoices, invoice_line_items, nexus_databases, autopilot_configs, autopilot_runs`.

Live policy check against `pg_policies` (2026-05-16):

| table                          | verdict                                          |
|--------------------------------|--------------------------------------------------|
| `autopilot_runs`               | SECURE — `is_team_member(organization_id)`       |
| `gbp_reviews`                  | SECURE — `is_team_member(organization_id)`       |
| `founder_outreach_queue`       | USING_TRUE — `service_role_all_foq` with `qual='true'` |
| all 14 others in the list      | NO_POLICY — RLS enabled, zero policies attached  |

The 14 NO_POLICY tables are protected IFF every code path reads them with
the service-role key (which bypasses anon-key RLS but applies no auth check).
If any route uses the anon or authenticated key, those rows return empty —
which means the feature is broken, not the security. Either way, the policy
is incomplete: there is no row-level isolation if the policy were ever
switched on for non-service-role access.

## Operational gates

- **P0 STOP threshold:** `SECURE < 5`. Phase 1 halts and a single-shot
  Telegram fires per `[[feedback-no-repeating-alerts]]`. NOT triggered today
  (18 ≥ 5).
- **Regression floor:** `SECURE < 18`. Any subsequent run that drops below
  18 should fail CI and gate the deploy. The Jest test asserts this
  floor via `RLS_SECURE_FLOOR` env (default 18).

## Recommendation for Phase 2

Phase 2 should write per-table policies for the 14 high-exposure NO_POLICY
tables FIRST, then attack the 147 `using (true)` tables in order of:

1. Tables referenced by user-facing API routes (cross-check `app/api/**`).
2. Tables joined into multi-tenant reports/dashboards.
3. Internal/operational tables (lower priority).

Each new policy needs a per-domain smoke test asserting tenant A cannot
read tenant B's rows. Adding only a schema-presence ALTER TABLE — as
PR #232 measures — is necessary but not sufficient.

## Contradictions surfaced vs Board memo (mandate `450be04c…`)

| Board memo claim                                 | Ground-truth (2026-05-16)                       |
|--------------------------------------------------|-------------------------------------------------|
| "16/131 user-data tables verified"               | 18 / 234 tables actually secure. Denominator off by ~78%. |
| Margot Q1: "32% of RLS-enabled tables broken"    | Synthex sits at ~92% broken (208 / 234). Synthex is a worst-case sample, not a typical one. |
| PR #232 "179 rls-enabled tables"                 | Correct as a schema-presence count (`ENABLE ROW LEVEL SECURITY` migration exists for 179 of 199 Prisma models). Live DB has 234 tables — the gap is tables created outside Prisma migrations. |

## How to re-run

```bash
# from /Users/phill-mac/Synthex-phase1
RLS_ADVERSARIAL=true \
SUPABASE_DB_URL='postgresql://postgres.znyjoyjsvjotlzjppzal:...@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres' \
npm run rls:adversarial
```

Or directly against `pg_policies` from psql/MCP — same query the test runs
is in the file header.
