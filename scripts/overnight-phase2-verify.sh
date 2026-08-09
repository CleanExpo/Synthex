#!/bin/bash
# overnight-phase2-verify.sh — unattended nightly verification, writing a report
# to read in the morning. Fired by ~/Library/LaunchAgents/com.synthex.phase2-overnight.plist
# at 03:00 local.
#
# Deliberately does NOT edit code, push, or merge. It re-runs the gate from a clean
# start against whatever HEAD actually is at 3am, so the morning report is evidence
# rather than a restatement of what the previous session believed.
#
# Exit contract — these mean different things and must not be conflated:
#   0  the job RAN and wrote a report. The report holds the PASS/FAIL verdict.
#   1  the job COULD NOT run (no repo, no toolchain, unwritable log). Nobody was told,
#      so this must be loud in `launchctl list`.
# A failing gate is a RESULT to read, not a crashed job — it still exits 0. The
# distinction is the whole point: exit status answers "did the watchman show up",
# the RESULT line answers "what did he see".
#
# History: this script was lost with a deleted branch and the LaunchAgent then exited
# 127 nightly for weeks with nobody noticing. Its predecessor also silently logged
# "npm: command not found" because launchd's `zsh -lc` sources .zprofile but not
# .zshrc, so an nvm-managed node was invisible. Both failure modes are guarded below.

set -u

REPO="/Users/phillmcgurk/Synthex"
STAMP="$(date +%Y-%m-%d-%H%M)"
OUT="$REPO/.artifacts/overnight/phase2-$STAMP.md"

# launchd hands over a minimal PATH. Never assume a login shell resolved the
# toolchain — pin it, then prove it before claiming any result.
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

fail_hard() { echo "OVERNIGHT ABORT $(date '+%Y-%m-%d %H:%M:%S'): $1" >&2; exit 1; }

cd "$REPO" || fail_hard "repo not found at $REPO"
mkdir -p "$(dirname "$OUT")" || fail_hard "cannot create $(dirname "$OUT")"
: > "$OUT" || fail_hard "cannot write $OUT"
command -v npm  >/dev/null || fail_hard "npm not on PATH ($PATH)"
command -v node >/dev/null || fail_hard "node not on PATH ($PATH)"

exec > >(tee -a "$OUT") 2>&1

echo "# Overnight verification — $STAMP"
echo
echo "## Starting state"
echo '```'
git rev-parse --abbrev-ref HEAD
git log --oneline -4
echo "uncommitted files: $(git status --porcelain | wc -l | tr -d ' ')"
echo "ahead/behind origin/main: $(git rev-list --left-right --count origin/main...HEAD 2>/dev/null)"
echo "node $(node --version) · npm $(npm --version)"
echo '```'
HEAD_SHA="$(git rev-parse HEAD)"

echo
echo "## Type-check"
echo '```'
TC_OUT="$(npm run type-check 2>&1)"; TC_RC=$?
echo "$TC_OUT" | grep -E 'error TS' | head -20
echo "type-check errors: $(echo "$TC_OUT" | grep -c 'error TS') (exit $TC_RC)"
echo '```'

echo
echo "## Lint"
echo '```'
LINT_OUT="$(npm run lint 2>&1)"; LINT_RC=$?
echo "$LINT_OUT" | tail -8
echo "(exit $LINT_RC)"
echo '```'

echo
echo "## Unit suite"
echo '```'
TEST_OUT="$(npm test 2>&1)"; TEST_RC=$?
echo "$TEST_OUT" | grep -E '^(FAIL|Tests:|Test Suites:)' | tail -12
echo "(exit $TEST_RC)"
echo '```'

echo
echo "## Prisma schema"
echo '```'
npx prisma validate 2>&1 | tail -2
echo '```'

# One machine-readable line, written on BOTH outcomes, so a morning check never
# has to infer a verdict from the absence of an error.
if [ "$TC_RC" -eq 0 ] && [ "$LINT_RC" -eq 0 ] && [ "$TEST_RC" -eq 0 ]; then
  VERDICT="PASS"
else
  VERDICT="FAIL"
fi

echo
echo "## Result"
echo '```'
echo "RESULT $VERDICT $(date '+%Y-%m-%d %H:%M:%S') type-check=$TC_RC lint=$LINT_RC test=$TEST_RC head=$HEAD_SHA"
echo '```'
echo
echo "No push and no merge were attempted."
exit 0
