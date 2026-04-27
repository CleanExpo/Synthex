---
description: Start one Synthex development loop. Loads HANDOFF.md, fetches the named Linear ticket, invokes /grill-me, and waits for confirmed scope before touching code.
---

# /loop-start

Usage: `/loop-start SYN-XXX` — where SYN-XXX is the Linear ID for this loop.

## What this command does

1. **Read `.claude/loop/HANDOFF.md`.** Nothing else yet. Do not load `.claude/memory/*` unless HANDOFF flags it for this task.
2. **Fetch the Linear ticket** via MCP (`list_issues` / `get_issue`). Summarise it in one sentence back to Phill.
3. **Invoke `/grill-me`** immediately — produce 3–7 clarifying questions.
4. **Wait.** Do not proceed until Phill replies with answers, `proceed with assumptions`, or `reject`.
5. **After confirmation** — begin implementation in the current worktree (or request a new worktree if one is named in HANDOFF).
6. **After tests pass** — run the Feedback stage: open the PR, update Linear to `In Review`, overwrite `HANDOFF.md` with the next loop's baton. End the session.

## Budgets

- System Prompt stage ≤ 3k tokens
- Grill-Me ≤ 8k tokens
- Implementation ≤ 40k tokens
- Testing ≤ 10k tokens
- Feedback ≤ 5k tokens
- Hard ceiling at 70% context — write HANDOFF.md and exit.

## Reference

- Loop definition: `prd.md`
- Baton: `.claude/loop/HANDOFF.md`
- Backlog: `.claude/loop/BACKLOG.md`
- Decision log: `.claude/loop/DECISIONS.md`
- Grill-Me skill: `.claude/skills/grill-me/SKILL.md`
