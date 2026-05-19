# Change Management

**Mandate:** `a4aae2cf-6a05-4426-9019-3f38137a9b7b`
**SOC 2 artifact:** #6 of 21 (Margot Q1)
**Scope:** Every change to production code, infra, schema, or security
config.

## Hard rules

1. **Every change ships via PR.** Direct push to `main` is disabled by
   branch protection. The CEO override exception is the only path and
   is logged in `audit_events_immutable` with category `compliance`.
2. **CI must be green before merge.** No `--no-verify`. No bypass.
3. **Squash merge only.** Preserves the bisectable history shape and
   keeps `git log --oneline` readable.
4. **Migrations are forward-only.** Reversibility is a non-goal once a
   migration touches production data. Compensating migrations are written
   forward (e.g. `..._revert_<n>.sql`).
5. **Adversarial test required for security-sensitive changes.** Any PR
   that touches RLS policies, audit logger, auth flow, or middleware
   must run the adversarial spec (`tests/security/cross-tenant.spec.ts`
   and `__tests__/security/immutable-audit.spec.ts`) before merge.

## PR-quality gate (CI must pass)

| Check                           | Owner          | Blocking?  |
|---------------------------------|----------------|------------|
| `npm run type-check`            | Build          | Yes        |
| `npm run lint`                  | Build          | Yes        |
| `npm test`                      | Build          | Yes        |
| `scripts/validate-rls-coverage.ts` (schema-presence) | Security | Yes |
| `scripts/validate-env.js`       | Build          | Yes        |
| Dependabot vulnerability scan   | Security       | Yes        |
| Codeowner review                | Owner of touched paths | Yes (1 approval) |
| Margot security review (auto)   | Security       | Soft       |
| Adversarial RLS spec (if RLS PR)| Security       | Yes        |

## Branch model

- `main` → production. Vercel auto-deploys.
- `feat/*`, `fix/*`, `chore/*`, `docs/*` — feature branches. PR to `main`.
- `hotfix/*` — Sev1/Sev2 incidents only. May skip the Margot soft gate
  but still must pass Yes-blocking checks.
- No long-lived branches besides `main` (worktree convention per
  `feedback_substrate_change_discipline`).

## Deploy gate

1. PR merged → Vercel deploys preview.
2. Smoke test (Playwright) runs against preview.
3. Promote to production via Vercel UI OR `production-gate` skill (the
   latter only after Phill says "approve PR-<n>" to Margot).

## Schema migrations — extra rules

1. Migrations applied via `mcp__claude_ai_Supabase__apply_migration` (MCP
   server) only on production. Local dev uses
   `supabase/migrations/` files committed to the PR.
2. RLS policy additions: per-PR adversarial spec invocation against the
   touched tables — `RLS_ADVERSARIAL=true npm test cross-tenant.spec.ts`.
3. Any DROP TABLE or DROP COLUMN: requires explicit CEO sign-off
   recorded in the PR description with a quoted Telegram approval.
4. The 5-discipline substrate-change pattern applies
   (`feedback_substrate_change_discipline`):
   shadow-run, source-restore-before-refactor, vendor-pin, rollback-drill,
   no-touch-during-sprint-windows.

## Emergency change procedure

For Sev1 / Sev2 incidents:
1. Author opens `hotfix/*` branch
2. PR title prefixed `[HOTFIX]`
3. CI Yes-blocking checks must still pass
4. CODEOWNER approval can be Margot (auto) plus IC
5. Production-gate skill is invoked with explicit Telegram confirmation
6. Post-mortem within 5 business days per `incident-response.md`

## Audit trail

Every merge writes an `audit_events_immutable` event with
`event_type = 'change.merge'`, `payload.pr_number`, `payload.actor`, and
`payload.touched_paths`. Margot's CI hook performs this write
non-bypassably from a service-role context.

The annual SOC 2 evidence pack queries this table to produce a list of
all changes touching security-sensitive paths
(`lib/security/**`, `lib/middleware/**`, `supabase/migrations/**`,
`app/api/auth/**`).

## What this policy intentionally does NOT do

- Force a separate Change Advisory Board meeting. We're a small team;
  the PR + reviewer + CI is the CAB.
- Block speculative refactors. Surgical changes are encouraged
  (`CLAUDE.md` rule 3).
- Require pre-implementation tickets for tiny fixes. Use judgement
  (`CLAUDE.md` tradeoff clause).
