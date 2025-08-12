/**
 * IDE Diagnostics Integration for SYNTHEX
 * Real-time error detection and code quality monitoring
 * using Claude Code's IDE MCP integration
 */

class IDEDiagnosticsIntegration {
  constructor() {
    this.diagnosticsCache = new Map();
    this.errorThresholds = {
      error: 0,      // No errors allowed
      warning: 10,   // Max 10 warnings
      info: 50       // Max 50 info messages
    };
    this.monitoring = false;
    this.callbacks = new Map();
  }

  /**
   * Get diagnostics for a specific file or all files
   * @param {string} uri - Optional file URI
   * @returns {Promise<object>} Diagnostics data
   */
  async getDiagnostics(uri = null) {
    try {
      const diagnostics = await mcp__ide__getDiagnostics({ uri });
      
      // Process and categorize diagnostics
      const processed = this.processDiagnostics(diagnostics);
      
      // Cache results
      if (uri) {
        this.diagnosticsCache.set(uri, processed);
      } else {
        this.diagnosticsCache.set('_all', processed);
      }
      
      // Check thresholds
      this.checkThresholds(processed);
      
      return processed;
    } catch (error) {
      console.error('Failed to get diagnostics:', error);
      throw error;
    }
  }

  /**
   * Process raw diagnostics into categorized format
   * @param {object} diagnostics - Raw diagnostics from IDE
   * @returns {object} Processed diagnostics
   */
  processDiagnostics(diagnostics) {
    const processed = {
      errors: [],
      warnings: [],
      info: [],
      hints: [],
      summary: {
        totalErrors: 0,
        totalWarnings: 0,
        totalInfo: 0,
        totalHints: 0,
        files: []
      }
    };

    // Process each diagnostic entry
    if (diagnostics && diagnostics.diagnostics) {
      for (const [file, fileDiagnostics] of Object.entries(diagnostics.diagnostics)) {
        processed.summary.files.push(file);
        
        fileDiagnostics.forEach(diagnostic => {
          const entry = {
            file,
            line: diagnostic.range?.start?.line || 0,
            column: diagnostic.range?.start?.character || 0,
            message: diagnostic.message,
            source: diagnostic.source || 'unknown',
            code: diagnostic.code
          };

          switch (diagnostic.severity) {
            case 1: // Error
              processed.errors.push(entry);
              processed.summary.totalErrors++;
              break;
            case 2: // Warning
              processed.warnings.push(entry);
              processed.summary.totalWarnings++;
              break;
            case 3: // Info
              processed.info.push(entry);
              processed.summary.totalInfo++;
              break;
            case 4: // Hint
              processed.hints.push(entry);
              processed.summary.totalHints++;
              break;
          }
        });
      }
    }

    return processed;
  }

  /**
   * Check if diagnostics exceed thresholds
   * @param {object} diagnostics - Processed diagnostics
   * @returns {boolean} True if within thresholds
   */
  checkThresholds(diagnostics) {
    const violations = [];

    if (diagnostics.summary.totalErrors > this.errorThresholds.error) {
      violations.push(`Errors: ${diagnostics.summary.totalErrors} (max: ${this.errorThresholds.error})`);
    }

    if (diagnostics.summary.totalWarnings > this.errorThresholds.warning) {
      violations.push(`Warnings: ${diagnostics.summary.totalWarnings} (max: ${this.errorThresholds.warning})`);
    }

    if (diagnostics.summary.totalInfo > this.errorThresholds.info) {
      violations.push(`Info: ${diagnostics.summary.totalInfo} (max: ${this.errorThresholds.info})`);
    }

    if (violations.length > 0) {
      console.warn('Diagnostic thresholds exceeded:', violations.join(', '));
      this.triggerCallbacks('threshold-exceeded', { violations, diagnostics });
      return false;
    }

    return true;
  }

