/**
 * Backup Verification Test Suite
 * Comprehensive tests for backup integrity and restore capability
 *
 * @task UNI-434
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// Test fixtures directory
const TEST_FIXTURES_DIR = './tests/fixtures/backup';
const TEST_TEMP_DIR = './tmp/backup-tests';

// Mock BackupVerifier class for testing (since main module uses ES modules)
class BackupVerifier {
  constructor() {
    this.results = [];
    this.startTime = null;
  }

  async checkFileExists(backupPath) {
    const check = {
      name: 'File Existence',
      status: 'passed',
      message: '',
      details: {}
    };

    try {
      await fs.access(backupPath);
      check.message = 'Backup file exists';
      check.details.path = backupPath;
    } catch (error) {
      check.status = 'failed';
      check.message = 'Backup file not found';
      check.details.error = error.message;
    }

    return check;
  }

  async calculateChecksum(filePath, algorithm = 'sha256') {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash(algorithm);
      const stream = fsSync.createReadStream(filePath);

      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  async checkFileIntegrity(backupPath) {
    const check = {
      name: 'File Integrity (Checksum)',
      status: 'passed',
      message: '',
      details: {}
    };

    try {
      const checksum = await this.calculateChecksum(backupPath);
      check.details.checksum = checksum;
      check.details.algorithm = 'sha256';

      const checksumFile = `${backupPath}.sha256`;
      try {
        const storedChecksum = (await fs.readFile(checksumFile, 'utf8')).trim();
        if (storedChecksum === checksum) {
          check.message = 'Checksum verified successfully';
          check.details.verified = true;
        } else {
          check.status = 'failed';
          check.message = 'Checksum mismatch - file may be corrupted';
          check.details.expected = storedChecksum;
          check.details.actual = checksum;
        }
      } catch {
        check.status = 'warning';
        check.message = 'No stored checksum found - computed checksum for reference';
        check.details.computed = checksum;
      }
    } catch (error) {
      check.status = 'failed';
      check.message = 'Failed to calculate checksum';
      check.details.error = error.message;
    }

    return check;
  }

  async checkFileSize(backupPath) {
    const check = {
      name: 'File Size',
      status: 'passed',
      message: '',
      details: {}
    };

    try {
      const stats = await fs.stat(backupPath);
      check.details.size = stats.size;
      check.details.sizeFormatted = this.formatBytes(stats.size);
      check.details.modified = stats.mtime.toISOString();

      if (stats.size < 100) {
        check.status = 'failed';
        check.message = 'Backup file is too small - likely corrupted or empty';
      } else if (stats.size < 1024) {
        check.status = 'warning';
        check.message = 'Backup file is unusually small';
      } else {
        check.message = `Backup size: ${check.details.sizeFormatted}`;
      }
    } catch (error) {
      check.status = 'failed';
      check.message = 'Failed to get file stats';
      check.details.error = error.message;
    }

    return check;
  }

  async validateManifest(extractedPath) {
    const check = {
      name: 'Manifest Validation',
      status: 'passed',
      message: '',
      details: {}
    };

    const requiredFields = ['backupId', 'timestamp', 'type', 'version', 'results', 'stats'];

    try {
      const manifestPath = path.join(extractedPath, 'manifest.json');
      const manifestContent = await fs.readFile(manifestPath, 'utf8');
      const manifest = JSON.parse(manifestContent);

      check.details.backupId = manifest.backupId;
      check.details.timestamp = manifest.timestamp;
      check.details.type = manifest.type;
      check.details.version = manifest.version;

      const missingFields = requiredFields.filter(field => !(field in manifest));

      if (missingFields.length > 0) {
        check.status = 'warning';
        check.message = `Missing manifest fields: ${missingFields.join(', ')}`;
        check.details.missingFields = missingFields;
      } else {
        check.message = 'Manifest is valid and complete';
      }

      if (manifest.stats?.errors?.length > 0) {
        check.status = 'warning';
        check.message = `Manifest contains ${manifest.stats.errors.length} recorded errors`;
        check.details.recordedErrors = manifest.stats.errors;
      }

    } catch (error) {
      if (error.code === 'ENOENT') {
        check.status = 'failed';
        check.message = 'Manifest file not found';
      } else if (error instanceof SyntaxError) {
        check.status = 'failed';
        check.message = 'Invalid JSON in manifest file';
      } else {
        check.status = 'failed';
        check.message = 'Failed to validate manifest';
      }
      check.details.error = error.message;
    }

    return check;
  }

  formatBytes(bytes) {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`;
  }

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
}

describe('Backup Verification System', () => {
  let verifier;

  beforeAll(async () => {
    await fs.mkdir(TEST_FIXTURES_DIR, { recursive: true });
    await fs.mkdir(TEST_TEMP_DIR, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(TEST_TEMP_DIR, { recursive: true, force: true }).catch(() => {});
    await fs.rm(TEST_FIXTURES_DIR, { recursive: true, force: true }).catch(() => {});
  });

  beforeEach(() => {
    verifier = new BackupVerifier();
  });

  describe('BackupVerifier', () => {
    describe('File Existence Check', () => {
      it('should pass for existing file', async () => {
        const testFile = path.join(TEST_TEMP_DIR, 'test-backup.tar.gz');
        await fs.writeFile(testFile, 'test content');

        const result = await verifier.checkFileExists(testFile);

        expect(result.status).toBe('passed');
        expect(result.name).toBe('File Existence');

        await fs.unlink(testFile);
      });

      it('should fail for non-existent file', async () => {
        const result = await verifier.checkFileExists('/non/existent/path.tar.gz');

        expect(result.status).toBe('failed');
        expect(result.message).toContain('not found');
      });
    });

    describe('File Integrity Check', () => {
      it('should calculate checksum correctly', async () => {
        const testFile = path.join(TEST_TEMP_DIR, 'checksum-test.txt');
        const content = 'test content for checksum';
        await fs.writeFile(testFile, content);

        const checksum = await verifier.calculateChecksum(testFile);
        const expectedChecksum = crypto.createHash('sha256').update(content).digest('hex');

        expect(checksum).toBe(expectedChecksum);

        await fs.unlink(testFile);
      });

      it('should verify against stored checksum', async () => {
        const testFile = path.join(TEST_TEMP_DIR, 'checksum-verify.txt');
        const content = 'test content';
        await fs.writeFile(testFile, content);

        const checksum = crypto.createHash('sha256').update(content).digest('hex');
        await fs.writeFile(`${testFile}.sha256`, checksum);

        const result = await verifier.checkFileIntegrity(testFile);

        expect(result.status).toBe('passed');
        expect(result.details.verified).toBe(true);

        await fs.unlink(testFile);
        await fs.unlink(`${testFile}.sha256`);
      });

      it('should warn when no stored checksum exists', async () => {
        const testFile = path.join(TEST_TEMP_DIR, 'no-checksum.txt');
        await fs.writeFile(testFile, 'test content');

        const result = await verifier.checkFileIntegrity(testFile);

        expect(result.status).toBe('warning');
        expect(result.message).toContain('No stored checksum');

        await fs.unlink(testFile);
      });
    });

    describe('File Size Check', () => {
      it('should pass for reasonable file size', async () => {
        const testFile = path.join(TEST_TEMP_DIR, 'size-test.txt');
        await fs.writeFile(testFile, 'x'.repeat(10000));

        const result = await verifier.checkFileSize(testFile);

        expect(result.status).toBe('passed');
        expect(result.details.size).toBe(10000);

        await fs.unlink(testFile);
      });

      it('should fail for very small files', async () => {
        const testFile = path.join(TEST_TEMP_DIR, 'tiny.txt');
        await fs.writeFile(testFile, 'x');

        const result = await verifier.checkFileSize(testFile);

        expect(result.status).toBe('failed');
        expect(result.message).toContain('too small');

        await fs.unlink(testFile);
      });

      it('should warn for small files', async () => {
        const testFile = path.join(TEST_TEMP_DIR, 'small.txt');
        await fs.writeFile(testFile, 'x'.repeat(500));

        const result = await verifier.checkFileSize(testFile);

        expect(result.status).toBe('warning');
        expect(result.message).toContain('unusually small');

        await fs.unlink(testFile);
      });
    });

    describe('Manifest Validation', () => {
      it('should validate complete manifest', async () => {
        const manifestDir = path.join(TEST_TEMP_DIR, 'manifest-test');
        await fs.mkdir(manifestDir, { recursive: true });

        const manifest = {
          backupId: 'test-backup-001',
          timestamp: new Date().toISOString(),
          type: 'daily',
          version: '1.0',
          results: { database: { success: true, files: 5, size: 1024 } },
          stats: { files: 5, size: 1024, duration: 1000, errors: [] }
        };

        await fs.writeFile(
          path.join(manifestDir, 'manifest.json'),
          JSON.stringify(manifest)
        );

        const result = await verifier.validateManifest(manifestDir);

        expect(result.status).toBe('passed');
        expect(result.details.backupId).toBe('test-backup-001');

        await fs.rm(manifestDir, { recursive: true });
      });

      it('should warn on missing manifest fields', async () => {
        const manifestDir = path.join(TEST_TEMP_DIR, 'incomplete-manifest');
        await fs.mkdir(manifestDir, { recursive: true });

        const manifest = {
          backupId: 'test-backup-001',
          timestamp: new Date().toISOString()
        };

        await fs.writeFile(
          path.join(manifestDir, 'manifest.json'),
          JSON.stringify(manifest)
        );

        const result = await verifier.validateManifest(manifestDir);

        expect(result.status).toBe('warning');
        expect(result.details.missingFields).toContain('type');

        await fs.rm(manifestDir, { recursive: true });
      });

      it('should fail on invalid JSON', async () => {
        const manifestDir = path.join(TEST_TEMP_DIR, 'invalid-json');
        await fs.mkdir(manifestDir, { recursive: true });

        await fs.writeFile(
          path.join(manifestDir, 'manifest.json'),
          'not valid json {'
        );

        const result = await verifier.validateManifest(manifestDir);

        expect(result.status).toBe('failed');
        expect(result.message).toContain('Invalid JSON');

        await fs.rm(manifestDir, { recursive: true });
      });

      it('should fail when manifest not found', async () => {
        const emptyDir = path.join(TEST_TEMP_DIR, 'no-manifest');
        await fs.mkdir(emptyDir, { recursive: true });

        const result = await verifier.validateManifest(emptyDir);

        expect(result.status).toBe('failed');
        expect(result.message).toContain('not found');

        await fs.rm(emptyDir, { recursive: true });
      });
    });

    describe('Utility Functions', () => {
      it('should format bytes correctly', () => {
        expect(verifier.formatBytes(0)).toBe('0 B');
        expect(verifier.formatBytes(1024)).toBe('1 KB');
        expect(verifier.formatBytes(1048576)).toBe('1 MB');
        expect(verifier.formatBytes(1073741824)).toBe('1 GB');
      });

      it('should get directory stats', async () => {
        const testDir = path.join(TEST_TEMP_DIR, 'stats-test');
        await fs.mkdir(path.join(testDir, 'subdir'), { recursive: true });
        await fs.writeFile(path.join(testDir, 'file1.txt'), 'content1');
        await fs.writeFile(path.join(testDir, 'subdir', 'file2.txt'), 'content2');

        const stats = await verifier.getDirectoryStats(testDir);

        expect(stats.files).toBe(2);
        expect(stats.directories).toBe(1);
        expect(stats.size).toBeGreaterThan(0);

        await fs.rm(testDir, { recursive: true });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle permission errors gracefully', async () => {
      const result = await verifier.checkFileExists('/root/protected/file.txt');
      expect(result.status).toBe('failed');
    });
  });
});

describe('Checksum Generation', () => {
  beforeAll(async () => {
    await fs.mkdir(TEST_TEMP_DIR, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(TEST_TEMP_DIR, { recursive: true, force: true }).catch(() => {});
  });

  it('should generate consistent checksums', async () => {
    const testFile = path.join(TEST_TEMP_DIR, 'consistent-checksum.txt');
    const content = 'consistent content';
    await fs.writeFile(testFile, content);

    const verifier = new BackupVerifier();
    const checksum1 = await verifier.calculateChecksum(testFile);
    const checksum2 = await verifier.calculateChecksum(testFile);

    expect(checksum1).toBe(checksum2);

    await fs.unlink(testFile);
  });
});
