#!/usr/bin/env bash
# Synthex Pipeline Health Monitor
# UNI-1660
#
# Checks that the pipeline ran successfully within the last 7 hours
# (6-hour schedule + 1-hour tolerance for startup jitter).
#
# Usage:
#   ./monitoring/healthcheck.sh              # Exit 0 = healthy, 1 = unhealthy
#   ./monitoring/healthcheck.sh --slack      # + notify Slack on unhealthy
#   ./monitoring/healthcheck.sh --json       # Output JSON status
#
# Suggested cron (every 30 minutes):
#   */30 * * * * /home/synthex/brand-intelligence/monitoring/healthcheck.sh --slack
#
# Or trigger from systemd OnFailure:
#   OnFailure=synthex-pipeline-alert@%n.service

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${SCRIPT_DIR}/logs"
MAX_AGE_SECONDS=$((7 * 3600))  # 7 hours
SLACK_FLAG="${1:-}"
JSON_FLAG="${2:-}"

# Source env for SLACK_WEBHOOK_URL
ENV_FILE="${HOME}/.synthex-env"
if [ -f "${ENV_FILE}" ]; then
    # shellcheck disable=SC1090
    set -a && source "${ENV_FILE}" && set +a
fi

# ── Find latest cron log ───────────────────────────────────────────────────────
latest_log=""
if [ -d "${LOG_DIR}" ]; then
    latest_log=$(ls -t "${LOG_DIR}"/cron-*.log 2>/dev/null | head -1 || true)
fi

STATUS="unknown"
DETAIL=""
EXIT_CODE=0

if [ -z "${latest_log}" ]; then
    STATUS="no_logs"
    DETAIL="No cron logs found in ${LOG_DIR}. Pipeline may not have run yet."
    EXIT_CODE=1
else
    LOG_MTIME=$(date -r "${latest_log}" +%s 2>/dev/null || stat -c %Y "${latest_log}")
    NOW=$(date +%s)
    AGE_SECONDS=$(( NOW - LOG_MTIME ))
    AGE_HUMAN="$(( AGE_SECONDS / 3600 ))h $(( (AGE_SECONDS % 3600) / 60 ))m"

    if [ "${AGE_SECONDS}" -gt "${MAX_AGE_SECONDS}" ]; then
        STATUS="stale"
        DETAIL="Last run was ${AGE_HUMAN} ago (threshold: 7h). Pipeline may be stuck."
        EXIT_CODE=1
    elif grep -qE "Pipeline completed successfully|exit 0" "${latest_log}" 2>/dev/null; then
        STATUS="healthy"
        DETAIL="Last successful run: ${AGE_HUMAN} ago ($(basename "${latest_log}"))"
        EXIT_CODE=0
    elif grep -qE "Pipeline FAILED|exit [^0]" "${latest_log}" 2>/dev/null; then
        STATUS="failed"
        DETAIL="Last run failed ${AGE_HUMAN} ago. See: ${latest_log}"
        EXIT_CODE=1
    else
        STATUS="unknown"
        DETAIL="Could not determine last run status. See: ${latest_log}"
        EXIT_CODE=1
    fi
fi

# ── Output ─────────────────────────────────────────────────────────────────────
TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
HOSTNAME_SAFE="$(hostname -s 2>/dev/null || echo 'server')"

if [ "${JSON_FLAG}" = "--json" ] || [ "${SLACK_FLAG}" = "--json" ]; then
    printf '{"status":"%s","detail":"%s","host":"%s","timestamp":"%s","exit":%d}\n' \
        "${STATUS}" "${DETAIL}" "${HOSTNAME_SAFE}" "${TIMESTAMP}" "${EXIT_CODE}"
else
    if [ "${EXIT_CODE}" -eq 0 ]; then
        echo "[${TIMESTAMP}] OK: ${DETAIL}"
    else
        echo "[${TIMESTAMP}] WARN: ${DETAIL}" >&2
    fi
fi

# ── Slack notification on unhealthy ───────────────────────────────────────────
if [ "${EXIT_CODE}" -ne 0 ] && { [ "${SLACK_FLAG}" = "--slack" ] || [ "${JSON_FLAG}" = "--slack" ]; }; then
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        curl -s -X POST "${SLACK_WEBHOOK_URL}" \
            -H "Content-Type: application/json" \
            -d "{\"text\":\"🚨 Synthex pipeline health check: *${STATUS}* on \`${HOSTNAME_SAFE}\`\\n${DETAIL}\"}" \
            >/dev/null || true
    fi
fi

exit "${EXIT_CODE}"
