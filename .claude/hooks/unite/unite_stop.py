#!/usr/bin/env python3
"""Stop: keep a session honest about the active milestone, without looping.

- No .unite/state.json or no active milestone -> allow.
- stop_hook_active true -> allow (the documented loop guard).
- Evidence fresh and passing, or a finish state recorded -> allow.
- Otherwise give ONE next action as non-error feedback, at most MAX_NUDGES times for the
  same evidence picture; then record a blocker and allow the stop (goal-circuit-breaker).
"""
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

MAX_NUDGES = 3
HERE = Path(__file__).resolve().parent


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0
    if payload.get("stop_hook_active"):
        return 0
    repo = Path(os.environ.get("CLAUDE_PROJECT_DIR") or payload.get("cwd") or ".")
    state_path = repo / ".unite" / "state.json"
    if not state_path.exists():
        return 0
    st = json.loads(state_path.read_text())
    if not st.get("milestone") or st.get("finish"):
        return 0
    r = subprocess.run([sys.executable, str(HERE / "unite_state.py"), "--repo", str(repo), "evidence", "check"],
                       capture_output=True, text=True, timeout=60)
    if r.returncode == 0:
        return 0
    picture = hashlib.sha256(r.stdout.encode()).hexdigest()
    hs_path = repo / ".unite" / "hook-state.json"
    hs = json.loads(hs_path.read_text()) if hs_path.exists() else {}
    key = f"{st['milestone']}:{picture}"
    hs[key] = hs.get(key, 0) + 1
    hs_path.write_text(json.dumps(hs, indent=2) + "\n")
    if hs[key] > MAX_NUDGES:
        subprocess.run([sys.executable, str(HERE / "unite_state.py"), "--repo", str(repo), "blocker", "add",
                        "--text", f"evidence unchanged after {MAX_NUDGES} nudges: {r.stdout.strip()[:300]}",
                        "--cleared-by", "next session or founder"], capture_output=True, text=True, timeout=30)
        return 0
    missing = [l for l in r.stdout.splitlines() if l.startswith("FAIL")]
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "Stop", "additionalContext":
        f"Milestone {st['milestone']} is not verified ({len(missing)} acceptance check(s) not freshly passing): "
        f"{'; '.join(m[5:] for m in missing[:3])}. Next action: run the first one and record it with "
        f"unite_state.py evidence add, or record a blocker if it cannot run. (nudge {hs[key]} of {MAX_NUDGES})"}}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
