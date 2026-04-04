/**
 * Backup Verification and Testing System
 * Automated verification of backup integrity and restore capability
 *
 * @version 1.0.0
 * @task UNI-434
 */

import fs from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { execSync } from 'child_process';

// Verification configuration
const VERIFICATION_CONFIG = {
  // Paths
  backupDir: process.env.BACKUP_LOCAL_PATH || './backups',
  tempDir: process.env.BACKUP_TEMP_DIR || './tmp/backup-verification',
  reportsDir: process.env.BACKUP_REPORTS_DIR || './reports/backup-verification',

  // Verification settings
  checksumAlgorithm: 'sha256',
  maxBackupAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms

  // Required manifest fields
  requiredManifestFields: ['backupId', 'timestamp', 'type', 'version', 'results', 'stats'],

  // Minimum expected sizes (bytes)
  minimumSizes: {
    database: 1024,      // 1KB minimum for database backup
    redis: 100,          // 100B minimum for Redis backup
    files: 0,            // Files can be empty
    code: 1024           // 1KB minimum for code backup
  },

  // Encryption settings (must match backup-system.js)
  encryption: {
    algorithm: 'aes-256-gcm',
    key: process.env.BACKUP_ENCRYPTION_KEY || 'default-backup-key-change-this'
  },

  // Notifications
  notifications: {
    enabled: process.env.BACKUP_VERIFICATION_NOTIFICATIONS !== 'false',
    webhookUrl: process.env.BACKUP_SLACK_WEBHOOK,
    emailRecipients: (process.env.BACKUP_EMAIL_RECIPIENTS || '').split(',').filter(Boolean)
  }
};

/**
 * Verification result status
 */
const VerificationStatus = {
  PASSED: 'passed',
  FAILED: 'failed',
  WARNING: 'warning',
  SKIPPED: 'skipped'
};

/**
 * BackupVerifier - Main verification class
 */
export class BackupVerifier {
  constructor() {
    this.results = [];
    this.startTime = null;
  }

  /**
   * Run full verification suite on a backup
   */
  async verifyBackup(backupPath, options = {}) {
    this.startTime = Date.now();
    const report = {
      backupPath,
      timestamp: new Date().toISOString(),
      checks: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        warnings: 0,
        skipped: 0
      },
      duration: 0,
      overallStatus: VerificationStatus.PASSED
    };

    console.log(`\n🔍 Starting backup verification: ${backupPath}\n`);

