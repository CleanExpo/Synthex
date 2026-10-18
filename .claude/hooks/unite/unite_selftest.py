#!/usr/bin/env python3
"""Self-test for the copied unite hooks: every planted forbidden act denied, every benign act allowed.

Exit 0 only when all cases behave. Run after gen_project_hooks.py --write, in the target repo.
"""
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DENY = ["git push --force origin feature/x", "git push -f origin x", "git push origin HEAD:main",
        "git commit -m x --no-verify", "npx prisma migrate deploy", "npx prisma db push",
        "vercel deploy --prod", "vercel env pull", "gh pr merge 12 --squash", "cat .env.local",
        "export ANTHROPIC_API_KEY=x", "git push origin --delete feature/x"]
ALLOW = ["git push origin feature/x", "git status", "npm test", "cat README.md", "npx prisma validate",
         "gh pr view 12", "ls .envrc-notes"]


def run(cmd: str) -> bool:
    r = subprocess.run([sys.executable, str(HERE / "unite_guard.py")], input=json.dumps(
        {"hook_event_name": "PreToolUse", "tool_name": "Bash", "tool_input": {"command": cmd}}),
        capture_output=True, text=True, timeout=30)
    if r.returncode != 0:
        return True  # a crashing guard denies (onFailure block); count as deny
    out = r.stdout.strip()
    return bool(out) and json.loads(out)["hookSpecificOutput"]["permissionDecision"] == "deny"


def main() -> int:
    bad = 0
    for c in DENY:
        ok = run(c)
        bad += not ok
        print(f"{'PASS' if ok else 'FAIL'} denied: {c}")
    for c in ALLOW:
        ok = not run(c)
        bad += not ok
        print(f"{'PASS' if ok else 'FAIL'} allowed: {c}")
    print(f"unite_selftest: {len(DENY) + len(ALLOW) - bad} of {len(DENY) + len(ALLOW)} behave")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
