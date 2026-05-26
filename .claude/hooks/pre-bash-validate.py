#!/usr/bin/env python3
"""
Pre-Bash Command Validator for Claude Code / Cursor (Synthex)

Cursor preToolUse hooks MUST write valid JSON to stdout (stdin carries hook payload).
Never print to stdout except JSON. Use stderr for debug only.
"""

from __future__ import annotations

import json
import re
import sys
from typing import Any, List, Tuple

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
    (
        r"git\s+push\s+(?:--force|-f)",
        "WARNING: force push requires explicit human confirmation per TOOL CONSTRAINTS",
    ),
    (
        r"git\s+push\b(?!\s+--dry-run)",
        "WARNING: 'git push' requires explicit human confirmation — confirm with user first",
    ),
    (r"rm\s+-rf\s+\S+", "WARNING: rm -rf is destructive — verify path is correct"),
    (r"git\s+reset\s+--hard", "WARNING: hard reset discards uncommitted changes"),
    (r"npm\s+install\s+--force", "WARNING: --force bypasses security checks"),
    (r"chmod\s+777", "WARNING: chmod 777 is overly permissive"),
]

SHELL_TOOLS = frozenset({"Bash", "Shell", "PowerShell"})


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
            if re.search(pattern, command, re.IGNORECASE):
                messages.append(message)

    return should_block, messages


def _write_stdout(payload: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(payload, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def emit_allow(additional_context: str | None = None) -> None:
    out: dict[str, Any] = {"permission": "allow"}
    if additional_context:
        out["hookSpecificOutput"] = {
            "hookEventName": "PreToolUse",
            "additionalContext": additional_context,
        }
    _write_stdout(out)
    raise SystemExit(0)


def emit_deny(message: str) -> None:
    _write_stdout(
        {
            "permission": "deny",
            "user_message": message,
            "agent_message": message,
        }
    )
    raise SystemExit(0)


def main() -> None:
    try:
        raw = sys.stdin.read()
    except Exception:
        emit_allow()

    try:
        input_data = json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError:
        emit_allow()

    tool_name = str(input_data.get("tool_name", ""))
    tool_input = input_data.get("tool_input") or {}
    if not isinstance(tool_input, dict):
        tool_input = {}
    command = str(tool_input.get("command", "") or "")

    if tool_name not in SHELL_TOOLS or not command:
        emit_allow()

    should_block, messages = validate_command(command)

    if should_block:
        emit_deny(" | ".join(messages))

    if messages:
        emit_allow(" | ".join(messages))

    emit_allow()


if __name__ == "__main__":
    main()
