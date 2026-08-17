# Phase 0.0 — founder runbook (parked items)

**Scope:** the Gruen Standard v1.1 Phase 0.0 items that need GitHub repo-admin or account-owner
rights and therefore could not be executed by an agent. Source of truth for the requirement is
[`spec.md`](./spec.md) §7 Phase 0.0 and §4 Class E. Sequence position: §11 step 2 — after the
founder-gate batch, **before** the 0.1–0.3 deletions and **before** the 0.5 rotation.

Every value below was read live on **2026-08-16** with read-only `gh api` calls. Re-read before
acting; `node scripts/check-repo-controls.mjs` prints the current state of all 31 declared controls
in one shot.

> **Nothing in this file has been executed.** No branch protection was changed, no variable was
> created, no secret was touched, no session was revoked.

---

## Before you start

Two consequences that are not obvious from the spec text and that change the order you want:

1. **P2 alone can lock production deploys entirely.** The `Production` environment has exactly one
   required reviewer — `CleanExpo` — and that is also the identity that merges. Setting
   `prevent_self_review: true` means the only eligible approver is barred from approving, so no
   production deploy can be approved by anyone. If that is the intent (a hard freeze while Phase 0
   runs) it is the correct move. If it is not, a second reviewer identity must exist first, and
   §7 Phase 0.0 does not provide one. **Decide this before executing P2.**
2. **P4 does not close E4 by itself.** Deleting the GitHub secret deletes GitHub's copy of the URL.
   The deploy hook itself lives in Vercel and stays live and unauthenticated after the secret is
   gone. Both halves are listed.

---

## P1 — Arm `DEPLOY_INHIBIT`

|             |                                                                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Setting** | Actions repository variable `DEPLOY_INHIBIT`                                                                                                |
| **Current** | **does not exist** — `repos/CleanExpo/Synthex/actions/variables` returns `total_count: 0`                                                   |
| **Target**  | exists, value `true`                                                                                                                        |
| **Read at** | `.github/workflows/deploy.yml:119` — `if: github.ref == 'refs/heads/main' && vars.DEPLOY_INHIBIT != 'true'`                                 |
| **Why now** | An unset variable evaluates to `''`, `'' != 'true'` is true, so `Deploy Production` runs. The kill-switch is wired and unarmed. Spec §4 E2. |

```bash
gh api --method POST repos/CleanExpo/Synthex/actions/variables \
  -f name=DEPLOY_INHIBIT -f value=true
```

Click-path: **Settings → Secrets and variables → Actions → Variables → New repository variable**.

To disarm later: `gh api --method PATCH repos/CleanExpo/Synthex/actions/variables/DEPLOY_INHIBIT -f name=DEPLOY_INHIBIT -f value=false`

### P1b — watch it block a real deploy (this is the acceptance line, not P1)

Phase 0.0 says `DEPLOY_INHIBIT` must be _"armed and **watched blocking a real deploy** before being
trusted"_. Arming it is not the acceptance; observing the block is.

`deploy.yml` triggers on `push` to `main`/`develop` only — there is **no** `workflow_dispatch`, so the
only way to observe the guard is a real push to `main` while armed. (Adding `workflow_dispatch` was
deliberately not done: it would create a new manual production-deploy path, which is the opposite of
what this phase is for.)

1. Arm per P1.
2. Push any trivial commit to `main`.
3. Open the resulting **Deploy** run. The `Deploy Production` job must show **skipped**, and `Test`
   must show as having run.
4. Record the run URL. That URL is the anchor for this acceptance line.

A run where `Deploy Production` is skipped **for any other reason** does not count — confirm the
`Test` job succeeded, otherwise you have observed `needs: [test]` failing, not the kill-switch.

---

## P2 — `Production` environment: prevent self-review

|                       |                                                                            |
| --------------------- | -------------------------------------------------------------------------- |
| **Setting**           | Environment `Production` → required-reviewers rule → `prevent_self_review` |
| **Current**           | `false`                                                                    |
| **Target**            | `true`                                                                     |
| **Current reviewers** | `[CleanExpo]` (sole reviewer)                                              |
| **Why now**           | Spec §4 E3. The merging identity approves its own production deploy.       |

