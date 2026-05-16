# RLS Batch Rollout Plan — 2026-05-16

**Mandate:** `a4aae2cf-6a05-4426-9019-3f38137a9b7b` (Synthex Phase 2)
**Target:** 234 / 234 SECURE. Current: 18 / 234.
**Current PR shipping in this session:** Batch 1 ONLY (19 tables — `NO_POLICY` → `SECURE`)

## Why this PR ships ONE batch, not five

The original mandate sequenced 5-10 sweeping batches. After live ground-
truth review, four risks demand a slower path:

1. **Service-role leak surface.** 46 non-internal API routes import
   `createServerClient` (service-role key) and bypass RLS entirely. RLS
   tightening on these tables provides false confidence until the
   routes are triaged. See
   `docs/security/service-role-leaks-2026-05-16.md`.
2. **Column-type heterogeneity.** `organization_id` is `text` on most
   tables but `uuid` on `testimonials` + `testimonial_requests`. A
   single policy template cannot be applied globally.
3. **Production blast radius.** 1,000+ paying users. A blanket
   `using (is_team_member(...))` on `USING_TRUE` tables would silently
   break every anon/auth-key code path that today works because the
   policy is open.
4. **Substrate-change discipline** (`feedback_substrate_change_discipline`
   memory) requires shadow-run + rollback drill + no-touch during sprint
   windows. We have none of those for batches 2-5 today.

## What Batch 1 ships safely

19 tables that are currently `NO_POLICY` (RLS on, zero policies, service-
role-only access) and have `organization_id text`. The transition is:

- service_role: UNCHANGED — still bypasses RLS
- anon: UNCHANGED — still gets 0 rows (no anon policy attached)
- authenticated: was getting 0 rows; now gets rows where the user is a
  team_member of the row's `organization_id`

This is a strict UNLOCK for legitimate users. It cannot break a
working service-role code path because nothing about service_role
behaviour changes.

### Tables in Batch 1
```
autopilot_configs
competitor_keyword_gaps
content_improvement_tracking
content_performance_profiles
content_topic_suggestions
ga4_properties
gbp_locations
gbp_snapshots
gsc_properties
gsc_snapshots
invoices
keyword_rank_snapshots
keyword_targets
leads
monthly_stories
review_requests
seasonal_signal_dismissals
story_config
visibility_scores
```

### Pre-merge gates (all 3 must pass)
1. `RLS_ADVERSARIAL=true npx jest tests/security/cross-tenant.spec.ts` —
   SECURE count must move from 18 to 37 after migration on staging.
2. Manual spot-check of `app/api/**` routes that read these 19 tables
   via authenticated context — must all still work.
3. Margot review.

## Subsequent batches (DEFERRED pending the discipline below)

### Batch 2 — `NO_POLICY` uuid-typed
- `testimonials`, `testimonial_requests`. Either cast policy
  predicate or fix column type first.

### Batch 3 — `USING_TRUE` user-scoped (largest, most user-facing)
~30 tables. The transition is from "every authenticated user reads
every row" to "only the row owner reads". This will surface every
existing route that reads these tables without scoping by `user_id`.

REQUIRED before merge:
- Per-table code-path audit
- Shadow-run on staging
- Per-batch rollback drill recorded in
  `docs/security/rollback-drills/`

### Batch 4 — `USING_TRUE` tenant-scoped
~40 tables. Similar risk profile to Batch 3.

### Batch 5 — `USING_TRUE` with no scoping column
~70 tables. CANNOT be tenant-scoped without first adding the column.
Most of these are reference tables (psychology_principles, algorithm_
updates, intervention_templates etc.) where `using(true)` for SELECT
may actually be correct AND a `forbid all writes for anon/auth` policy
is needed. Per-table case-by-case.

### Batch 6 — `NO_POLICY` no-scope tables
~33 tables. Service-role-only by design (audit, system, internal).
Move to a documented service-role allowlist; tighten grants.

## Pre-condition for ALL subsequent batches

The service-role leak triage MUST land first. There is no value in
tightening RLS on a table whose primary access path is a service-role
client receiving a user-supplied `organization_id`. Sequence:

1. **PR A (this session):** policy docs + immutable audit log + Batch 1 + gap-list + leak inventory.
2. **PR B:** service-role-leak triage (46 routes → exempt / refactor / move-to-internal).
3. **PR C onwards:** Batches 2-6, one per PR, gated on adversarial test
   + per-batch rollback drill + Margot review.

## Rollback procedure for Batch 1

```sql
BEGIN;
DROP POLICY IF EXISTS autopilot_configs_tenant_read ON public.autopilot_configs;
DROP POLICY IF EXISTS autopilot_configs_tenant_write ON public.autopilot_configs;
-- ... (repeat for each of the 19 tables)
COMMIT;
```

After rollback, the affected tables return to `NO_POLICY` verdict (RLS
on, zero policies, service-role-only). No data is lost. No service-role
code path is affected.

## SLA after Batch 1 lands

- Adversarial SECURE count: 18 → 37 (target)
- Regression floor in `tests/security/cross-tenant.spec.ts`: bump from
  18 to 37
- Re-run baseline against `pg_policies` at +24h to confirm no policy
  drift
