# F2 + Synthex parity finalization

The last gated actions to close the Synthex parity-remediation program (spec
`docs/specs/spm-parity-remediation-2026-07-11.md`). F1 (ledger 33→43, churn cron off,
17 dropped, 5 renamed) is complete and verified. This is edge-function hardening + tie-offs.

## The edge-function picture (from the F2 mapping)

6 functions were deployed, all `verify_jwt=false` (open HTTP trigger). They split three ways:

- **Delete (4)** — nothing invokes them:
  - `churn-scorer` — killed in F1 (cron disabled); source archived at `supabase/functions/_archived/churn-scorer/`.
  - `deliver-advisor-brief`, `advisor-weekly-metrics`, `algorithm-freshness-monitor` — **orphaned**: plain `serve()`, no `Deno.cron`, no `pg_cron` job, and no repo caller. Their docstrings claim dashboard cron schedules that were never created. Nothing triggers them.
- **Harden (2)** — real work runs via in-process `Deno.cron` (which bypasses the HTTP handler), so gating the handler is non-breaking:
  - `compute-health-scores`, `health-score-interventions` — this PR adds a constant-time inbound-secret check to their `Deno.serve` handler, **log-only by default** (`EDGE_AUTH_ENFORCE` unset).

## Gated actions (founder / operator)

### 1. Delete the 4 dead functions (Supabase dashboard → Edge Functions → delete)

`churn-scorer`, `deliver-advisor-brief`, `advisor-weekly-metrics`, `algorithm-freshness-monitor`.
No MCP delete tool exists; do it in the dashboard. Removes 4 unauthenticated HTTP surfaces outright.

### 2. Deploy the 2 hardened functions (log-only first)

No CLI deploy path is committed, so deploy via the Supabase MCP `deploy_edge_function` (or the
dashboard). Deploy with the current code (`EDGE_AUTH_ENFORCE` **unset** = log-only) — this cannot
break anything: the `Deno.cron` schedule doesn't use the handler, and log-only allows all inbound.

### 3. Set per-function secrets, then enforce

- Set project secrets: `CRON_SECRET_COMPUTE_HEALTH_SCORES`, `CRON_SECRET_HEALTH_SCORE_INTERVENTIONS`
  (each a fresh random token). If you skip these, the functions fall back to the shared `CRON_SECRET`.
- Confirm nothing is manually triggering the HTTP handler without the secret (watch `get_logs` for
  the `inbound secret missing/invalid (log-only; allowing)` warning for a few days).
- When clean, set `EDGE_AUTH_ENFORCE=true` and redeploy. Smoke it: `POST` with the correct
  `Authorization: Bearer <secret>` → 200; with a wrong/absent one → 401. The `Deno.cron` runs stay green.

## Repo tie-offs (normal PRs)

- Merge **#738** (`db_preflight` trimmed to the 9 live tables) — completes the F1 drop follow-up.
- Confirm the parity PRs are merged (#724/#729 reconcile, #730 P0, #731 P2, #732 P3, #736 F1 runbook).
- This PR also commits the previously-untracked spec `docs/specs/spm-parity-remediation-2026-07-11.md`.

## Post-deploy verification (closes P2's deferred criterion, free, read-only)

Once Vercel redeploys `main` and there's login activity, confirm the P2 auth fix is live:
`SELECT count(*) FROM audit_events_immutable WHERE event_type LIKE 'auth_monitor.%';` on
`znyjoyjsvjotlzjppzal` — expect > 0 (auth events now persisting, PII-minimized). That is the real-prod
proof P2's Supabase-branch check was standing in for.

## Definition of done

Ledger 43 ✓ · churn cron off ✓ · 17 dropped ✓ · 5 renamed ✓ (all F1, verified) · 4 dead functions
deleted · 2 hardened + enforced · #738 merged · spec committed · `auth_monitor.*` rows appearing.
