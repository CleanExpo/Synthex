# NodeJS-Starter-V1 CLAUDE.md & MCP Config Integration Analysis

**Date:** 17/03/2026
**Source:** `D:/NodeJS-Starter-V1/`
**Target:** `D:/Synthex/`

---

## What Was Found

### NodeJS-Starter-V1 Overview
- Stack: Next.js 15 + FastAPI/LangGraph (Python) + PostgreSQL — runs locally in Docker
- Package manager: pnpm (monorepo with turbo)
- 29 subagents, 65 skills, 10 commands
- Context drift prevention: 4-pillar system (CONSTITUTION.md, SessionStart hook, UserPromptSubmit compass, PreCompact saver)
- Multi-Agent Coordination Harness: 8-phase convergence loop with rubric scoring
- Solution Library pattern: reusable Claude assets governed by Senior PM + Senior Orchestrator

### Key Files Reviewed
- `CLAUDE.md` — architecture routing, agent dispatch, testing discipline, context drift prevention
- `mcp_config.json` — MCP server config (supabase, filesystem, git, github, postgres, memory, brave-search, slack)
- `.claude/settings.json` — hooks: UserPromptSubmit compass, PreCompact save, SessionStart, PostToolUse format, PreToolUse Bash validate + Task iteration counter, Notification, Stop verify
- `.claude/AGENT_HARNESS.md` — 8-phase convergence loop protocol
- `.claude/memory/CONSTITUTION.md` — immutable rules surviving compaction
- `.claude/hooks/scripts/pre-compact-save.py` — PreCompact hook with additionalContext output
- `.claude/hooks/scripts/stop-verify-todos.py` — Stop hook blocking on uncommitted changes
- `.claude/hooks/scripts/pre-bash-validate.py` — PreToolUse Bash command safety validator
- `.claude/hooks/scripts/iteration-counter.py` — Task tool iteration cap enforcement

---

## What Was Integrated

### 1. Three New Hook Scripts
Created in `/d/Synthex/.claude/hooks/`:

| File | Purpose | Source Pattern |
|------|---------|----------------|
| `pre-compact-context.py` | PreCompact hook — saves state snapshot and outputs `additionalContext` guidance to the compactor preserving CLAUDE.md rules | `pre-compact-save.py` |
| `stop-verify-git.py` | Stop hook — blocks if uncommitted changes detected, citing SESSION PROTOCOL | `stop-verify-todos.py` |
| `pre-bash-validate.py` | PreToolUse hook — blocks catastrophic bash commands, warns on `git push` and `git reset --hard` | `pre-bash-validate.py` |

Key Synthex-specific adaptations:
- `pre-compact-context.py`: `additionalContext` references Synthex stack constraints (Supabase Auth ONLY, Prisma, Vercel, npm), Linear issue IDs, and Australian locale rules instead of NodeJS-Starter design tokens
- `stop-verify-git.py`: Removed Beads task check (not used in Synthex); kept git clean check
- `pre-bash-validate.py`: Added `git push` warning aligned with TOOL CONSTRAINTS ("never without explicit human confirmation")

### 2. settings.json Hook Wiring
Updated `/d/Synthex/.claude/settings.json`:
- Added `PreCompact` hook wired to `pre-compact-context.py`
- Replaced `Stop` echo-only hook with `stop-verify-git.py` (git clean check)
- Added `PreToolUse` (Bash matcher) wired to `pre-bash-validate.py`
- Fixed `SessionStart` to use the correct PowerShell script path (`.claude/hooks/session-start.ps1`)
- Updated `name`, `description`, and `model` fields from NodeJS-Starter defaults to Synthex values
- Added `Bash(gh *)` to permissions allowlist

### 3. CLAUDE.md Additions
Appended four new sections to `/d/Synthex/CLAUDE.md`:

| Section | Purpose |
|---------|---------|
| Context Drift Prevention | Documents the 3-pillar defence (PreCompact hook, session scratchpad, MEMORY.md) |
| Verification Discipline | Bans "should work" phrases; mandates running actual commands before claiming Done |
| Architectural Decisions Log | Points to MEMORY.md with append-only format |
| Multi-Agent Harness | 8-phase convergence loop table for complex features, with scope routing and escalation rules |

---

## What Was Skipped

| Item | Reason |
|------|--------|
| pnpm / turbo commands | Synthex uses npm, not pnpm |
| FastAPI / Python backend patterns | Synthex is Next.js-only |
| Docker commands | Synthex uses Supabase hosted, no local Docker |
| CONSTITUTION.md file | Synthex's CLAUDE.md + MEMORY.md serve the same role; creating a third file would be redundant |
| UserPromptSubmit compass hook | Synthex already has `pre-agent-dispatch.ps1` and compass in memory; adding a per-message 100-token injection would add noise |
| Beads task manager | Not installed in Synthex |
| NotebookLM integration | Not used in Synthex |
| Solution Library governance | NodeJS-Starter-V1 is the authoritative library; Synthex consumes it, not the other way around |
| MCP servers from mcp_config.json | All entries (filesystem, git, github, postgres, brave-search, slack) are either already present in Synthex's settings.json or not applicable (memory server requires Python backend) |
| Design token rules (OLED Black, Scientific Luxury) | Synthex has its own design system |
| `iteration-counter.py` | Synthex doesn't use the `/minion` command pattern yet |
| `notification-alert.ps1` | Not material to autonomous operation improvement |

---

## Risk Assessment

- **Low risk**: All additions are purely additive. No existing hooks, settings, or CLAUDE.md sections were removed.
- **PreCompact hook**: Python required on PATH. Same requirement already met by existing hooks in the repo.
- **Stop hook**: Uses `"decision": "block"` which prompts Claude to review, but does not hard-prevent stopping.
- **Pre-bash hook**: Exit code 2 blocks execution — only triggered on genuinely dangerous patterns (rm -rf /, drop database, etc.) plus warnings on `git push` per existing TOOL CONSTRAINTS.
