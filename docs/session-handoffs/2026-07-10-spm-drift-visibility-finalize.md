# SPM Spec — Finalise migration-drift recurrence prevention (Phase C + housekeeping)

`spm-run: 2026-07-10 (2nd)` · analysis vs `origin/main` · **READ-ONLY spec — no build**
Follow-on to [2026-07-10-spm-migration-drift-remediation.md](2026-07-10-spm-migration-drift-remediation.md) (Phase A done).

> **Judge (inline, T1): APPROVE BUILD — Phase C only.** Design was settled by the prior
> run's 3-seat bench; this is execution-spec. Phase B is an existing ticket (SYN-1002),
> not buildable locally; housekeeping is trivial.

## 1. Task

Finalise the non-blocking recurrence-prevention work so prod migration drift is surfaced in
CI, never again discovered via a runtime 500.

## 2. Project context

Synthex (team `Synthex`, project `Synthex`). Prod drift cleared this session (Phase A: 3
migrations applied). Root cause (prior spec): `vercel.json` buildCommand never invokes the
migrate/drift pipeline (`build-with-migrations.sh` orphaned since `b36f794c`). The manual
founder-apply convention is intentional; the failure was **visibility**.

## 3. Problem

Nothing surfaces "repo migration not yet applied to prod" until a tool 500s. `check-schema-drift.mjs`
exists but is only invoked from the orphaned build script — it never runs in CI or deploy.

## 4. Desired outcome

Every PR (and main) gets a **non-blocking** signal listing schema objects declared in
`prisma/schema.prisma` but missing from prod — turning the manual-apply gate observable.

## 5. Scope

**In (Phase C, buildable now):** a non-blocking GitHub Actions job that runs the existing
`check-schema-drift.mjs` against prod read-only, report-only; re-validate the drift parser
at the current 226-model schema. **Housekeeping:** promote `PENDING-generative_video_engine.sql`
to a timestamped folder + add its missing `IF NOT EXISTS`/RLS guards (schema already in prod
— this is repo-truth alignment only).
**Out / deferred:** ledger baseline = **SYN-1002** (existing, needs prod access + founder —
annotate, don't dup); re-wiring `vercel.json` buildCommand = the prior spec's staging-only
Phase D experiment; making the drift checker fail-loud on can't-run (rejected — availability
regression).

## 6. Existing capability (reuse, don't rebuild)

- `scripts/check-schema-drift.mjs` — schema→`information_schema` scalar-column comparator
  (fail-open on infra, fail-closed on detected drift). **This is the engine** — the CI job
  just invokes it with a prod URL and `continue-on-error`.
- `scripts/db/reconcile-migration-history.js` — read-only ledger diagnostic (alt engine).
- `rls-checks.yml` — precedent for a schema-parse CI job.

## 7. Specialist board (receipt)

- **Tier T1** (axes F1/I2/N2/X2/S2 — CI-only, read-only prod, no deploy path touched).
  `board_version: inline`. **Seats: 0 (inline judge).** Rationale logged: the prior
  `spm-run` (2026-07-10, T2) convened a 3-seat bench (build-engineer / migration-safety /
  devil's-advocate) that already produced the must-fix list this spec inherits; re-benching
  identical territory adds no divergence. Not a simulated board — explicitly T1/inline.

## 8. Judge challenge (inherited must-fix → acceptance criteria)

From the prior bench, the criteria that bind Phase C:

1. **Non-blocking** — the job must never fail a build (`continue-on-error: true` / `|| true`). ✅ by design
2. **Fail-SAFE when it can't run** — if the prod URL secret is absent or unreachable, skip
   with exit 0 + a clear log; never fail. ✅ by design (safe to merge before the secret exists)
3. **Prod-scope creds, never logged** — read-only `information_schema` SELECTs only → use the
   **pooled** `DATABASE_URL` (no need for direct 5432 `DIRECT_URL`); GitHub Actions secret,
   never `echo`'d. ✅ (no security fail)
4. **Re-validate the parser at 226 models** — run `check-schema-drift.mjs` once against a
   known DB, confirm a clean pass + one injected true-positive, BEFORE trusting it as a
   signal. ⬜ must be verified during build (not assumed).
5. **This IS the visibility check** the bench called load-bearing. ✅

No security `fail` (read-only, pooled, prod-scope, unlogged). **Inline verdict: APPROVE BUILD**
for Phase C provided criterion 4 is actually executed.

## 9. Proposed solution

**Phase C:**

- New workflow `.github/workflows/migration-drift-visibility.yml`: on `pull_request` + `push`
  to main; single job; `continue-on-error: true`; step runs
  `node scripts/check-schema-drift.mjs` with `DATABASE_URL: ${{ secrets.PROD_DB_READONLY_URL }}`.
- Wrap invocation so a missing/blank secret → `echo "no prod URL secret — skipping (non-blocking)"; exit 0`.
- Pipe the checker's stderr (its drift detail) into `$GITHUB_STEP_SUMMARY` so the result is
  visible on the PR without gating it.
- **Enhancement (kicker):** label output as "schema ahead of prod (pending manual apply —
  expected)" so the signal is actionable, not alarming — since pending-migrations-until-founder-apply
  is the _normal_ state here.

