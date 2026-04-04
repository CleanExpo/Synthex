#!/usr/bin/env node
/**
 * Backup Verification Runner
 * Scheduled verification of all backups with reporting
 *
 * @task UNI-434
 *
 * Usage:
 *   node run-backup-verification.js              # Verify latest backups
 *   node run-backup-verification.js --all        # Verify all backups
 *   node run-backup-verification.js --path <p>   # Verify specific backup
 *   node run-backup-verification.js --schedule   # Run scheduled verification
 */

import fs from 'fs/promises';
import path from 'path';
import { BackupVerifier, verifyAllBackups } from './backup-verification.js';

const CONFIG = {
  backupDir: process.env.BACKUP_LOCAL_PATH || './backups',
  reportsDir: process.env.BACKUP_REPORTS_DIR || './reports/backup-verification',
  slackWebhook: process.env.BACKUP_SLACK_WEBHOOK,
  emailRecipients: (process.env.BACKUP_EMAIL_RECIPIENTS || '').split(',').filter(Boolean)
};

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    all: false,
    path: null,
    schedule: false,
    verbose: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--all':
      case '-a':
        options.all = true;
        break;
      case '--path':
      case '-p':
        options.path = args[++i];
        break;
      case '--schedule':
      case '-s':
        options.schedule = true;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
    }
  }

  return options;
}

/**
 * Get latest backup from each type
 */
async function getLatestBackups() {
  const backups = [];
  const types = ['daily', 'weekly', 'monthly'];

  for (const type of types) {
    const typeDir = path.join(CONFIG.backupDir, type);

    try {
      const entries = await fs.readdir(typeDir);
      const backupFiles = entries.filter(e =>
        e.startsWith('backup_') &&
        (e.endsWith('.tar.gz') || e.endsWith('.tar.gz.enc') || e.endsWith('.tar'))
      );

      if (backupFiles.length > 0) {
        backupFiles.sort().reverse();
        backups.push({
          type,
          path: path.join(typeDir, backupFiles[0]),
          name: backupFiles[0]
        });
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error(`Error reading ${type} backups:`, error.message);
      }
    }
  }

  return backups;
}

/**
 * Generate summary report
 */
function generateSummary(results) {
  const summary = {
    timestamp: new Date().toISOString(),
    totalBackups: results.length,
    passed: 0,
    failed: 0,
    warnings: 0,
    details: []
  };

  for (const result of results) {
    const status = result.report.overallStatus;

    if (status === 'passed') summary.passed++;
    else if (status === 'failed') summary.failed++;
    else if (status === 'warning') summary.warnings++;

    summary.details.push({
      type: result.type || 'unknown',
      path: result.report.backupPath,
      status: status,
      checks: {
        total: result.report.summary.total,
        passed: result.report.summary.passed,
        failed: result.report.summary.failed
      },
      duration: result.report.duration
    });
  }

  return summary;
}

/**
 * Send summary notification
 */
async function sendSummaryNotification(summary) {
  if (!CONFIG.slackWebhook) return;

  const emoji = summary.failed > 0 ? '❌' : summary.warnings > 0 ? '⚠️' : '✅';
  const color = summary.failed > 0 ? '#ff0000' : summary.warnings > 0 ? '#ffaa00' : '#00ff00';

  const payload = {
    text: `${emoji} Backup Verification Summary`,
    attachments: [{
      color,
      fields: [
        { title: 'Total Backups', value: summary.totalBackups.toString(), short: true },
        { title: 'Passed', value: summary.passed.toString(), short: true },
        { title: 'Failed', value: summary.failed.toString(), short: true },
        { title: 'Warnings', value: summary.warnings.toString(), short: true }
      ],
      footer: `Verification completed at ${summary.timestamp}`
    }]
  };

  // Add failed backup details
  if (summary.failed > 0) {
    const failedDetails = summary.details
      .filter(d => d.status === 'failed')
      .map(d => `• ${d.type}: ${d.path}`)
      .join('\n');

    payload.attachments.push({
      color: '#ff0000',
      title: 'Failed Backups',
      text: failedDetails
    });
  }

  try {
    await fetch(CONFIG.slackWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.error('Failed to send notification:', error.message);
  }
}

/**
 * Save summary to database
 */
async function saveSummaryToDatabase(summary) {
  // This would save to the system_backups table
  // For now, just save to file
  const summaryPath = path.join(CONFIG.reportsDir, `summary_${Date.now()}.json`);

  try {
    await fs.mkdir(CONFIG.reportsDir, { recursive: true });
    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`Summary saved: ${summaryPath}`);
  } catch (error) {
    console.error('Failed to save summary:', error.message);
  }
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
Backup Verification Runner

Usage:
  node run-backup-verification.js [options]

Options:
  --all, -a          Verify all backups (not just latest)
  --path, -p <path>  Verify specific backup file
  --schedule, -s     Run as scheduled job (for cron)
  --verbose, -v      Show detailed output
  --help, -h         Show this help message

Examples:
  node run-backup-verification.js
  node run-backup-verification.js --path ./backups/daily/backup_2024-01-15.tar.gz
  node run-backup-verification.js --all --verbose

Environment Variables:
  BACKUP_LOCAL_PATH         Base backup directory
  BACKUP_REPORTS_DIR        Reports output directory
  BACKUP_SLACK_WEBHOOK      Slack webhook for notifications
  BACKUP_EMAIL_RECIPIENTS   Comma-separated email addresses
  `);
}

/**
 * Main execution
 */
async function main() {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           BACKUP VERIFICATION RUNNER                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\nStarted at: ${new Date().toISOString()}\n`);

  const results = [];
  const verifier = new BackupVerifier();

  try {
    if (options.path) {
      // Verify specific backup
      console.log(`Verifying specific backup: ${options.path}\n`);
      const report = await verifier.verifyBackup(options.path);
      results.push({ type: 'manual', report });

    } else {
      // Verify latest backups
      const backups = await getLatestBackups();

      if (backups.length === 0) {
        console.log('No backups found to verify.');
        process.exit(0);
      }

      console.log(`Found ${backups.length} backup(s) to verify:\n`);
      backups.forEach(b => console.log(`  • ${b.type}: ${b.name}`));
      console.log('');

      for (const backup of backups) {
        console.log(`\n${'─'.repeat(60)}`);
        console.log(`Verifying ${backup.type} backup: ${backup.name}`);
        console.log('─'.repeat(60));

        const report = await verifier.verifyBackup(backup.path);
        results.push({ type: backup.type, report });
      }
    }

    // Generate and display summary
    const summary = generateSummary(results);

    console.log('\n' + '═'.repeat(60));
    console.log('VERIFICATION SUMMARY');
    console.log('═'.repeat(60));
    console.log(`\nTotal Backups Verified: ${summary.totalBackups}`);
    console.log(`  ✅ Passed:   ${summary.passed}`);
    console.log(`  ❌ Failed:   ${summary.failed}`);
    console.log(`  ⚠️  Warnings: ${summary.warnings}`);

    // Send notifications and save summary
    if (options.schedule || summary.failed > 0) {
      await sendSummaryNotification(summary);
    }
    await saveSummaryToDatabase(summary);

    // Exit with appropriate code
    const exitCode = summary.failed > 0 ? 1 : 0;
    console.log(`\nCompleted at: ${new Date().toISOString()}`);
    console.log(`Exit code: ${exitCode}`);
    process.exit(exitCode);

  } catch (error) {
    console.error('\nVerification runner error:', error);
    process.exit(1);
  }
}

// Run if called directly
main().catch(console.error);
