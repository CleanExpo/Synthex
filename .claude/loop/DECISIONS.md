# Loop Decisions — Running Log

> Append-only. Each entry is a Grill-Me answer that should outlive its session.
> Format: `[DD/MM/YYYY] LOOP: <id> | DECISION: <what> | REASON: <why> | ALTERNATIVES REJECTED: <what was considered>`

## 2026-04-25

- [25/04/2026] LOOP: PRD.1 | DECISION: adopt 5-stage loop (System Prompt → Grill-Me → Implementation → Testing → Feedback) with one PR per session | REASON: compound sessions hit context ceilings; Linear drift when the code session does not close its own ticket | ALTERNATIVES REJECTED: long-running 200k-context marathons (hide failures), off-session Linear sync (Phill's standing complaint)
- [25/04/2026] LOOP: PRD.1 | DECISION: HANDOFF.md is the only file a new session reads first | REASON: prevents token burn on MEMORY.md/ARCHITECTURE.md when they are not needed for the current task | ALTERNATIVES REJECTED: always-load full memory (bloat), always-load CLAUDE.md (already loaded by framework)
- [25/04/2026] LOOP: PRD.1 | DECISION: one worktree per implementation agent, verified before dispatch | REASON: SYN-732 and SYN-793 both leaked across a shared worktree despite `isolation: "worktree"` | ALTERNATIVES REJECTED: single-worktree orchestrator (proven to collide)
