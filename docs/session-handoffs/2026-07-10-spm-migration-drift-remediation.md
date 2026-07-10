# SPM Spec — Prod Migration Drift: root-cause + safe remediation

`spm-run: 2026-07-10` · branch `claude/viral-method-cards-2d611b` (analysis vs `origin/main`) · **READ-ONLY spec — no build**

> **Judge verdict: 38/100 · REDUCE SCOPE · APPROVE-EXPERIMENT (not APPROVE-BUILD).**
> This spec authorises the safe subset (clear backlog + visibility check + ledger
> baseline) as build-ready, and quarantines the risky part (re-wiring the deploy
> buildCommand) as a staging-only experiment. Below 100/100 is never a blind prod build.

---

## 1. Task

Diagnose why recent Prisma migrations reached the repo but not production, remediate the
current drift **safely**, and prevent recurrence — without bricking prod deploys.

## 2. Project context

Synthex (Next.js 16 / Prisma 7 / Supabase on Vercel). Migrations are applied **out of
band** (Supabase SQL editor / `prisma db execute`), the founder is the prod-apply gate
(SYN-1085), and the `_prisma_migrations` ledger is **unbaselined**. This session closed
WS0 by hand-applying `20260710120000_mcp_api_keys` and `20260710100000_add_claim_approval_status`;
both surfaced as runtime 500s ("table/column does not exist") before the fix.

## 3. Problem

Recent migrations (≥ 2026-07-01) are in the repo but not in prod → runtime 500s across
MCP tools and dashboards. The originally-suspected cause (build-time `DATABASE_URL`
missing) is **refuted**.

