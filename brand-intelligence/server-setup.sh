#!/usr/bin/env bash
# Synthex Brand Intelligence Pipeline — VPS Server Provisioning
# UNI-1660
#
# Provisions an Ubuntu 22.04+ server for production pipeline execution.
# Run as root on a fresh DigitalOcean / Hetzner / Linode VPS (~$6/month).
#
# Usage (on the server):
#   git clone https://github.com/CleanExpo/Synthex.git /opt/synthex
#   sudo bash /opt/synthex/brand-intelligence/server-setup.sh
#
# After setup, complete the manual steps printed at the end.

set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────────────
SYNTHEX_USER="synthex"
REPO_URL="https://github.com/CleanExpo/Synthex.git"
REPO_DIR="/opt/synthex"
PIPELINE_DIR="${REPO_DIR}/brand-intelligence"
SYMLINK_DIR="/home/${SYNTHEX_USER}/brand-intelligence"
NODE_VERSION="22"
LOGROTATE_CONF="/etc/logrotate.d/synthex-pipeline"

echo "============================================================"
echo " Synthex Brand Intelligence — VPS Server Provisioning"
echo " Ubuntu 22.04+ | Node ${NODE_VERSION} | Python 3.11+"
echo " UNI-1660"
echo "============================================================"
echo ""

# ── Require root ───────────────────────────────────────────────────────────────
if [ "$(id -u)" -ne 0 ]; then
    echo "ERROR: This script must be run as root (or with sudo)"
    exit 1
fi

# ── Step 1: System packages ────────────────────────────────────────────────────
echo "[1/8] Installing system packages..."
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    git curl wget build-essential \
    python3.11 python3.11-venv python3.11-dev python3-pip \
    ca-certificates gnupg lsb-release \
    logrotate cron \
    libnss3 libnspr4 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
    libxfixes3 libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2

echo "  System packages installed."

# ── Step 2: Create synthex user ────────────────────────────────────────────────
echo "[2/8] Creating '${SYNTHEX_USER}' user..."
if id "${SYNTHEX_USER}" &>/dev/null; then
    echo "  User '${SYNTHEX_USER}' already exists."
else
    useradd --create-home --shell /bin/bash --system "${SYNTHEX_USER}"
    echo "  Created user: ${SYNTHEX_USER}"
fi

