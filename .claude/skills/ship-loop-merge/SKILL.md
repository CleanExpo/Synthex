---
name: ship-loop-merge
description: Merge to main child loop. Default mode (auto_merge=false) HALTS at "ready for human review" — escalates to ship-loop-escalations.md and lets the master loop continue monitoring CI. Auto-merge mode (auto_merge=true) requires literal --enable-auto-merge flag at master-loop activation; runs `gh pr merge --squash --delete-branch` only when CI is green. Use standalone via /loop ship-loop-merge or wired into the master orchestrator.
type: child-loop
context: persistent
---

# ship-loop-merge — merge to main child loop

## Activation

- Standalone: `/loop ship-loop-merge` (manual merge from CEO after review)
- Orchestrated: invoked by `ship-loop-master` when:
  - `pr.state === 'opened'`
  - `pr.ci_state === 'green'` (master polled `gh pr checks` and updated state)
  - `merge.state === 'not_attempted'`

## Pre-flight

1. Read `ship-loop-state.json`. Confirm:
   - `pr.url` populated
   - `pr.number` populated
   - `pr.ci_state === 'green'`
   - `merge.state === 'not_attempted'`
2. Re-verify CI fresh (in case state is stale): `gh pr checks <num> --repo CleanExpo/Synthex`
   - If any required check is `pending` or `fail`, abort tick (master will re-eval next time)

## Mode determination

Read `state.auto_merge` (set at master-loop init from the `--enable-auto-merge` flag).

### auto_merge === false (DEFAULT — human-gated)

This is the safe path. Per CLAUDE.md hard rule: "Phase 8 (production) always ends at a **human review gate** — never auto-merge PRs".

Action:

1. Append to `escalations.md` (idempotent — only add once per PR):

   ```md
   ## READY FOR REVIEW — PR #<num>: <title>

   - URL: <pr.url>
   - CI: all required checks green at <iso>
   - Branch: <branch>
   - Linear: <SYN-XXX>
   - Files: <count>
   - Action: review, then run `gh pr merge <num> --squash --delete-branch` OR resume the loop with `--enable-auto-merge` to let it merge

   To resume the loop after merge:

   - Manual merge → loop will detect `pr.state === 'merged'` on next tick and exit cleanly
   - Re-invoke `/loop ship-loop-master` if loop has exited
   ```

2. Update `merge.state = 'awaiting_human'`
3. Master loop will see this state and treat it as a soft-halt: continues monitoring CI / production but does not invoke this skill again until state changes

### auto_merge === true (CEO-OPTED-IN)

Pre-conditions verified, mode confirmed. Proceed.

```bash
gh pr merge <num> --repo CleanExpo/Synthex --squash --delete-branch
```

After successful merge:

1. Update `layers.merge`:
   ```json
   {
     "state": "merged",
     "merged_at": "<iso>",
     "merge_commit_sha": "<sha>",
     "auto_merge_used": true
   }
   ```
2. Update `state.completion = 'merged'` (master will exit cleanly on next tick)
3. Append POSITIVE entry to `escalations.md` (audit trail):
   ```md
   ## ✅ MERGED — PR #<num> at <iso> (auto-merge mode)

   - URL: <pr.url>
   - Linear: <SYN-XXX>
   - SHA: <sha>
   ```
4. Local cleanup: switch to `main`, pull, delete the feature branch locally
   - `git checkout main && git pull --ff-only && git branch -D <branch>`
   - Failures here are non-fatal — log and continue

## Hard rules compliance

- **Default-deny merge** — `auto_merge=false` is the default; nothing flips it on without explicit CEO opt-in via the literal `--enable-auto-merge` flag at master init
- **No `--force` flags** — never on merge, never on push, never on branch deletion of unmerged work
- **Audit trail** — every merge (auto or manual) writes a positive entry to `escalations.md`
- **CI must be green** — pre-flight re-verifies CI state via `gh pr checks` even if state file says green (defense vs stale state)
- **Production deploy is Vercel's job** — this skill does NOT call `vercel --prod`. Vercel's `main` branch trigger does that automatically post-merge.

## Recipe priorities for this loop

None. Merge is intentionally recipe-free — failures escalate immediately rather than auto-recovery. Production-bound merges are too high-stakes for retry logic.

## Verification

### Default-mode test

- Run with `auto_merge: false` (default), CI green; expect:
  - State updates to `merge.state = 'awaiting_human'`
  - escalations.md has `## READY FOR REVIEW` entry
  - No `gh pr merge` invocation in events log

### Auto-merge mode test

- Run after `/loop ship-loop-master --enable-auto-merge` was the activation
- CI green; expect:
  - `gh pr merge` runs
  - state updates to `merged`
  - branch deleted locally + on origin
  - completion set, master exits next tick

### Defensive test

- Set `auto_merge: true` directly in state file (without the flag at activation); expect:
  - This skill detects the mismatch (no audit trail of `--enable-auto-merge` flag)
  - Forces `auto_merge: false` for this run
  - Logs `## P0 — auto_merge state inconsistency: state says true but master init flag absent` to escalations

## Out of scope

- Production deploy validation (Vercel handles; this skill only merges)
- Post-merge release notes generation (separate skill)
- Auto-close of related Linear issues (defer to GitHub→Linear sync if configured)
- Slack / email notifications of merge (escalations.md is the surface)