**Housekeeping:** move `PENDING-generative_video_engine.sql` →
`prisma/migrations/20260710140000_generative_video_engine/migration.sql`; add `IF NOT EXISTS`
guards to its bare `CREATE TABLE`/`ADD COLUMN`/`ADD CONSTRAINT`, and `ENABLE ROW LEVEL SECURITY`

- service-role policy on `organization_video_quotas` (repo-truth only; prod already has it).

**SYN-1002:** add a comment — acute drift cleared 2026-07-10 (mcp_api_keys, add_claim_approval_status,
syn_mcp_006 applied); full `_prisma_migrations` baseline still pending; needs prod `DIRECT_URL` + founder.

## 10. UX

PR authors see a "Migration drift (advisory)" job with a step-summary list of any
schema-declared object missing from prod. Green/neutral always; never red.

## 11. Technical

- No new deps. Reuse `check-schema-drift.mjs` verbatim.
- Secret `PROD_DB_READONLY_URL` (pooled, read-only role if available) added by the founder in
  GitHub repo settings (Claude cannot set repo secrets — that's a settings action for Phill).
- Job is standalone (not in the deploy `buildCommand`), so it can never brick a deploy.

## 12. Security

- Read-only pooled connection; ideally a Supabase read-only DB role. Prod-scope GitHub secret,
  never echoed, exposed only to this one job. No `DIRECT_URL`/5432 needed (no DDL).

## 13. Verification (isolation: CI job on a throwaway PR; prod read-only)

- Open a scratch PR → the advisory job runs, posts a step summary, and is **not** required/green-gating.
- With the current cleared schema → summary shows "no drift".
- Temporarily add a dummy model column in schema (scratch branch) → summary lists it; job still green.
- Parser: run `check-schema-drift.mjs` locally/CI against a DB with one known-missing column → exit 1 (true positive); against matching schema → exit 0.

## 14. Loop + stress

- Run the job with the secret unset → skips cleanly (exit 0). With a bad URL → skips/logs, never fails.
- 226-model parse completes without crash; spot-check 3 `@@map`/`@map` models resolve to DB names.

## 15. Acceptance criteria (100/100)

1. `migration-drift-visibility.yml` merged; runs on PR + main; `continue-on-error`; never gates. ⬜
2. Missing/blank secret → job skips with exit 0 (proven on a PR without the secret). ⬜
3. Parser re-validated at 226 models: clean pass + one injected true-positive (output pasted). ⬜
4. Step summary distinguishes "pending manual apply (expected)" from unexpected drift. ⬜
5. `PENDING-generative_video_engine.sql` promoted to timestamped folder + guarded + RLS. ⬜
6. SYN-1002 annotated with Phase-A outcome; no duplicate ticket created. ⬜
7. No secret value in any log; secret is prod-scope pooled read-only. ⬜

## 16. `/goal` command

```
/goal Implement Phase C migration-drift visibility per docs/session-handoffs/2026-07-10-spm-drift-visibility-finalize.md.
Build ONLY: (1) .github/workflows/migration-drift-visibility.yml — non-blocking advisory job running scripts/check-schema-drift.mjs against a prod read-only secret, skip-clean if secret absent, post drift to $GITHUB_STEP_SUMMARY, distinguish expected-pending from unexpected; (2) promote PENDING-generative_video_engine.sql to prisma/migrations/20260710140000_generative_video_engine/ with IF NOT EXISTS guards + RLS on organization_video_quotas.
Then re-validate scripts/check-schema-drift.mjs at 226 models (clean pass + one injected true-positive, paste output).
Do NOT touch vercel.json buildCommand; do NOT add DB creds to the deploy build; do NOT run prisma migrate deploy. Secret creation + SYN-1002 comment are founder actions.
Done = all 7 §15 criteria met with pasted evidence.
```

## 17. Implementation sequence

1. Re-validate the parser at 226 models (must-fix #4) → if it crashes/misparses, fix the parser first.
2. Write the advisory workflow (non-blocking, skip-clean-if-no-secret, step-summary output).
3. Promote + harden the video-engine migration file (repo-truth alignment).
4. (Founder) add `PROD_DB_READONLY_URL` GitHub secret; comment on SYN-1002.
5. Prove on a scratch PR (green, summary populated, not gating).

## 18. Session-handoff seed

- **Done:** Phase A (all prod drift cleared). This spec finalises Phase C.
- **Buildable now by Claude:** the workflow + parser re-validation + file promotion. **Founder-only:** the GitHub secret + SYN-1002 comment.
- **Deferred:** SYN-1002 full ledger baseline (needs prod access); Phase D buildCommand experiment.

## 19. Final recommendation

**APPROVE BUILD for Phase C** (non-blocking advisory CI + housekeeping) — it's the load-bearing
recurrence fix, reuses existing code, adds no deploy-brick risk, and is safe to merge before the
secret exists. Keep the ledger baseline as SYN-1002 and the buildCommand re-wire as a separate
staged experiment.

`SPM spec complete. Next safe action: on your go, I build the advisory workflow + re-validate the parser + promote the video-engine migration file (the GitHub secret and SYN-1002 comment stay with you).`
