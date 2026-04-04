#!/usr/bin/env bash
# =============================================================================
# Scout — AI Provider Retirement Checker (UNI-1190)
#
# Reads .claude/provider-registry.json and reports any models approaching
# or past their retirement dates.
#
# Exit codes:
#   0  — all models OK (or no retirement dates defined)
#   1  — one or more models within the alert window (14 days by default)
#
# Usage:
#   bash .claude/skills/scout/run.sh
#   bash .claude/skills/scout/run.sh --window 30   # custom window in days
# =============================================================================

set -euo pipefail

REGISTRY=".claude/provider-registry.json"
WINDOW_DAYS=14
FOUND_WARNINGS=0

# Parse optional --window argument
while [[ $# -gt 0 ]]; do
  case "$1" in
    --window)
      WINDOW_DAYS="${2:-14}"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

# ── Colour helpers ──────────────────────────────────────────────────────────
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GREEN='\033[0;32m'
BOLD='\033[1m'
RESET='\033[0m'

echo ""
echo -e "${BOLD}${CYAN}🔭  Scout — AI Provider Registry Check${RESET}"
echo -e "   Registry: ${REGISTRY}"
echo -e "   Alert window: ${WINDOW_DAYS} days"
echo ""

# ── Validate registry exists ────────────────────────────────────────────────
if [[ ! -f "$REGISTRY" ]]; then
  echo -e "${RED}✗ Registry not found: ${REGISTRY}${RESET}"
  echo -e "  Run this from the Synthex project root directory."
  exit 1
fi

# ── Check required tools ────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo -e "${YELLOW}⚠  node not found — skipping retirement date check${RESET}"
  exit 0
fi

# ── Run retirement check via Node (no extra deps required) ──────────────────
node - "$REGISTRY" "$WINDOW_DAYS" <<'NODEEOF'
const fs   = require('fs');
const path = require('path');

const registryPath = process.argv[2];
const windowDays   = parseInt(process.argv[3], 10) || 14;
const today        = new Date();
today.setHours(0, 0, 0, 0);

// ── Colours (ANSI) ─────────────────────────────────────────────────────────
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE   = '\x1b[34m';
const GREEN  = '\x1b[32m';
const BOLD   = '\x1b[1m';
const RESET  = '\x1b[0m';

let registry;
try {
  registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
} catch (e) {
  console.error(`${RED}✗ Could not parse registry: ${e.message}${RESET}`);
  process.exit(1);
}

const models     = registry.models || {};
const providers  = Object.keys(models);
let warnCount    = 0;
let checkedCount = 0;

for (const provider of providers) {
  const config      = models[provider];
  const retirements = config.retirements || {};

  for (const [modelId, retireStr] of Object.entries(retirements)) {
    checkedCount++;
    const retireDate = new Date(retireStr);
    retireDate.setHours(0, 0, 0, 0);

    const diffMs   = retireDate - today;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    // Find which tier this model belongs to
    const tier = Object.entries(config)
      .find(([k, v]) => ['fast','balanced','advanced'].includes(k) && v === modelId)?.[0]
      ?? 'unknown tier';

    if (diffDays <= 0) {
      // Already retired
      console.log(`${RED}${BOLD}🔴 RETIRED${RESET}  ${BOLD}${provider}/${modelId}${RESET} (${tier})`);
      console.log(`   Retired: ${retireStr}  (${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} ago)`);
      console.log(`   ${YELLOW}Action: Update ${provider}-provider.ts ${tier} model immediately.${RESET}`);
      console.log('');
      warnCount++;

    } else if (diffDays <= windowDays) {
      // Within alert window
      const severity = diffDays <= 7 ? RED : YELLOW;
      const icon     = diffDays <= 7 ? '🔴 CRITICAL' : '🟡 WARNING ';
      console.log(`${severity}${BOLD}${icon}${RESET}  ${BOLD}${provider}/${modelId}${RESET} (${tier})`);
      console.log(`   Retiring: ${retireStr}  (${diffDays} day${diffDays !== 1 ? 's' : ''} remaining)`);
      console.log(`   ${YELLOW}Action: Schedule update to ${provider}-provider.ts ${tier} preset.${RESET}`);
      console.log('');
      warnCount++;

    } else if (diffDays <= 30) {
      // On the horizon — info only
      console.log(`${BLUE}🔵 INFO     ${RESET} ${BOLD}${provider}/${modelId}${RESET} (${tier})`);
      console.log(`   Retiring: ${retireStr}  (${diffDays} days remaining — plan migration)`);
      console.log('');
    }
  }
}

// ── Summary ─────────────────────────────────────────────────────────────────
if (checkedCount === 0) {
  console.log(`${GREEN}✅  No retirement dates defined in registry.${RESET}`);
} else if (warnCount === 0) {
  console.log(`${GREEN}✅  All ${checkedCount} model${checkedCount !== 1 ? 's' : ''} checked — no retirements within ${windowDays} days.${RESET}`);
} else {
  console.log(`${RED}${BOLD}⚠  ${warnCount} model retirement warning${warnCount !== 1 ? 's' : ''} found.${RESET}`);
  console.log(`   Update model presets in lib/ai/providers/ and .claude/provider-registry.json.`);
}

console.log('');

// Exit 1 if warnings found (allows CI to catch issues)
process.exit(warnCount > 0 ? 1 : 0);
NODEEOF