**Read the warning at the top of this file first.**

Click-path: **Settings → Environments → Production → Required reviewers → tick "Prevent self-review"**.

API (the `PUT` replaces the whole environment config, so the reviewer must be resent):

```bash
gh api --method PUT repos/CleanExpo/Synthex/environments/Production \
  --input - <<'JSON'
{"prevent_self_review":true,"reviewers":[{"type":"User","id":161467050}],"deployment_branch_policy":null}
JSON
```

`161467050` is the numeric id of `CleanExpo`, read live 2026-08-16.

---

## P3 — `Production` environment: stop admin bypass

|             |                                                                                     |
| ----------- | ----------------------------------------------------------------------------------- |
| **Setting** | Environment `Production` → `can_admins_bypass`                                      |
| **Current** | `true`                                                                              |
| **Target**  | `false`                                                                             |
| **Why now** | Spec §4 E3. With bypass on, the environment reviewer rule is advisory for an admin. |

Click-path: **Settings → Environments → Production → untick "Allow administrators to bypass configured protection rules"**.

`can_admins_bypass` is **not** in the documented request body for
`PUT /repos/{owner}/{repo}/environments/{name}` — it is returned on read but the write is a UI
toggle. Use the click-path. (If a later API gains the field, the drift check picks the change up
either way.)

---

## P4 — the dormant `VERCEL_DEPLOY_HOOK`

|                      |                                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| **Setting (half 1)** | Actions repository secret `VERCEL_DEPLOY_HOOK`                                                       |
| **Current**          | exists, last updated `2025-08-04T05:15:35Z`, referenced by **zero** files under `.github/workflows/` |
| **Target**           | removed                                                                                              |
| **Setting (half 2)** | the deploy hook itself, in Vercel                                                                    |
| **Current**          | not read from here — Vercel is outside this repo's API surface                                       |
| **Target**           | deleted, or replaced with an authenticated path                                                      |
| **Why now**          | Spec §4 E4 and Phase 0.0 ("remove or authenticate the dormant `VERCEL_DEPLOY_HOOK`").                |

```bash
gh api --method DELETE repos/CleanExpo/Synthex/actions/secrets/VERCEL_DEPLOY_HOOK
```

Click-path (half 1): **Settings → Secrets and variables → Actions → `VERCEL_DEPLOY_HOOK` → Remove**.

Click-path (half 2): **Vercel → project `synthex` → Settings → Git → Deploy Hooks → delete the hook**.

Half 2 is the one that actually closes E4. A deploy-hook URL is a bearer credential: anyone holding
it can trigger a production deploy with no GitHub identity at all, which is why arming
`DEPLOY_INHIBIT` (P1) does not cover it — the guard lives in a workflow the hook never runs.

---

## P5 — decide who is told when the drift check goes red

