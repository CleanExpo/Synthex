#!/usr/bin/env bash
# UNI-2715 verifier. Asserts the npm audit surface is EXACTLY the expected
# residual: only advisories whose fix requires a semver-major bump remain.
# Exit 0 = as expected. Non-zero = a named, specific failure.
set -uo pipefail

# This guard performs its OWN measurement and accepts no caller-supplied audit JSON.
# It previously honoured $UNI2715_AUDIT_JSON, which meant a stale or fabricated file
# could produce PASS without npm audit ever running against this tree. Found by
# independent review of 365485ada (P1) and removed rather than narrowed: a check that
# takes its verdict from its caller is not a check.
# To exercise this script against a different dependency surface, run it in a tree whose
# package.json / package-lock.json actually carry that surface - never by handing it a result.
TMP="$(mktemp)"
OUT="$TMP"
npm audit --json > "$OUT" 2>/dev/null

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

EXPECT_TOTAL=13
EXPECT_CRITICAL=0
EXPECT_HIGH=8
EXPECT_MODERATE=4
EXPECT_LOW=1

# sanitize-html is DELIBERATELY PINNED to 2.17.5 in package.json (not ^2.17.5).
# 2.17.7 is the only patched version (vulnerable range <=2.17.6), but it moved its
# own dependency htmlparser2 from ^10 to ^12 inside a PATCH release, and v12 dropped
# the CommonJS build v10 shipped (v10 exports a "require" condition; v12 exports only
# "default" and sets type:module). That makes an ESM-only parser reach jest's CJS
# runtime and kills tests/unit/lib/sanitize.test.ts with
# "Cannot use import statement outside a module".
# Forcing htmlparser2 back to v10 is NOT possible: npm root overrides cannot pull a
# nested dep below its parent's declared range (tried ^10.1.0 and exact 10.1.0; both
# silently ignored). Taking 2.17.7 therefore requires jest ESM support
# (transformIgnorePatterns) - a separate unit of work on an 8600-test suite.
# COST OF THIS PIN: GHSA-g8qq-57p8-ggw5 (stored XSS via SVG SMIL) and
# GHSA-jxwj-j7wr-gfrw (mutation-XSS via literal </textarea/>) remain OPEN in
# lib/sanitize.ts. Tracked in SYN-1213 (High), which carries the full ESM
# diagnosis: the allowlist alone is insufficient because both nested
# node_modules segments must be listed, and babel still will not transform
# htmlparser2's ESM dist. Not forgotten.

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
# Tracked: SYN-1214 (upstream watch on tsup widening its esbuild range).
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

BADROOT="$(jq -r '[.vulnerabilities[] | select((.fixAvailable|type)=="object") | .fixAvailable.name] | unique | map(select(. != "prisma" and . != "puppeteer" and . != "sanitize-html")) | join(",")' "$OUT")"
if [ -n "$BADROOT" ]; then
  echo "FAIL: survivors blocked by an unexpected upgrade root: $BADROOT (expected only prisma/puppeteer/sanitize-html)" >&2
  rc=1
fi

# The sanitize-html exemption is valid ONLY while the pin that causes it is present.
# If someone restores the ^ range, this check fails rather than silently excusing a
# vulnerability that is once again avoidable.
if ! grep -q '"sanitize-html": "2.17.5"' package.json; then
  echo "FAIL: the sanitize-html exemption assumes an EXACT pin of 2.17.5 in package.json, and that pin is gone." >&2
  echo "      Either restore the pin, or take 2.17.7 with jest ESM support and delete this exemption." >&2
  rc=1
fi

if [ "$rc" = 0 ]; then
  echo "PASS: audit surface is exactly the expected residual - total=$T critical=$C high=$H moderate=$M low=$L."
  echo "      11 survivors need a semver-major bump (prisma@6.19.3 / puppeteer@25.10.0), deferred as foundation-class."
  echo "      1 survivor (esbuild) is upstream-blocked by tsup's ^0.27.0 pin."
  echo "      1 survivor (sanitize-html) is deliberately pinned to 2.17.5; 2.17.7 needs jest ESM support."
  echo "      See the EXPECT_* notes above for the full reasoning behind each exemption."
fi

[ -n "$TMP" ] && rm -f "$TMP"
exit "$rc"