# ── Step 3: Install Node.js via nvm ───────────────────────────────────────────
echo "[3/8] Installing Node.js ${NODE_VERSION} (via nvm) for '${SYNTHEX_USER}'..."
su - "${SYNTHEX_USER}" -c "
    if [ ! -d \"\${HOME}/.nvm\" ]; then
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
    fi
    export NVM_DIR=\"\${HOME}/.nvm\"
    [ -s \"\${NVM_DIR}/nvm.sh\" ] && . \"\${NVM_DIR}/nvm.sh\"
    nvm install ${NODE_VERSION}
    nvm alias default ${NODE_VERSION}
    # Persist nvm in bashrc
    grep -q 'NVM_DIR' \"\${HOME}/.bashrc\" || cat >> \"\${HOME}/.bashrc\" << 'BASHRC'
export NVM_DIR=\"\$HOME/.nvm\"
[ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\"
[ -s \"\$NVM_DIR/bash_completion\" ] && . \"\$NVM_DIR/bash_completion\"
BASHRC
    node --version
    npm --version
"
echo "  Node.js installed."

# ── Step 4: Install Claude Code CLI ───────────────────────────────────────────
echo "[4/8] Installing Claude Code CLI..."
su - "${SYNTHEX_USER}" -c "
    export NVM_DIR=\"\${HOME}/.nvm\"
    [ -s \"\${NVM_DIR}/nvm.sh\" ] && . \"\${NVM_DIR}/nvm.sh\"
    npm install -g @anthropic-ai/claude-code
    echo \"  Claude Code: \$(claude --version 2>/dev/null || echo 'installed — auth required')\"
"

# ── Step 5: Clone/update repository ───────────────────────────────────────────
echo "[5/8] Cloning Synthex repository to ${REPO_DIR}..."
if [ -d "${REPO_DIR}/.git" ]; then
    echo "  Repository exists — pulling latest from main..."
    git -C "${REPO_DIR}" fetch origin
    git -C "${REPO_DIR}" reset --hard origin/main
else
    git clone "${REPO_URL}" "${REPO_DIR}"
fi
chown -R "${SYNTHEX_USER}:${SYNTHEX_USER}" "${REPO_DIR}"

# Symlink brand-intelligence into home dir for convenience
if [ ! -L "${SYMLINK_DIR}" ]; then
    su - "${SYNTHEX_USER}" -c "ln -sf ${PIPELINE_DIR} ${SYMLINK_DIR}"
fi
echo "  Repository ready at ${REPO_DIR}"

# ── Step 6: Python virtual environment + Playwright ───────────────────────────
echo "[6/8] Setting up Python 3.11 virtual environment..."
su - "${SYNTHEX_USER}" -c "
    python3.11 -m venv ${PIPELINE_DIR}/.venv
    ${PIPELINE_DIR}/.venv/bin/pip install --quiet --upgrade pip
    ${PIPELINE_DIR}/.venv/bin/pip install --quiet -e ${PIPELINE_DIR}
    echo '  Installing Playwright Chromium (headless)...'
    ${PIPELINE_DIR}/.venv/bin/python -m playwright install chromium
    echo '  Python environment ready.'
    ${PIPELINE_DIR}/.venv/bin/python --version
"
chown -R "${SYNTHEX_USER}:${SYNTHEX_USER}" "${PIPELINE_DIR}/.venv"

# ── Step 7: Install systemd service + timer ────────────────────────────────────
echo "[7/8] Installing systemd service and 6-hour timer..."

SYSTEMD_SERVICE="/etc/systemd/system/synthex-pipeline.service"
SYSTEMD_TIMER="/etc/systemd/system/synthex-pipeline.timer"

# Copy unit files and substitute real paths/user
cp "${PIPELINE_DIR}/systemd/synthex-pipeline.service" "${SYSTEMD_SERVICE}"
cp "${PIPELINE_DIR}/systemd/synthex-pipeline.timer" "${SYSTEMD_TIMER}"
sed -i "s|User=synthex|User=${SYNTHEX_USER}|g" "${SYSTEMD_SERVICE}"
sed -i "s|/home/synthex|/home/${SYNTHEX_USER}|g" "${SYSTEMD_SERVICE}"

systemctl daemon-reload
systemctl enable synthex-pipeline.timer
# Do NOT start the timer yet — needs ANTHROPIC_API_KEY first
echo "  Systemd timer installed and enabled (start manually after setting API key)."

# ── Step 8: Log rotation ───────────────────────────────────────────────────────
echo "[8/8] Configuring log rotation..."
cat > "${LOGROTATE_CONF}" << LOGROTATE
/home/${SYNTHEX_USER}/brand-intelligence/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
    su ${SYNTHEX_USER} ${SYNTHEX_USER}
}
LOGROTATE

mkdir -p "/home/${SYNTHEX_USER}/brand-intelligence/logs"
chown "${SYNTHEX_USER}:${SYNTHEX_USER}" "/home/${SYNTHEX_USER}/brand-intelligence/logs"
echo "  Log rotation configured."

# ── Summary ────────────────────────────────────────────────────────────────────
echo ""
echo "============================================================"
echo " Setup complete! Manual steps required before starting:"
echo "============================================================"
echo ""
echo "1. Set your Anthropic API key:"
echo "   sudo -u ${SYNTHEX_USER} bash -c '"
echo "     echo \"export ANTHROPIC_API_KEY=sk-ant-...\" >> ~/.synthex-env"
echo "     chmod 600 ~/.synthex-env"
echo "   '"
echo ""
echo "2. Authenticate Claude Code CLI:"
echo "   sudo -u ${SYNTHEX_USER} claude login"
echo ""
echo "3. Configure active clients:"
echo "   sudo -u ${SYNTHEX_USER} nano ${PIPELINE_DIR}/clients/active-clients.json"
echo ""
echo "4. Optional — Slack webhook for alerts:"
echo "   sudo -u ${SYNTHEX_USER} bash -c '"
echo "     echo \"export SLACK_WEBHOOK_URL=https://hooks.slack.com/...\" >> ~/.synthex-env"
echo "   '"
echo ""
echo "5. Test with a dry run:"
echo "   sudo -u ${SYNTHEX_USER} ${PIPELINE_DIR}/run-brand-pipeline.sh --dry-run"
echo ""
echo "6. If dry run passes, start the 6-hour timer:"
echo "   systemctl start synthex-pipeline.timer"
echo "   systemctl list-timers synthex-pipeline*"
echo ""
echo "7. Monitor the first live run:"
echo "   journalctl -u synthex-pipeline.service -f"
echo ""
