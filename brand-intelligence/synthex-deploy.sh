#!/usr/bin/env bash
# Synthex Brand Intelligence Pipeline — Server Deployment Script
# UNI-1661 / UNI-1660
#
# Sets up the Python environment and installs the 6-hour cron job.
# Run this on the deployment server (not locally).
#
# Usage:
#   chmod +x synthex-deploy.sh
#   ./synthex-deploy.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="${SCRIPT_DIR}/.venv"
CRON_LOG="${SCRIPT_DIR}/logs/cron.log"

echo "=== Synthex Brand Intelligence Pipeline — Deploy ==="
echo "Directory: ${SCRIPT_DIR}"
echo ""

# 1. Python environment
if [ ! -d "${VENV_DIR}" ]; then
    echo "[1/4] Creating Python virtual environment..."
    python3 -m venv "${VENV_DIR}"
else
    echo "[1/4] Virtual environment exists, skipping creation"
fi

echo "[2/4] Installing dependencies..."
"${VENV_DIR}/bin/pip" install --quiet --upgrade pip
"${VENV_DIR}/bin/pip" install --quiet -e "${SCRIPT_DIR}"

# 3. Ensure directories exist
echo "[3/4] Creating output directories..."
mkdir -p "${SCRIPT_DIR}/output"/{brand-profile,content,health,admin}
mkdir -p "${SCRIPT_DIR}/logs"

# 4. Install cron job (6-hour intervals: 00:00, 06:00, 12:00, 18:00)
echo "[4/4] Installing cron job..."

CRON_CMD="${VENV_DIR}/bin/python ${SCRIPT_DIR}/synthex_orchestrator.py --cron --verbose >> ${CRON_LOG} 2>&1"

# Remove existing Synthex cron entries, then add new ones
(crontab -l 2>/dev/null | grep -v "synthex_orchestrator.py") | crontab -

# Add 6-hour cron: 00:00, 06:00, 12:00, 18:00 UTC
(crontab -l 2>/dev/null; echo "0 0,6,12,18 * * * ${CRON_CMD}") | crontab -

echo ""
echo "=== Deployment complete ==="
echo "Cron schedule: every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)"
echo "Logs: ${CRON_LOG}"
echo ""
echo "Verify with: crontab -l | grep synthex"
echo "Test run:    ${VENV_DIR}/bin/python ${SCRIPT_DIR}/synthex_orchestrator.py --dry-run"
