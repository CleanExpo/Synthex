---
name: session-manager
description: >
  Session lifecycle management with checkpoint persistence. Handles START
  (load last checkpoint, display briefing), CHECKPOINT (save current state),
  and END/"Land the Plane" (create summary, update knowledge base, write
  next-session checkpoint). Use at the beginning and end of every work session,
  or mid-session to save progress.
---

# Session Lifecycle Manager

## Process

Invoke with one of three operations: START, CHECKPOINT, or END.

1. **START** -- initialize a new session from the last checkpoint
2. **CHECKPOINT** -- save current session state mid-flight
3. **END** ("Land the Plane") -- gracefully close the session with full handoff artifacts

## Operation: START

Load the previous session's checkpoint and present a briefing to orient the current session.

### Steps
1. Scan `.claude/checkpoints/` for the most recent checkpoint file (sorted by timestamp in filename)
2. If a `next-session.md` file exists, load it as the primary briefing source
3. Parse checkpoint YAML frontmatter for session metadata
4. Display session briefing

### Session Briefing Format
```markdown
## Session Briefing

### Previous Session
- **Session ID**: [id]
- **Date**: [timestamp]
- **Duration**: [if available]

### Open Items (carried forward)
1. [item from previous checkpoint]
2. [item from previous checkpoint]

### Files Modified Last Session
- `path/to/file.ts` -- [brief description of change]

### Key Decisions Made
- [decision and rationale]

### Recommended Starting Point
[Suggested first action based on open items and context]
```

### No Checkpoint Found
If no previous checkpoint exists, start a fresh session:
- Generate a new session ID: `session-YYYYMMDD-HHMM`
- Display: "Fresh session started. No previous checkpoint found."
- Proceed normally

## Operation: CHECKPOINT

Save the current session state to `.claude/checkpoints/` for recovery or handoff.

### Steps
1. Generate checkpoint filename: `checkpoint-YYYYMMDD-HHMM.md`
2. Collect current session state:
   - List all files modified in this session (from git status or tracked changes)
   - Gather decisions made (from conversation context)
   - Identify open items and incomplete work
   - Note any knowledge base updates made
3. Write checkpoint file to `.claude/checkpoints/`

### Checkpoint Format
```markdown
---
session_id: session-YYYYMMDD-HHMM
timestamp: YYYY-MM-DDTHH:MM:SS
type: checkpoint
files_modified: [count]
open_items: [count]
---

# Session Checkpoint

## Session ID
session-YYYYMMDD-HHMM

## Timestamp
YYYY-MM-DDTHH:MM:SS

## Files Modified
- `path/to/file1.ts` -- [what changed]
- `path/to/file2.md` -- [what changed]

## Decisions Made
- [Decision]: [Rationale]

## Open Items
- [ ] [Incomplete task 1]
- [ ] [Incomplete task 2]

## Knowledge Updates
- [Entry ID]: [What was added/updated]

## Context Notes
[Any additional context needed for resumption]
```

## Operation: END ("Land the Plane")

Gracefully close the session with comprehensive handoff artifacts.

### Steps
1. Create final session summary
2. Update knowledge base with any new learnings (via knowledge-curator if available)
3. Write `next-session.md` checkpoint with prioritized action items
4. Archive the session checkpoint to `.claude/checkpoints/`

### Session Summary Format
```markdown
---
session_id: session-YYYYMMDD-HHMM
timestamp: YYYY-MM-DDTHH:MM:SS
type: end
duration: [estimated]
files_modified: [count]
decisions_made: [count]
---

# Session Summary

## Accomplishments
1. [What was completed]
2. [What was completed]

## Files Modified
- `path/to/file.ts` -- [description]

## Decisions Made
| Decision | Rationale | Impact |
|----------|-----------|--------|
| [decision] | [why] | [what it affects] |

## Open Items (Not Completed)
- [ ] [Task with context for next session]

## Knowledge Base Updates
- [New/updated entries and their IDs]

## Blockers Encountered
- [Blocker and current status]
```

### Next-Session Checkpoint
Written to `.claude/checkpoints/next-session.md`:
```markdown
---
created_by: session-YYYYMMDD-HHMM
created_at: YYYY-MM-DDTHH:MM:SS
priority_items: [count]
---

# Next Session Priorities

## Immediate Actions
1. [Highest priority carry-forward task]
2. [Second priority task]

## Context
[Brief narrative of where things stand]

## Files to Review
- `path/to/file.ts` -- [why it needs attention]

## Warnings
- [Any gotchas or things to watch out for]
```

## Checkpoint Storage

- **Location**: `.claude/checkpoints/`
- **Naming**: `checkpoint-YYYYMMDD-HHMM.md` for mid-session, `next-session.md` for end-of-session handoff
- **Retention**: Keep last 10 checkpoints; archive older ones to `.claude/checkpoints/archive/`
- **Session IDs**: Format `session-YYYYMMDD-HHMM`, generated at START or first CHECKPOINT