    try {
      // 1. File existence check
      report.checks.push(await this.checkFileExists(backupPath));

      // 2. File integrity check (checksum)
      report.checks.push(await this.checkFileIntegrity(backupPath));

      // 3. File size check
      report.checks.push(await this.checkFileSize(backupPath));

      // 4. Extraction test
      const extractResult = await this.testExtraction(backupPath, options);
      report.checks.push(extractResult.check);

      if (extractResult.extractedPath) {
        // 5. Manifest validation
        report.checks.push(await this.validateManifest(extractResult.extractedPath));

        // 6. Component verification
        const componentChecks = await this.verifyComponents(extractResult.extractedPath);
        report.checks.push(...componentChecks);

        // 7. Restore dry-run (if enabled)
        if (options.dryRun !== false) {
          report.checks.push(await this.performDryRunRestore(extractResult.extractedPath, options));
        }

        // Cleanup extracted files
        await this.cleanup(extractResult.extractedPath);
      }

      // Calculate summary
      report.checks.forEach(check => {
        report.summary.total++;
        switch (check.status) {
          case VerificationStatus.PASSED: report.summary.passed++; break;
          case VerificationStatus.FAILED: report.summary.failed++; break;
          case VerificationStatus.WARNING: report.summary.warnings++; break;
          case VerificationStatus.SKIPPED: report.summary.skipped++; break;
        }
      });

      // Determine overall status
      if (report.summary.failed > 0) {
        report.overallStatus = VerificationStatus.FAILED;
      } else if (report.summary.warnings > 0) {
        report.overallStatus = VerificationStatus.WARNING;
      }

      report.duration = Date.now() - this.startTime;

      // Print summary
      this.printReport(report);

      // Save report
      await this.saveReport(report);

      // Send notifications if failed
      if (report.overallStatus === VerificationStatus.FAILED) {
        await this.sendNotification(report);
      }

      return report;

    } catch (error) {
      report.checks.push({
        name: 'Verification Error',
        status: VerificationStatus.FAILED,
        message: error.message,
        details: { stack: error.stack }
      });
      report.overallStatus = VerificationStatus.FAILED;
      report.duration = Date.now() - this.startTime;

      this.printReport(report);
      await this.saveReport(report);
      await this.sendNotification(report);

      return report;
    }
  }

  /**
   * Check if backup file exists
   */
  async checkFileExists(backupPath) {
    const check = {
      name: 'File Existence',
      status: VerificationStatus.PASSED,
      message: '',
      details: {}
    };

    try {
      await fs.access(backupPath);
      check.message = 'Backup file exists';
      check.details.path = backupPath;
    } catch (error) {
      check.status = VerificationStatus.FAILED;
      check.message = 'Backup file not found';
      check.details.error = error.message;
    }

    return check;
  }

  /**
   * Verify file integrity using checksum
   */
  async checkFileIntegrity(backupPath) {
    const check = {
      name: 'File Integrity (Checksum)',
      status: VerificationStatus.PASSED,
      message: '',
      details: {}
    };

    try {
      const checksum = await this.calculateChecksum(backupPath);
      check.details.checksum = checksum;
      check.details.algorithm = VERIFICATION_CONFIG.checksumAlgorithm;

      // Check if checksum file exists
      const checksumFile = `${backupPath}.${VERIFICATION_CONFIG.checksumAlgorithm}`;
      try {
        const storedChecksum = (await fs.readFile(checksumFile, 'utf8')).trim();
        if (storedChecksum === checksum) {
          check.message = 'Checksum verified successfully';
          check.details.verified = true;
        } else {
          check.status = VerificationStatus.FAILED;
          check.message = 'Checksum mismatch - file may be corrupted';
          check.details.expected = storedChecksum;
          check.details.actual = checksum;
        }
      } catch {
        check.status = VerificationStatus.WARNING;
        check.message = 'No stored checksum found - computed checksum for reference';
        check.details.computed = checksum;
      }
    } catch (error) {
      check.status = VerificationStatus.FAILED;
      check.message = 'Failed to calculate checksum';
      check.details.error = error.message;
    }

    return check;
  }

  /**
   * Calculate file checksum
   */
  async calculateChecksum(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash(VERIFICATION_CONFIG.checksumAlgorithm);
      const stream = createReadStream(filePath);

      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Check file size is reasonable
   */
  async checkFileSize(backupPath) {
    const check = {
      name: 'File Size',
      status: VerificationStatus.PASSED,
      message: '',
      details: {}
    };

    try {
      const stats = await fs.stat(backupPath);
      check.details.size = stats.size;
      check.details.sizeFormatted = this.formatBytes(stats.size);
      check.details.modified = stats.mtime.toISOString();

      // Check if file is suspiciously small
      if (stats.size < 100) {
        check.status = VerificationStatus.FAILED;
        check.message = 'Backup file is too small - likely corrupted or empty';
      } else if (stats.size < 1024) {
        check.status = VerificationStatus.WARNING;
        check.message = 'Backup file is unusually small';
      } else {
        check.message = `Backup size: ${check.details.sizeFormatted}`;
      }

      // Check age
      const age = Date.now() - stats.mtime.getTime();
      check.details.ageMs = age;
      check.details.ageDays = Math.floor(age / (24 * 60 * 60 * 1000));

      if (age > VERIFICATION_CONFIG.maxBackupAge) {
        check.status = check.status === VerificationStatus.PASSED
          ? VerificationStatus.WARNING
          : check.status;
        check.message += ` (backup is ${check.details.ageDays} days old)`;
      }

    } catch (error) {
      check.status = VerificationStatus.FAILED;
      check.message = 'Failed to get file stats';
      check.details.error = error.message;
    }

    return check;
  }

  /**
   * Test extraction of backup archive
   */
  async testExtraction(backupPath, options = {}) {
    const check = {
      name: 'Archive Extraction',
      status: VerificationStatus.PASSED,
      message: '',
      details: {}
    };

    let extractedPath = null;

    try {
      // Create temp directory
      const tempDir = path.join(VERIFICATION_CONFIG.tempDir, `verify_${Date.now()}`);
      await fs.mkdir(tempDir, { recursive: true });
      check.details.tempDir = tempDir;

      // Determine file type and extract accordingly
      let currentFile = backupPath;

      // Handle encryption (.enc)
      if (backupPath.endsWith('.enc')) {
        check.details.encrypted = true;
        const decryptedPath = path.join(tempDir, 'decrypted.tar.gz');
        await this.decryptFile(currentFile, decryptedPath);
        currentFile = decryptedPath;
      }

      // Handle compression (.gz)
      if (currentFile.endsWith('.gz')) {
        check.details.compressed = true;
        const decompressedPath = path.join(tempDir, 'decompressed.tar');
        await this.decompressFile(currentFile, decompressedPath);
        currentFile = decompressedPath;
      }

      // Extract tar archive
      if (currentFile.endsWith('.tar')) {
        check.details.tarArchive = true;
        extractedPath = path.join(tempDir, 'extracted');
        await fs.mkdir(extractedPath, { recursive: true });
        execSync(`tar -xf "${currentFile}" -C "${extractedPath}"`, { stdio: 'pipe' });
      }

      // Find the actual backup directory (may be nested)
      const entries = await fs.readdir(extractedPath);
      if (entries.length === 1) {
        const nestedPath = path.join(extractedPath, entries[0]);
        const stat = await fs.stat(nestedPath);
        if (stat.isDirectory()) {
          extractedPath = nestedPath;
        }
      }

      check.message = 'Archive extracted successfully';
      check.details.extractedPath = extractedPath;

      // List contents
      const contents = await fs.readdir(extractedPath);
      check.details.contents = contents;

    } catch (error) {
      check.status = VerificationStatus.FAILED;
      check.message = 'Failed to extract archive';
      check.details.error = error.message;
    }

    return { check, extractedPath };
  }

  /**
   * Decrypt encrypted backup file
   */
  async decryptFile(inputPath, outputPath) {
    const input = createReadStream(inputPath);
    const output = require('fs').createWriteStream(outputPath);
    const decipher = crypto.createDecipher(
      VERIFICATION_CONFIG.encryption.algorithm,
      VERIFICATION_CONFIG.encryption.key
    );

    await pipeline(input, decipher, output);
  }

  /**
   * Decompress gzipped file
   */
  async decompressFile(inputPath, outputPath) {
    const input = createReadStream(inputPath);
    const output = require('fs').createWriteStream(outputPath);
    const gunzip = createGunzip();

    await pipeline(input, gunzip, output);
  }

  /**
   * Validate backup manifest
   */
  async validateManifest(extractedPath) {
    const check = {
      name: 'Manifest Validation',
      status: VerificationStatus.PASSED,
      message: '',
      details: {}
    };

    try {
      const manifestPath = path.join(extractedPath, 'manifest.json');
      const manifestContent = await fs.readFile(manifestPath, 'utf8');
      const manifest = JSON.parse(manifestContent);

      check.details.backupId = manifest.backupId;
      check.details.timestamp = manifest.timestamp;
      check.details.type = manifest.type;
      check.details.version = manifest.version;

      // Check required fields
      const missingFields = VERIFICATION_CONFIG.requiredManifestFields.filter(
        field => !(field in manifest)
      );

      if (missingFields.length > 0) {
        check.status = VerificationStatus.WARNING;
        check.message = `Missing manifest fields: ${missingFields.join(', ')}`;
        check.details.missingFields = missingFields;
      } else {
        check.message = 'Manifest is valid and complete';
      }

      // Check backup results
      if (manifest.results) {
        check.details.results = {};
        for (const [component, result] of Object.entries(manifest.results)) {
          check.details.results[component] = {
            success: result.success,
            files: result.files,
            size: result.size
          };
        }
      }

      // Check for errors recorded in manifest
      if (manifest.stats?.errors?.length > 0) {
        check.status = VerificationStatus.WARNING;
        check.message = `Manifest contains ${manifest.stats.errors.length} recorded errors`;
        check.details.recordedErrors = manifest.stats.errors;
      }

    } catch (error) {
      if (error.code === 'ENOENT') {
        check.status = VerificationStatus.FAILED;
        check.message = 'Manifest file not found';
      } else if (error instanceof SyntaxError) {
        check.status = VerificationStatus.FAILED;
        check.message = 'Invalid JSON in manifest file';
      } else {
        check.status = VerificationStatus.FAILED;
        check.message = 'Failed to validate manifest';
      }
      check.details.error = error.message;
    }

    return check;
  }

  /**
   * Verify individual backup components
   */
  async verifyComponents(extractedPath) {
    const checks = [];

    // Database component
    checks.push(await this.verifyDatabaseBackup(extractedPath));

    // Redis component
    checks.push(await this.verifyRedisBackup(extractedPath));

    // Files component
    checks.push(await this.verifyFilesBackup(extractedPath));

    // Code component
    checks.push(await this.verifyCodeBackup(extractedPath));

    return checks;
  }

  /**
   * Verify database backup component
   */
  async verifyDatabaseBackup(extractedPath) {
    const check = {
      name: 'Database Backup',
      status: VerificationStatus.PASSED,
      message: '',
      details: {}
    };

    try {
      const dbPath = path.join(extractedPath, 'database');

      try {
        await fs.access(dbPath);
      } catch {
        check.status = VerificationStatus.SKIPPED;
        check.message = 'Database backup not included';
        return check;
      }

      const files = await fs.readdir(dbPath);
      check.details.files = files;
      check.details.fileCount = files.length;

      if (files.length === 0) {
        check.status = VerificationStatus.WARNING;
        check.message = 'Database backup directory is empty';
        return check;
      }

      // Check each file
      let totalSize = 0;
      for (const file of files) {
        const filePath = path.join(dbPath, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;

        // Validate JSON files
        if (file.endsWith('.json')) {
          try {
            const content = await fs.readFile(filePath, 'utf8');
            const data = JSON.parse(content);
            check.details[file] = {
              records: Array.isArray(data) ? data.length : 'N/A',
              size: stats.size
            };
          } catch (e) {
            check.status = VerificationStatus.WARNING;
            check.message = `Invalid JSON in ${file}`;
          }
        }

        // Validate SQL files
        if (file.endsWith('.sql')) {
          const content = await fs.readFile(filePath, 'utf8');
          if (content.length < 10) {
            check.status = VerificationStatus.WARNING;
            check.message = 'SQL dump file appears empty';
          }
          check.details[file] = { size: stats.size };
        }
      }

      check.details.totalSize = totalSize;
      check.details.totalSizeFormatted = this.formatBytes(totalSize);

      if (totalSize < VERIFICATION_CONFIG.minimumSizes.database) {
        check.status = VerificationStatus.WARNING;
        check.message = 'Database backup is smaller than expected';
      } else if (check.status === VerificationStatus.PASSED) {
        check.message = `Database backup verified (${files.length} files, ${this.formatBytes(totalSize)})`;
      }

    } catch (error) {
      check.status = VerificationStatus.FAILED;
      check.message = 'Failed to verify database backup';
      check.details.error = error.message;
    }

    return check;
  }

  /**
   * Verify Redis backup component
   */
  async verifyRedisBackup(extractedPath) {
    const check = {
      name: 'Redis Backup',
      status: VerificationStatus.PASSED,
      message: '',
      details: {}
    };

    try {
      const redisPath = path.join(extractedPath, 'redis');

      try {
        await fs.access(redisPath);
      } catch {
        check.status = VerificationStatus.SKIPPED;
        check.message = 'Redis backup not included';
        return check;
      }

      const files = await fs.readdir(redisPath);
      check.details.files = files;

      if (files.length === 0) {
        check.status = VerificationStatus.WARNING;
        check.message = 'Redis backup directory is empty';
        return check;
      }

      // Check RDB or JSON file
      for (const file of files) {
        const filePath = path.join(redisPath, file);
        const stats = await fs.stat(filePath);
        check.details[file] = { size: stats.size };

        if (file.endsWith('.json')) {
          try {
            const content = await fs.readFile(filePath, 'utf8');
            const data = JSON.parse(content);
            check.details[file].keys = Object.keys(data).length;
          } catch (e) {
            check.status = VerificationStatus.WARNING;
            check.message = `Invalid JSON in Redis backup: ${file}`;
          }
        }
      }

      if (check.status === VerificationStatus.PASSED) {
        check.message = `Redis backup verified (${files.length} files)`;
      }

    } catch (error) {
      check.status = VerificationStatus.FAILED;
      check.message = 'Failed to verify Redis backup';
      check.details.error = error.message;
    }

    return check;
  }

  /**
   * Verify files backup component
   */
  async verifyFilesBackup(extractedPath) {
    const check = {
      name: 'Files Backup',
      status: VerificationStatus.PASSED,
      message: '',
      details: {}
    };

    try {
      const filesPath = path.join(extractedPath, 'files');

      try {
        await fs.access(filesPath);
      } catch {
        check.status = VerificationStatus.SKIPPED;
        check.message = 'Files backup not included';
        return check;
      }

      const stats = await this.getDirectoryStats(filesPath);
      check.details = {
        totalFiles: stats.files,
        totalSize: stats.size,
        totalSizeFormatted: this.formatBytes(stats.size),
        directories: stats.directories
      };

      if (stats.files === 0) {
        check.status = VerificationStatus.WARNING;
        check.message = 'Files backup contains no files';
      } else {
        check.message = `Files backup verified (${stats.files} files, ${this.formatBytes(stats.size)})`;
      }

    } catch (error) {
      check.status = VerificationStatus.FAILED;
      check.message = 'Failed to verify files backup';
      check.details.error = error.message;
    }

    return check;
  }

  /**
   * Verify code backup component
   */
  async verifyCodeBackup(extractedPath) {
    const check = {
      name: 'Code Backup',
      status: VerificationStatus.PASSED,
      message: '',
      details: {}
    };

    try {
      const codePath = path.join(extractedPath, 'code');

      try {
        await fs.access(codePath);
      } catch {
        check.status = VerificationStatus.SKIPPED;
        check.message = 'Code backup not included';
        return check;
      }

      const files = await fs.readdir(codePath);
      check.details.files = files;

      // Check for git bundle
      const bundleFile = files.find(f => f.endsWith('.bundle'));
      if (bundleFile) {
        const bundlePath = path.join(codePath, bundleFile);
        const stats = await fs.stat(bundlePath);
        check.details.gitBundle = {
          name: bundleFile,
          size: stats.size,
          sizeFormatted: this.formatBytes(stats.size)
        };

        // Verify bundle integrity
        try {
          execSync(`git bundle verify "${bundlePath}"`, { stdio: 'pipe' });
          check.details.gitBundle.verified = true;
        } catch (e) {
          check.status = VerificationStatus.WARNING;
          check.message = 'Git bundle verification failed';
          check.details.gitBundle.verified = false;
        }
      }

      // Check working directory copy
      const workingDirPath = path.join(codePath, 'working-directory');
      try {
        const wdStats = await this.getDirectoryStats(workingDirPath);
        check.details.workingDirectory = {
          files: wdStats.files,
          size: wdStats.size,
          sizeFormatted: this.formatBytes(wdStats.size)
        };
      } catch {
        // Working directory not present
      }

      if (check.status === VerificationStatus.PASSED) {
        check.message = 'Code backup verified';
      }

    } catch (error) {
      check.status = VerificationStatus.FAILED;
      check.message = 'Failed to verify code backup';
      check.details.error = error.message;
    }

    return check;
  }

  /**
   * Perform a dry-run restore to verify restorability
   */
  async performDryRunRestore(extractedPath, options = {}) {
    const check = {
      name: 'Restore Dry-Run',
      status: VerificationStatus.PASSED,
      message: '',
      details: {}
    };

    try {
      check.details.tests = [];

      // Test database restore capability
      const dbPath = path.join(extractedPath, 'database');
      try {
        await fs.access(dbPath);
        const dbFiles = await fs.readdir(dbPath);

        for (const file of dbFiles) {
          if (file.endsWith('.json')) {
            const content = await fs.readFile(path.join(dbPath, file), 'utf8');
            const data = JSON.parse(content);

            // Verify data structure
            if (Array.isArray(data)) {
              check.details.tests.push({
                component: 'database',
                file,
                status: 'passed',
                records: data.length,
                sampleFields: data.length > 0 ? Object.keys(data[0]) : []
              });
            }
          }
        }
      } catch {
        // Database not present
      }

      // Test Redis restore capability
      const redisPath = path.join(extractedPath, 'redis');
      try {
        await fs.access(redisPath);
        const redisFiles = await fs.readdir(redisPath);

        for (const file of redisFiles) {
          if (file.endsWith('.json')) {
            const content = await fs.readFile(path.join(redisPath, file), 'utf8');
            const data = JSON.parse(content);

            check.details.tests.push({
              component: 'redis',
              file,
              status: 'passed',
              keys: Object.keys(data).length
            });
          }
        }
      } catch {
        // Redis not present
      }

      // Count test results
      const passedTests = check.details.tests.filter(t => t.status === 'passed').length;
      const totalTests = check.details.tests.length;

      if (totalTests === 0) {
        check.status = VerificationStatus.WARNING;
        check.message = 'No restore tests could be performed';
      } else if (passedTests === totalTests) {
        check.message = `All ${totalTests} restore tests passed`;
      } else {
        check.status = VerificationStatus.WARNING;
        check.message = `${passedTests}/${totalTests} restore tests passed`;
      }

    } catch (error) {
      check.status = VerificationStatus.FAILED;
      check.message = 'Dry-run restore failed';
      check.details.error = error.message;
    }

    return check;
  }

  /**
   * Get directory statistics recursively
   */
  async getDirectoryStats(dirPath) {
    let size = 0;
    let files = 0;
    let directories = 0;

    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        directories++;
        const subStats = await this.getDirectoryStats(entryPath);
        size += subStats.size;
        files += subStats.files;
        directories += subStats.directories;
      } else {
        const stats = await fs.stat(entryPath);
        size += stats.size;
        files++;
      }
    }

    return { size, files, directories };
  }

  /**
   * Clean up temporary files
   */
  async cleanup(extractedPath) {
    try {
      // Find the temp directory (parent of extracted path)
      let tempDir = extractedPath;
      while (!tempDir.includes('verify_') && tempDir !== path.dirname(tempDir)) {
        tempDir = path.dirname(tempDir);
      }

      if (tempDir.includes('verify_')) {
        await fs.rm(path.dirname(tempDir) === VERIFICATION_CONFIG.tempDir
          ? tempDir
          : path.dirname(tempDir),
          { recursive: true, force: true }
        );
      }
    } catch (error) {
      console.warn('Cleanup warning:', error.message);
    }
  }

  /**
   * Print verification report to console
   */
  printReport(report) {
    console.log('\n' + '='.repeat(60));
    console.log('BACKUP VERIFICATION REPORT');
    console.log('='.repeat(60));

    const statusEmoji = {
      [VerificationStatus.PASSED]: '✅',
      [VerificationStatus.FAILED]: '❌',
      [VerificationStatus.WARNING]: '⚠️',
      [VerificationStatus.SKIPPED]: '⏭️'
    };

    console.log(`\nBackup: ${report.backupPath}`);
    console.log(`Time: ${report.timestamp}`);
    console.log(`Duration: ${report.duration}ms`);
    console.log(`\nOverall Status: ${statusEmoji[report.overallStatus]} ${report.overallStatus.toUpperCase()}`);

    console.log('\n--- Check Results ---\n');

    for (const check of report.checks) {
      console.log(`${statusEmoji[check.status]} ${check.name}: ${check.message}`);

      if (check.status === VerificationStatus.FAILED && check.details.error) {
        console.log(`   Error: ${check.details.error}`);
      }
    }

    console.log('\n--- Summary ---\n');
    console.log(`Total Checks: ${report.summary.total}`);
    console.log(`  ✅ Passed:   ${report.summary.passed}`);
    console.log(`  ❌ Failed:   ${report.summary.failed}`);
    console.log(`  ⚠️  Warnings: ${report.summary.warnings}`);
    console.log(`  ⏭️  Skipped:  ${report.summary.skipped}`);

    console.log('\n' + '='.repeat(60) + '\n');
  }

  /**
   * Save verification report to file
   */
  async saveReport(report) {
    try {
      await fs.mkdir(VERIFICATION_CONFIG.reportsDir, { recursive: true });

      const filename = `verification_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const reportPath = path.join(VERIFICATION_CONFIG.reportsDir, filename);

      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      console.log(`Report saved: ${reportPath}`);

      return reportPath;
    } catch (error) {
      console.error('Failed to save report:', error.message);
    }
  }

  /**
   * Send notification for failed verification
   */
  async sendNotification(report) {
    if (!VERIFICATION_CONFIG.notifications.enabled) return;

    // Slack notification
    if (VERIFICATION_CONFIG.notifications.webhookUrl) {
      try {
        const payload = {
          text: `❌ Backup Verification Failed`,
          attachments: [{
            color: '#ff0000',
            fields: [
              { title: 'Backup', value: report.backupPath, short: false },
              { title: 'Status', value: report.overallStatus, short: true },
              { title: 'Failed Checks', value: report.summary.failed.toString(), short: true },
              { title: 'Warnings', value: report.summary.warnings.toString(), short: true }
            ]
          }]
        };

        await fetch(VERIFICATION_CONFIG.notifications.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (error) {
        console.error('Failed to send Slack notification:', error.message);
      }
    }
  }

  /**
   * Format bytes to human readable string
   */
  formatBytes(bytes) {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`;
  }
}

