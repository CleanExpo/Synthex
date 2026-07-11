# \_archived/churn-scorer — retrieved deployed source, kill pending

**Do not deploy from here.** This is the archived source of a deployed edge function that has
**no source anywhere else in git history**, captured before the founder-gated deletion so its
logic is not lost. Spec: `docs/specs/spm-parity-remediation-2026-07-11.md` (C2 / phase P0 + F1).

## What this is

- Deployed function `churn-scorer` (id `9cd9750b-474f-4a9e-a4ec-13b2f66df28d`, version 3,
  `verify_jwt=false`, ACTIVE), pulled 2026-07-11 via Supabase MCP `get_edge_function`
  (`ezbr_sha256=30cd4e80208b39c90687ab6dfa9e98552fd215c456d95540d4fb611cd92f1793`).
- It is invoked nightly by pg_cron job `daily-churn-score` (`0 2 * * *`, jobid 1, active) and
  proxies `POST` to `${NEXT_PUBLIC_APP_URL}/api/internal/churn-scorer` — **a route that does not
  exist** in `app/api/internal/`. So the upstream fetch 404s and the handler returns **500 to
  the cron caller** (observed live: 500, 2,230 ms, at 2026-07-11 02:00:03 UTC via `get_logs`).
  The nightly job has therefore been failing since ~2026-04-09.

## Provenance / decision

- SYN-618. Churn scoring was never a shipped feature: no committed route, and
  `docs/pm/capability-matrix.csv` marks retention incomplete. `client_churn_risk` (its backing
  table, 0 rows) was applied straight to prod via `supabase db push`
  (`supabase_migrations.schema_migrations` version `20260408225959 syn618_client_churn_risk`),
  its migration file since removed from the tree — an aborted spike.
- **Decision (spec C2): KILL.** In founder gate F1: `cron.alter_job(1, active := false)` to
  stop the nightly failure, then delete the function via the Supabase dashboard (no MCP delete
  tool). This archive is the record if a rebuild is ever chosen; a Linear ticket carries the
  rebuild-vs-retire decision into normal prioritization.
