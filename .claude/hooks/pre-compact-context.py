#!/usr/bin/env python3
"""
Pre-Compact Context Saver for Claude Code (Synthex)
Triggered before every context compaction event via the PreCompact hook.
Outputs additionalContext guidance so the compactor preserves critical rules.
Adapted from NodeJS-Starter-V1 pre-compact-save.py pattern.
"""

import json
import os
import sys
from datetime import datetime


def get_project_dir() -> str:
    """Get the project directory from environment."""
    return os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())


def write_state_snapshot(project_dir: str, session_id: str) -> None:
    """Write a compaction snapshot to .claude/scratchpad/pre-compact-state.md."""
    scratchpad_dir = os.path.join(project_dir, ".claude", "scratchpad")
    state_path = os.path.join(scratchpad_dir, "pre-compact-state.md")
    timestamp = datetime.now().strftime("%d/%m/%Y %H:%M AEST")

    content = f"""## Pre-Compact State
> Updated by PreCompact hook. Session: {session_id[:8] if session_id else "unknown"}
> Compaction triggered at {timestamp}

### Recovery Instructions
Re-read CLAUDE.md if rules feel unclear after compaction.
Run: git status && git log --oneline -5
Check: .claude/scratchpad/current-session.md for interrupted work
"""

    try:
        os.makedirs(scratchpad_dir, exist_ok=True)
        with open(state_path, "w", encoding="utf-8") as f:
            f.write(content)
    except OSError:
        pass  # Graceful degradation — never block compaction


def build_compaction_guidance() -> str:
    """Build additionalContext guidance for the compactor."""
    return (
        "PRESERVE_VERBATIM: All CLAUDE.md instructions | SESSION PROTOCOL section | "
        "Australian locale rules (en-AU, DD/MM/YYYY, AUD) | "
        "Stack constraints (Next.js 15, Supabase Auth ONLY, Prisma, Vercel, npm) | "
        "Tool constraints (no git push without confirmation, no .env edits) | "
        "Data fetching patterns (useApi/useSWR/fetch) | "
        "PRESERVE_SUMMARY: Current Linear issue identifiers | Recent architectural decisions | "
        "Active task state from .claude/scratchpad/current-session.md | "
        "Key file paths modified in this session | "
        "DRIFT_RECOVERY: Before touching any route or page file, consult "
        ".planning/ROUTE_REFERENCE.md for exact path, auth level, and canonical "
        "lib/auth/ function — run `npm run routes:refresh` if reference looks stale | "
        "DISCARD: Resolved debug output | Completed tool outputs | "
        "Repeated search results already acted upon | Old file read contents"
    )


def main() -> None:
    try:
        input_data = json.load(sys.stdin)
    except (json.JSONDecodeError, EOFError):
        input_data = {}

    session_id = input_data.get("session_id", "")
    project_dir = get_project_dir()

    write_state_snapshot(project_dir, session_id)

    output = {
        "hookSpecificOutput": {
            "hookEventName": "PreCompact",
            "additionalContext": build_compaction_guidance()
        }
    }

    print(json.dumps(output))
    sys.exit(0)


if __name__ == "__main__":
    main()
