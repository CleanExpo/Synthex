#!/usr/bin/env python3
"""
Stop Verification Hook for Claude Code (Synthex)
Blocks session Stop if there are uncommitted changes, reminding the agent
to commit before closing. Adapted from NodeJS-Starter-V1 stop-verify-todos.py.

Outputs a "block" decision (which Claude Code treats as a warning prompt)
if uncommitted changes are detected. Does not hard-block — it surfaces the
issue so the agent can decide whether to commit or acknowledge.
"""

import json
import subprocess
import sys


def check_git_status() -> tuple[bool, str]:
    """Return (clean, message). clean=True means nothing uncommitted."""
    try:
        result = subprocess.run(
            ["git", "status", "--porcelain"],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.stdout.strip():
            lines = result.stdout.strip().split("\n")
            count = len(lines)
            return False, f"Git: {count} uncommitted change(s) detected"
        return True, "Git: working tree clean"
    except Exception:
        return True, "Git: status check skipped"


def main() -> None:
    try:
        input_data = json.load(sys.stdin)
    except (json.JSONDecodeError, EOFError):
        sys.exit(0)

    # Prevent infinite loops if the stop hook is already active
    if input_data.get("stop_hook_active", False):
        sys.exit(0)

    git_clean, git_message = check_git_status()

    if not git_clean:
        output = {
            "decision": "block",
            "reason": (
                f"{git_message}. "
                "Per SESSION PROTOCOL: run 'git status', commit any remaining changes "
                "with a Linear issue identifier, and confirm before stopping."
            )
        }
        print(json.dumps(output))

    sys.exit(0)


if __name__ == "__main__":
    main()
