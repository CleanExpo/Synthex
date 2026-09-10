#!/usr/bin/env bash
#
# Proves that the Phase 7 hold-for-review invariant test is capable of FAILING.
#
# A test that asserts autopilot produces 'draft' passes trivially while the
# production code produces 'draft' for every input. That tells you nothing about
# whether the test would notice if the hold were removed - which is the only
# thing it exists to notice (SYN-1211).
#
# So: flip HOLD_FOR_REVIEW to false, run the suite, and require that it goes RED
# *and* names the draft-never-scheduled assertion. A non-zero exit alone is not
# enough - a syntax error or a missing module also exits non-zero, and would let
# a broken mutant masquerade as a working control.
#
# The mutation is applied to a byte-for-byte backup and restored from that
# backup, never from git, so this is safe to run against an uncommitted tree.

set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1

export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"

SUBJECT="lib/autopilot/hold-for-review.ts"
SPEC="tests/unit/lib/autopilot/hold-for-review.test.ts"
BACKUP="$(mktemp -t hold-for-review.XXXXXX)"
LOG="$(mktemp -t hold-mutant-run.XXXXXX)"

cleanup() {
  # Restore unconditionally, including on interrupt, then verify byte equality.
  if [ -f "$BACKUP" ]; then
    cp "$BACKUP" "$SUBJECT"
    if ! cmp -s "$BACKUP" "$SUBJECT"; then
      echo "FATAL: restore of $SUBJECT did not verify - backup kept at $BACKUP" >&2
      exit 1
    fi
    rm -f "$BACKUP"
  fi
  rm -f "$LOG"
}
trap cleanup EXIT INT TERM

cp "$SUBJECT" "$BACKUP"
BEFORE_SUM="$(shasum -a 256 "$SUBJECT" | awk '{print $1}')"

# --- positive control on the control itself -------------------------------
# If the anchor is absent the sed below is a silent no-op and the "mutant" run
# would be an unmutated run: green, and read as "the test cannot fail".
if ! grep -q 'export const HOLD_FOR_REVIEW: boolean = true;' "$SUBJECT"; then
  echo "FAIL: mutation anchor not found in $SUBJECT - this control cannot mutate anything" >&2
  exit 1
fi

# --- apply the mutant ------------------------------------------------------
sed -i.sedbak 's/export const HOLD_FOR_REVIEW: boolean = true;/export const HOLD_FOR_REVIEW: boolean = false;/' "$SUBJECT"
rm -f "$SUBJECT.sedbak"

if ! grep -q 'export const HOLD_FOR_REVIEW: boolean = false;' "$SUBJECT"; then
  echo "FAIL: mutation did not apply - nothing was tested" >&2
  exit 1
fi

# --- the suite must go RED, for the right reason ---------------------------
npx jest "$SPEC" --ci --colors=false > "$LOG" 2>&1
MUTANT_EXIT=$?

if [ "$MUTANT_EXIT" -eq 0 ]; then
  echo "FAIL: suite PASSED with HOLD_FOR_REVIEW=false - the invariant test cannot detect the hold being removed" >&2
  sed -n '1,40p' "$LOG" >&2
  exit 1
fi

if ! grep -q 'holds a schedule decision as a draft, never scheduled' "$LOG"; then
  echo "FAIL: suite exited $MUTANT_EXIT but did not name the draft-never-scheduled test." >&2
  echo "       A non-zero exit from some other cause is not proof this control works." >&2
  sed -n '1,40p' "$LOG" >&2
  exit 1
fi

# --- restore and verify ----------------------------------------------------
cp "$BACKUP" "$SUBJECT"
AFTER_SUM="$(shasum -a 256 "$SUBJECT" | awk '{print $1}')"
if [ "$BEFORE_SUM" != "$AFTER_SUM" ]; then
  echo "FAIL: $SUBJECT did not restore to its pre-mutation bytes" >&2
  exit 1
fi

echo "PASS: invariant test went RED under HOLD_FOR_REVIEW=false (exit $MUTANT_EXIT), named the"
echo "      draft-never-scheduled assertion, and $SUBJECT restored byte-identical."
exit 0
