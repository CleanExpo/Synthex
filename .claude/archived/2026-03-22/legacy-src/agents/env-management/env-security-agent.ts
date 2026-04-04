import { EnvAgent, AgentResult, AgentOptions } from './base-env-agent';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface SecurityIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  variable: string;
  issue: string;
  recommendation: string;
  line?: number;
  file?: string;
}

export interface SecurityConfig {
  scanPatterns: RegExp[];
  sensitiveKeys: string[];
  allowedDomains?: string[];
  encryptionRequired?: string[];
  maxValueLength?: number;
  checkGitIgnore?: boolean;
  checkCommitHistory?: boolean;
}

export class EnvSecurityAgent extends EnvAgent {
  private securityConfig: SecurityConfig;
  private issues: SecurityIssue[] = [];
  
  private defaultSensitivePatterns = [
    /api[_-]?key/i,
    /api[_-]?secret/i,
    /auth[_-]?token/i,
    /private[_-]?key/i,
    /secret[_-]?key/i,
    /password/i,
    /passwd/i,
    /pwd/i,
    /access[_-]?token/i,
    /refresh[_-]?token/i,
    /client[_-]?secret/i,
    /aws[_-]?access/i,
    /aws[_-]?secret/i,
    /stripe[_-]?key/i,
    /github[_-]?token/i,
    /ssh[_-]?key/i,
    /db[_-]?pass/i,
    /database[_-]?url/i,
    /jwt[_-]?secret/i,
    /encryption[_-]?key/i
  ];

  private knownSecretPatterns = [
    { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/ },
    { name: 'AWS Secret Key', pattern: /[0-9a-zA-Z/+=]{40}/ },
    { name: 'GitHub Token', pattern: /ghp_[0-9a-zA-Z]{36}/ },
    { name: 'Slack Token', pattern: /xox[baprs]-[0-9]{10,}-[0-9a-zA-Z]{24}/ },
    { name: 'Private Key', pattern: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
    { name: 'Google API Key', pattern: /AIza[0-9A-Za-z\-_]{35}/ },
    { name: 'Stripe Key', pattern: /(sk|pk)_(test|live)_[0-9a-zA-Z]{24}/ },
    { name: 'JWT Token', pattern: /eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/ }
  ];

  constructor(options: AgentOptions & { securityConfig?: SecurityConfig }) {
    super(options);
    this.securityConfig = options.securityConfig || {
      scanPatterns: this.defaultSensitivePatterns,
      sensitiveKeys: [],
      checkGitIgnore: true,
      checkCommitHistory: false,
      maxValueLength: 500
    };
  }

  async scanForSecrets(): Promise<SecurityIssue[]> {
    this.issues = [];
    const envFiles = await this.findEnvFiles();

    for (const file of envFiles) {
      await this.scanFile(file);
    }

    await this.checkGitIgnore(envFiles);
    
    if (this.securityConfig.checkCommitHistory) {
      await this.scanGitHistory();
    }

    await this.checkEncryption();
    await this.validatePermissions(envFiles);

    this.emit('security-scan-complete', {
      issues: this.issues,
      filesScanned: envFiles.length
    });

    return this.issues;
  }

  private async scanFile(filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const fileName = path.basename(filePath);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('#')) continue;

        const [key, ...valueParts] = line.split('=');
        if (!key) continue;

        const value = valueParts.join('=').replace(/^["']|["']$/g, '');

        await this.checkVariable(key.trim(), value, i + 1, fileName);
      }
    } catch (error) {
      this.log('error', `Failed to scan file ${filePath}`, error);
    }
  }

