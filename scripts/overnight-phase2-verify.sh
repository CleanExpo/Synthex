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
REPORT_DIR="$REPO/.artifacts/overnight"
# OUT is created atomically by mktemp below, never assembled from a predictable
# name. A per-minute pathname was both a symlink target an attacker could plant
# between the truncate and the check, and a file two same-minute runs would share.

# launchd hands over a minimal PATH. Never assume a login shell resolved the
# toolchain — pin it, then prove it before claiming any result.
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

# Keep the real stderr on fd 3 from the very first line. Once stdout/stderr are
# redirected into tee, a failure message written to stderr would go to that same
# tee — and tee dying is exactly the case that must stay reportable.
exec 3>&2
fail_hard() { echo "OVERNIGHT ABORT $(date '+%Y-%m-%d %H:%M:%S'): $1" >&3; exit 1; }

cd "$REPO" || fail_hard "repo not found at $REPO"
mkdir -p "$REPORT_DIR" || fail_hard "cannot create $REPORT_DIR"
command -v npm    >/dev/null || fail_hard "npm not on PATH ($PATH)"
command -v node   >/dev/null || fail_hard "node not on PATH ($PATH)"
command -v npx    >/dev/null || fail_hard "npx not on PATH ($PATH)"
command -v git    >/dev/null || fail_hard "git not on PATH ($PATH)"
command -v mktemp >/dev/null || fail_hard "mktemp not on PATH ($PATH)"

# Create the report atomically. mktemp opens O_CREAT|O_EXCL, so it cannot follow a
# planted symlink and cannot collide with a concurrent run — which replaces both a
# truncate-then-check race and a shared per-minute filename that let one run's
# output satisfy another run's readback.
# The X's must be the LAST characters of the template: BSD mktemp does not
# substitute a placeholder followed by an extension, and silently creates a file
# named literally "…-XXXXXX.md" — which is neither unique nor random. The .md is
# added afterwards with `mv -n`, whose target already carries the random suffix.
OUT="$(mktemp "$REPORT_DIR/phase2-$STAMP-XXXXXX")" || fail_hard "cannot create a report in $REPORT_DIR"
RUN_ID="${OUT##*-}"
case "$RUN_ID" in XXXXXX|"") fail_hard "mktemp did not randomise the report name (got $OUT)";; esac
# `mv -n` exits 0 when the target already exists and silently does NOT move —
# so a pre-existing $OUT.md would leave OUT pointing at a file this run never
# created. Prove the rename took effect rather than trusting the status.
mv -n "$OUT" "$OUT.md" || fail_hard "cannot name the report $OUT.md"
[ ! -e "$OUT" ] || fail_hard "rename did not take effect — $OUT.md already existed"
OUT="$OUT.md"
[ -L "$OUT" ] && fail_hard "$OUT is a symlink; refusing to write the report through it"
[ -f "$OUT" ] || fail_hard "$OUT is not a regular file"

# Append straight to the report rather than through `tee`. Process substitution
# put a child between this shell and the file: its failures were invisible here,
# and the readback below could run before it had drained the pipe — a false hard
# failure on a report that was about to be written. Writing to the fd directly
# removes both, and the report file is the artefact that matters; launchd's own
# stdout log was only ever a duplicate of it.
exec >> "$OUT" 2>&1

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
# A verdict that cannot name the revision it checked is not evidence. git's status
# was ignored here, so a failing git left head= empty and the run still reported
# PASS — a report about nothing in particular.
HEAD_SHA="$(git rev-parse HEAD 2>/dev/null)" || HEAD_SHA=""
[ -n "$HEAD_SHA" ] || fail_hard "git rev-parse HEAD produced nothing; refusing to report a verdict with no revision"

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
# Run the gate the repository actually declares. package.json's db:validate is
# `prisma validate && prisma generate`; running validate alone reported PASS while
# client generation could be failing. Status captured BEFORE any pipe, because
# `npx … | tail` reports tail's status and this script sets no pipefail — which is
# how an npx exiting 127 was once displayed as a passing check.
PRISMA_OUT="$(npm run db:validate 2>&1)"; PRISMA_RC=$?
echo "$PRISMA_OUT" | tail -2
echo "(exit $PRISMA_RC)"
echo '```'

# One machine-readable line, written on BOTH outcomes, so a morning check never
# has to infer a verdict from the absence of an error.
if [ "$TC_RC" -eq 0 ] && [ "$LINT_RC" -eq 0 ] && [ "$TEST_RC" -eq 0 ] &&
   [ "$PRISMA_RC" -eq 0 ]; then
  VERDICT="PASS"
else
  VERDICT="FAIL"
fi

# run= carries the mktemp suffix, so this line is unique to this invocation even
# if two runs share a second, a HEAD and all four statuses. Without it the readback
# could be satisfied by a concurrent run's line while this run's output was lost.
RESULT_LINE="RESULT $VERDICT $(date '+%Y-%m-%d %H:%M:%S') run=$RUN_ID type-check=$TC_RC lint=$LINT_RC test=$TEST_RC prisma=$PRISMA_RC head=$HEAD_SHA"

echo
echo "## Result"
echo '```'
echo "$RESULT_LINE"
echo '```'
echo
echo "No push and no merge were attempted."

# Prove the report survived. `exec > >(tee …)` runs tee as a child whose failure
# never reaches this shell: if the filesystem fills after the initial truncate,
# every line above is discarded and the script would still exit 0 claiming a
# report was written.
#
# The match is fixed-string and whole-line against the exact line just emitted,
# NOT a `^RESULT ` prefix. That earlier predicate was satisfied by a seven-byte
# file containing only "RESULT ", and by a stale line from an earlier run — so it
# proved almost nothing. This line carries this run's timestamp and revision, so
# nothing but this run can produce it.
# Not `|| true`. A swallowed failure here is the exact defect this script exists to
# stop: the readback below reads through the page cache, so without a successful
# flush it can confirm a RESULT line that never reached disk — an exit 0 and no
# report in the morning. If the flush fails, say so and fail.
sync || fail_hard "sync failed; cannot confirm $OUT reached disk"
if ! grep -Fqx -- "$RESULT_LINE" "$OUT" 2>/dev/null; then
  echo "OVERNIGHT ABORT $(date '+%Y-%m-%d %H:%M:%S'): $OUT does not contain this run's RESULT line — output was lost after the report was opened" >&3
  exit 1
fi
exit 0
