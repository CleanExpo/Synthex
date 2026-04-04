/**
 * Security Analyzer Sub-Agent
 * Detects security vulnerabilities across multiple languages
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';
import { 
  QualitySubAgent, 
  QualityIssue, 
  AnalysisContext, 
  SupportedLanguage,
  AutoFix 
} from '../code-quality-analyzer';

export interface SecurityRule {
  id: string;
  name: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  languages: SupportedLanguage[];
  pattern: RegExp;
  cwe?: string; // Common Weakness Enumeration
  owasp?: string; // OWASP category
  fix?: SecurityFix;
}

export interface SecurityFix extends AutoFix {
  securityImprovement: string;
  requiresManualReview: boolean;
}

export interface VulnerabilityDatabase {
  rules: SecurityRule[];
  lastUpdated: Date;
}

export class SecurityAnalyzer implements QualitySubAgent {
  public readonly name = 'Security Analyzer';
  public readonly category = 'security' as const;
  public readonly supportedLanguages: SupportedLanguage[] = [
    'javascript', 'typescript', 'python', 'swift', 'go', 'rust', 'java', 'csharp'
  ];

  private vulnerabilityDb: VulnerabilityDatabase;
  private customRules: Map<string, SecurityRule> = new Map();

  constructor() {
    this.vulnerabilityDb = {
      rules: [],
      lastUpdated: new Date()
    };
    this.initializeSecurityRules();
  }

  /**
   * Analyze code for security vulnerabilities
   */
  async analyze(context: AnalysisContext): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];

    try {
      // Static analysis
      const staticIssues = await this.performStaticAnalysis(context);
      issues.push(...staticIssues);

      // Dependency vulnerability scan
      const dependencyIssues = await this.scanDependencyVulnerabilities(context);
      issues.push(...dependencyIssues);

      // Configuration security scan
      const configIssues = await this.scanConfigurationSecurity(context);
      issues.push(...configIssues);

      // Secret detection
      const secretIssues = await this.detectHardcodedSecrets(context);
      issues.push(...secretIssues);

      // Language-specific security checks
      const languageIssues = await this.performLanguageSpecificChecks(context);
      issues.push(...languageIssues);

      // Sort by severity
      return issues.sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });

    } catch (error) {
      console.error('Security analysis failed:', error);
      return [];
    }
  }

  /**
   * Check if an issue can be auto-fixed
   */
  canAutoFix(issue: QualityIssue): boolean {
    const rule = this.findRuleById(issue.rule || '');
    return rule?.fix?.canAutoApply === true && !rule.fix.requiresManualReview;
  }

  /**
   * Apply automatic fix for security issue
   */
  async applyFix(issue: QualityIssue): Promise<boolean> {
    if (!issue.fix || !issue.file) return false;

    try {
      const fileContent = await fs.readFile(issue.file, 'utf-8');
      const fixedContent = fileContent.replace(
        issue.fix.oldText,
        issue.fix.newText
      );

      await fs.writeFile(issue.file, fixedContent, 'utf-8');
      return true;
    } catch (error) {
      console.error('Failed to apply security fix:', error);
      return false;
    }
  }

  /**
   * Initialize comprehensive security rules
   */
  private initializeSecurityRules(): void {
    const rules: SecurityRule[] = [
      // SQL Injection vulnerabilities
      {
        id: 'sql-injection-dynamic',
        name: 'SQL Injection via Dynamic Query',
        description: 'Dynamic SQL query construction detected - use parameterized queries',
        severity: 'critical',
        languages: ['javascript', 'typescript', 'python', 'java', 'csharp'],
        pattern: /(?:query|execute|exec)\s*\(\s*["`'][^"`']*\+|(?:query|execute|exec)\s*\(\s*f["'][^"']*\{/gi,
        cwe: 'CWE-89',
        owasp: 'A03:2021 – Injection',
        fix: {
          description: 'Use parameterized queries instead of string concatenation',
          oldText: '',
          newText: '',
          canAutoApply: false,
          riskLevel: 'high',
          securityImprovement: 'Prevents SQL injection attacks',
          requiresManualReview: true
        }
      },

      // XSS vulnerabilities
      {
        id: 'xss-innerHTML',
        name: 'Cross-Site Scripting via innerHTML',
        description: 'Potential XSS vulnerability through innerHTML usage',
        severity: 'high',
        languages: ['javascript', 'typescript'],
        pattern: /\.innerHTML\s*=\s*(?!["'][^"']*["'])[^;]+/gi,
        cwe: 'CWE-79',
        owasp: 'A03:2021 – Injection',
        fix: {
          description: 'Use textContent or sanitize HTML content',
          oldText: '.innerHTML',
          newText: '.textContent',
          canAutoApply: true,
          riskLevel: 'medium',
          securityImprovement: 'Prevents XSS attacks through HTML injection',
          requiresManualReview: false
        }
      },

      // Hardcoded secrets
      {
        id: 'hardcoded-api-key',
        name: 'Hardcoded API Key',
        description: 'API key appears to be hardcoded in source code',
        severity: 'critical',
        languages: ['javascript', 'typescript', 'python', 'swift', 'go', 'rust'],
        pattern: /(?:api[_-]?key|apikey|access[_-]?token|secret[_-]?key)\s*[:=]\s*["`'][a-zA-Z0-9]{16,}["`']/gi,
        cwe: 'CWE-798',
        owasp: 'A07:2021 – Identification and Authentication Failures'
      },

      // Insecure random number generation
      {
        id: 'weak-random',
        name: 'Weak Random Number Generation',
        description: 'Using Math.random() for security-sensitive operations',
        severity: 'medium',
        languages: ['javascript', 'typescript'],
        pattern: /Math\.random\(\)/gi,
        cwe: 'CWE-338',
        owasp: 'A02:2021 – Cryptographic Failures',
        fix: {
          description: 'Use crypto.getRandomValues() for cryptographically secure random numbers',
          oldText: 'Math.random()',
          newText: 'crypto.getRandomValues(new Uint32Array(1))[0] / 2**32',
          canAutoApply: true,
          riskLevel: 'low',
          securityImprovement: 'Provides cryptographically secure random numbers',
          requiresManualReview: false
        }
      },

      // Unsafe file operations
      {
        id: 'path-traversal',
        name: 'Path Traversal Vulnerability',
        description: 'Potential path traversal vulnerability in file operations',
        severity: 'high',
        languages: ['javascript', 'typescript', 'python'],
        pattern: /(?:readFile|writeFile|open)\s*\([^)]*\.\.[^)]*\)/gi,
        cwe: 'CWE-22',
        owasp: 'A01:2021 – Broken Access Control'
      },

      // Unsafe deserialization
      {
        id: 'unsafe-eval',
        name: 'Unsafe Code Execution',
        description: 'Using eval() or similar functions can lead to code injection',
        severity: 'critical',
        languages: ['javascript', 'typescript', 'python'],
        pattern: /\b(?:eval|exec|Function)\s*\(/gi,
        cwe: 'CWE-95',
        owasp: 'A03:2021 – Injection'
      },

      // Insecure HTTP usage
      {
        id: 'insecure-http',
        name: 'Insecure HTTP Communication',
        description: 'HTTP URLs detected - use HTTPS for secure communication',
        severity: 'medium',
        languages: ['javascript', 'typescript', 'python', 'swift', 'go'],
        pattern: /['"]http:\/\/[^'"]+['"]/gi,
        cwe: 'CWE-319',
        owasp: 'A02:2021 – Cryptographic Failures',
        fix: {
          description: 'Replace HTTP with HTTPS',
          oldText: 'http://',
          newText: 'https://',
          canAutoApply: true,
          riskLevel: 'low',
          securityImprovement: 'Ensures encrypted communication',
          requiresManualReview: false
        }
      },

      // Unsafe regex
      {
        id: 'regex-dos',
        name: 'ReDoS (Regular Expression Denial of Service)',
        description: 'Complex regex pattern may cause ReDoS attacks',
        severity: 'medium',
        languages: ['javascript', 'typescript', 'python'],
        pattern: /\/.*\(\.\*\)\+.*\/|\/.*\(\.\+\)\+.*\/|\/.*\(\.\*\)\*\+.*\//gi,
        cwe: 'CWE-1333',
        owasp: 'A06:2021 – Vulnerable and Outdated Components'
      },

      // Missing input validation
      {
        id: 'missing-input-validation',
        name: 'Missing Input Validation',
        description: 'User input used without validation',
        severity: 'high',
        languages: ['javascript', 'typescript', 'python'],
        pattern: /(?:req\.(?:body|query|params)|input|userInput)\.[a-zA-Z]+\s*(?:\)|;|,)/gi,
        cwe: 'CWE-20',
        owasp: 'A03:2021 – Injection'
      },

      // Weak cryptography
      {
        id: 'weak-crypto-md5',
        name: 'Weak Cryptographic Hash (MD5)',
        description: 'MD5 is cryptographically broken - use SHA-256 or stronger',
        severity: 'high',
        languages: ['javascript', 'typescript', 'python'],
        pattern: /(?:md5|MD5)/gi,
        cwe: 'CWE-327',
        owasp: 'A02:2021 – Cryptographic Failures',
        fix: {
          description: 'Replace MD5 with SHA-256',
          oldText: 'md5',
          newText: 'sha256',
          canAutoApply: true,
          riskLevel: 'medium',
          securityImprovement: 'Uses cryptographically secure hash algorithm',
          requiresManualReview: true
        }
      }
    ];

    this.vulnerabilityDb.rules = rules;
  }

  /**
   * Perform static code analysis for security issues
   */
  private async performStaticAnalysis(context: AnalysisContext): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];

    for (const filePath of context.files) {
      if (!this.isFileSupported(filePath, context.language)) continue;

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');

        // Check each rule against file content
        for (const rule of this.vulnerabilityDb.rules) {
          if (!rule.languages.includes(context.language)) continue;

          const matches = content.matchAll(rule.pattern);
          for (const match of matches) {
            const lineNumber = this.getLineNumber(content, match.index || 0);
            
            issues.push(this.createSecurityIssue({
              rule,
              file: filePath,
              line: lineNumber,
              match: match[0],
              context
            }));
          }
        }

        // Check for language-specific patterns
        const languageIssues = await this.checkLanguageSpecificPatterns(
          filePath, content, lines, context.language
        );
        issues.push(...languageIssues);

      } catch (error) {
        console.error(`Failed to analyze file ${filePath}:`, error);
      }
    }

    return issues;
  }

  /**
   * Scan for dependency vulnerabilities
   */
  private async scanDependencyVulnerabilities(context: AnalysisContext): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];

    try {
      // Check for known vulnerable packages
      if (context.packageInfo) {
        const vulnerablePackages = await this.checkVulnerablePackages(context.packageInfo);
        issues.push(...vulnerablePackages);
      }

      // Run external security tools if available
      const externalIssues = await this.runExternalSecurityTools(context);
      issues.push(...externalIssues);

    } catch (error) {
      console.error('Dependency vulnerability scan failed:', error);
    }

    return issues;
  }

  /**
   * Scan configuration files for security issues
   */
  private async scanConfigurationSecurity(context: AnalysisContext): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];
    const configFiles = ['.env', 'config.json', 'config.js', 'docker-compose.yml'];

    for (const configFile of configFiles) {
      const configPath = path.join(context.projectPath, configFile);
      
      try {
        await fs.access(configPath);
        const content = await fs.readFile(configPath, 'utf-8');
        
        // Check for exposed secrets in config
        const secretIssues = await this.findConfigSecrets(configPath, content);
        issues.push(...secretIssues);
        
        // Check for insecure configurations
        const configIssues = await this.checkInsecureConfigurations(configPath, content);
        issues.push(...configIssues);
        
      } catch (error) {
        // File doesn't exist, skip
      }
    }

    return issues;
  }

  /**
   * Detect hardcoded secrets and credentials
   */
  private async detectHardcodedSecrets(context: AnalysisContext): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];
    
    const secretPatterns = [
      { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/gi, severity: 'critical' as const },
      { name: 'Private Key', pattern: /-----BEGIN (?:RSA )?PRIVATE KEY-----/gi, severity: 'critical' as const },
      { name: 'Generic Password', pattern: /password\s*[:=]\s*["`'][^"`']{8,}["`']/gi, severity: 'high' as const },
      { name: 'JWT Token', pattern: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/gi, severity: 'high' as const },
      { name: 'Database URL with Credentials', pattern: /[a-zA-Z]+:\/\/[^:\s]+:[^@\s]+@[^\/\s]+/gi, severity: 'critical' as const }
    ];

    for (const filePath of context.files) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        
        for (const { name, pattern, severity } of secretPatterns) {
          const matches = content.matchAll(pattern);
          for (const match of matches) {
            const lineNumber = this.getLineNumber(content, match.index || 0);
            
            issues.push({
              id: `secret_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              type: 'error',
              severity,
              category: 'security',
              title: `Hardcoded Secret: ${name}`,
              description: `${name} detected in source code - move to environment variables`,
              file: filePath,
              line: lineNumber,
              rule: `hardcoded-${name.toLowerCase().replace(/\s+/g, '-')}`,
              impact: 'Exposed credentials can lead to unauthorized access',
              confidence: 0.95,
              source: this.name,
              fix: {
                description: 'Move secret to environment variable',
                oldText: match[0],
                newText: 'process.env.SECRET_NAME',
                canAutoApply: false,
                riskLevel: 'high'
              }
            });
          }
        }
      } catch (error) {
        console.error(`Failed to scan secrets in ${filePath}:`, error);
      }
    }

    return issues;
  }

  /**
   * Perform language-specific security checks
   */
  private async performLanguageSpecificChecks(context: AnalysisContext): Promise<QualityIssue[]> {
    switch (context.language) {
      case 'javascript':
      case 'typescript':
        return this.checkJavaScriptSecurity(context);
      case 'python':
        return this.checkPythonSecurity(context);
      case 'go':
        return this.checkGoSecurity(context);
      default:
        return [];
    }
  }

  // Language-specific security checkers
  private async checkJavaScriptSecurity(context: AnalysisContext): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];
    
    // Check package.json for known vulnerable packages
    const packageJsonPath = path.join(context.projectPath, 'package.json');
    try {
      const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageContent);
      
      // Check for known vulnerable versions
      const vulnerablePackages = this.getVulnerableJSPackages();
      for (const [pkg, vulnerableVersions] of vulnerablePackages) {
        const installedVersion = packageJson.dependencies?.[pkg] || packageJson.devDependencies?.[pkg];
        if (installedVersion && this.isVulnerableVersion(installedVersion, vulnerableVersions)) {
          issues.push({
            id: `js-vuln-${pkg}-${Date.now()}`,
            type: 'error',
            severity: 'critical',
            category: 'security',
            title: `Vulnerable Dependency: ${pkg}`,
            description: `Package ${pkg} version ${installedVersion} has known security vulnerabilities`,
            file: packageJsonPath,
            impact: 'Security vulnerabilities in dependencies',
            confidence: 0.95,
            source: this.name
          });
        }
      }
    } catch (error) {
      // package.json not found or invalid
    }

    return issues;
  }

  private async checkPythonSecurity(context: AnalysisContext): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];
    
    // Python-specific security checks
    for (const filePath of context.files) {
      if (!filePath.endsWith('.py')) continue;
      
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        
        // Check for unsafe imports
        const unsafeImports = ['pickle', 'marshal', 'shelve'];
        for (const unsafeImport of unsafeImports) {
          if (content.includes(`import ${unsafeImport}`) || content.includes(`from ${unsafeImport}`)) {
            issues.push({
              id: `py-unsafe-import-${unsafeImport}-${Date.now()}`,
              type: 'warning',
              severity: 'medium',
              category: 'security',
              title: `Unsafe Import: ${unsafeImport}`,
              description: `Using ${unsafeImport} can lead to code execution vulnerabilities`,
              file: filePath,
              impact: 'Potential code execution through deserialization',
              confidence: 0.8,
              source: this.name
            });
          }
        }
      } catch (error) {
        console.error(`Failed to check Python security for ${filePath}:`, error);
      }
    }

    return issues;
  }

  private async checkGoSecurity(context: AnalysisContext): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];
    
    // Go-specific security checks would go here
    // This is a placeholder for Go security analysis
    
    return issues;
  }

  // Helper methods
  private isFileSupported(filePath: string, language: SupportedLanguage): boolean {
    const extensionMap: Record<SupportedLanguage, string[]> = {
      javascript: ['.js', '.jsx', '.mjs'],
      typescript: ['.ts', '.tsx'],
      python: ['.py', '.pyw'],
      swift: ['.swift'],
      go: ['.go'],
      rust: ['.rs'],
      java: ['.java'],
      csharp: ['.cs']
    };

    const supportedExtensions = extensionMap[language] || [];
    return supportedExtensions.some(ext => filePath.endsWith(ext));
  }

  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }

  private createSecurityIssue(params: {
    rule: SecurityRule;
    file: string;
    line: number;
    match: string;
    context: AnalysisContext;
  }): QualityIssue {
    const { rule, file, line, match, context } = params;
    
    return {
      id: `sec_${rule.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: rule.severity === 'critical' ? 'error' : 'warning',
      severity: rule.severity,
      category: 'security',
      title: rule.name,
      description: `${rule.description}${rule.cwe ? ` (${rule.cwe})` : ''}${rule.owasp ? ` - ${rule.owasp}` : ''}`,
      file,
      line,
      rule: rule.id,
      impact: this.getSecurityImpact(rule.severity),
      confidence: 0.9,
      source: this.name,
      fix: rule.fix ? {
        description: rule.fix.description,
        oldText: match,
        newText: rule.fix.newText,
        canAutoApply: rule.fix.canAutoApply,
        riskLevel: rule.fix.riskLevel
      } : undefined
    };
  }

  private getSecurityImpact(severity: SecurityRule['severity']): string {
    const impacts = {
      critical: 'High risk of security breach or data compromise',
      high: 'Significant security vulnerability requiring immediate attention',
      medium: 'Moderate security risk that should be addressed',
      low: 'Minor security concern for best practices'
    };
    return impacts[severity];
  }

  private findRuleById(ruleId: string): SecurityRule | undefined {
    return this.vulnerabilityDb.rules.find(rule => rule.id === ruleId);
  }

  private async checkLanguageSpecificPatterns(
    filePath: string, 
    content: string, 
    lines: string[], 
    language: SupportedLanguage
  ): Promise<QualityIssue[]> {
    // Implementation for language-specific pattern checking
    return [];
  }

  private async checkVulnerablePackages(packageInfo: any): Promise<QualityIssue[]> {
    // Implementation for checking vulnerable packages
    return [];
  }

  private async runExternalSecurityTools(context: AnalysisContext): Promise<QualityIssue[]> {
    // Integration with external security tools like Snyk, OWASP Dependency Check, etc.
    return [];
  }

  private async findConfigSecrets(configPath: string, content: string): Promise<QualityIssue[]> {
    // Implementation for finding secrets in configuration files
    return [];
  }

  private async checkInsecureConfigurations(configPath: string, content: string): Promise<QualityIssue[]> {
    // Implementation for checking insecure configurations
    return [];
  }

  private getVulnerableJSPackages(): Map<string, string[]> {
    // Database of known vulnerable JavaScript packages and versions
    return new Map([
      ['lodash', ['<4.17.21']],
      ['moment', ['<2.29.4']],
      ['axios', ['<0.21.2']]
    ]);
  }

  private isVulnerableVersion(installedVersion: string, vulnerableVersions: string[]): boolean {
    // Version comparison logic
    return false; // Placeholder
  }
}

export default SecurityAnalyzer;