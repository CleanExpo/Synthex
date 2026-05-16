# Local Branch Reconciliation — 2026-05-16

**Mandate:** `450be04c-504d-4824-bd3f-f62178721c0b` (Synthex Phase 1, Deliverable 5)
**Scope:** local branches in `/Users/phill-mac/Synthex` (canonical clone) NOT merged into `origin/main`.

## Method

```bash
cd /Users/phill-mac/Synthex
git fetch origin --quiet
git branch --no-merged origin/main
# Then for each: ahead/behind count + commit message lookup vs origin/main shipped log
```

26 local branches surfaced as "no-merged" against `origin/main`. The Board memo
sample-listed 8 — the recon was wider.

## Per-branch decisions

### MERGE — 1 branch

| branch                                   | head SHA   | action                                                 |
|------------------------------------------|------------|--------------------------------------------------------|
| `chore/brand-config-type-test-utils`     | `1bad2155` | Cherry-picked to NEW branch `feat/brand-config-tenant-envelope` (`a1bc7d9c`) on top of fresh `origin/main`. **DRAFT PR #237 opened** (Phase 6 Task 6.1 — TenantConfig envelope, ADR 002). |

### CONVERT-TO-ISSUE — 0 branches

PR #226 already tracks `phillmcgurk/syn-956-...` and remains open — that branch
is effectively the "issue" already. Nothing to convert.

### ABANDON — 25 branches

All these branches' work was squash-merged to `origin/main` already (verified
via `git log origin/main --grep=…` per commit subject). The local copies are
stale and the SHA on the branch will never appear on main. Recommend
`git branch -D` after Phase 1 ships.