  private async checkVariable(
    key: string, 
    value: string, 
    line: number, 
    file: string
  ): Promise<void> {
    if (this.isSensitiveKey(key)) {
      if (value && value.length < 8) {
        this.issues.push({
          severity: 'high',
          variable: key,
          issue: 'Weak secret value (too short)',
          recommendation: 'Use a strong, randomly generated value with at least 32 characters',
          line,
          file
        });
      }

      if (this.containsCommonPattern(value)) {
        this.issues.push({
          severity: 'critical',
          variable: key,
          issue: 'Uses common or default value',
          recommendation: 'Replace with a unique, secure value',
          line,
          file
        });
      }

      if (this.isPlainTextSecret(key, value)) {
        this.issues.push({
          severity: 'high',
          variable: key,
          issue: 'Secret stored in plain text',
          recommendation: 'Consider using encryption or a secret management service',
          line,
          file
        });
      }
    }

    for (const { name, pattern } of this.knownSecretPatterns) {
      if (pattern.test(value)) {
        this.issues.push({
          severity: 'critical',
          variable: key,
          issue: `Detected ${name} pattern in value`,
          recommendation: 'This appears to be a real secret. Rotate immediately and use secure storage',
          line,
          file
        });
      }
    }

    if (value.includes('http://') && this.isSensitiveKey(key)) {
      this.issues.push({
        severity: 'medium',
        variable: key,
        issue: 'Using insecure HTTP protocol',
        recommendation: 'Use HTTPS for all sensitive connections',
        line,
        file
      });
    }

    if (this.securityConfig.maxValueLength && value.length > this.securityConfig.maxValueLength) {
      this.issues.push({
        severity: 'low',
        variable: key,
        issue: `Value exceeds maximum length (${value.length} > ${this.securityConfig.maxValueLength})`,
        recommendation: 'Consider storing large values in separate files or services',
        line,
        file
      });
    }

    if (value.includes(' ') && !value.startsWith('"') && !value.startsWith("'")) {
      this.issues.push({
        severity: 'low',
        variable: key,
        issue: 'Value contains spaces but is not quoted',
        recommendation: 'Wrap values with spaces in quotes',
        line,
        file
      });
    }
  }

  private isSensitiveKey(key: string): boolean {
    return this.securityConfig.scanPatterns.some(pattern => pattern.test(key)) ||
           this.securityConfig.sensitiveKeys.includes(key);
  }

  private containsCommonPattern(value: string): boolean {
    const commonPatterns = [
      'password', 'secret', 'test', 'demo', 'example',
      '12345', 'admin', 'root', 'default', 'changeme'
    ];
    
    const lowerValue = value.toLowerCase();
    return commonPatterns.some(pattern => lowerValue.includes(pattern));
  }

