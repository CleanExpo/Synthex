---
name: hey-claude
description: Session context bootstrap — run at the start of every session to restore full project context
type: command
version: 1.0.0
---

# /hey-claude — Session Bootstrap

Run this at the start of every conversation to restore full project context before starting any work.

## What it does

1. Reads `CONSTITUTION.md` — project rules that override all other guidance
2. Reads `.claude/memory/MEMORY.md` — cross-session decisions and architectural history
3. Reads `.claude/scratchpad/current-session.md` — any interrupted work from the last session
4. Queries Linear MCP: top 5 issues with status "In Progress" for the Synthex project
5. Runs `git status` + `git log --oneline -5`
6. Reads `.planning/STATE.md` — current phase and active priorities

## Output format

```
=== SESSION CONTEXT — SYNTHEX ===
Date:        2026-03-24
Branch:      main
Uncommitted: 0 files

Phase:       [current phase from STATE.md]

Active Linear (In Progress):
  UNI-XXXX  [title]
  UNI-XXXX  [title]
  UNI-XXXX  [title]
  UNI-XXXX  [title]
  UNI-XXXX  [title]

Last 5 commits:
  [hash] [message]
  [hash] [message]
  ...

Scratchpad:  [one-line summary of current-session.md, or "empty"]

Constitution: loaded
Memory:       loaded
=================================
```

## When to use

- Start of every session (replaces the 4-step manual startup in CLAUDE.md)
- After context compaction (to re-establish project state)
- After switching branches (to re-check active issues)

## Notes

- This command does not write anything — read-only
- If Linear MCP is unavailable, skip step 4 and note it in output
- If `current-session.md` is empty, note "no interrupted work"
- After running, immediately resume the top priority from the Linear list or scratchpad

## Relationship to CLAUDE.md startup protocol

This command automates the "START OF SESSION" steps 1–4 from `CLAUDE.md`. Running `/hey-claude` satisfies those requirements.
