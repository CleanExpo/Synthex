#!/usr/bin/env python3
"""unite_state.py — state, milestones and evidence for unite-project-completion.

Runs inside a target repository and reads/writes only its `.unite/` directory
(references/state-contract.md). Standard library only.

  init                                   create .unite/state.json if absent
  milestone check [--file F]             validate a milestone (default: the active one)
  milestone activate --file F            make F the active milestone
  evidence add --check ID --cmd C --exit N [--expect N] [--paths G ...]
  evidence check                         exit 1 if an acceptance check lacks fresh evidence
  status [--finish STATE] [--json]       print the state; --finish refuses an unsupported state
  blocker add --text T --cleared-by WHO | blocker clear --id ID
  decision add --text T | next --text T | pr --url U --head SHA

Evidence is bound to the content of the files its globs match (git blob ids plus any
uncommitted change), not to HEAD alone: an unrelated commit does not invalidate it, an
edit under its paths does. Stale evidence counts as no evidence.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

FINISH_STATES = ("VERIFIED_LOCAL", "AWAITING_RELEASE_APPROVAL", "VERIFIED_LIVE", "BLOCKED")
UI_PREFIXES = ("app/", "components/", "pages/", "src/app/", "src/pages/", "apps/web/")
DOC_ONLY = ("cat ", "less ", "head ", "ls docs", "grep ", "rg ")


def now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def git(repo: Path, *args: str) -> str:
    r = subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)}: {r.stderr.strip()}")
    return r.stdout


class Store:
    def __init__(self, repo: Path):
        self.repo = repo
        self.dir = repo / ".unite"
        self.state_path = self.dir / "state.json"
        self.evidence_path = self.dir / "evidence.jsonl"

    def state(self) -> dict:
        if not self.state_path.exists():
            return {"schema": "unite-state/1", "milestone": None, "decisions": [],
                    "blockers": [], "next": None, "pr": None}
        return json.loads(self.state_path.read_text())

    def save(self, st: dict) -> None:
        self.dir.mkdir(exist_ok=True)
        try:
            st["head"] = git(self.repo, "rev-parse", "HEAD").strip()
            st["branch"] = git(self.repo, "rev-parse", "--abbrev-ref", "HEAD").strip()
        except RuntimeError:
            pass
        st["updated_at"] = now()
        tmp = self.state_path.with_suffix(".tmp")
        tmp.write_text(json.dumps(st, indent=2) + "\n")
        os.replace(tmp, self.state_path)

    def milestone(self, path: str | None = None) -> tuple[dict, Path]:
        if path is None:
            mid = self.state().get("milestone")
            if not mid:
                raise RuntimeError("no active milestone (milestone activate --file F)")
            p = self.dir / "milestones" / f"{mid}.json"
        else:
            p = Path(path)
            if not p.is_absolute():
                p = self.repo / p
        return json.loads(p.read_text()), p

    def evidence(self) -> list[dict]:
        if not self.evidence_path.exists():
            return []
        return [json.loads(l) for l in self.evidence_path.read_text().splitlines() if l.strip()]


def paths_hash(repo: Path, globs: list[str]) -> str:
    """sha256 over the git blob ids the globs match plus any uncommitted change under them."""
    specs = [f":(glob){g}" for g in globs] or ["."]
    staged = git(repo, "ls-files", "-s", "--", *specs)
    dirty = git(repo, "status", "--porcelain", "--untracked-files=all", "--", *specs)
    h = hashlib.sha256()
    h.update(staged.encode())
    for line in sorted(dirty.splitlines()):
        h.update(line.encode())
        f = repo / line[3:].strip().split(" -> ")[-1]
        if f.is_file():
            h.update(hashlib.sha256(f.read_bytes()).digest())
    return h.hexdigest()


def check_milestone(m: dict) -> list[str]:
    problems = []
    if m.get("schema") != "unite-milestone/1":
        problems.append("schema must be unite-milestone/1")
    for k in ("id", "promise", "scope_in", "acceptance", "finish_target"):
        if not m.get(k):
            problems.append(f"missing {k}")
    if m.get("finish_target") and m["finish_target"] not in FINISH_STATES:
        problems.append(f"finish_target {m['finish_target']} is not one of {', '.join(FINISH_STATES)}")
    kinds = set()
    for a in m.get("acceptance") or []:
        aid = a.get("id", "?")
        if not a.get("cmd"):
            problems.append(f"acceptance {aid}: no cmd")
        elif a["cmd"].strip().startswith(DOC_ONLY) and ".md" in a["cmd"]:
            problems.append(f"acceptance {aid}: reads documentation, proves nothing")
        if not isinstance(a.get("expect_exit"), int):
            problems.append(f"acceptance {aid}: expect_exit must be an integer")
        if not a.get("paths"):
            problems.append(f"acceptance {aid}: no paths (evidence could never go stale)")
        if a.get("kind") not in ("command", "journey"):
            problems.append(f"acceptance {aid}: kind must be command or journey")
        kinds.add(a.get("kind"))
    touches_ui = any(str(p).startswith(UI_PREFIXES) for p in m.get("scope_in") or [])
    if touches_ui and "journey" not in kinds:
        problems.append("scope touches UI or a public route but no journey check is defined")
    return problems


def freshness(store: Store, m: dict) -> dict[str, str]:
    """acceptance id -> FRESH_PASS | FRESH_FAIL | STALE | MISSING"""
    rows = store.evidence()
    out = {}
    for a in m["acceptance"]:
        mine = [r for r in rows if r["check"] == a["id"]]
        if not mine:
            out[a["id"]] = "MISSING"
            continue
        last = mine[-1]
        if paths_hash(store.repo, last["paths"]) != last["paths_hash"]:
            out[a["id"]] = "STALE"
        else:
            out[a["id"]] = "FRESH_PASS" if last["exit"] == last["expect_exit"] else "FRESH_FAIL"
    return out


def finish_problems(store: Store, state: str) -> list[str]:
    st = store.state()
    if state == "BLOCKED":
        open_b = [b for b in st["blockers"] if not b.get("cleared")]
        return [] if open_b and all(b.get("cleared_by") for b in open_b) else \
            ["BLOCKED needs at least one open blocker naming cleared_by"]
    m, _ = store.milestone()
    fr = freshness(store, m)
    bad = [f"{k}: {v}" for k, v in fr.items() if v != "FRESH_PASS"]
    if bad:
        return [f"acceptance not freshly passing: {'; '.join(bad)}"]
    if state in ("AWAITING_RELEASE_APPROVAL", "VERIFIED_LIVE") and not (st.get("pr") or {}).get("head"):
        return [f"{state} needs a recorded PR url and head SHA (pr --url U --head SHA)"]
    if state == "VERIFIED_LIVE":
        live = [r for r in store.evidence() if r["check"] == "live" and r["exit"] == r["expect_exit"]
                and r["head"].startswith(st["pr"]["head"][:12])]
        if not live:
            return ["VERIFIED_LIVE needs a passing evidence row with check 'live' for the released SHA"]
    return []


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(prog="unite_state.py")
    ap.add_argument("--repo", default=".")
    sub = ap.add_subparsers(dest="command", required=True)
    sub.add_parser("init")
    mp = sub.add_parser("milestone")
    mp.add_argument("action", choices=["check", "activate"])
    mp.add_argument("--file")
    ep = sub.add_parser("evidence")
    ep.add_argument("action", choices=["add", "check"])
    ep.add_argument("--check")
    ep.add_argument("--cmd")
    ep.add_argument("--exit", type=int)
    ep.add_argument("--expect", type=int, default=0)
    ep.add_argument("--paths", nargs="*", default=[])
    sp = sub.add_parser("status")
    sp.add_argument("--finish", choices=FINISH_STATES)
    sp.add_argument("--json", action="store_true")
    bp = sub.add_parser("blocker")
    bp.add_argument("action", choices=["add", "clear"])
    bp.add_argument("--text")
    bp.add_argument("--cleared-by")
    bp.add_argument("--id", type=int)
    dp = sub.add_parser("decision")
    dp.add_argument("action", choices=["add"])
    dp.add_argument("--text", required=True)
    np_ = sub.add_parser("next")
    np_.add_argument("--text", required=True)
    pp = sub.add_parser("pr")
    pp.add_argument("--url", required=True)
    pp.add_argument("--head", required=True)
    a = ap.parse_args(argv)
    store = Store(Path(a.repo).resolve())
    try:
        if a.command == "init":
            st = store.state()
            store.save(st)
            print(f"unite-state: {store.state_path}")
            return 0
        if a.command == "milestone":
            m, p = store.milestone(a.file)
            problems = check_milestone(m)
            for x in problems:
                print(f"FAIL milestone {m.get('id', p.name)}: {x}")
            if problems:
                return 1
            if a.action == "activate":
                dest = store.dir / "milestones" / f"{m['id']}.json"
                dest.parent.mkdir(parents=True, exist_ok=True)
                if dest.resolve() != p.resolve():
                    dest.write_text(json.dumps(m, indent=2) + "\n")
                st = store.state()
                st["milestone"] = m["id"]
                store.save(st)
            print(f"PASS milestone {m['id']}: {len(m['acceptance'])} measurable acceptance checks")
            return 0
        if a.command == "evidence" and a.action == "add":
            if not a.check or a.cmd is None or a.exit is None:
                print("evidence add needs --check, --cmd and --exit", file=sys.stderr)
                return 2
            paths = a.paths
            if not paths:
                m, _ = store.milestone()
                paths = next((x["paths"] for x in m["acceptance"] if x["id"] == a.check), [])
            row = {"check": a.check, "cmd": a.cmd, "exit": a.exit, "expect_exit": a.expect,
                   "head": git(store.repo, "rev-parse", "HEAD").strip(), "paths": paths,
                   "paths_hash": paths_hash(store.repo, paths), "at": now(), "by": "claude"}
            store.dir.mkdir(exist_ok=True)
            with store.evidence_path.open("a") as f:
                f.write(json.dumps(row) + "\n")
            print(f"evidence {a.check}: exit {a.exit} (expect {a.expect}) bound to {row['paths_hash'][:12]}")
            return 0
        if a.command == "evidence" and a.action == "check":
            m, _ = store.milestone()
            fr = freshness(store, m)
            for k, v in fr.items():
                print(f"{'PASS' if v == 'FRESH_PASS' else 'FAIL'} evidence {k}: {v}")
            return 0 if all(v == "FRESH_PASS" for v in fr.values()) else 1
        if a.command == "status":
            st = store.state()
            fr = {}
            if st.get("milestone"):
                fr = freshness(store, store.milestone()[0])
            report = {"milestone": st.get("milestone"), "branch": st.get("branch"),
                      "evidence": fr, "open_blockers": [b for b in st["blockers"] if not b.get("cleared")],
                      "next": st.get("next"), "finish": st.get("finish")}
            if a.finish:
                problems = finish_problems(store, a.finish)
                report["finish_check"] = problems or "PASS"
                if not problems:
                    st["finish"] = a.finish
                    store.save(st)
                    report["finish"] = a.finish
            print(json.dumps(report, indent=2) if a.json else "\n".join(
                f"{k}: {json.dumps(v)}" for k, v in report.items()))
            return 1 if a.finish and report["finish_check"] != "PASS" else 0
        st = store.state()
        if a.command == "blocker" and a.action == "add":
            if not a.text or not a.cleared_by:
                print("blocker add needs --text and --cleared-by", file=sys.stderr)
                return 2
            st["blockers"].append({"id": len(st["blockers"]) + 1, "text": a.text,
                                   "cleared_by": a.cleared_by, "at": now()})
        elif a.command == "blocker":
            for b in st["blockers"]:
                if b["id"] == a.id:
                    b["cleared"] = now()
        elif a.command == "decision":
            st["decisions"].append({"text": a.text, "at": now()})
        elif a.command == "next":
            st["next"] = a.text
        elif a.command == "pr":
            st["pr"] = {"url": a.url, "head": a.head}
        store.save(st)
        print(f"unite-state: {a.command} recorded")
        return 0
    except (RuntimeError, FileNotFoundError, json.JSONDecodeError) as e:
        print(f"INCONCLUSIVE unite-state: {e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