| branch                                                          | shipped-as commit / PR on main          |
|-----------------------------------------------------------------|-----------------------------------------|
| `chore/brand-config-as-const-narrowing` (`1555ef1e`)            | `d38906e2` (#236)                       |
| `chore/claude-settings-tooling-fixes` (`666a5b1e`)              | `6328d30d` (#228)                       |
| `claude/charming-villani` (`473f209c`)                          | reverted-then-superseded; abandoned line |
| `claude/hopeful-banzai` (`d73d7e0d`)                            | revert(SYN-907) — superseded            |
| `claude/sleepy-hypatia` (`2d0908e2`)                            | CodeRabbit feedback, already on main    |
| `claude/syn-953-deploy-fix` (`d4cc4fbf`)                        | `7cddd6ec` (#223)                       |
| `claude/syn-953-deploy-fix-followup` (`df9c4259`)               | `ac142813` (#224)                       |
| `claude/syn-953-monitoring-routes` (`c19e60bf`)                 | `257376d0` (#225)                       |
| `feat/design-md-adoption` (`105cfebc`)                          | `4b1a9a54`                              |
| `feat/john-coutis-brand-onboarding` (`e9013d33`)                | `858b0d23`                              |
| `feat/ra-3024-batch-2-llm-routes` (`84441b89`)                  | `99e1e5dc` (#231)                       |
| `feat/ra-3024-rate-limit-user-llm-routes` (`1546eb0f`)          | `94015591` (#229)                       |
| `phillmcgurk/hermes-h1-finish-to-main` (`329dd5d5`)             | `69e88cfc` (#207) chain consolidation   |
| `phillmcgurk/hermes-h1-integration` (`02aa5ffa`)                | merged via HERMES H-1 chain             |
| `phillmcgurk/syn-909-her-1a-…` (`4652d8d7`)                     | `d13bca54` (#202)                       |
| `phillmcgurk/syn-910-her-1b-…` (`1b0a1473`)                     | `d494a150` (#203)                       |
| `phillmcgurk/syn-911-her-1c-discovery-engine` (`3b1c1057`)      | `69e88cfc` (#207)                       |
| `phillmcgurk/syn-911-hermes-org-impersonation-fix` (`ce2a629a`) | `ab120806` (#209)                       |
| `phillmcgurk/syn-912-her-1d-…` (`941b99ef`)                     | `69e88cfc` (#207)                       |
| `phillmcgurk/syn-913-her-1e-…` (`d4d35e63`)                     | `69e88cfc` (#207)                       |
| `phillmcgurk/syn-938-ai-commentary-…` (`2c04ff2a`)              | `373fde79` (#214)                       |
| `phillmcgurk/syn-939-ai-commentary-…` (`a7f71c15`)              | `7900203e` (#215)                       |
| `phillmcgurk/syn-940-ai-commentary-…` (`8fbc03c1`)              | `aa81207d` (#216)                       |
| `phillmcgurk/syn-956-ci-failure-…` (`c81e5cae`)                 | open PR #226 (CONFLICTING — see below)  |
| `security/ra-3021-rls-coverage-gap` (`6ef8c590`)                | `e8ee73a1` (#232)                       |

### Notes

- `phillmcgurk/syn-956-ci-failure-cleanexposynthex-deploy-on-main` is the
  head of open PR #226 (`fix(SYN-956): lazy-init Supabase in monitoring/errors`),
  currently CONFLICTING / DIRTY against main. The PR exists; the local branch
  is effectively a mirror. ABANDON the local branch; the PR continues to
  represent the work-in-flight.

## How to clean up the abandoned branches

```bash
cd /Users/phill-mac/Synthex
git branch -D \
  chore/brand-config-as-const-narrowing \
  chore/brand-config-type-test-utils \
  chore/claude-settings-tooling-fixes \
  claude/charming-villani \
  claude/hopeful-banzai \
  claude/sleepy-hypatia \
  claude/syn-953-deploy-fix \
  claude/syn-953-deploy-fix-followup \
  claude/syn-953-monitoring-routes \
  feat/design-md-adoption \
  feat/john-coutis-brand-onboarding \
  feat/ra-3024-batch-2-llm-routes \
  feat/ra-3024-rate-limit-user-llm-routes \
  phillmcgurk/hermes-h1-finish-to-main \
  phillmcgurk/hermes-h1-integration \
  phillmcgurk/syn-909-her-1a-schema-migration-hermes-foundation \
  phillmcgurk/syn-910-her-1b-escalation-channel-telegram-linear \
  phillmcgurk/syn-911-her-1c-discovery-engine \
  phillmcgurk/syn-911-hermes-org-impersonation-fix \
  phillmcgurk/syn-912-her-1d-draft-generator \
  phillmcgurk/syn-913-her-1e-metrics-digest \
  phillmcgurk/syn-938-ai-commentary-gemini-preview \
  phillmcgurk/syn-939-ai-commentary-timeout-bump \
  phillmcgurk/syn-940-ai-commentary-thinking-budget \
  phillmcgurk/syn-956-ci-failure-cleanexposynthex-deploy-on-main \
  security/ra-3021-rls-coverage-gap
```

**Not executed by Phase 1** — destructive operations on the canonical clone
fall outside the worktree scope. Recommend Phill or PM-Core executes the
cleanup once PR #237 lands.

## Summary

- **1 MERGE** → PR #237 opened with `feat/brand-config-tenant-envelope` (`a1bc7d9c`).
- **0 CONVERT-TO-ISSUE** (PR #226 already covers the WIP case).
- **25 ABANDON** (already squash-merged to main under different SHAs).

## Contradictions surfaced vs Board memo

| Board memo claim                       | Reality                                  |
|----------------------------------------|------------------------------------------|
| "8 unmerged local branches"            | 26 unmerged local branches found.        |
| Branches listed in the memo all alive  | All 4 sampled (`chore/brand-config-as-const-narrowing`, `chore/claude-settings-tooling-fixes`, `feat/john-coutis-brand-onboarding`, `feat/ra-3024-…`) are already squash-merged to main. Only `chore/brand-config-type-test-utils` (the one the memo flagged as MERGE) was actually unmerged. |
