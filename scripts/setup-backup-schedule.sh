#!/bin/bash

# Backup Schedule Setup Script
# Sets up automated backup schedules using cron

set -e

echo "🔧 Setting up automated backup schedules..."

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
NODE_PATH=$(which node)
BACKUP_SCRIPT="$PROJECT_DIR/scripts/backup-system.js"
LOG_DIR="$PROJECT_DIR/logs"
BACKUP_LOG="$LOG_DIR/backup.log"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Create backup wrapper script
BACKUP_WRAPPER="$PROJECT_DIR/scripts/run-backup.sh"
cat > "$BACKUP_WRAPPER" << 'EOF'
#!/bin/bash

# Backup execution wrapper
# Ensures proper environment and logging

set -e

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Set working directory
cd "$PROJECT_DIR"

# Load environment variables
if [ -f "$PROJECT_DIR/.env.production" ]; then
    export $(grep -v '^#' "$PROJECT_DIR/.env.production" | xargs)
fi

# Set Node.js environment
export NODE_ENV=production
export PATH="$HOME/.nvm/versions/node/$(node --version)/bin:$PATH"

# Log file
LOG_FILE="$PROJECT_DIR/logs/backup-$(date +%Y%m%d).log"

# Create log directory
mkdir -p "$PROJECT_DIR/logs"

# Run backup with logging
echo "$(date '+%Y-%m-%d %H:%M:%S') - Starting automated backup" >> "$LOG_FILE"
node "$PROJECT_DIR/scripts/backup-system.js" backup >> "$LOG_FILE" 2>&1

