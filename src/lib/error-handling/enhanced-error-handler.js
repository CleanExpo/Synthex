/**
 * SYNTHEX Enhanced Error Handler
 * Implements improved error handling with better stderr redirection
 * Based on Claude Code's improved Bash tool capabilities
 */

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class EnhancedErrorHandler {
  constructor() {
    this.errorLog = [];
    this.maxLogSize = 1000;
    this.errorHandlers = new Map();
    this.globalErrorHandler = null;
    this.stderrBuffer = [];
    this.stderrMaxSize = 100;
  }

  /**
   * Initialize error handling system
   */
  initialize() {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.handleCriticalError('UNCAUGHT_EXCEPTION', error);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.handleCriticalError('UNHANDLED_REJECTION', reason);
    });

    // Handle process warnings
    process.on('warning', (warning) => {
      this.logWarning(warning);
    });

    // Capture stderr output
    this.captureStderr();
  }

  /**
   * Enhanced stderr capture with buffering
   */
  captureStderr() {
    const originalStderrWrite = process.stderr.write;
    
    process.stderr.write = (chunk, encoding, callback) => {
      // Buffer stderr output
      const message = chunk.toString();
      this.stderrBuffer.push({
        timestamp: new Date().toISOString(),
        message,
        encoding
      });

      // Maintain buffer size
      if (this.stderrBuffer.length > this.stderrMaxSize) {
        this.stderrBuffer.shift();
      }

      // Parse and categorize errors
      this.parseStderrError(message);

      // Call original stderr write
      return originalStderrWrite.call(process.stderr, chunk, encoding, callback);
    };
  }

  /**
   * Parse stderr output for error patterns
   */
  parseStderrError(message) {
    const errorPatterns = [
      { pattern: /ERROR:/i, type: 'ERROR' },
      { pattern: /WARNING:/i, type: 'WARNING' },
      { pattern: /CRITICAL:/i, type: 'CRITICAL' },
      { pattern: /TypeError:/i, type: 'TYPE_ERROR' },
      { pattern: /ReferenceError:/i, type: 'REFERENCE_ERROR' },
      { pattern: /SyntaxError:/i, type: 'SYNTAX_ERROR' },
      { pattern: /RangeError:/i, type: 'RANGE_ERROR' },
      { pattern: /failed/i, type: 'FAILURE' },
      { pattern: /exception/i, type: 'EXCEPTION' },
      { pattern: /fatal/i, type: 'FATAL' }
    ];

    for (const { pattern, type } of errorPatterns) {
      if (pattern.test(message)) {
        this.logError({
          type,
          message,
          source: 'stderr',
          timestamp: new Date().toISOString()
        });
        
        // Trigger specific handler if registered
        if (this.errorHandlers.has(type)) {
          this.errorHandlers.get(type)(message);
        }
        break;
      }
    }
  }

  /**
   * Execute command with enhanced error handling
   */
  async executeWithErrorHandling(command, options = {}) {
    const {
      timeout = 120000,
      retries = 3,
      retryDelay = 1000,
      captureStderr = true,
      throwOnError = true
    } = options;

    let lastError = null;
    let attempt = 0;

    while (attempt < retries) {
      try {
        const result = await this.executeCommand(command, {
          timeout,
          captureStderr
        });

        // Check for stderr output that might indicate problems
        if (result.stderr && captureStderr) {
          this.analyzeStderr(result.stderr, command);
        }

        return result;
      } catch (error) {
        lastError = error;
        attempt++;

        // Log the error
        this.logError({
          type: 'COMMAND_EXECUTION',
          command,
          attempt,
          error: error.message,
          stderr: error.stderr,
          stdout: error.stdout
        });

        // Wait before retry
        if (attempt < retries) {
          await this.delay(retryDelay * attempt);
        }
      }
    }

    if (throwOnError) {
      throw new Error(`Command failed after ${retries} attempts: ${lastError.message}`);
    }

    return {
      success: false,
      error: lastError,
      attempts: attempt
    };
  }

  /**
   * Execute command with timeout and stderr capture
   */
  async executeCommand(command, options) {
    return new Promise((resolve, reject) => {
      const child = exec(command, {
        timeout: options.timeout,
        windowsHide: true
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      // Set timeout handler
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
      }, options.timeout);

      // Capture stdout
      child.stdout.on('data', (data) => {
        stdout += data;
      });

      // Capture stderr with proper handling
      child.stderr.on('data', (data) => {
        stderr += data;
        if (options.captureStderr) {
          this.parseStderrError(data.toString());
        }
      });

      // Handle completion
      child.on('close', (code) => {
        clearTimeout(timer);

        if (timedOut) {
          reject(new Error(`Command timed out after ${options.timeout}ms`));
        } else if (code !== 0) {
          const error = new Error(`Command exited with code ${code}`);
          error.code = code;
          error.stdout = stdout;
          error.stderr = stderr;
          reject(error);
        } else {
          resolve({ stdout, stderr, code });
        }
      });

      // Handle errors
      child.on('error', (error) => {
        clearTimeout(timer);
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      });
    });
  }

  /**
   * Analyze stderr output for actionable insights
   */
  analyzeStderr(stderr, command) {
    const insights = [];

    // Check for common issues
    if (stderr.includes('ENOENT')) {
      insights.push('File or command not found');
    }
    if (stderr.includes('EACCES') || stderr.includes('Permission denied')) {
      insights.push('Permission denied - may need elevated privileges');
    }
    if (stderr.includes('EADDRINUSE')) {
      insights.push('Port already in use');
    }
    if (stderr.includes('npm ERR!')) {
      insights.push('npm error detected - check package.json and node_modules');
    }
    if (stderr.includes('TypeScript error')) {
      insights.push('TypeScript compilation error');
    }

    if (insights.length > 0) {
      this.logError({
        type: 'STDERR_ANALYSIS',
        command,
        insights,
        stderr: stderr.substring(0, 500) // Truncate for logging
      });
    }

    return insights;
  }

  /**
   * Register error handler for specific error types
   */
  registerErrorHandler(errorType, handler) {
    this.errorHandlers.set(errorType, handler);
  }

  /**
   * Handle critical errors that need immediate attention
   */
  handleCriticalError(type, error) {
    const errorInfo = {
      type,
      message: error.message || error,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      severity: 'CRITICAL'
    };

    // Log to error log
    this.logError(errorInfo);

    // Write to error file
    this.writeErrorToFile(errorInfo);

    // Execute global handler if set
    if (this.globalErrorHandler) {
      this.globalErrorHandler(errorInfo);
    }

    // For uncaught exceptions, exit gracefully
    if (type === 'UNCAUGHT_EXCEPTION') {
      console.error('💥 Critical error - shutting down gracefully...');
      process.exit(1);
    }
  }

  /**
   * Log error to internal buffer
   */
  logError(errorInfo) {
    this.errorLog.push({
      ...errorInfo,
      id: this.generateErrorId(),
      timestamp: errorInfo.timestamp || new Date().toISOString()
    });

    // Maintain log size
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog.shift();
    }

    // Console output for development
    if (process.env.NODE_ENV === 'development') {
      console.error('[ERROR]', errorInfo);
    }
  }

  /**
   * Log warning
   */
  logWarning(warning) {
    this.logError({
      type: 'WARNING',
      message: warning.message || warning,
      stack: warning.stack,
      severity: 'WARNING'
    });
  }

  /**
   * Write error to file for persistence
   */
  async writeErrorToFile(errorInfo) {
    try {
      const errorDir = path.join(process.cwd(), '.claude-session', 'errors');
      await fs.mkdir(errorDir, { recursive: true });

      const filename = `error-${Date.now()}.json`;
      const filepath = path.join(errorDir, filename);

      await fs.writeFile(filepath, JSON.stringify(errorInfo, null, 2));
    } catch (writeError) {
      console.error('Failed to write error to file:', writeError);
    }
  }

  /**
   * Get recent errors
   */
  getRecentErrors(count = 10) {
    return this.errorLog.slice(-count);
  }

  /**
   * Get stderr buffer
   */
  getStderrBuffer() {
    return [...this.stderrBuffer];
  }

  /**
   * Clear error log
   */
  clearErrorLog() {
    this.errorLog = [];
  }

  /**
   * Clear stderr buffer
   */
  clearStderrBuffer() {
    this.stderrBuffer = [];
  }

  /**
   * Generate unique error ID
   */
  generateErrorId() {
    return `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create error report
   */
  async createErrorReport() {
    const report = {
      timestamp: new Date().toISOString(),
      totalErrors: this.errorLog.length,
      recentErrors: this.getRecentErrors(20),
      stderrBuffer: this.getStderrBuffer(),
      errorTypes: this.categorizeErrors(),
      systemInfo: {
        platform: process.platform,
        nodeVersion: process.version,
        memory: process.memoryUsage(),
        uptime: process.uptime()
      }
    };

    return report;
  }

  /**
   * Categorize errors by type
   */
  categorizeErrors() {
    const categories = {};
    
    for (const error of this.errorLog) {
      const type = error.type || 'UNKNOWN';
      if (!categories[type]) {
        categories[type] = {
          count: 0,
          recent: []
        };
      }
      categories[type].count++;
      if (categories[type].recent.length < 3) {
        categories[type].recent.push({
          message: error.message,
          timestamp: error.timestamp
        });
      }
    }

    return categories;
  }

  /**
   * Export error log to file
   */
  async exportErrorLog(format = 'json') {
    const report = await this.createErrorReport();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `error-report-${timestamp}.${format}`;
    const filepath = path.join(process.cwd(), '.claude-session', 'reports', filename);

    await fs.mkdir(path.dirname(filepath), { recursive: true });

    if (format === 'json') {
      await fs.writeFile(filepath, JSON.stringify(report, null, 2));
    } else if (format === 'md') {
      const markdown = this.generateMarkdownReport(report);
      await fs.writeFile(filepath, markdown);
    }

    return filepath;
  }

  /**
   * Generate markdown error report
   */
  generateMarkdownReport(report) {
    let md = `# SYNTHEX Error Report\n\n`;
    md += `**Generated:** ${report.timestamp}\n\n`;
    md += `## Summary\n`;
    md += `- Total Errors: ${report.totalErrors}\n`;
    md += `- Platform: ${report.systemInfo.platform}\n`;
    md += `- Node Version: ${report.systemInfo.nodeVersion}\n`;
    md += `- Uptime: ${Math.floor(report.systemInfo.uptime / 60)} minutes\n\n`;

    md += `## Error Categories\n`;
    for (const [type, data] of Object.entries(report.errorTypes)) {
      md += `### ${type} (${data.count} occurrences)\n`;
      for (const error of data.recent) {
        md += `- ${error.message} (${error.timestamp})\n`;
      }
      md += `\n`;
    }

    md += `## Recent Errors\n`;
    for (const error of report.recentErrors) {
      md += `### ${error.type || 'UNKNOWN'} - ${error.timestamp}\n`;
      md += `${error.message}\n`;
      if (error.stack) {
        md += `\`\`\`\n${error.stack}\n\`\`\`\n`;
      }
      md += `\n`;
    }

    return md;
  }
}

// Export singleton instance
const errorHandler = new EnhancedErrorHandler();
export default errorHandler;