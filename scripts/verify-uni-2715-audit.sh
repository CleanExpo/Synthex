#!/usr/bin/env bash
# UNI-2715 verifier. Asserts the npm audit surface is EXACTLY the expected
# residual: only advisories whose fix requires a semver-major bump remain.
# Exit 0 = as expected. Non-zero = a named, specific failure.
set -uo pipefail

OUT="${UNI2715_AUDIT_JSON:-}"
TMP=""
if [ -z "$OUT" ]; then
  TMP="$(mktemp)"
  OUT="$TMP"
  npm audit --json > "$OUT" 2>/dev/null
fi

if [ ! -s "$OUT" ]; then
  echo "FAIL: audit output missing or empty at $OUT - measurement did not run" >&2
  [ -n "$TMP" ] && rm -f "$TMP"
  exit 3
fi

# A failed measurement must never be able to return a value: require the key.
if ! jq -e '.metadata.vulnerabilities.total' "$OUT" >/dev/null 2>&1; then
  echo "FAIL: .metadata.vulnerabilities.total absent - audit JSON unusable" >&2
  [ -n "$TMP" ] && rm -f "$TMP"
  exit 3
fi

EXPECT_TOTAL=12
EXPECT_CRITICAL=0
EXPECT_HIGH=8
EXPECT_MODERATE=3
EXPECT_LOW=1

# esbuild (GHSA-g7r4-m6w7-qqqr, CVSS 2.5, dev-server-on-Windows only) is an
# UPSTREAM-BLOCKED residual, not an unfinished fix. It sits at
# node_modules/tsup/node_modules/esbuild. tsup@8.5.1 is the LATEST published
# tsup and pins esbuild ^0.27.0; the patched esbuild is 0.28.1, which cannot
# satisfy that range, so npm always nests a separate vulnerable copy. Root
# `overrides` do not reach it - nested form, top-level form and a full
# --package-lock-only regeneration were all tried and all left 0.27.7.
# npm reports fixAvailable:true because a patched esbuild EXISTS, not because
# one is reachable without breaking tsup's pin.
# This exemption is deliberately EXACT: if esbuild ever drops out of the audit
# (upstream fixed) the check FAILS and tells you to delete the exemption.
EXPECT_STRAY="esbuild"

rc=0
read -r T C H M L < <(jq -r '.metadata.vulnerabilities | "\(.total) \(.critical) \(.high) \(.moderate) \(.low)"' "$OUT")

if [ "$T" != "$EXPECT_TOTAL" ] || [ "$C" != "$EXPECT_CRITICAL" ] || [ "$H" != "$EXPECT_HIGH" ] || [ "$M" != "$EXPECT_MODERATE" ] || [ "$L" != "$EXPECT_LOW" ]; then
  echo "FAIL: audit counts are total=$T critical=$C high=$H moderate=$M low=$L; expected total=$EXPECT_TOTAL critical=$EXPECT_CRITICAL high=$EXPECT_HIGH moderate=$EXPECT_MODERATE low=$EXPECT_LOW" >&2
  rc=1
fi

# Every survivor must be blocked ONLY by a semver-major bump to prisma/puppeteer.
STRAY="$(jq -r '[.vulnerabilities[] | select((.fixAvailable|type)=="boolean" and .fixAvailable==true) | .name] | sort | join(",")' "$OUT")"
if [ "$STRAY" != "$EXPECT_STRAY" ]; then
  echo "FAIL: advisories reporting a non-breaking fix are [$STRAY]; expected exactly [$EXPECT_STRAY]." >&2
  echo "      If esbuild is now ABSENT, tsup shipped a fix - delete the EXPECT_STRAY exemption." >&2
  echo "      If a NEW name appears, it has a reachable fix and must be resolved in this lap." >&2
  rc=1
fi

BADROOT="$(jq -r '[.vulnerabilities[] | select((.fixAvailable|type)=="object") | .fixAvailable.name] | unique | map(select(. != "prisma" and . != "puppeteer")) | join(",")' "$OUT")"
if [ -n "$BADROOT" ]; then
  echo "FAIL: survivors blocked by an unexpected major bump root: $BADROOT (expected only prisma/puppeteer)" >&2
  rc=1
fi

if [ "$rc" = 0 ]; then
  echo "PASS: audit surface is exactly the expected residual - total=$T critical=$C high=$H moderate=$M low=$L."
  echo "      11 survivors need a semver-major bump (prisma@6.19.3 / puppeteer@25.10.0), deferred as foundation-class."
  echo "      1 survivor (esbuild) is upstream-blocked by tsup's ^0.27.0 pin - see EXPECT_STRAY note above."
fi

[ -n "$TMP" ] && rm -f "$TMP"
exit "$rc"
