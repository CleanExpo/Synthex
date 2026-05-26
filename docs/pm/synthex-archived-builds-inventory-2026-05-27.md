# Synthex Archived Builds Inventory - 2026-05-27

## Scope

This inventory covers the preserved local Synthex builds under:

`/Users/phill-mac/Local-Quarantine/Synthex-cleanup-20260526-230400/archived-local-builds`

The canonical repo for continued work is:

`/Users/phill-mac/Documents/Synthex -> /Users/phill-mac/pi-seo-workspace/Synthex`

Remote source of truth:

`https://github.com/CleanExpo/Synthex.git`

## Inventory Summary

| Archived build | Branch | Head | Remote branch | Ancestor of `origin/main` | Patch-unique commits | Dirty files | Required action |
|---|---|---:|---|---|---:|---:|---|
| `Synthex` | `fix/remove-ccw-apt-example-copy` | `cf61a3b7` | gone/local-only | no | 0 | 62 | Triage dirty work only; head patch is already equivalent on main. |
| `Synthex-audit` | `main` | `148d006e` | exists | yes | 0 | 4 | No branch import; inspect dirty package/route changes before final archive closure. |
| `Synthex-hygiene` | `chore/synthex-phase2-hygiene-fix` | `6cf61c58` | gone/local-only | no | 2 | 1 | Assessed 2026-05-27: hygiene payload already present or superseded on current main; no import required. |
| `Synthex-journey-hmac` | `feat/journey-hmac-pixel-tokens` | `900fc34f` | gone/local-only | no | 2 | 1 | Assessed 2026-05-27: HMAC code/test payload already present on current main; no import required. |
| `Synthex-owner-override` | `feat/owner-override-tenant-assertion` | `c658fef0` | exists | no | 0 | 1 | No code import from head; patch is already equivalent on main. |
| `Synthex-phase1` | `chore/synthex-phase1-measurement` | `d8381169` | gone/local-only | no | 2 | 0 | Assessed 2026-05-27: measurement artifacts already present; no import required. |
| `Synthex-phase2` | `feat/synthex-phase2-rls-soc2-scaffolding` | `81d63b9c` | exists | no | 24 | 0 | Assessed 2026-05-27: payload already present or superseded on current main; no import required. |
| `Synthex-phase3` | `feat/synthex-phase3-pr4-stripe-dunning-config` | `09194e1b` | gone/local-only | no | 2 | 1 | Assessed 2026-05-27: unique commits duplicate closed `Synthex-hygiene`; no import required. |
| `Synthex-phase4` | `feat/syn-831-aeo-snapshot-dashboard-scaffold` | `19df683c` | gone/local-only | no | 0 | 0 | No code import from head; patch is already equivalent on main. |
| `Synthex-phase5` | `feat/synthex-phase5-brand-config-phase6` | `57792542` | gone/local-only | no | 2 | 1 | Assessed 2026-05-27: TenantConfig payload present; stale CCW test references fixed on current main. |
| `Synthex-prod-verify` | `chore/synthex-phase6-production-verify` | `00fbddab` | gone/local-only | no | 1 | 1 | Preserve or refresh production sign-off doc; do not treat as current sign-off. |
| `Synthex-srleak` | `chore/synthex-service-role-triage` | `fcd8c9bf` | gone/local-only | no | 0 | 1 | No code import from head; patch is already equivalent on main. |
| `Synthex-testimonial` | `feat/testimonial-card-withauth` | `22b92180` | gone/local-only | no | 0 | 1 | No code import from head; patch is already equivalent on main. |

## Unique Commit Backlog

These are the archived commits that `git cherry -v origin/main <archive-ref>` reported as patch-unique (`+`) and therefore still need a human/code review decision before the archive can be considered fully closed.

### `Synthex-hygiene`

Assessment on 2026-05-27: these commits are still patch-unique by Git topology, but the hygiene payload is already present in current `main` or superseded by safer current files. No branch merge or cherry-pick is required.

Evidence:

- The 16 route files touched by `9e3a6d7b` for missing `withRateLimit` imports compared identical to `archive-check/Synthex-hygiene`.
- `lib/remotion/brand-content.ts` compared identical to `archive-check/Synthex-hygiene`; RestoreAssist `brandColour` is already `#1C2E47`.
- Current `next.config.mjs` has the intended SYN-877 correction and no `typescript.ignoreBuildErrors` workaround, but also contains newer asset cache/CSP header work not present in the archived branch.
- Current `__tests__/remotion/brand-registry.test.ts` keeps the RA navy assertion and includes newer CCW-aware expectations not present in the archived branch.
- Validation after assessment: `npm test -- --runInBand __tests__/remotion/brand-registry.test.ts` passed 16/16 tests, and `npm run type-check` exited 0.

Original patch-unique commit list retained for audit:

