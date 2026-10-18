#!/usr/bin/env python3
"""SessionStart / PreCompact: inject (or save) the .unite/state.json summary.

Lightweight by design: reads one file, never runs the build, never blocks a session.
With --save (PreCompact) it stamps state.json so compaction loses nothing.
"""
import json
import os
import sys
from pathlib import Path

MAX_CHARS = 6000  # well under the 10,000-character additionalContext cap


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        payload = {}
    repo = Path(os.environ.get("CLAUDE_PROJECT_DIR") or payload.get("cwd") or ".")
    state_path = repo / ".unite" / "state.json"
    if not state_path.exists():
        return 0  # nothing to inject; absence is not an error
    try:
        st = json.loads(state_path.read_text())
    except Exception as e:
        print(f"unite_context: state.json unreadable ({e}); run unite_state.py status", file=sys.stderr)
        return 0
    if "--save" in sys.argv:
        st.setdefault("compactions", []).append(payload.get("trigger", "unknown"))
        state_path.write_text(json.dumps(st, indent=2) + "\n")
        return 0
    open_b = [b for b in st.get("blockers", []) if not b.get("cleared")]
    lines = [
        "unite-project-completion state (from .unite/state.json; verify before acting):",
        f"- milestone: {st.get('milestone') or 'none'} on {st.get('branch') or '?'} @ {(st.get('head') or '?')[:12]}",
        f"- finish state: {st.get('finish') or 'not reached'}",
        f"- next action: {st.get('next') or 'none recorded'}",
        f"- open blockers ({len(open_b)}): " + ("; ".join(f"{b['text']} [cleared by {b.get('cleared_by')}]" for b in open_b) or "none"),
        f"- recent decisions: " + ("; ".join(d["text"] for d in st.get("decisions", [])[-5:]) or "none"),
        "Evidence may be stale: run unite_state.py evidence check before reporting any status.",
    ]
    disc = repo / ".unite" / "discovery.json"
    if disc.exists():
        try:
            d = json.loads(disc.read_text())
            m = d.get("milestone") or {}
            status = ("adopted as the active milestone" if m.get("id") and m.get("id") == st.get("milestone")
                      else "a proposal only until /spm or Phill picks it")
            lines.append(f"- last /unite-discover ({d.get('created', '?')}): proposed {m.get('id', '?')}; "
                         f"{status} (do not re-run discovery here)")
        except Exception:
            lines.append("- .unite/discovery.json unreadable; re-run check_discovery.py check")
    out = {"hookSpecificOutput": {"hookEventName": payload.get("hook_event_name", "SessionStart"),
                                  "additionalContext": "\n".join(lines)[:MAX_CHARS]}}
    print(json.dumps(out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
