#!/usr/bin/env python3
"""
Pre-Bash Command Validator for Claude Code (Synthex)
Validates bash commands before execution. Blocks truly dangerous operations
and warns on operations that require explicit human confirmation per TOOL CONSTRAINTS.
Adapted from NodeJS-Starter-V1 pre-bash-validate.py.
"""

import json
import re
import sys
from typing import List, Tuple

# Patterns that are always blocked (catastrophic/irreversible)
DANGEROUS_PATTERNS: List[Tuple[str, str]] = [
    (r"rm\s+-rf\s+/(?:\s|$)", "BLOCKED: 'rm -rf /' would delete the entire filesystem"),
    (r"rm\s+-rf\s+~", "BLOCKED: 'rm -rf ~' would delete the home directory"),
    (r"sudo\s+rm\s+-rf", "BLOCKED: sudo rm -rf is extremely dangerous"),
    (r":\s*\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}", "BLOCKED: fork bomb detected"),
    (r">\s*/dev/sd[a-z]", "BLOCKED: direct write to disk device"),
    (r"mkfs\.", "BLOCKED: filesystem formatting command"),
    (r"dd\s+if=.*of=/dev/", "BLOCKED: direct disk write with dd"),
    (r"DROP\s+DATABASE", "BLOCKED: DROP DATABASE requires explicit human confirmation"),
]

# Operations that require warning (per TOOL CONSTRAINTS in CLAUDE.md)
WARNINGS: List[Tuple[str, str]] = [
    (r"git\s+push\s+(?:--force|-f)", "WARNING: force push requires explicit human confirmation per TOOL CONSTRAINTS"),
    (r"git\s+push\b(?!\s+--dry-run)", "WARNING: 'git push' requires explicit human confirmation — confirm with user first"),
    (r"rm\s+-rf\s+\S+", "WARNING: rm -rf is destructive — verify path is correct"),
    (r"git\s+reset\s+--hard", "WARNING: hard reset discards uncommitted changes"),
    (r"npm\s+install\s+--force", "WARNING: --force bypasses security checks"),
    (r"chmod\s+777", "WARNING: chmod 777 is overly permissive"),
]


def validate_command(command: str) -> Tuple[bool, List[str]]:
    """Return (should_block, messages)."""
    messages: List[str] = []
    should_block = False

    for pattern, message in DANGEROUS_PATTERNS:
        if re.search(pattern, command, re.IGNORECASE):
            messages.append(message)
            should_block = True

    if not should_block:
        for pattern, message in WARNINGS:
            if re.search(pattern, command):
                messages.append(message)

    return should_block, messages


def main() -> None:
    try:
        input_data = json.load(sys.stdin)
    except (json.JSONDecodeError, EOFError):
        sys.exit(0)

    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})
    command = tool_input.get("command", "")

    if tool_name != "Bash" or not command:
        sys.exit(0)

    should_block, messages = validate_command(command)

    if should_block:
        for message in messages:
            print(message, file=sys.stderr)
        sys.exit(2)  # Exit code 2 = block in Claude Code hook protocol
    elif messages:
        output = {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "additionalContext": " | ".join(messages)
            }
        }
        print(json.dumps(output))
        sys.exit(0)
    else:
        sys.exit(0)


if __name__ == "__main__":
    main()