**Actual root cause [VERIFIED, 2 seats converged]:** production deploys run `vercel build --prod`
(`.github/workflows/deploy.yml:133`), which executes `vercel.json` `buildCommand` =
`npx prisma generate && rm -rf .next/cache && next build --webpack` (`vercel.json:3`).
That command **never invokes** `scripts/build-with-migrations.sh` (the migrate-deploy +
`check-schema-drift.mjs` gate). The gate is **orphaned**: added in `3812c089` (2026-06-14,
"P0: apply migrations on deploy"), reverted in `b36f794c` (2026-07-02, "align buildCommand
with dashboard settings" / SYN-1056), never restored. `DATABASE_URL`/`DIRECT_URL` **are**
present at build (via `vercel pull --environment=production`, `deploy.yml:131`).

**So the incident is a visibility failure of an intentionally-manual gate** — not a broken
auto-apply. The founder-apply convention is by design (migration headers: "PROD apply is
the founder's gate", ".claude/rules/database/supabase-migrations.md"); what failed is that
nobody surfaced the pending backlog until prod 500'd.

## 4. Desired outcome

1. Prod schema matches `prisma/schema.prisma` for all shipped code (drift-check clean).
2. Pending migration backlog cleared safely (additive/idempotent, founder-applied).
3. `_prisma_migrations` ledger baselined so tooling reports truthfully.
4. **Recurrence prevented** by a non-blocking CI check that surfaces "repo migrations not
   in prod" on every PR — aligned with the manual-apply convention, adding no deploy-brick
   risk and no build-time DB credentials.

## 5. Scope

**In:** backlog audit + safe apply order; hardening `PENDING-generative_video_engine.sql`;
ledger baseline/reconcile; a non-blocking pending-migrations CI visibility check; a Linear
incident for the orphaned buildCommand; re-validating the drift parser against the current
226-model schema.

**Out (this spec):** blindly re-wiring `vercel.json` buildCommand → `build:vercel` on prod
(quarantined to a staging experiment, §13); making the drift checker fail-loud on
"can't-run" (rejected — availability regression); any `prisma db push`; any destructive DDL.

## 6. Existing capability (do not rebuild)

- `scripts/build-with-migrations.sh` — baseline-tolerant migrate-deploy + hard drift gate (orphaned, reusable).
- `scripts/check-schema-drift.mjs` — scalar-column drift checker (fail-open on infra, fail-closed on detected drift; validated at 215 models, schema now 226).
- `scripts/db/reconcile-migration-history.js` (`npm run db:migration-history:reconcile[:strict]`) — **read-only** ledger diagnostic (4 statuses).
- `prisma migrate resolve --applied <name>` — the actual ledger-write for out-of-band applies.

## 7. Specialist board (receipt)

- **Tier: T2.** Axes F2 / I4 / N3 / X3 / S3 (production pipeline, high blast radius, additive-but-irreversible-ish). `board_version: inline-3seat`.
- **Seats convened (3, parallel, read-only leaf agents):**
  1. `build-engineer` (pipeline root-cause) — verdict: hypothesis **refuted**, real cause = orphaned buildCommand; confidence **0.9**.
  2. `general-purpose` (migration backlog + reconcile) — cataloged 8 pending + loose file; confidence **~0.85** (could not read live ledger — Supabase MCP unauth).
  3. `senior-reviewer` (devil's-advocate judge) — **REDUCE SCOPE, 38/100**, confidence **0.80**.
- **Divergence:** seats 1 & 3 **converged independently** on the orphaned-buildCommand cause (high agreement); no seat defended the original hypothesis. Seat 3 added the decisive safety reframing (visibility-check over gate-flip). No ramp round needed.

## 8. Judge challenge (mandatory must-fix → 100/100 criteria)

Verdict **REDUCE SCOPE / 38/100**. Mandatory must-fix (each blocks a real 100):

1. **Diagnose the actual invocation, not the assumed one** — confirmed: buildCommand bypasses the wrapper. ✅ (met)
2. **Clear the backlog FIRST and verify empty** before any gate is armed — arming the hard gate with a non-empty backlog bricks every prod deploy.
3. **Never flip `vercel.json` buildCommand → wrapper on prod blind** — prove on staging with backlog clear; APPROVE-EXPERIMENT only.
4. **Preserve the drift checker's fail-SAFE-on-can't-run** — do NOT make it fail-loud on unreachable DB; loud reporting belongs in a CI job, not the deploy gate.
5. **Production-scope-only DB creds, never logged** — if any DB URL is added to a build/CI env, prod-scope only, prefer pooled `DATABASE_URL`, no `echo`.
6. **Re-validate the drift parser at 226 models** before trusting it as a gate (scalar-only regex parser; confirm a clean run + one true-positive).
7. **Ship the visibility check regardless** — the load-bearing recurrence fix.

A security `fail` was not raised at ≥0.8; item 5 is the residual security guard.

## 9. Proposed solution (REDUCED scope)

**Phase A — Clear the drift (out-of-band, founder-applied, additive/idempotent):**
apply the remaining pending migrations to prod `znyjoyjsvjotlzjppzal` via Supabase SQL
editor, in timestamp order, after hardening the one risky file:

- Pending (additive + idempotent, LOW): `20260704_add_conversion_copy_variant`,
  `20260704_add_brand_os_client_profile`, `20260704120000_geo_citation_events`,
  `20260710000000_client_engagement_events`, `20260710130000_syn_mcp_006_evidence_core`.
  (Already applied this session: `…_add_claim_approval_status`, `…_mcp_api_keys`.)
- **`PENDING-generative_video_engine.sql` — MEDIUM, must harden first:** add
  `IF NOT EXISTS`/`DO$$…EXCEPTION` guards (currently bare `ADD COLUMN`/`CREATE TABLE`/
  `ADD CONSTRAINT` → non-idempotent); run its two `CREATE INDEX CONCURRENTLY` **individually,
  outside any transaction**; add `ENABLE ROW LEVEL SECURITY` + service-role policy to the new
  `organization_video_quotas` table; **promote it to a timestamped folder**
  `20260710140000_generative_video_engine/migration.sql` so tooling can track it.
- **Caveat [INFERENCE]:** the "pending" state of the 5 is inferred (Supabase MCP was
  unauthenticated). Authoritative check first: `npm run db:migration-history:reconcile`.

**Phase B — Baseline + reconcile the ledger:** the ledger is unbaselined, so resolve the
**full applied history** (not just this session's two) via `prisma migrate resolve --applied <name>`
against `DIRECT_URL`, then confirm `reconcile` reports `ready`.

**Phase C — Prevent recurrence (the real fix):** add a **non-blocking CI check** that diffs
`prisma/migrations/*` + `PENDING-*.sql` against the prod ledger/`information_schema` and
**warns on the PR** when repo migrations aren't yet applied. No DB creds in the deploy build;
no deploy-brick risk. Keep `check-schema-drift.mjs` as a **CI advisory job** (a context that
already has DB access), not in the deploy buildCommand.

**Phase D — Quarantined experiment (separate, staging-only):** if true migrate-on-deploy is
wanted, restore buildCommand → `build:vercel` **on staging**, backlog already clear, and
prove the baseline-tolerant path doesn't abort (watch the P3005/P3009 regex against real
Prisma 7.x output). Only promote to prod after a clean staging run.

## 10. UX (developer/founder workflow)

- PR author sees a CI comment: "N migrations in repo not yet applied to prod: [list]" →
  makes the manual founder-apply gate observable at the moment work merges.
- Founder apply stays the same one-surface action (Supabase SQL editor), now driven by a
  visible checklist rather than discovered via a 500.

## 11. Technical design

- **Visibility check:** a Node/CI script (reuse `reconcile-migration-history.js`'s ledger
  read) run in a GitHub Actions job with prod `DIRECT_URL` (prod-scope secret), output as a
  non-blocking PR annotation. Exit 0 always; report-only.
- **Drift advisory:** move `check-schema-drift.mjs` invocation into a dedicated CI job
  (not `vercel.json` buildCommand); keep its fail-open-on-infra, fail-closed-on-drift
  semantics; re-validate the parser at 226 models first.
- **Ledger baseline:** scripted `prisma migrate resolve --applied` sweep over every
  already-applied migration dir, against `DIRECT_URL`; verify with `:strict` reconcile.
- **No change to `vercel.json` in Phases A–C.**

## 12. Security

- DB creds only in CI/prod-scope, never preview/all; prefer pooled `DATABASE_URL`; never
  echoed (item 5). A direct 5432 `DIRECT_URL` in a broadly-scoped build env is a
  supply-chain + log-exposure surface — avoid.
- RLS must be added to `organization_video_quotas` before applying the video-engine
  migration (service-role-only convention).
- No secrets in the repo; migration SQL contains no secrets.

## 13. Verification plan (isolation named; prod untouched except founder-gated applies)

- **Phase A:** after each apply, `npm run db:drift-check` (needs `DIRECT_URL`) → expect
  "no schema drift"; re-run the failing MCP tools live (`approvals_list_pending`,
  `search_media_library`) → expect **200**, not 500. (Requires a short-lived re-minted MCP
  session key, revoked after — same pattern as WS0.)
- **Phase B:** `npm run db:migration-history:reconcile:strict` → exit 0 / `ready`.
- **Phase C:** open a throwaway PR that adds a dummy pending migration → CI comment lists
  it; a PR with none → no warning. CI stays green either way (non-blocking).
- **Phase D (staging only):** `vercel build` on staging with buildCommand → `build:vercel`,
  backlog clear → build succeeds, `[build]` logs show the fall-through (not abort) path.

## 14. Loop + stress testing

- Idempotency: re-run each applied migration's SQL → no error (proves guards). The video
  engine file must pass this only AFTER hardening.
- Adversarial: apply the video-engine `CREATE INDEX CONCURRENTLY` inside a transaction →
  must fail (documents the hazard); run standalone → succeeds.
- Parser stress: run `check-schema-drift.mjs` against the 226-model schema; inject one known
  missing column in a scratch DB → expect exit 1 (true positive).

## 15. Acceptance criteria (100/100 = every item true)

1. `npm run db:migration-history:reconcile:strict` → `ready` (ledger baselined). ✅=pending
2. `npm run db:drift-check` → no drift, against prod. ✅=pending
3. `approvals_list_pending` + `search_media_library` return 200 live. ✅=pending
4. `PENDING-generative_video_engine.sql` hardened (guards + RLS + CONCURRENTLY handling) and
   promoted to a timestamped folder. ✅=pending
5. Non-blocking CI "pending migrations not in prod" check merged and demonstrably firing. ✅=pending
6. Drift parser re-validated at 226 models (clean run + one true positive). ✅=pending
7. Linear incident filed for the orphaned buildCommand (SYN-1056 regression). ✅=pending
8. `vercel.json` buildCommand **unchanged** on prod in this scope (experiment is separate). ✅=met by design

## 16. `/goal` command

```
/goal Remediate Synthex prod migration drift per docs/session-handoffs/2026-07-10-spm-migration-drift-remediation.md.
REDUCED SCOPE (judge 38/100): do Phases A–C only; Phase D (buildCommand re-wire) is a SEPARATE staging experiment, not in this goal.
Constraints: additive/idempotent only; never prisma db push; prod applies are the founder gate (SYN-1085, human-acked each); DB creds prod-scope-only, never logged; keep check-schema-drift fail-open-on-infra.
Done = all 8 acceptance criteria in §15 satisfied and verified with pasted tool output (drift-check clean, reconcile `ready`, approvals/media 200, CI check firing).
```

## 17. Implementation sequence

1. Authoritative ledger read (`reconcile`) → confirm which of the 5 are truly pending.
2. Harden `PENDING-generative_video_engine.sql` (guards + RLS) → promote to timestamped folder.
3. Founder-apply pending migrations out-of-band (timestamp order; video-engine last; CONCURRENTLY indexes standalone), each human-acked; drift-check after each.
4. Baseline `_prisma_migrations` (full history `migrate resolve --applied`) → `:strict` reconcile `ready`.
5. Live-verify the previously-500ing MCP tools return 200.
6. Build + merge the non-blocking pending-migrations CI check; move drift-check to a CI advisory job; re-validate the parser at 226 models.
7. File the Linear incident (orphaned buildCommand / SYN-1056 regression).
8. (Later, separate) Phase D staging experiment for real migrate-on-deploy.

## 18. Session-handoff seed

- **Done this session:** WS0 closed (`mcp_api_keys` applied); live 1→8 shipped ($1.6933, 8 gated cuts); `add_claim_approval_status` applied; root cause corrected to orphaned `vercel.json` buildCommand; this spec produced.
- **Next pickup:** run `reconcile` for the authoritative pending list, then Phase A step 2 (harden the video-engine SQL). Founder-apply is human-gated.
- **Risks:** ledger is unbaselined — do NOT re-arm the deploy gate before backlog clear + baseline; the drift parser is unvalidated at 226 models; the video-engine file is non-idempotent as written.

## 19. Final recommendation

**REDUCE SCOPE and proceed with Phases A–C.** The incident is a visibility failure of an
intentionally-manual gate, not a broken auto-apply — so the correct fix clears the current
backlog, baselines the ledger, and makes pending migrations **visible in CI**, all
convention-aligned and deploy-safe. Do **not** flip the deploy buildCommand or make the
drift gate fail-loud as part of this work; both risk converting silent drift into a total
prod-deploy outage. Treat real migrate-on-deploy as a later, staging-proven experiment.

`SPM spec complete. Next safe action: run `npm run db:migration-history:reconcile` (needs DIRECT_URL) to get the authoritative pending-migration list, then harden PENDING-generative_video_engine.sql before any founder apply.`
