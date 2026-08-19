#!/usr/bin/env bash
set -euo pipefail

# Usage: scripts/handoff-loop.sh [--quick|--full]
MODE="${1:---quick}"
TS="$(date +%Y%m%d-%H%M%S)"
LOG_PATH=".handoff-logs/handoff-${TS}.log"
REPORT_PATH="docs/session-handoffs/handoff-${TS}.md"
mkdir -p .handoff-logs docs/session-handoffs

run_step() {
  local name="$1"
  shift
  echo "## ${name}" | tee -a "$LOG_PATH"
  {
    if "$@" 2>&1; then
      echo "${name}: PASS"
    else
      echo "${name}: FAIL"
      return 1
    fi
  } | tee -a "$LOG_PATH"
}

{
  echo "# handoff ${TS}"
  echo "Mode: ${MODE}"
  echo "date: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "branch: $(git rev-parse --abbrev-ref HEAD)"
  echo "status_exit:"
  git status --short
  echo
  run_step "type-check" npm run type-check
  run_step "lint" npm run lint
  run_step "test" npm run test -- --runInBand
  run_step "build" npm run build
  echo "control_module:"
  node -e "const fs=require('fs'); const ok=fs.existsSync('node_modules/@unite-group/control-module/package.json'); console.log(ok?'present':'missing')"
  echo "node_modules_next:"
  node -e "const fs=require('fs'); const ok=fs.existsSync('node_modules/next/package.json'); console.log(ok?'present':'missing')"
  echo "node_modules_prisma_client:"
  node -e "const fs=require('fs'); const ok=fs.existsSync('node_modules/@prisma/client/package.json'); console.log(ok?'present':'missing')"
} > "$REPORT_PATH"

# Ensure all step outputs are captured
cp "$REPORT_PATH" "$LOG_PATH".tmp 2>/dev/null || true
cp "$REPORT_PATH" "$LOG_PATH"

cat "$LOG_PATH"

echo "handoff complete"