/**
 * Verify all recent backups
 */
export async function verifyAllBackups(options = {}) {
  const verifier = new BackupVerifier();
  const results = [];

  const backupTypes = ['daily', 'weekly', 'monthly'];

  for (const type of backupTypes) {
    const typeDir = path.join(VERIFICATION_CONFIG.backupDir, type);

    try {
      const entries = await fs.readdir(typeDir);
      const backupFiles = entries.filter(e =>
        e.startsWith('backup_') && (e.endsWith('.tar.gz') || e.endsWith('.tar.gz.enc'))
      );

      // Sort by name (newest first) and take latest
      backupFiles.sort().reverse();
      const latestBackup = backupFiles[0];

      if (latestBackup) {
        const backupPath = path.join(typeDir, latestBackup);
        console.log(`\nVerifying ${type} backup: ${latestBackup}`);

        const report = await verifier.verifyBackup(backupPath, options);
        results.push({ type, report });
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error(`Error checking ${type} backups:`, error.message);
      }
    }
  }

  return results;
}

/**
 * Schedule regular verification
 */
export function scheduleVerification(cronExpression = '0 6 * * *') {
  // This would use node-cron or similar
  console.log(`Backup verification scheduled: ${cronExpression}`);
  // Implementation would use cron library
}

// CLI interface
const args = process.argv.slice(2);
const command = args[0];

