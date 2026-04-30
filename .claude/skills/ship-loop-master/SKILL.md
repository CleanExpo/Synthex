---
name: ship-loop-master
description: 24/7 ~1.5-day autonomous shipping orchestrator for Synthex. Drives 7 child loops (build, test, sanity, watch, smoke, pr, merge) on differentiated cadences. Reads state from .claude/scratchpad/ship-loop-state.json on every tick, dispatches the next eligible child loop, and exits cleanly after 36 hours OR when state.completion === 'merged'. Use when the CEO says "/loop ship-loop-master" to start an autonomous shipping run.
type: orchestrator
context: persistent
---

# ship-loop-master — autonomous shipping orchestrator

## Activation

CEO invokes `/loop ship-loop-master` (default) or `/loop ship-loop-master --enable-auto-merge` (auto-merge mode).

The literal phrase `--enable-auto-merge` in the activation prompt is the **only** way to set `auto_merge: true`. Without it the loop forces `auto_merge: false` regardless of any state file content. This is the audit trail.

## Pre-flight (runs once at first tick)

1. Verify `git status` is on a feature branch (refuse to run on `main`)
2. Verify `gh auth status` shows authenticated session
3. Verify a Linear ticket reference exists in env `SHIP_LOOP_TICKET=SYN-XXX` OR in `.claude/scratchpad/ship-loop-ticket.txt` (refuse to start without one — CLAUDE.md hard rule "all work traces to Linear")
4. Initialise `.claude/scratchpad/ship-loop-state.json` if absent:
   ```json
   {
     "started_at": "<iso>",
     "deadline_at": "<iso + 36h>",
     "ticket": "SYN-XXX",
     "branch": "<current branch>",
     "auto_merge": false,
     "completion": "in_progress",
     "layers": {
       "build": { "state": "unknown", "last_run": null, "retries": 0 },
       "test": { "state": "unknown", "last_run": null, "retries": 0 },
       "sanity": { "state": "unknown", "last_run": null, "retries": 0 },
       "watch": { "state": "unknown", "last_run": null, "retries": 0 },
       "smoke": { "state": "unknown", "last_run": null, "retries": 0 },
       "pr": { "state": "not_opened", "url": null, "ci_state": null },
       "merge": { "state": "not_attempted" }
     }
   }
   ```
5. Initialise `ship-loop-events.jsonl` (touch) and `ship-loop-escalations.md` (touch with header)

## Tick loop (every dynamic-paced wakeup)

Read `ship-loop-state.json`. Then:

### Hard stops (highest priority, check first)

- **Deadline reached**: `now() >= deadline_at` → set `completion = 'timeout'`, write summary to `escalations.md`, exit
- **Completion state**: `completion === 'merged'` → exit cleanly with summary
- **Unresolved P0 escalation**: parse `escalations.md` for `^## P0` headings; if any remain unchecked, refuse to invoke any child loop, write current status, sleep 1800s and re-check

### Eligibility decisions (in priority order)

The master picks ONE child to invoke per tick (not parallel — sequential discipline keeps debugging tractable):

| If state                                                                                                        | Then invoke                        |
| --------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `layers.build.state !== 'green' OR last_run > 30 min ago`                                                       | `ship-loop-build`                  |
| `layers.build.state === 'green' AND (layers.test.state !== 'green' OR last_run > 30 min ago)`                   | `ship-loop-test`                   |
| build+test green AND `layers.sanity.last_run > 60 min ago OR sanity.state !== 'green'`                          | `ship-loop-sanity`                 |
| any layer green AND `layers.watch.last_run > 15 min ago`                                                        | `ship-loop-watch`                  |
| build+test+sanity green AND `layers.smoke.last_run > 60 min ago OR smoke.state !== 'green'`                     | `ship-loop-smoke`                  |
| all 5 inner layers green AND `git status --short` shows staged/unstaged changes AND `pr.state === 'not_opened'` | `ship-loop-pr`                     |
| `pr.state === 'opened' AND pr.ci_state === 'green' AND merge.state === 'not_attempted'`                         | `ship-loop-merge`                  |
| nothing eligible                                                                                                | sleep (longer cache-miss interval) |

### After invoking the child

- Read child's exit state from `ship-loop-state.json` (children update their layer's section atomically)
- Append a tick entry to `ship-loop-events.jsonl`:
  ```json
  {"ts":"<iso>","tick":N,"invoked":"ship-loop-build","result":"green","duration_ms":12345}
  ```
- Decide next sleep duration via `ScheduleWakeup`:
  - Active work (something just changed state, more eligible loops queued): 60–270s (in-cache)
  - Idle (everything green, just monitoring): 1200–1800s (cache miss but acceptable)
  - Approaching deadline: shorter intervals to maximise final-hour work

## Hard rules compliance

- **Linear ticket required** — refuses to start without `SHIP_LOOP_TICKET`
- **Branch protection** — refuses to run on `main`
- **Auto-merge gating** — defaults `false`; only flips on if literal `--enable-auto-merge` was in activation prompt; recorded in state for audit
- **No env modifications** — never reads/writes `.env*`
- **Max 1 retry per child loop per tick** — child loops handle their own recovery; master does not retry beyond what child reports
- **Phase 8 stays human-gated** — even with auto-merge enabled, master never invokes Vercel CLI or pushes to `main` directly

## Exit conditions

| Condition                                                                                 | Action                                                                                                             |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `completion === 'merged'`                                                                 | Write summary to escalations.md (positive), exit clean                                                             |
| Deadline reached                                                                          | Mark `completion = 'timeout'`, summary, exit                                                                       |
| P0 escalation written by any child                                                        | Halt; require human to clear escalation before resume                                                              |
| Activation prompt missing `--enable-auto-merge` AND merge layer reaches `ready_for_human` | Halt with "ready for human review" message; do not exit (loop sleeps so CEO can resume by clearing the escalation) |

## Files this skill writes

- `.claude/scratchpad/ship-loop-state.json` (read + write atomically)
- `.claude/scratchpad/ship-loop-events.jsonl` (append-only)
- `.claude/scratchpad/ship-loop-escalations.md` (append-only)

## Verification

`/loop ship-loop-master` on a branch with one trivially failing test should:

1. Tick 1: invoke `ship-loop-build` (state was `unknown`)
2. Tick 2: invoke `ship-loop-test` (build went `green`)
3. Tick 3: child reports `red` with one fail; master logs and re-queues
4. Eventually: `escalations.md` has the test failure escalated after retry exhaustion

## Out of scope

- Production deploy invocation (Vercel auto-deploys on merge to main; loop does not call Vercel CLI)
- Cross-repo coordination
- Slack/email notifications (escalations.md is the surface)