> **Rewritten 2026-08-17. Do not do what the struck-through version below says — it cannot work.**
>
> P5 used to read "add `Repo Controls Drift` to `main`'s required status checks". That is no longer
> possible, and the reason is a deliberate security change, not an oversight.
>
> A required status check has to report **on a pull request**. The drift workflow no longer runs on
> pull requests, because under `pull_request` GitHub checks out the PR's own code and the workflow
> then executes `scripts/check-repo-controls.mjs` **from that PR**. Two consequences, and the second
> is the serious one:
>
> 1. A PR that edits the checker would be checked by its own edited checker — rewrite it to exit 0
>    and the control passes while the declaration is wrong. Same-repo branches are how this
>    repository's PRs are made, so this was not a fork-only concern.
> 2. Same-repository pull requests **do** receive secrets. The moment P6 below creates
>    `REPO_CONTROLS_TOKEN`, that PAT would be handed to PR-authored code, which could post it
>    anywhere before exiting 0. **P6 and the old P5 together would have built the leak.**
>
> So the check now runs only on `schedule` (daily, from the default branch's already-merged code)
> and `workflow_dispatch`. Neither executes unmerged code.
>
> **What is left to decide is not a click, it is a routing question:** the scheduled run goes red at
> 05:10 AEST and, today, nothing tells anyone. Options, cheapest first:
>
> - **(a)** Accept GitHub's default failed-workflow email to the repo owner. Zero setup. Easy to
>   miss, and it stops being noticed after the third one.
> - **(b)** Add a notification step to the workflow on failure — the estate already routes to
>   Telegram, not Slack. Small change, needs a webhook/token, which is itself a secret to place.
> - **(c)** Have the failure open a Linear issue on the Synthex team so it lands in the normal
>   backlog rather than an inbox.
>
> Until one is chosen, treat the daily run as **watched by nobody**. A control nobody reads is
> documentation with a cron schedule.

### Superseded — the original P5, kept for the record

|             |                                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------------- |
| **Setting** | `main` branch protection → `required_status_checks.contexts`                                                  |
| **Current** | `["Build", "Lint"]`                                                                                           |
| **Target**  | `["Build", "Lint", "Repo Controls Drift"]`                                                                    |
| **Why now** | Otherwise the drift check is observable but not blocking; a PR that widens the control plane can still merge. |

The click-path this section used to give — Settings → Branches → `main` → Require status checks →
search `Repo Controls Drift` → add — **would now block every PR in the repository permanently.**
The context would never report, because the workflow no longer runs on pull requests, and a
required check that never reports never passes. Do not follow it.

---

## P5b — `ci.yml` has four jobs that run and do not block

Not a Phase 0.0 item. Recorded because it was read while looking at the same screen, and it is the
kind of thing that is only ever noticed once.

`ci.yml` defines six jobs — `Lint`, `Type Check`, `Unit Tests`, `Build`, `Auth Coverage Ratchet`,
`Pipeline Smoke Tests (blocking)` — and only **`Build` and `Lint`** are required to merge. So a PR
can merge with failing type-checks, failing unit tests, a dropped auth-coverage ratchet, and red
smoke tests. `Pipeline Smoke Tests (blocking)` calls itself blocking in its own name and does not
block.

Same screen as P5, one decision: which of those four should join the required list.

---

## P6 — `REPO_CONTROLS_TOKEN` secret for the drift workflow

|             |                                                                                                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Setting** | Actions repository secret `REPO_CONTROLS_TOKEN`                                                                                                                                                   |
| **Current** | does not exist                                                                                                                                                                                    |
| **Target**  | fine-grained PAT, resource owner `CleanExpo`, repository `CleanExpo/Synthex`, permissions **Administration: Read-only**, **Secrets: Read-only**, **Variables: Read-only**, **Actions: Read-only** |
| **Why now** | Without it the drift workflow is permanently red. This is **observed**, not predicted — see below.                                                                                                |

**This is the item that is currently failing.** Run `31969036972` on branch
`chore/gruen-merge-attribution` had no `REPO_CONTROLS_TOKEN`, fell through to the stock Actions
`GITHUB_TOKEN`, and returned:

```
FATAL: GET /repos/CleanExpo/Synthex/actions/secrets -> 403.
This check cannot read its subject, so it cannot pass.
{"message":"Resource not accessible by integration"}
```

Widening `permissions:` in the workflow cannot fix this. The workflow `permissions:` key has no
`administration`, `secrets` or `variables` entry to grant, so three of the five probed surfaces are
unreachable from `GITHUB_TOKEN` at any setting. The PAT is required, not preferred.

Each permission below is load-bearing — dropping one re-breaks the run at a different endpoint:

| Permission               | Endpoints it unlocks in `scripts/check-repo-controls.mjs`                              |
| ------------------------ | -------------------------------------------------------------------------------------- |
| **Administration: Read** | `branches/main/protection`, `.../protection/required_pull_request_reviews`, `rulesets` |
| **Secrets: Read**        | `actions/secrets` — the endpoint that returned the 403 above                           |
| **Variables: Read**      | `actions/variables`                                                                    |
| **Actions: Read**        | `environments`, `environments/Production`                                              |
| **Metadata: Read**       | `repos/{repo}`, `branches?protected=true` — GitHub selects this one automatically      |

1. **github.com/settings/personal-access-tokens/new** → resource owner `CleanExpo` → only
   `CleanExpo/Synthex` → Repository permissions → set **Administration**, **Secrets**, **Variables**
   and **Actions** each to **Read-only** → generate.
2. **Settings → Secrets and variables → Actions → New repository secret** → name
   `REPO_CONTROLS_TOKEN` → paste.

Read-only by construction: the token cannot change what it audits.

To confirm it worked, re-run the **Repo Controls Drift** workflow. Green there means the probe read
all 31 controls and none had drifted; it does **not** mean Phase 0.0 is complete. The open gaps are
reported by the second step and are the P1–P5 items above.

---

## P7 — the anchor Phase 0.0 asks for does not exist on this account

Phase 0.0's anchor is _"the refused merge, in GitHub's own audit log"_.

|                     |                                                                                                                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fact**            | `CleanExpo` is a **User** account, not an Organization (`users/CleanExpo` → `"type": "User"`)                                                                                                       |
| **Consequence**     | `orgs/CleanExpo/audit-log` → `404`. `users/CleanExpo/audit-log` → `404`. There is no repo audit log to anchor to.                                                                                   |
| **Nearest surface** | **github.com/settings/security-log** — the personal-account security log. It records account security events (logins, OAuth grants, token creation), **not** repository merge attempts or refusals. |

This is a founder decision, not a click:

- **(a)** Move `CleanExpo/Synthex` under a GitHub Organization on Team or above, which has an audit
  log covering repository events. Cost and migration impact not assessed here.
- **(b)** Accept a substitute anchor and amend the spec: the refusal recorded by GitHub as a failed
  merge on the PR timeline plus the `Repo Controls Drift` run, rather than an audit-log row.
- **(c)** Accept that this acceptance line cannot be met and mark it so, rather than letting it read
  as pending.

Until one of these is chosen, **Phase 0.0's first acceptance line ("a merge attempted by any
non-attributable identity is refused _and recorded_") cannot be closed as written.** The "refused"
half is achievable; the "recorded, in GitHub's own audit log" half is not, on a personal account.

---

## P8 — require signed commits (founder ruling, not named by the spec)

|               |                                                                                                                                                                                                                                                     |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Setting**   | `main` branch protection → `required_signatures`                                                                                                                                                                                                    |
| **Current**   | `false`                                                                                                                                                                                                                                             |
| **Target**    | founder ruling                                                                                                                                                                                                                                      |
| **Relevance** | This is the only branch-protection control that refuses a commit _for being unattributable_, which is the sentence Phase 0.0's acceptance line is written in. Phase 0.0 does not name it, so no target is declared in `.github/repo-controls.json`. |

Click-path: **Settings → Branches → `main` → tick "Require signed commits"**.

Evidence that it would bite: `main` currently contains unsigned commits authored as `Phill McGurk`
(e.g. `510a3a721`, `1e16832a0`, `339fb4bb0`, 2026-08-06), which entered through merge commits for
PRs #886–#889. Squash-merged PRs land signed by GitHub; merge-commit PRs carry the branch's original
unsigned commits onto `main`.

---

## P9 — require approval of the most recent push (founder ruling)

|               |                                                                                                                                                                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Setting**   | `main` branch protection → `required_pull_request_reviews.require_last_push_approval`                                                                                                                                                    |
| **Current**   | `false`                                                                                                                                                                                                                                  |
| **Target**    | founder ruling                                                                                                                                                                                                                           |
| **Relevance** | With it off, the identity that pushed last can also be the approving reviewer — the branch-protection twin of the environment self-review gap in P2. `dismiss_stale_reviews` is also `false`, so an approval survives a subsequent push. |

Click-path: **Settings → Branches → `main` → tick "Require approval of the most recent reviewable push"**.

---

## P10 — flip the drift workflow's second step to gating

Once P1–P4 are done and `.github/repo-controls.json` has been updated so every `expected` equals its
`phase_0_0_target`, change the last step of `.github/workflows/repo-controls-drift.yml` from

```yaml
run: node scripts/check-repo-controls.mjs --require-targets || echo "::warning::..."
```

to

```yaml
run: node scripts/check-repo-controls.mjs --require-targets
```

so that reopening a Phase 0.0 gap fails the build instead of warning.

---

## P11 — revoke the browser-extension session path (spec §4 E1)

|             |                                                              |
| ----------- | ------------------------------------------------------------ |
| **Target**  | the session that merged PR #822 no longer exists             |
| **Current** | **not identifiable from any API this repo's token can read** |

PR #822 read live 2026-08-16: merged `2026-08-03T08:45:09Z`, `merged_by.login = CleanExpo`,
`auto_merge = null`, merge commit `7946d85c7`. That matches spec §4 E1 exactly.

The blocking fact: **the REST API returns only `merged_by.login`. It never returns the credential,
token or session that performed the merge.** So #822 is, through the API, indistinguishable from
every other merge that week. Revocation therefore cannot be targeted from here; it has to be done by
clearing the surfaces, in the account UI:

1. **github.com/settings/sessions** → "Web sessions" → **Revoke all other sessions**. This is the
   surface a cookie-authenticating browser extension lives on.
2. **github.com/settings/applications** → "Authorized OAuth Apps" → revoke anything unrecognised.
3. **github.com/settings/installations** → GitHub Apps → review write-capable installations.
4. **github.com/settings/security-log?q=action:oauth_authorization** → which grants exist and when
   they were created.

`user/installations` returns `403` to this repo's token, so step 3 cannot be pre-checked from a
script — it is a genuine UI-only read.

### The week's merge ledger (Phase 0.0: "re-read every merge that week attributed to you")

Read live 2026-08-16 from `repos/CleanExpo/Synthex/pulls/{n}`, window `2026-08-01` → `2026-08-09`:

- **72 PRs** merged to `main`.
- `merged_by` is **`CleanExpo` for all 72**. Zero exceptions.
- **Zero** used GitHub auto-merge (`auto_merge` null on all 72), consistent with
  `allow_auto_merge: false`.
- Authors: 68 `CleanExpo`, 4 `dependabot[bot]` (#824, #825, #826, #829).
- PR numbers: 820–826, 828–841, 843–876, 878–894 (#827, #842, #877 were not merged to `main` in
  this window).

**What this ledger does and does not establish.** It establishes that no merge that week carries a
_different_ login. It does **not** establish that they were all performed by the founder in person,
because the API exposes no credential discriminator — which is precisely why every one of the 72
inherits #822's doubt rather than #822 being the single suspect entry. Re-reading the _content_ of
those 72 PRs is a separate exercise and is not attempted here.

---

## P12 — a second protection-as-code file already exists, and every claim in it is false

Not named by the spec. Raised because it sits squarely in Phase 0.0's subject area and, left alone,
the repo now carries **two** declarations of the merge control plane that contradict each other.

|             |                                                                                                                                                      |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **File**    | `.github/branch-protection.json` — tracked, added **2025-08-12**, commit `95679169b` ("Implement comprehensive authentication stabilization system") |
| **Read by** | **nothing.** Zero readers under `.github/workflows/`, `scripts/`, or `package.json`                                                                  |
| **Current** | present, unreferenced, and wrong                                                                                                                     |
| **Target**  | deleted, or reconciled into `.github/repo-controls.json` — **a founder ruling, not a spec requirement**                                              |

### Divergence against the live repository, `main` block

| Field                              | The file claims                           | Live (2026-08-16)                                                               |     |
| ---------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------- | --- |
| `required_status_checks.strict`    | `true`                                    | `false`                                                                         | ✗   |
| `required_status_checks.contexts`  | `["auth-tests","file-integrity","build"]` | `["Build","Lint"]` — **none of the three named contexts exist as CI job names** | ✗   |
| `enforce_admins`                   | `false`                                   | `true`                                                                          | ✗   |
| `dismiss_stale_reviews`            | `true`                                    | `false`                                                                         | ✗   |
| `require_code_owner_reviews`       | `true`                                    | `false`                                                                         | ✗   |
| `required_approving_review_count`  | `1`                                       | `1`                                                                             | ✓   |
| `allow_force_pushes`               | `false`                                   | `false`                                                                         | ✓   |
| `allow_deletions`                  | `false`                                   | `false`                                                                         | ✓   |
| `required_conversation_resolution` | `true`                                    | `true`                                                                          | ✓   |
| `lock_branch`                      | `false`                                   | `false`                                                                         | ✓   |
| `allow_fork_syncing`               | `false`                                   | `false`                                                                         | ✓   |

**Six of eleven fields are false.** The five that match do so by coincidence of default, not because
anything applied this file.

### The other two blocks are not merely wrong, they are impossible

- **`staging` block** — declares branch protection for a branch that **does not exist**
  (`repos/CleanExpo/Synthex/branches/staging` → `404`).
- **`codeowners` block** — declares `@security-team`, `@lead-dev`, `@devops-team`. GitHub teams
  require an **Organization**; `CleanExpo` is a User account (see P7), so these three owners
  **cannot exist**. The real `.github/CODEOWNERS` is three lines: `* @CleanExpo`.
- **`protected_paths`** — GitHub has no "protected paths" concept outside CODEOWNERS plus
  `require_code_owner_reviews`, which is `false`. Nothing protects `src/lib/auth/**`.

### Why this matters to Phase 0.0 specifically

Spec §7 item 0.2 states the principle: _"An uncalled gate is testimony of a control that does not
operate."_ This file is the documentation-layer instance of exactly that. Anyone reading it — an
auditor, a new agent, the founder in six months — would conclude that `main` requires code-owner
review on authentication paths and that a security team signs off. None of that is true, and none of
it ever was.

**Deletion is one line and is the honest option:**

```bash
git rm .github/branch-protection.json
```

If it is kept instead, it must be corrected to match `.github/repo-controls.json`, and something
must read it — otherwise the correction decays the same way.

### Two adjacent facts read while investigating this

- **`.github/CODEOWNERS` currently documents self-review as policy**: its comment reads _"Self-review
  is acceptable for this single-owner setup."_ Closing **P2** reverses that stated policy. Update the
  comment in the same change, or the repo will contradict itself in the other direction.
- **`develop` is a deploy branch and has no protection at all.** `deploy.yml` fires on
  `push: branches: [main, develop]`. Protected branches are `main` and `sandbox` only. `develop`
  deploys to staging, not production, so it is outside Phase 0.0's door — recorded so the omission is
  a decision rather than an oversight.

---

## P13 — parse `deploy.yml` instead of pattern-matching it (engineering, not founder)

The three `workflow.deploy.*` controls read `.github/workflows/deploy.yml` as anchored text:
comments stripped, CRLF normalised, matches confined to the `deploy-production` job block, and
anchored to job indentation (4 for a job key, 6 for its child). That is defensible — inside the
job, everything under `steps:` is indent 6 or deeper, so text at exactly indent 4 cannot be step
content — but it is still pattern-matching a structured document.

Parsing settles it outright: `jobs['deploy-production'].if` either is the declared condition or is
not, with no question of what else in the file might resemble it.

Not done here because `js-yaml` is present in `node_modules` only as a **transitive** dependency of
something else. Depending on it directly makes this control's correctness hostage to another
package's dependency choices, and promoting it to a direct dependency means a `package-lock.json`
change in a PR whose required checks are `Build` and `Lint`.

**Not founder-gated and not urgent** — it is recorded so it is a decision rather than an oversight.
Do it as its own PR: add `js-yaml` as a devDependency, replace the three regex probes, and keep the
mutation tests (guard moved to another job, guard moved to step depth, `|| always()` appended,
`production-disabled` environment name) as the proof they still fire.

---

## Verifying the whole set afterwards

```bash
node scripts/check-repo-controls.mjs                    # drift only; must exit 0
node scripts/check-repo-controls.mjs --require-targets  # exits 0 only when Phase 0.0 is closed
```

After executing P1–P4, update the matching `expected` values in `.github/repo-controls.json` in the
same PR. The drift check exists so that updating the file _without_ making the change is caught: set
an `expected` to a value the repository does not have and the check fails naming that control.
