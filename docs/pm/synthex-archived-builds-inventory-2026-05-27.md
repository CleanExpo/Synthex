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
| `Synthex-hygiene` | `chore/synthex-phase2-hygiene-fix` | `6cf61c58` | gone/local-only | no | 2 | 1 | Import or supersede 2 unique hygiene commits. |
| `Synthex-journey-hmac` | `feat/journey-hmac-pixel-tokens` | `900fc34f` | gone/local-only | no | 2 | 1 | Security review and import/supersede HMAC journey-token work. |
| `Synthex-owner-override` | `feat/owner-override-tenant-assertion` | `c658fef0` | exists | no | 0 | 1 | No code import from head; patch is already equivalent on main. |
| `Synthex-phase1` | `chore/synthex-phase1-measurement` | `d8381169` | gone/local-only | no | 2 | 0 | Review Phase 1 measurement/adversarial artifacts for carry-forward. |
| `Synthex-phase2` | `feat/synthex-phase2-rls-soc2-scaffolding` | `81d63b9c` | exists | no | 24 | 0 | High-priority database/security review before import. |
| `Synthex-phase3` | `feat/synthex-phase3-pr4-stripe-dunning-config` | `09194e1b` | gone/local-only | no | 2 | 1 | Unique commits duplicate `Synthex-hygiene`; no independent Phase 3 import found. |
| `Synthex-phase4` | `feat/syn-831-aeo-snapshot-dashboard-scaffold` | `19df683c` | gone/local-only | no | 0 | 0 | No code import from head; patch is already equivalent on main. |
| `Synthex-phase5` | `feat/synthex-phase5-brand-config-phase6` | `57792542` | gone/local-only | no | 2 | 1 | Review/import Phase 5 TenantConfig continuation if still product-valid. |
| `Synthex-prod-verify` | `chore/synthex-phase6-production-verify` | `00fbddab` | gone/local-only | no | 1 | 1 | Preserve or refresh production sign-off doc; do not treat as current sign-off. |
| `Synthex-srleak` | `chore/synthex-service-role-triage` | `fcd8c9bf` | gone/local-only | no | 0 | 1 | No code import from head; patch is already equivalent on main. |
| `Synthex-testimonial` | `feat/testimonial-card-withauth` | `22b92180` | gone/local-only | no | 0 | 1 | No code import from head; patch is already equivalent on main. |

## Unique Commit Backlog

These are the archived commits that `git cherry -v origin/main <archive-ref>` reported as patch-unique (`+`) and therefore still need a human/code review decision before the archive can be considered fully closed.

### `Synthex-hygiene`

- `9e3a6d7b` - `chore(hygiene): fix withRateLimit imports + remove SYN-877 typescript-skip workaround`
- `6cf61c58` - `fix(brand-content): align RA brandColour with Wave 1 navy palette`

### `Synthex-journey-hmac`

- `52026aa3` - `feat(security): HMAC-sign journey pixel URLs (service-role leak fix 2/N)`
- `900fc34f` - `test(journey): update pulse-survey unit tests for signed-token URLs`

### `Synthex-phase1`

- `1f1b9116` - `chore(phase1): RLS adversarial + CFR baselines + planning refresh`
- `d8381169` - `fix(lint): remove unused eslint-disable no-console directives in cross-tenant spec`

### `Synthex-phase2`

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

The only patch-unique commits are the same two commits listed under `Synthex-hygiene`.

### `Synthex-phase5`

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

1. Review `Synthex-phase2` first because it carries the largest database/security backlog and still exists as a remote branch.
2. Review `Synthex-journey-hmac` next because it is security-sensitive service-role leak follow-up work and is local-only.
3. Review `Synthex-hygiene` once, then mark `Synthex-phase3` as duplicate coverage unless its dirty state contains separate useful work.
4. Review `Synthex-phase5` for current TenantConfig compatibility against the canonical package state.
5. Refresh `Synthex-prod-verify` into a current sign-off only after env, deployment, authenticated runtime, Supabase/RLS, and Vercel checks are rerun.
6. Triage broad dirty work in archived root `Synthex` as a separate backlog. Do not bulk-apply it.
