#!/usr/bin/env python3
"""Fail if harness.json points at anything that does not exist.

Usage: python3 -I validate_harness.py [repo_root]   (default: four levels up from this file)
Checks: node ids unique; depends_on resolve; every skill exists in <repo>/.claude/skills or
~/.claude/skills; every tool ref that looks like a repo path exists, and a :line suffix lands
within 3 lines of a symbol named in the tool's name;
gap/stub/partial nodes carry a build_hint. Exit 1 with one line per problem.
"""
import json, re, shutil, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else HERE.parents[2]
GLOBAL_SKILLS = Path.home() / ".claude" / "skills"
GENERIC_WORDS = {"studio", "tool", "tools", "with", "from", "only", "grounded", "route", "code", "data"}
PATH_PREFIXES = ("lib/", "app/", "scripts/", "prisma/", "services/", ".claude/", "vercel.json", "package.json")


def main():
    h = json.loads((HERE / "harness.json").read_text())
    problems, ids = [], [n["id"] for n in h["nodes"]]
    if len(ids) != len(set(ids)):
        problems.append("duplicate node ids")
    for n in h["nodes"]:
        nid = n["id"]
        for dep in n.get("depends_on", []):
            if dep not in ids:
                problems.append(f"{nid}: depends_on {dep} does not exist")
        for s in n.get("skills", []):
            if not ((REPO / ".claude/skills" / s / "SKILL.md").exists() or (GLOBAL_SKILLS / s / "SKILL.md").exists()):
                problems.append(f"{nid}: skill {s} not found (repo or global)")
        for t in n.get("tools", []):
            ref = t.get("ref", "")
            if ref.startswith(PATH_PREFIXES):
                p, _, line = ref.partition(":")
                if not (REPO / p).exists():
                    problems.append(f"{nid}: tool ref {p} missing")
                elif line.isdigit():
                    # A file:line pointer must land within 3 lines of a symbol the tool name mentions.
                    rows = (REPO / p).read_text(errors="replace").splitlines()
                    ln = int(line)
                    window = "\n".join(rows[max(0, ln - 4):ln + 3])
                    idents = [w for w in re.findall(r"[A-Za-z_][A-Za-z0-9_]{3,}", t.get("name", ""))
                              if w.lower() not in GENERIC_WORDS]
                    if ln > len(rows) or not any(w in window for w in idents):
                        problems.append(f"{nid}: {ref} does not point at any of {idents[:4]}")
            elif ref.startswith("/") and not Path(ref).exists():
                problems.append(f"{nid}: binary {ref} missing")
            elif ref.startswith("bin:") and not shutil.which(ref[4:]):
                problems.append(f"{nid}: binary {ref[4:]} not on PATH")
        if n.get("status") in ("gap", "stub", "partial") and not n.get("build_hint"):
            problems.append(f"{nid}: status {n['status']} without build_hint")
    for p in problems:
        print("FAIL", p)
    print(f"{len(h['nodes'])} nodes, {len(problems)} problems")
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
