#!/usr/bin/env python3
"""PreToolUse (Bash): deny the actions no milestone may take without the founder.

Deterministic, registered with onFailure "block" so a crash denies rather than allows.
Denies via the documented hookSpecificOutput.permissionDecision "deny".
"""
import json
import re
import sys

RULES = [
    (r"\bgit\s+push\b.*(\s--force\b|\s-f\b|\s--force-with-lease\b|\s\+\S+)", "force-push is forbidden"),
    (r"\bgit\s+push\b.*(\s|:)(main|master)(\s|$)", "pushing to main/master needs the merge owner"),
    (r"--no-verify\b", "--no-verify bypasses the repo's gates"),
    (r"\bgit\s+push\b.*\s--delete\b|\bgit\s+push\b.*\s:refs/tags/", "deleting remote branches or tags needs approval"),
    (r"\bprisma\s+(migrate\s+deploy|db\s+push)\b", "production schema changes are founder-gated"),
    (r"\bsupabase\s+db\s+push\b", "production schema changes are founder-gated"),
    (r"\bvercel\b.*\s--prod\b|\bvercel\s+env\b", "deployment and environment changes need approval"),
    (r"\bgh\s+pr\s+merge\b", "merging needs the merge owner's approval"),
    (r"(^|[\s;|&<>])(cat|less|head|tail|more|bat|source|\.)\s+\S*\.env(\.[\w.-]+)?(\s|$)", "reading .env files is forbidden"),
    (r"\bANTHROPIC_API_KEY\s*=", "API billing is not used; subscription only"),
]


def decide(command: str):
    for pattern, reason in RULES:
        if re.search(pattern, command):
            return reason
    return None


def main() -> int:
    payload = json.load(sys.stdin)
    if payload.get("tool_name") != "Bash":
        return 0
    command = (payload.get("tool_input") or {}).get("command", "")
    reason = decide(command)
    if reason:
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": f"unite-project-completion guard: {reason}. Record a blocker with unite_state.py if this is needed.",
        }}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
