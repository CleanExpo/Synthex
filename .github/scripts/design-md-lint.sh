#!/usr/bin/env bash
# DESIGN.md lint — v1 (shell). Run on every PR.
# Asserts the .claude/DESIGN.md contract per Google DESIGN.md spec v1.
# Swap to `npx design-md lint` once google-labs-code/design.md publishes.
set -euo pipefail

DESIGN_FILE=".claude/DESIGN.md"
FAIL=0

red()  { printf "\033[31m%s\033[0m\n" "$*"; }
grn()  { printf "\033[32m%s\033[0m\n" "$*"; }
ylw()  { printf "\033[33m%s\033[0m\n" "$*"; }

# 1. File must exist
if [[ ! -f "$DESIGN_FILE" ]]; then
  red "FAIL: $DESIGN_FILE does not exist."
  red "Every portfolio repo must have a .claude/DESIGN.md per the design-system-adoption mandate."
  exit 1
fi
grn "OK: $DESIGN_FILE present."

# 2. Required H2 headings
REQUIRED_HEADINGS=(
  "## Brand Voice"
  "## Visual Tokens"
  "## Forbidden Patterns"
  "## Required Patterns"
  "## Approval Gates"
  "## CI Lint Integration"
)
for h in "${REQUIRED_HEADINGS[@]}"; do
  if ! grep -qF "$h" "$DESIGN_FILE"; then
    red "FAIL: missing required heading '$h' in $DESIGN_FILE"
    FAIL=1
  fi
done
[[ $FAIL -eq 0 ]] && grn "OK: all 6 required H2 headings present."

# 3. No Lucide / HeroIcons / FontAwesome imports in app code (Phill Rule 1)
ICON_LIB_REGEX='from .lucide-react.|from .@heroicons/react|from .@fortawesome/'
SRC_DIRS=(src app components packages apps)
ICON_HITS=""
for d in "${SRC_DIRS[@]}"; do
  if [[ -d "$d" ]]; then
    hits=$(grep -RInE "$ICON_LIB_REGEX" "$d" \
      --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' \
      2>/dev/null || true)
    [[ -n "$hits" ]] && ICON_HITS+="$hits"$'\n'
  fi
done
# Net-new violations: count Lucide imports vs baseline.
# Baseline is recorded in .github/design-md-lint.baseline.txt — the count of
# files importing the forbidden libs at the time the lint was introduced.
# v1 is report-only when count <= baseline; PR fails only when count grows.
ICON_FILE_COUNT=0
if [[ -n "$ICON_HITS" ]]; then
  ICON_FILE_COUNT=$(printf '%s\n' "$ICON_HITS" | grep -c ':' || true)
fi
BASELINE_FILE=".github/design-md-lint.baseline.txt"
BASELINE_ICONS=0
if [[ -f "$BASELINE_FILE" ]]; then
  BASELINE_ICONS=$(grep -E '^icon_imports=' "$BASELINE_FILE" | cut -d= -f2 || echo 0)
fi
if [[ "$ICON_FILE_COUNT" -gt "$BASELINE_ICONS" ]]; then
  red "FAIL: net-new generic icon-library imports (Phill Rule 1)."
  red "Baseline: $BASELINE_ICONS occurrences. Current: $ICON_FILE_COUNT. Net-new: $((ICON_FILE_COUNT - BASELINE_ICONS))."
  printf '%s\n' "$ICON_HITS"
  red "Replace with a custom geometric mark from src/components/ui/marks.tsx (24x24, 1.5px stroke, sharp corners)."
  FAIL=1
elif [[ "$ICON_FILE_COUNT" -gt 0 ]]; then
  ylw "WARN: $ICON_FILE_COUNT existing icon-library imports (within baseline of $BASELINE_ICONS)."
  ylw "Migrate to src/components/ui/marks.tsx and lower the baseline. Phill Rule 1."
else
  grn "OK: no forbidden icon-library imports."
fi

# 4. AI-slop phrase scan (brand-guardian global banned list)
# Scans tracked .md, .mdx and string literals in code, EXCLUDING this DESIGN.md
# itself and brand-guardian reference docs which legitimately quote the list.
SLOP_PHRASES=(
  "in today's fast-paced world"
  "in today's competitive landscape"
  "game-changer"
  "game-changing"
  "cutting-edge"
  "state-of-the-art"
  "best-in-class"
  "our passionate team"
  "end-to-end solution"
)
SLOP_HITS=""
for phrase in "${SLOP_PHRASES[@]}"; do
  hits=$(grep -RIin --include='*.md' --include='*.mdx' --include='*.tsx' --include='*.ts' \
    --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist --exclude-dir=.git \
    --exclude="DESIGN.md" \
    "$phrase" . 2>/dev/null \
    | grep -v "skills/brand-guardian" \
    | grep -v "feedback_design_preferences" \
    || true)
  [[ -n "$hits" ]] && SLOP_HITS+="[$phrase]"$'\n'"$hits"$'\n'
done
if [[ -n "$SLOP_HITS" ]]; then
  ylw "WARN: AI-slop phrases detected (brand-guardian banned list)."
  printf '%s\n' "$SLOP_HITS"
  ylw "Review and rewrite before client-facing publication. Non-blocking in v1; promote to FAIL after grace period."
fi

if [[ $FAIL -ne 0 ]]; then
  red "DESIGN.md lint FAILED — $FAIL category(ies)."
  exit 1
fi

grn "DESIGN.md lint passed."
