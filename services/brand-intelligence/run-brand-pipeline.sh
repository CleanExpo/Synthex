#!/usr/bin/env bash
# Synthex Brand Intelligence Pipeline — Production Cron Wrapper
# UNI-1660
#
# Called every 6 hours by the system cron or systemd timer.
# Logs each run to logs/cron-YYYYMMDD-HHMMSS.log
#
# System cron setup (add via crontab -e):
#   0 0,6,12,18 * * * /home/synthex/brand-intelligence/run-brand-pipeline.sh >> /var/log/synthex-brand.log 2>&1
#
# Or use the systemd timer instead (preferred — survives reboots, logs to journald):
#   systemctl enable --now synthex-pipeline.timer

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="${SCRIPT_DIR}/.venv"
LOG_DIR="${SCRIPT_DIR}/logs"
RUN_ID="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="${LOG_DIR}/cron-${RUN_ID}.log"
DRY_RUN="${1:-}"

mkdir -p "${LOG_DIR}"

log() {
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" | tee -a "${LOG_FILE}"
}

# ── Source environment file if it exists ──────────────────────────────────────
# Set ANTHROPIC_API_KEY, SLACK_WEBHOOK_URL, and any other secrets in
# /home/synthex/.synthex-env (chmod 600, not committed to git).
ENV_FILE="${HOME}/.synthex-env"
if [ -f "${ENV_FILE}" ]; then
    # shellcheck disable=SC1090
    set -a && source "${ENV_FILE}" && set +a
fi

log "=== Synthex Brand Intelligence Pipeline — Run ${RUN_ID} ==="
log "Working directory: ${SCRIPT_DIR}"
log "PIPELINE_ENV: ${PIPELINE_ENV:-local}"

# ── Validate required environment ─────────────────────────────────────────────
if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
    log "ERROR: ANTHROPIC_API_KEY is not set. Aborting."
    log "Set it in ${ENV_FILE} or export it before running."
    exit 1
fi

# ── Select execution mode ──────────────────────────────────────────────────────
# Python orchestrator is the production path (budget caps, structured logging).
# Claude CLI is the fallback (requires claude binary in PATH and active auth).

EXIT_CODE=0

if [ "${DRY_RUN}" = "--dry-run" ]; then
    log "DRY RUN — validating pipeline without executing..."
    "${VENV_DIR}/bin/python" "${SCRIPT_DIR}/synthex_orchestrator.py" --dry-run --verbose 2>&1 | tee -a "${LOG_FILE}"
    EXIT_CODE=${PIPESTATUS[0]}

elif [ -f "${VENV_DIR}/bin/python" ]; then
    log "Launching Python orchestrator (production mode)..."
    "${VENV_DIR}/bin/python" "${SCRIPT_DIR}/synthex_orchestrator.py" --cron --verbose 2>&1 | tee -a "${LOG_FILE}"
    EXIT_CODE=${PIPESTATUS[0]}

elif command -v claude &>/dev/null; then
    log "Python venv not found — falling back to Claude Code CLI..."
    cd "${SCRIPT_DIR}"
    claude --dangerously-skip-permissions -p \
        "Run the Synthex brand intelligence 6-hour refresh. Read active-clients.json, research each client using Playwright headless browser, update brand profiles, log results to logs/." \
        2>&1 | tee -a "${LOG_FILE}"
    EXIT_CODE=${PIPESTATUS[0]}

else
    log "ERROR: Neither Python venv nor Claude CLI found. Run synthex-deploy.sh first."
    EXIT_CODE=1
fi

# ── Post-run reporting ─────────────────────────────────────────────────────────
if [ "${EXIT_CODE}" -eq 0 ]; then
    log "Pipeline completed successfully (exit ${EXIT_CODE})"
    STATUS_EMOJI="✅"
    STATUS_TEXT="succeeded"
else
    log "Pipeline FAILED (exit ${EXIT_CODE}) — check ${LOG_FILE}"
    STATUS_EMOJI="⚠️"
    STATUS_TEXT="FAILED (exit ${EXIT_CODE})"
fi

# ── Slack notification ─────────────────────────────────────────────────────────
# Notify on failure always; notify on success if SLACK_NOTIFY_SUCCESS=1
SHOULD_NOTIFY=0
if [ "${EXIT_CODE}" -ne 0 ]; then
    SHOULD_NOTIFY=1
elif [ "${SLACK_NOTIFY_SUCCESS:-0}" = "1" ]; then
    SHOULD_NOTIFY=1
fi

if [ "${SHOULD_NOTIFY}" -eq 1 ] && [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
    HOSTNAME_SAFE="$(hostname -s 2>/dev/null || echo 'server')"
    curl -s -X POST "${SLACK_WEBHOOK_URL}" \
        -H "Content-Type: application/json" \
        -d "{\"text\":\"${STATUS_EMOJI} Synthex brand pipeline ${STATUS_TEXT} on \`${HOSTNAME_SAFE}\` at $(date -u +%Y-%m-%dT%H:%M:%SZ) | Run: ${RUN_ID}\"}" \
        >/dev/null || log "WARN: Slack notification failed (non-fatal)"
fi

exit "${EXIT_CODE}"
