#!/usr/bin/env python3
"""Fail if harness.json points at anything that does not exist.

Usage: python3 -I validate_harness.py [repo_root]   (default: four levels up from this file)
Checks: node ids unique; depends_on resolve; every skill exists in <repo>/.claude/skills or
~/.claude/skills; every tool ref that looks like a repo path exists (line suffix ignored);
gap/stub/partial nodes carry a build_hint. Exit 1 with one line per problem.
"""
import json, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else HERE.parents[2]
GLOBAL_SKILLS = Path.home() / ".claude" / "skills"
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
                p = ref.split(":")[0]
                if not (REPO / p).exists():
                    problems.append(f"{nid}: tool ref {p} missing")
            elif ref.startswith("/") and not Path(ref).exists():
                problems.append(f"{nid}: binary {ref} missing")
        if n.get("status") in ("gap", "stub", "partial") and not n.get("build_hint"):
            problems.append(f"{nid}: status {n['status']} without build_hint")
    for p in problems:
        print("FAIL", p)
    print(f"{len(h['nodes'])} nodes, {len(problems)} problems")
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
