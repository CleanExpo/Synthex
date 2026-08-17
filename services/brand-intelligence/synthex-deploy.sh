#!/usr/bin/env bash
# Synthex Brand Intelligence Pipeline — Server Deployment Script
# UNI-1661 / UNI-1660
#
# Sets up the Python environment and installs the 6-hour cron job.
# Run this on the deployment server (not locally).
#
# Usage:
#   chmod +x synthex-deploy.sh
#   ./synthex-deploy.sh            # cron mode (default)
#   ./synthex-deploy.sh --systemd  # systemd timer mode (preferred for production)
#
# For full VPS provisioning from scratch, use server-setup.sh instead.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="${SCRIPT_DIR}/.venv"
CRON_LOG="${SCRIPT_DIR}/logs/cron.log"
DEPLOY_MODE="${1:-cron}"  # cron | systemd

echo "=== Synthex Brand Intelligence Pipeline — Deploy (${DEPLOY_MODE} mode) ==="
echo "Directory: ${SCRIPT_DIR}"
echo ""

# 1. Python environment
if [ ! -d "${VENV_DIR}" ]; then
    echo "[1/5] Creating Python virtual environment..."
    python3 -m venv "${VENV_DIR}"
else
    echo "[1/5] Virtual environment exists, skipping creation"
fi

echo "[2/5] Installing dependencies..."
"${VENV_DIR}/bin/pip" install --quiet --upgrade pip
"${VENV_DIR}/bin/pip" install --quiet -e "${SCRIPT_DIR}"

echo "[3/5] Installing Playwright Chromium (headless browser)..."
"${VENV_DIR}/bin/python" -m playwright install chromium

# 4. Ensure directories exist
echo "[4/5] Creating output directories..."
mkdir -p "${SCRIPT_DIR}/output"/{brand-profile,content,health,admin}
mkdir -p "${SCRIPT_DIR}/logs"

# 5. Install scheduler
echo "[5/5] Installing 6-hour scheduler (${DEPLOY_MODE})..."

if [ "${DEPLOY_MODE}" = "--systemd" ] || [ "${DEPLOY_MODE}" = "systemd" ]; then
    # systemd mode: preferred for production (journal logging, persistent, reboot-safe)
    if [ "$(id -u)" -ne 0 ]; then
        echo "ERROR: systemd install requires root. Run: sudo bash synthex-deploy.sh --systemd"
        exit 1
    fi
    SYSTEMD_SRC="${SCRIPT_DIR}/systemd"
    cp "${SYSTEMD_SRC}/synthex-pipeline.service" /etc/systemd/system/
    cp "${SYSTEMD_SRC}/synthex-pipeline.timer" /etc/systemd/system/
    # Substitute actual paths
    sed -i "s|/home/synthex|$(getent passwd synthex | cut -d: -f6 2>/dev/null || echo /home/synthex)|g" \
        /etc/systemd/system/synthex-pipeline.service
    systemctl daemon-reload
    systemctl enable synthex-pipeline.timer
    systemctl start synthex-pipeline.timer
    echo ""
    echo "=== Deployment complete (systemd mode) ==="
    echo "Timer schedule: every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)"
    echo ""
    echo "Status:  systemctl status synthex-pipeline.timer"
    echo "Timers:  systemctl list-timers synthex-pipeline*"
    echo "Logs:    journalctl -u synthex-pipeline.service -f"
    echo "Test:    sudo -u synthex ${SCRIPT_DIR}/run-brand-pipeline.sh --dry-run"
else
    # cron mode: simpler, works on any system without systemd
    WRAPPER="${SCRIPT_DIR}/run-brand-pipeline.sh"
    chmod +x "${WRAPPER}"
    CRON_CMD="${WRAPPER} >> ${CRON_LOG} 2>&1"
    # Remove existing Synthex cron entries, then add fresh entry
    (crontab -l 2>/dev/null | grep -v "run-brand-pipeline.sh\|synthex_orchestrator.py") | crontab -
    (crontab -l 2>/dev/null; echo "0 0,6,12,18 * * * ${CRON_CMD}") | crontab -
    echo ""
    echo "=== Deployment complete (cron mode) ==="
    echo "Cron schedule: every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)"
    echo "Logs: ${CRON_LOG}"
    echo ""
    echo "Verify:  crontab -l | grep synthex"
    echo "Test:    ${SCRIPT_DIR}/run-brand-pipeline.sh --dry-run"
fi
