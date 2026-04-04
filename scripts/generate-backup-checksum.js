#!/usr/bin/env node
/**
 * Backup Checksum Generator
 * Generates checksums for backup files to enable integrity verification
 *
 * @task UNI-434
 */

import fs from 'fs/promises';
import { createReadStream } from 'fs';
import crypto from 'crypto';
import path from 'path';

const ALGORITHMS = ['sha256', 'md5'];
const DEFAULT_ALGORITHM = 'sha256';

/**
 * Calculate checksum for a file
 */
async function calculateChecksum(filePath, algorithm = DEFAULT_ALGORITHM) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash(algorithm);
    const stream = createReadStream(filePath);

    stream.on('data', data => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * Generate checksum file for backup
 */
async function generateChecksumFile(backupPath, algorithm = DEFAULT_ALGORITHM) {
  try {
    const checksum = await calculateChecksum(backupPath, algorithm);
    const checksumPath = `${backupPath}.${algorithm}`;

    // Format: checksum  filename
    const content = `${checksum}  ${path.basename(backupPath)}\n`;
    await fs.writeFile(checksumPath, content);

    return { checksum, checksumPath };
  } catch (error) {
    throw new Error(`Failed to generate checksum: ${error.message}`);
  }
}

/**
 * Verify checksum of backup file
 */
async function verifyChecksum(backupPath, algorithm = DEFAULT_ALGORITHM) {
  const checksumPath = `${backupPath}.${algorithm}`;

  try {
    // Read stored checksum
    const storedContent = await fs.readFile(checksumPath, 'utf8');
    const storedChecksum = storedContent.trim().split(/\s+/)[0];

    // Calculate current checksum
    const currentChecksum = await calculateChecksum(backupPath, algorithm);

    return {
      valid: storedChecksum === currentChecksum,
      stored: storedChecksum,
      current: currentChecksum,
      algorithm
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Checksum file not found: ${checksumPath}`);
    }
    throw error;
  }
}

/**
 * Generate checksums for all backups in directory
 */
async function generateAllChecksums(backupDir, algorithm = DEFAULT_ALGORITHM) {
  const results = [];
  const types = ['daily', 'weekly', 'monthly'];

  for (const type of types) {
    const typeDir = path.join(backupDir, type);

    try {
      const entries = await fs.readdir(typeDir);
      const backupFiles = entries.filter(e =>
        e.startsWith('backup_') &&
        !e.endsWith('.sha256') &&
        !e.endsWith('.md5')
      );

      for (const file of backupFiles) {
        const filePath = path.join(typeDir, file);
        const checksumFilePath = `${filePath}.${algorithm}`;

        // Check if checksum already exists
        try {
          await fs.access(checksumFilePath);
          results.push({ file, type, status: 'exists', path: checksumFilePath });
        } catch {
          // Generate new checksum
          try {
            const { checksum, checksumPath } = await generateChecksumFile(filePath, algorithm);
            results.push({
              file,
              type,
              status: 'generated',
              checksum,
              path: checksumPath
            });
          } catch (error) {
            results.push({
              file,
              type,
              status: 'error',
              error: error.message
            });
          }
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error(`Error processing ${type} backups:`, error.message);
      }
    }
  }

  return results;
}

// CLI
const args = process.argv.slice(2);
const command = args[0];

async function main() {
  switch (command) {
    case 'generate': {
      const backupPath = args[1];
      const algorithm = args[2] || DEFAULT_ALGORITHM;

      if (!backupPath) {
        console.error('Usage: node generate-backup-checksum.js generate <backup-path> [algorithm]');
        process.exit(1);
      }

      console.log(`Generating ${algorithm} checksum for: ${backupPath}`);
      const result = await generateChecksumFile(backupPath, algorithm);
      console.log(`Checksum: ${result.checksum}`);
      console.log(`Saved to: ${result.checksumPath}`);
      break;
    }

    case 'verify': {
      const backupPath = args[1];
      const algorithm = args[2] || DEFAULT_ALGORITHM;

      if (!backupPath) {
        console.error('Usage: node generate-backup-checksum.js verify <backup-path> [algorithm]');
        process.exit(1);
      }

      console.log(`Verifying ${algorithm} checksum for: ${backupPath}`);
      const result = await verifyChecksum(backupPath, algorithm);

      if (result.valid) {
        console.log('✅ Checksum verified successfully');
        console.log(`   Algorithm: ${result.algorithm}`);
        console.log(`   Checksum:  ${result.current}`);
      } else {
        console.log('❌ Checksum mismatch!');
        console.log(`   Expected: ${result.stored}`);
        console.log(`   Actual:   ${result.current}`);
        process.exit(1);
      }
      break;
    }

    case 'generate-all': {
      const backupDir = args[1] || process.env.BACKUP_LOCAL_PATH || './backups';
      const algorithm = args[2] || DEFAULT_ALGORITHM;

      console.log(`Generating ${algorithm} checksums for all backups in: ${backupDir}\n`);
      const results = await generateAllChecksums(backupDir, algorithm);

      let generated = 0;
      let existing = 0;
      let errors = 0;

      for (const result of results) {
        const statusIcon = result.status === 'generated' ? '✅' :
          result.status === 'exists' ? '⏭️' : '❌';
        console.log(`${statusIcon} ${result.type}/${result.file}: ${result.status}`);

        if (result.status === 'generated') generated++;
        else if (result.status === 'exists') existing++;
        else errors++;
      }

      console.log(`\nSummary: ${generated} generated, ${existing} existing, ${errors} errors`);
      break;
    }

    case 'help':
    default:
      console.log(`
Backup Checksum Generator

Usage:
  node generate-backup-checksum.js <command> [options]

Commands:
  generate <path> [algo]      Generate checksum for a backup file
  verify <path> [algo]        Verify checksum of a backup file
  generate-all [dir] [algo]   Generate checksums for all backups
  help                        Show this help message

Options:
  path     Path to backup file
  dir      Backup directory (default: ./backups)
  algo     Hash algorithm: sha256, md5 (default: sha256)

Examples:
  node generate-backup-checksum.js generate ./backups/daily/backup_2024-01-15.tar.gz
  node generate-backup-checksum.js verify ./backups/daily/backup_2024-01-15.tar.gz
  node generate-backup-checksum.js generate-all ./backups sha256
      `);
  }
}

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});

export { calculateChecksum, generateChecksumFile, verifyChecksum, generateAllChecksums };