  /**
   * Start monitoring diagnostics with interval
   * @param {number} interval - Check interval in milliseconds
   */
  startMonitoring(interval = 5000) {
    if (this.monitoring) {
      console.warn('Monitoring already active');
      return;
    }

    this.monitoring = true;
    this.monitoringInterval = setInterval(async () => {
      try {
        const diagnostics = await this.getDiagnostics();
        this.triggerCallbacks('diagnostics-updated', diagnostics);
        
        // Auto-fix if enabled
        if (this.autoFix && diagnostics.summary.totalErrors === 0) {
          await this.autoFixWarnings(diagnostics.warnings);
        }
      } catch (error) {
        console.error('Monitoring error:', error);
      }
    }, interval);

    console.log(`Diagnostics monitoring started (interval: ${interval}ms)`);
  }

  /**
   * Stop monitoring diagnostics
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoring = false;
      console.log('Diagnostics monitoring stopped');
    }
  }

  /**
   * Register callback for diagnostic events
   * @param {string} event - Event name
   * @param {function} callback - Callback function
   */
  on(event, callback) {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, []);
    }
    this.callbacks.get(event).push(callback);
  }

  /**
   * Trigger callbacks for an event
   * @param {string} event - Event name
   * @param {any} data - Event data
   */
  triggerCallbacks(event, data) {
    if (this.callbacks.has(event)) {
      this.callbacks.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Callback error for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Execute code in Jupyter kernel (for notebooks)
   * @param {string} code - Python code to execute
   * @returns {Promise<object>} Execution result
   */
  async executeCode(code) {
    try {
      const result = await mcp__ide__executeCode({ code });
      return result;
    } catch (error) {
      console.error('Code execution failed:', error);
      throw error;
    }
  }

  /**
   * Get diagnostics report in markdown format
   * @returns {Promise<string>} Markdown report
   */
  async getReport() {
    const diagnostics = await this.getDiagnostics();
    
    let report = '# IDE Diagnostics Report\n\n';
    report += `Generated: ${new Date().toISOString()}\n\n`;
    
    report += '## Summary\n';
    report += `- **Errors:** ${diagnostics.summary.totalErrors}\n`;
    report += `- **Warnings:** ${diagnostics.summary.totalWarnings}\n`;
    report += `- **Info:** ${diagnostics.summary.totalInfo}\n`;
    report += `- **Hints:** ${diagnostics.summary.totalHints}\n`;
    report += `- **Files Analyzed:** ${diagnostics.summary.files.length}\n\n`;
    
    if (diagnostics.errors.length > 0) {
      report += '## Errors (Must Fix)\n';
      diagnostics.errors.forEach(error => {
        report += `- \`${error.file}:${error.line}:${error.column}\` - ${error.message}\n`;
      });
      report += '\n';
    }
    
    if (diagnostics.warnings.length > 0) {
      report += '## Warnings (Should Fix)\n';
      diagnostics.warnings.slice(0, 10).forEach(warning => {
        report += `- \`${warning.file}:${warning.line}:${warning.column}\` - ${warning.message}\n`;
      });
      if (diagnostics.warnings.length > 10) {
        report += `- ... and ${diagnostics.warnings.length - 10} more warnings\n`;
      }
      report += '\n';
    }
    
    return report;
  }

  /**
   * Auto-fix common warnings
   * @param {array} warnings - List of warnings
   */
  async autoFixWarnings(warnings) {
    const fixable = [
      'Missing semicolon',
      'Unused variable',
      'Missing return type',
      'Prefer const over let'
    ];
    
    for (const warning of warnings) {
      if (fixable.some(fix => warning.message.includes(fix))) {
        console.log(`Auto-fixing: ${warning.message} in ${warning.file}`);
        // Implement auto-fix logic here
      }
    }
  }

  /**
   * Set error thresholds
   * @param {object} thresholds - New thresholds
   */
  setThresholds(thresholds) {
    this.errorThresholds = { ...this.errorThresholds, ...thresholds };
  }

  /**
   * Clear diagnostics cache
   */
  clearCache() {
    this.diagnosticsCache.clear();
  }
}

// Create singleton instance
const ideDiagnostics = new IDEDiagnosticsIntegration();

// Export for use in SYNTHEX
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ideDiagnostics;
}

// Browser global
if (typeof window !== 'undefined') {
  window.IDEDiagnosticsIntegration = ideDiagnostics;
}