- `9e3a6d7b` - `chore(hygiene): fix withRateLimit imports + remove SYN-877 typescript-skip workaround`
- `6cf61c58` - `fix(brand-content): align RA brandColour with Wave 1 navy palette`

### `Synthex-journey-hmac`

Assessment on 2026-05-27: these commits are still patch-unique by Git topology, but their HMAC code and test payload is already present in current `main`. No branch merge or cherry-pick is required.

Evidence:

- `__tests__/security/journey-hmac.test.ts` compared identical to `archive-check/Synthex-journey-hmac`.
- `app/api/journey/click/route.ts`, `app/api/journey/pulse-confirm/route.ts`, and `app/api/journey/pulse/route.ts` compared identical to `archive-check/Synthex-journey-hmac`.
- `lib/journey/pixel-token.ts`, `lib/journey/pulse-survey.ts`, and `__tests__/unit/journey/pulse-survey.test.ts` compared identical to `archive-check/Synthex-journey-hmac`.
- The only inspected difference was `.env.example`: current `main` contains extra unrelated marketing-agency signal env placeholders, so the archived `.env.example` must not replace it.

Original patch-unique commit list retained for audit:

- `52026aa3` - `feat(security): HMAC-sign journey pixel URLs (service-role leak fix 2/N)`
- `900fc34f` - `test(journey): update pulse-survey unit tests for signed-token URLs`

### `Synthex-phase1`

Assessment on 2026-05-27: the Phase 1 measurement/adversarial payload is already present in current `main`. No branch merge or cherry-pick is required.

Evidence:

- `docs/billing/churn-mix-2026-05-16.md`, `docs/cleanup/branch-reconciliation-2026-05-16.md`, `docs/ops/cfr-baseline-2026-05-16.md`, `docs/security/rls-adversarial-baseline-2026-05-16.md`, `jest.worktree.cjs`, `scripts/cfr-baseline.ts`, `scripts/churn-mix-analysis.ts`, and `tests/security/cross-tenant.spec.ts` compared identical to `archive-check/Synthex-phase1`.
- Current `.planning/ROADMAP.md`, `.planning/STATE.md`, and `package.json` intentionally differ because current main contains newer v12.0/marketing/media/package state and should not be rolled back to the archived branch.
- Validation after assessment: `npm test -- --runInBand tests/security/cross-tenant.spec.ts` reported the suite skipped by design because `RLS_ADVERSARIAL=true` was not set. This proves the test is discoverable, not that live RLS currently passes.

Original patch-unique commit list retained for audit:

- `1f1b9116` - `chore(phase1): RLS adversarial + CFR baselines + planning refresh`
- `d8381169` - `fix(lint): remove unused eslint-disable no-console directives in cross-tenant spec`

### `Synthex-phase2`

Assessment on 2026-05-27: these commits are still patch-unique by Git topology, but their final file payload is already present in current `main` or superseded by safer current files. No branch merge or cherry-pick is required.

Evidence:

- Phase 2 docs, SOC 2 policy docs, `lib/security/audit-logger.ts`, `tests/security/cross-tenant.spec.ts`, `__tests__/security/immutable-audit.spec.ts`, and the main RLS/SOC2 migration payloads compared identical to `archive-check/Synthex-phase2`.
- `supabase/migrations/20260516000003_rls_batch_1_5_drop_broken_using_true_policies.sql` from the archived branch is present on current main as `supabase/migrations/20260516000004_rls_batch_1_5_drop_broken_using_true_policies.sql` with identical content.
- Current `supabase/migrations/20260404100219_client_journey_events.sql` is more defensive than the archived branch: it uses `IF NOT EXISTS` and wraps the service-role policy in a duplicate-safe `DO` block.
- Current `supabase/migrations/20260405014604_syn677_engagement_outcome.sql` is more defensive than the archived branch: it uses `ALTER TABLE IF EXISTS` and guards index/comment creation behind table-existence checks.

Original patch-unique commit list retained for audit:

- `60943c67` - `feat(security): Phase 2 SOC 2 scaffolding - immutable audit log, RLS batch 1, policy docs`
- `23a3e4b8` - `fix(lint): remove unused eslint-disable no-console directives (port from PR #238)`
- `db83c003` - `feat(security): RLS Batch 1.5 - drop 4 broken using-true policies`
- `f6fcd0f5` - `fix(supabase-preview): bootstrap Prisma-dependency placeholders`
- `5ca475e1` - `fix(supabase-preview): swallow type-mismatch errors in defensive policy DO blocks`
- `28693a88` - `fix(supabase-preview): bootstrap 3 more Prisma-managed tables (ALTER targets)`
- `83b9ddb2` - `fix(supabase-preview): rename bootstrap to valid early timestamp`
- `ca9cbba7` - `fix(supabase-preview): split bootstrap into two stages to match Preview history`
- `9d83b77a` - `fix(supabase-preview): bootstrap 6 more Prisma-managed tables hit by non-defensive ALTERs`
- `e98a3447` - `fix(supabase-preview): supplement bootstrap for 6 more tables (already-applied trap)`
- `87ec258e` - `fix(supabase-preview): wrap views + policies in defensive DO blocks`
- `5722d46b` - `fix(supabase-preview): wrap team_members indexes + policies defensively`
- `1e8a3c72` - `fix(supabase-preview): extend EXCEPTION list to catch type-mismatch errors`
- `00d31cd4` - `fix(supabase-preview): wrap team_member_page_views CREATE TABLE defensively`
- `a7629a2c` - `fix(supabase-preview): rename client_journey_events to unique version`
- `d317afdb` - `fix(supabase-preview): rename 4 duplicate-version migrations to unique timestamps`
- `2abee497` - `fix(supabase-preview): bootstrap public.clients table before syn681`
- `fc6d7b13` - `fix(supabase-preview): wrap syn730 client_value_scorecard rebuild defensively`
- `f9db7e39` - `fix(supabase-preview): wrap aeo_gate_runs admin policy in DO block`
- `abd0af7d` - `fix(supabase-preview): bootstrap public.user_roles before 20260516 admin policies`
- `fb3858a5` - `fix(rls): cast auth.uid() to text when comparing against user_roles.user_id`
- `862cf20e` - `fix(supabase-preview): wrap Batch 1.5 DROP POLICY statements defensively`
- `b301fcdd` - `fix(supabase-preview): wrap dunning_states user policy defensively`
- `81d63b9c` - `fix(supabase-preview): wrap all 38 Batch 1 CREATE POLICY statements`

### `Synthex-phase3`

The only patch-unique commits are the same two commits listed under `Synthex-hygiene`. Since `Synthex-hygiene` is now closed for import, `Synthex-phase3` has no independent branch payload to import. Its dirty archived worktree still shows the repeated deleted `app/api/seo/search-console/coverage/route.ts` archive noise and should not be bulk-applied.

### `Synthex-phase5`

Assessment on 2026-05-27: the Phase 5 TenantConfig payload is already present in current `main`, but current main had a real stale-test issue after `7edc4445` removed CCW/client example references.

Evidence and action:

- `.planning/phases/phase-6/PHASE-6-PLAN.md`, `packages/brand-config/src/tenant-resolver.ts`, `packages/brand-config/src/tests/tenant-resolver.test-d.ts`, and `__tests__/brand-config/tenant-resolver.spec.ts` compared to the archive payload before cleanup.
- `packages/brand-config/src/index.ts` correctly differs from the archive because current main removed the `ccw` export in `7edc4445 Remove client example references from Synthex (#270)`.
- `npm --prefix packages/brand-config run typecheck` initially failed because `packages/brand-config/src/tests/tenant-resolver.test-d.ts` still expected `ccw` in `TenantSlug`.
- `npm test -- --runInBand __tests__/brand-config/tenant-resolver.spec.ts` initially failed with "No tests found" because the repo Jest config only runs `__tests__/**/*.test.ts`, not `__tests__/**/*.spec.ts`.
- Fixed on current main: removed stale `ccw` expectations from TenantConfig tests and renamed the runtime test to `__tests__/brand-config/tenant-resolver.test.ts`.
- Validation after fix: `npm --prefix packages/brand-config run typecheck` exited 0; `npm test -- --runInBand __tests__/brand-config/tenant-resolver.test.ts` passed 7/7 tests; root `npm run type-check` exited 0.

Original patch-unique commit list retained for audit:

- `59d89156` - `docs(phase-6): decompose Tasks 6.2-6.5 (TenantConfig envelope rollout)`
- `57792542` - `feat(brand-config): TenantConfig resolver (Phase 6 Task 6.2)`

### `Synthex-prod-verify`

- `00fbddab` - `docs(sign-off): Synthex production-ready verification 2026-05-16`

## Dirty Worktree Notes

- The repeated dirty deletion of `app/api/seo/search-console/coverage/route.ts` appears in most archived linked worktrees, while the file exists in canonical `main`. Treat it as archive dirt until a branch-specific diff proves otherwise.
- `Synthex` has broad uncommitted work across auth, brand config, marketing docs, package files, scripts, tests, and untracked marketing orchestrator files. This should be triaged separately before anything is copied forward.
- `Synthex-audit` has dirty package metadata and the same deleted route. Its branch head is already merged into `origin/main`.
- Clean archived worktrees: `Synthex-phase1`, `Synthex-phase2`, `Synthex-phase4`.

## Recommended Closure Order

1. Refresh `Synthex-prod-verify` into a current sign-off only after env, deployment, authenticated runtime, Supabase/RLS, and Vercel checks are rerun.
2. Triage broad dirty work in archived root `Synthex` as a separate backlog. Do not bulk-apply it.
3. Close or delete the remote `feat/synthex-phase2-rls-soc2-scaffolding` branch only after explicit human confirmation, because the project constitution blocks unapproved remote mutation.