  private isPlainTextSecret(key: string, value: string): boolean {
    const encryptedPatterns = [
      /^enc\[/, 
      /^encrypted:/,
      /^vault:/,
      /^kms:/,
      /^\$\{vault\./
    ];

    if (encryptedPatterns.some(p => p.test(value))) {
      return false;
    }

    return this.isSensitiveKey(key) && value.length > 0;
  }

  private async checkGitIgnore(envFiles: string[]): Promise<void> {
    if (!this.securityConfig.checkGitIgnore) return;

    const gitIgnorePath = path.join(this.projectPath, '.gitignore');
    
    try {
      const gitIgnoreContent = await fs.readFile(gitIgnorePath, 'utf-8');
      const ignoredPatterns = gitIgnoreContent
        .split('\n')
        .filter(line => line.trim() && !line.startsWith('#'))
        .map(line => line.trim());

      for (const envFile of envFiles) {
        const relativePath = path.relative(this.projectPath, envFile);
        const fileName = path.basename(envFile);
        
        const isIgnored = ignoredPatterns.some(pattern => {
          return pattern === fileName || 
                 pattern === relativePath ||
                 pattern === '.env*' ||
                 pattern === '*.env';
        });

        if (!isIgnored) {
          this.issues.push({
            severity: 'critical',
            variable: fileName,
            issue: 'Environment file not in .gitignore',
            recommendation: `Add "${fileName}" or ".env*" to .gitignore to prevent committing secrets`,
            file: fileName
          });
        }
      }
    } catch (error) {
      this.issues.push({
        severity: 'high',
        variable: '.gitignore',
        issue: 'No .gitignore file found',
        recommendation: 'Create a .gitignore file and exclude all .env files',
        file: ''
      });
    }
  }

  private async scanGitHistory(): Promise<void> {
    try {
      const { exec } = require('child_process');
      const util = require('util');
      const execPromise = util.promisify(exec);

      const { stdout } = await execPromise(
        'git log --all --full-history -p --grep="env\\|secret\\|key\\|password" -- "*.env*"',
        { cwd: this.projectPath }
      );

      if (stdout && stdout.includes('=')) {
        this.issues.push({
          severity: 'critical',
          variable: 'Git History',
          issue: 'Potential secrets found in git history',
          recommendation: 'Review git history and consider using BFG Repo-Cleaner or git-filter-branch to remove secrets',
          file: ''
        });
      }
    } catch (error) {
      this.log('debug', 'Could not scan git history', error);
    }
  }

  private async checkEncryption(): Promise<void> {
    if (!this.securityConfig.encryptionRequired) return;

    const envFiles = await this.findEnvFiles();
    
    for (const file of envFiles) {
      const vars = await this.loadEnvFile(file);
      
      for (const requiredKey of this.securityConfig.encryptionRequired) {
        const value = vars.get(requiredKey);
        
        if (value && !this.isEncrypted(value)) {
          this.issues.push({
            severity: 'high',
            variable: requiredKey,
            issue: 'Required encryption not detected',
            recommendation: 'Encrypt this value using your chosen encryption method',
            file: path.basename(file)
          });
        }
      }
    }
  }

  private isEncrypted(value: string): boolean {
    const encryptionIndicators = [
      /^enc\[.*\]$/,
      /^encrypted:.*/,
      /^vault:.*/,
      /^[A-Za-z0-9+/]{32,}={0,2}$/,
      /^-----BEGIN PGP MESSAGE-----/
    ];

    return encryptionIndicators.some(pattern => pattern.test(value));
  }

  private async validatePermissions(files: string[]): Promise<void> {
    for (const file of files) {
      try {
        const stats = await fs.stat(file);
        const mode = (stats.mode & parseInt('777', 8)).toString(8);
        
        if (mode !== '600' && mode !== '400') {
          this.issues.push({
            severity: 'medium',
            variable: path.basename(file),
            issue: `File has overly permissive permissions (${mode})`,
            recommendation: 'Set file permissions to 600 (rw-------) or 400 (r--------)',
            file: path.basename(file)
          });
        }
      } catch (error) {
        this.log('debug', `Could not check permissions for ${file}`, error);
      }
    }
  }

  async encryptValue(value: string, key?: string): Promise<string> {
    const algorithm = 'aes-256-gcm';
    const encryptionKey = key || process.env.ENV_ENCRYPTION_KEY || this.generateKey();
    
    const keyBuffer = Buffer.from(encryptionKey, 'hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, keyBuffer, iv);
    
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return `enc[${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}]`;
  }

  async decryptValue(encryptedValue: string, key?: string): Promise<string> {
    const match = encryptedValue.match(/^enc\[([^:]+):([^:]+):([^\]]+)\]$/);
    if (!match) {
      throw new Error('Invalid encrypted value format');
    }

    const [, ivHex, authTagHex, encrypted] = match;
    const algorithm = 'aes-256-gcm';
    const encryptionKey = key || process.env.ENV_ENCRYPTION_KEY;
    
    if (!encryptionKey) {
      throw new Error('Encryption key not provided');
    }

    const keyBuffer = Buffer.from(encryptionKey, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(algorithm, keyBuffer, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  private generateKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  async execute(): Promise<AgentResult> {
    try {
      const issues = await this.scanForSecrets();
      const critical = issues.filter(i => i.severity === 'critical').length;
      const high = issues.filter(i => i.severity === 'high').length;

      return {
        success: critical === 0,
        message: critical > 0 
          ? `Security scan failed: ${critical} critical issues found`
          : `Security scan completed: ${issues.length} total issues`,
        data: {
          issues,
          summary: {
            critical,
            high,
            medium: issues.filter(i => i.severity === 'medium').length,
            low: issues.filter(i => i.severity === 'low').length
          }
        },
        errors: issues.filter(i => i.severity === 'critical').map(i => `${i.variable}: ${i.issue}`),
        warnings: issues.filter(i => i.severity === 'high').map(i => `${i.variable}: ${i.issue}`),
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        message: `Security scan failed: ${error}`,
        errors: [String(error)],
        timestamp: new Date()
      };
    }
  }

  async validate(): Promise<boolean> {
    const envFiles = await this.findEnvFiles();
    return envFiles.length > 0;
  }
}