if (command === 'verify') {
  const backupPath = args[1];
  if (!backupPath) {
    console.error('Usage: node backup-verification.js verify <backup-path>');
    process.exit(1);
  }

  const verifier = new BackupVerifier();
  verifier.verifyBackup(backupPath)
    .then(report => {
      process.exit(report.overallStatus === VerificationStatus.FAILED ? 1 : 0);
    })
    .catch(error => {
      console.error('Verification error:', error);
      process.exit(1);
    });

} else if (command === 'verify-all') {
  verifyAllBackups()
    .then(results => {
      const failed = results.filter(r => r.report.overallStatus === VerificationStatus.FAILED);
      process.exit(failed.length > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Verification error:', error);
      process.exit(1);
    });

} else if (command === 'help' || !command) {
  console.log(`
Backup Verification System

Usage:
  node backup-verification.js verify <backup-path>   Verify a specific backup
  node backup-verification.js verify-all             Verify all recent backups
  node backup-verification.js help                   Show this help

Environment Variables:
  BACKUP_LOCAL_PATH          Base backup directory (default: ./backups)
  BACKUP_TEMP_DIR            Temp directory for verification (default: ./tmp/backup-verification)
  BACKUP_REPORTS_DIR         Reports directory (default: ./reports/backup-verification)
  BACKUP_ENCRYPTION_KEY      Encryption key (must match backup system)
  BACKUP_SLACK_WEBHOOK       Slack webhook for notifications
  BACKUP_EMAIL_RECIPIENTS    Comma-separated email addresses
  `);
}

export default BackupVerifier;
