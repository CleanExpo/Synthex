---
phase: 112-nexus-dedup
plan: 01
subsystem: dev-infrastructure
tags: [hooks, dedup, idempotency, agent-dispatch]
key-files:
  - .claude/hooks/pre-agent-dispatch.ps1
  - .claude/hooks/session-start-protocol.ps1
  - .claude/scratchpad/dispatch-dedup.json
commits:
  - 68a2b19c feat(112-01): add idempotency key + dedup check to pre-agent-dispatch
  - 8d59c592 feat(112-01): add dedup store pruning to session-start-protocol
---

# Phase 112 Plan 01: NEXUS Agent Dispatch Deduplication Summary

Added SHA256-based idempotency keys and a 30-minute TTL dedup store to the agent dispatch hook, preventing duplicate Linear issues from being created when retried Task tool calls fire identical dispatches.

## Accomplishments

- Added SHA256 idempotency key generation to `pre-agent-dispatch.ps1` — key is 16-char hex prefix of `SHA256(subagent_type|description[:200])`
- Dedup store persists at `.claude/scratchpad/dispatch-dedup.json` (auto-created on first dispatch)
- Duplicate detection: if same key seen within 30 min, emits `DUPLICATE_DISPATCH [key=... count=... age=...min]` warning to stderr before the dispatch proceeds
- Within-session pruning: entries older than 60 min are removed on every dispatch
- Session-start pruning: `session-start-protocol.ps1` silently clears entries older than 120 min at each new session
- Hook remains non-blocking — exits 0 always, existing TOOL_INPUT parsing and validation logic unchanged
- Log entry updated to include `Duplicate: True/False`

## Files Created/Modified

- `.claude/hooks/pre-agent-dispatch.ps1` — added 64-line dedup block (key generation, store load/check/upsert/prune/persist)
- `.claude/hooks/session-start-protocol.ps1` — added silent 18-line dedup pruning block at top
- `.claude/scratchpad/dispatch-dedup.json` — auto-created on first dispatch (JSON, TTL-managed)

## Decisions Made

- 16-char SHA256 prefix is sufficient for uniqueness within a session (2^64 collision space, at most ~100 dispatches per session)
- Separate TTLs: 30-min for duplicate warning, 60-min for within-session prune, 120-min for cross-session cleanup at session start
- Dedup store uses native PowerShell `ConvertTo-Json`/`ConvertFrom-Json` — no external dependencies

## Issues Encountered

None.

## Next Step

Phase complete, ready for Phase 113.