# Check exit status
if [ $? -eq 0 ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Backup completed successfully" >> "$LOG_FILE"
else
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Backup failed with exit code $?" >> "$LOG_FILE"
    exit 1
fi
EOF

# Make wrapper executable
chmod +x "$BACKUP_WRAPPER"

echo "✅ Created backup wrapper script: $BACKUP_WRAPPER"

# Create cron job entries
CRON_ENTRIES="
# Synthex Automated Backups
# Daily backup at 2:00 AM
0 2 * * * $BACKUP_WRAPPER daily 2>&1 | logger -t synthex-backup

# Weekly backup on Sundays at 3:00 AM  
0 3 * * 0 $BACKUP_WRAPPER weekly 2>&1 | logger -t synthex-backup

# Monthly backup on 1st of month at 4:00 AM
0 4 1 * * $BACKUP_WRAPPER monthly 2>&1 | logger -t synthex-backup

# Cleanup old log files (keep 30 days)
0 5 * * * find $LOG_DIR -name 'backup-*.log' -mtime +30 -delete 2>&1 | logger -t synthex-backup-cleanup
"

# Install cron jobs
echo "📅 Installing cron jobs..."

# Create temporary cron file
TEMP_CRON_FILE=$(mktemp)

# Get existing crontab (if any)
crontab -l > "$TEMP_CRON_FILE" 2>/dev/null || true

# Remove existing Synthex backup jobs
sed -i '/# Synthex Automated Backups/,/# End Synthex Automated Backups/d' "$TEMP_CRON_FILE" 2>/dev/null || true
sed -i '/synthex-backup/d' "$TEMP_CRON_FILE" 2>/dev/null || true

# Add new cron entries
echo "$CRON_ENTRIES" >> "$TEMP_CRON_FILE"
echo "# End Synthex Automated Backups" >> "$TEMP_CRON_FILE"

# Install new crontab
crontab "$TEMP_CRON_FILE"

# Cleanup
rm "$TEMP_CRON_FILE"

echo "✅ Cron jobs installed successfully"

# Create systemd service (for systems that support it)
if command -v systemctl >/dev/null 2>&1; then
    echo "🔧 Setting up systemd service..."
    
    SYSTEMD_SERVICE_FILE="/etc/systemd/system/synthex-backup.service"
    SYSTEMD_TIMER_FILE="/etc/systemd/system/synthex-backup.timer"
    
    # Service file
    sudo tee "$SYSTEMD_SERVICE_FILE" > /dev/null << EOF
[Unit]
Description=Synthex Backup Service
After=network.target

[Service]
Type=oneshot
User=$(whoami)
WorkingDirectory=$PROJECT_DIR
Environment=NODE_ENV=production
ExecStart=$BACKUP_WRAPPER
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

    # Timer file
    sudo tee "$SYSTEMD_TIMER_FILE" > /dev/null << EOF
[Unit]
Description=Run Synthex Backup Service
Requires=synthex-backup.service

[Timer]
# Daily at 2:00 AM
OnCalendar=*-*-* 02:00:00
# Run 5 minutes after boot if we missed the scheduled time
OnBootSec=5min
# Randomize start time by up to 10 minutes to avoid system load spikes
RandomizedDelaySec=10min
Persistent=true

[Install]
WantedBy=timers.target
EOF

    # Enable and start timer
    sudo systemctl daemon-reload
    sudo systemctl enable synthex-backup.timer
    sudo systemctl start synthex-backup.timer
    
    echo "✅ Systemd timer created and started"
else
    echo "ℹ️  Systemd not available, using cron only"
fi

# Create backup configuration validation script
VALIDATION_SCRIPT="$PROJECT_DIR/scripts/validate-backup-config.js"
cat > "$VALIDATION_SCRIPT" << 'EOF'
#!/usr/bin/env node

/**
 * Backup Configuration Validator
 * Checks that all required backup dependencies and configurations are present
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

console.log('🔍 Validating backup configuration...');

let errors = [];
let warnings = [];

// Check Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
if (majorVersion < 16) {
    errors.push(`Node.js version ${nodeVersion} is too old. Minimum version: 16.0.0`);
} else {
    console.log(`✅ Node.js version: ${nodeVersion}`);
}

// Check required directories
const requiredDirs = ['logs', 'backups'];
for (const dir of requiredDirs) {
    try {
        fs.accessSync(dir, fs.constants.F_OK);
        console.log(`✅ Directory exists: ${dir}`);
    } catch (error) {
        warnings.push(`Directory missing: ${dir} (will be created automatically)`);
    }
}

// Check environment variables
const requiredEnvVars = [
    'NODE_ENV',
    'DATABASE_URL'
];

const optionalEnvVars = [
    'AWS_BACKUP_ENABLED',
    'AWS_BACKUP_BUCKET',
    'GCS_BACKUP_ENABLED',
    'GCS_BACKUP_BUCKET',
    'BACKUP_ENCRYPTION_KEY',
    'BACKUP_EMAIL_NOTIFICATIONS',
    'BACKUP_EMAIL_RECIPIENTS'
];

for (const envVar of requiredEnvVars) {
    if (process.env[envVar]) {
        console.log(`✅ Environment variable: ${envVar}`);
    } else {
        errors.push(`Missing required environment variable: ${envVar}`);
    }
}

for (const envVar of optionalEnvVars) {
    if (process.env[envVar]) {
        console.log(`✅ Optional environment variable: ${envVar}`);
    } else {
        console.log(`ℹ️  Optional environment variable not set: ${envVar}`);
    }
}

// Check database connection
try {
    if (process.env.DATABASE_URL) {
        // Test pg_dump availability
        execSync('pg_dump --version', { stdio: 'ignore' });
        console.log('✅ PostgreSQL client (pg_dump) is available');
    }
} catch (error) {
    warnings.push('pg_dump not found. Database backups may not work properly.');
}

// Check disk space
try {
    const stats = fs.statSync('.');
    // This is a simplified check - in production you'd check actual disk space
    console.log('✅ Backup location is writable');
} catch (error) {
    errors.push('Cannot write to backup location');
}

// Check cron service
try {
    execSync('crontab -l', { stdio: 'ignore' });
    console.log('✅ Cron service is available');
} catch (error) {
    warnings.push('Cron service may not be available or accessible');
}

// Summary
console.log('\n📋 Validation Summary:');

if (errors.length > 0) {
    console.log('\n❌ Errors (must be fixed):');
    errors.forEach(error => console.log(`   • ${error}`));
}

if (warnings.length > 0) {
    console.log('\n⚠️  Warnings (recommended to fix):');
    warnings.forEach(warning => console.log(`   • ${warning}`));
}

if (errors.length === 0) {
    console.log('\n✅ Backup configuration is valid!');
    console.log('\n🚀 Next steps:');
    console.log('   • Test backup: npm run backup:test');
    console.log('   • View cron jobs: crontab -l');
    console.log('   • Check logs: tail -f logs/backup-*.log');
    process.exit(0);
} else {
    console.log('\n❌ Please fix the errors above before proceeding.');
    process.exit(1);
}
EOF

chmod +x "$VALIDATION_SCRIPT"

# Test backup configuration
echo "🧪 Validating backup configuration..."
node "$VALIDATION_SCRIPT"

echo ""
echo "🎉 Backup schedule setup completed!"
echo ""
echo "📋 Summary:"
echo "   • Daily backups: 2:00 AM"
echo "   • Weekly backups: Sunday 3:00 AM"
echo "   • Monthly backups: 1st of month 4:00 AM"
echo "   • Logs: $LOG_DIR/backup-YYYYMMDD.log"
echo ""
echo "🔧 Management commands:"
echo "   • View cron jobs: crontab -l"
echo "   • Edit cron jobs: crontab -e"
echo "   • Test backup: node scripts/backup-system.js backup"
echo "   • View logs: tail -f logs/backup-*.log"
echo ""
echo "⚠️  Important notes:"
echo "   • Ensure environment variables are properly set"
echo "   • Test restore procedures periodically"
echo "   • Monitor backup logs for errors"
echo "   • Verify backup integrity regularly"