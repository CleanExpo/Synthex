/**
 * Performance Analyzer Sub-Agent
 * Identifies performance bottlenecks and optimization opportunities
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { 
  QualitySubAgent, 
  QualityIssue, 
  AnalysisContext, 
  SupportedLanguage,
  AutoFix 
} from '../code-quality-analyzer';

export interface PerformanceRule {
  id: string;
  name: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  languages: SupportedLanguage[];
  pattern: RegExp;
  category: 'memory' | 'cpu' | 'io' | 'network' | 'rendering' | 'bundle';
  impact: PerformanceImpact;
  fix?: PerformanceFix;
}

export interface PerformanceImpact {
  description: string;
  severity: 'blocking' | 'significant' | 'moderate' | 'minor';
  metrics: {
    memoryIncrease?: string;
    cpuOverhead?: string;
    renderBlocking?: boolean;
    bundleSize?: string;
  };
}

export interface PerformanceFix extends AutoFix {
  performanceGain: string;
  alternativeApproach?: string;
}

export interface PerformanceMetrics {
  complexity: number;
  nestedLoops: number;
  largeFiles: number;
  inefficientOperations: number;
  memoryLeaks: number;
  asyncIssues: number;
}

export class PerformanceAnalyzer implements QualitySubAgent {
  public readonly name = 'Performance Analyzer';
  public readonly category = 'performance' as const;
  public readonly supportedLanguages: SupportedLanguage[] = [
    'javascript', 'typescript', 'python', 'swift', 'go', 'rust', 'java', 'csharp'
  ];

  private performanceRules: PerformanceRule[] = [];
  private metrics: PerformanceMetrics = {
    complexity: 0,
    nestedLoops: 0,
    largeFiles: 0,
    inefficientOperations: 0,
    memoryLeaks: 0,
    asyncIssues: 0
  };

  constructor() {
    this.initializePerformanceRules();
  }

  /**
   * Analyze code for performance issues
   */
  async analyze(context: AnalysisContext): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];

    try {
      // Reset metrics
      this.resetMetrics();

      // Static performance analysis
      const staticIssues = await this.performStaticAnalysis(context);
      issues.push(...staticIssues);

      // Bundle size analysis
      const bundleIssues = await this.analyzeBundleSize(context);
      issues.push(...bundleIssues);

      // Memory usage analysis
      const memoryIssues = await this.analyzeMemoryUsage(context);
      issues.push(...memoryIssues);

      // Async/await pattern analysis
      const asyncIssues = await this.analyzeAsyncPatterns(context);
      issues.push(...asyncIssues);

      // Database query optimization
      const dbIssues = await this.analyzeDatabaseQueries(context);
      issues.push(...dbIssues);

      // Language-specific performance checks
      const languageIssues = await this.performLanguageSpecificChecks(context);
      issues.push(...languageIssues);

      // Sort by impact and severity
      return issues.sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        if (a.severity !== b.severity) {
          return severityOrder[a.severity] - severityOrder[b.severity];
        }
        return b.confidence - a.confidence;
      });

    } catch (error) {
      console.error('Performance analysis failed:', error);
      return [];
    }
  }

  /**
   * Check if an issue can be auto-fixed
   */
  canAutoFix(issue: QualityIssue): boolean {
    const rule = this.findRuleById(issue.rule || '');
    return rule?.fix?.canAutoApply === true && rule.fix.riskLevel === 'low';
  }

  /**
   * Apply automatic fix for performance issue
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
      console.error('Failed to apply performance fix:', error);
      return false;
    }
  }

  /**
   * Initialize comprehensive performance rules
   */
  private initializePerformanceRules(): void {
    this.performanceRules = [
      // Memory leaks
      {
        id: 'memory-leak-listeners',
        name: 'Event Listener Memory Leak',
        description: 'Event listeners added without cleanup can cause memory leaks',
        severity: 'high',
        languages: ['javascript', 'typescript'],
        pattern: /addEventListener\s*\([^)]+\)(?![^{]*removeEventListener)/gi,
        category: 'memory',
        impact: {
          description: 'Memory usage grows over time due to uncleaned event listeners',
          severity: 'significant',
          metrics: { memoryIncrease: '10-50MB over time' }
        },
        fix: {
          description: 'Add corresponding removeEventListener in cleanup',
          oldText: '',
          newText: '',
          canAutoApply: false,
          riskLevel: 'medium',
          performanceGain: 'Prevention of memory leaks'
        }
      },

      // Inefficient loops
      {
        id: 'nested-loops-high-complexity',
        name: 'Nested Loops with High Complexity',
        description: 'Deeply nested loops can cause performance bottlenecks',
        severity: 'medium',
        languages: ['javascript', 'typescript', 'python', 'java', 'csharp'],
        pattern: /for\s*\([^}]*for\s*\([^}]*for\s*\(/gi,
        category: 'cpu',
        impact: {
          description: 'O(n³) or higher complexity can cause significant slowdowns',
          severity: 'significant',
          metrics: { cpuOverhead: 'High' }
        }
      },

      // DOM manipulation inefficiencies
      {
        id: 'dom-manipulation-loop',
        name: 'DOM Manipulation in Loop',
        description: 'DOM modifications inside loops cause layout thrashing',
        severity: 'high',
        languages: ['javascript', 'typescript'],
        pattern: /for\s*\([^}]*(?:appendChild|innerHTML|textContent|style\.|setAttribute)/gi,
        category: 'rendering',
        impact: {
          description: 'Forces browser reflows and repaints on each iteration',
          severity: 'blocking',
          metrics: { renderBlocking: true }
        },
        fix: {
          description: 'Use DocumentFragment or batch DOM updates',
          oldText: '',
          newText: '',
          canAutoApply: false,
          riskLevel: 'low',
          performanceGain: '50-90% improvement in DOM manipulation',
          alternativeApproach: 'Use virtual DOM or batch operations'
        }
      },

      // Inefficient array operations
      {
        id: 'inefficient-array-search',
        name: 'Inefficient Array Search',
        description: 'Using indexOf or includes in loops is inefficient',
        severity: 'medium',
        languages: ['javascript', 'typescript'],
        pattern: /for\s*\([^}]*(?:indexOf|includes)\s*\(/gi,
        category: 'cpu',
        impact: {
          description: 'O(n²) complexity for array searches',
          severity: 'moderate',
          metrics: { cpuOverhead: 'Medium' }
        },
        fix: {
          description: 'Use Set or Map for faster lookups',
          oldText: 'array.indexOf(item) !== -1',
          newText: 'set.has(item)',
          canAutoApply: true,
          riskLevel: 'low',
          performanceGain: 'O(n) to O(1) lookup time'
        }
      },

      // Large bundle imports
      {
        id: 'large-library-import',
        name: 'Large Library Import',
        description: 'Importing entire large libraries increases bundle size',
        severity: 'medium',
        languages: ['javascript', 'typescript'],
        pattern: /import\s+(?:\*\s+as\s+\w+|\{[^}]{50,}\})\s+from\s+['"](?:lodash|moment|rxjs|antd)['"]/gi,
        category: 'bundle',
        impact: {
          description: 'Increases bundle size and initial load time',
          severity: 'moderate',
          metrics: { bundleSize: '100KB-1MB+' }
        },
        fix: {
          description: 'Use tree-shakable imports',
          oldText: "import * as _ from 'lodash'",
          newText: "import { debounce, throttle } from 'lodash'",
          canAutoApply: true,
          riskLevel: 'low',
          performanceGain: 'Reduced bundle size by 50-90%'
        }
      },

      // Synchronous operations
      {
        id: 'sync-file-operations',
        name: 'Synchronous File Operations',
        description: 'Synchronous file operations block the event loop',
        severity: 'high',
        languages: ['javascript', 'typescript'],
        pattern: /fs\.(?:readFileSync|writeFileSync|statSync|existsSync)/gi,
        category: 'io',
        impact: {
          description: 'Blocks event loop and reduces application responsiveness',
          severity: 'blocking',
          metrics: { cpuOverhead: 'Blocking' }
        },
        fix: {
          description: 'Use async file operations',
          oldText: 'fs.readFileSync',
          newText: 'await fs.promises.readFile',
          canAutoApply: true,
          riskLevel: 'medium',
          performanceGain: 'Non-blocking I/O operations'
        }
      },

      // Memory-intensive operations
      {
        id: 'large-array-creation',
        name: 'Large Array Creation',
        description: 'Creating very large arrays can cause memory issues',
        severity: 'medium',
        languages: ['javascript', 'typescript', 'python'],
        pattern: /new\s+Array\s*\(\s*[0-9]{6,}\s*\)|Array\.from\s*\(\s*{\s*length:\s*[0-9]{6,}/gi,
        category: 'memory',
        impact: {
          description: 'High memory allocation can cause garbage collection pressure',
          severity: 'significant',
          metrics: { memoryIncrease: '100MB+' }
        }
      },

      // Network inefficiencies
      {
        id: 'sequential-api-calls',
        name: 'Sequential API Calls',
        description: 'Sequential API calls instead of parallel requests',
        severity: 'medium',
        languages: ['javascript', 'typescript', 'python'],
        pattern: /await\s+fetch[^}]*await\s+fetch/gi,
        category: 'network',
        impact: {
          description: 'Increases total request time due to network latency',
          severity: 'moderate',
          metrics: {}
        },
        fix: {
          description: 'Use Promise.all for parallel requests',
          oldText: 'await fetch(url1); await fetch(url2);',
          newText: 'await Promise.all([fetch(url1), fetch(url2)]);',
          canAutoApply: true,
          riskLevel: 'low',
          performanceGain: '50% reduction in network wait time'
        }
      },

      // Regular expression inefficiencies
      {
        id: 'regex-in-loop',
        name: 'Regular Expression in Loop',
        description: 'Compiling regex inside loops is inefficient',
        severity: 'medium',
        languages: ['javascript', 'typescript', 'python'],
        pattern: /for\s*\([^}]*new\s+RegExp\s*\(/gi,
        category: 'cpu',
        impact: {
          description: 'Regex compilation overhead on each iteration',
          severity: 'moderate',
          metrics: { cpuOverhead: 'Medium' }
        },
        fix: {
          description: 'Move regex compilation outside the loop',
          oldText: '',
          newText: '',
          canAutoApply: false,
          riskLevel: 'low',
          performanceGain: '20-50% improvement in loop performance'
        }
      },

      // Database query inefficiencies
      {
        id: 'n-plus-one-query',
        name: 'N+1 Query Problem',
        description: 'Query inside loop indicates N+1 problem',
        severity: 'high',
        languages: ['javascript', 'typescript', 'python'],
        pattern: /for\s*\([^}]*(?:query|find|findOne|select)\s*\(/gi,
        category: 'io',
        impact: {
          description: 'Exponential increase in database queries',
          severity: 'blocking',
          metrics: {}
        }
      }
    ];
  }

  /**
   * Perform static performance analysis
   */
  private async performStaticAnalysis(context: AnalysisContext): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];

    for (const filePath of context.files) {
      if (!this.isFileSupported(filePath, context.language)) continue;

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');

        // Check file size
        if (content.length > 100000) { // 100KB
          this.metrics.largeFiles++;
          issues.push(this.createPerformanceIssue({
            id: 'large-file-size',
            name: 'Large File Size',
            description: 'Large files can impact IDE performance and maintainability',
            severity: 'medium',
            file: filePath,
            impact: 'Slower loading and processing times',
            confidence: 0.8
          }));
        }

        // Apply performance rules
        for (const rule of this.performanceRules) {
          if (!rule.languages.includes(context.language)) continue;

          const matches = content.matchAll(rule.pattern);
          for (const match of matches) {
            const lineNumber = this.getLineNumber(content, match.index || 0);
            
            // Update metrics
            this.updateMetrics(rule.category);
            
            issues.push(this.createPerformanceIssueFromRule({
              rule,
              file: filePath,
              line: lineNumber,
              match: match[0],
              context
            }));
          }
        }

        // Check for deeply nested code
        const nestingIssues = this.analyzeNesting(filePath, lines);
        issues.push(...nestingIssues);

        // Check for long functions
        const functionIssues = this.analyzeFunctionLength(filePath, content);
        issues.push(...functionIssues);

      } catch (error) {
        console.error(`Failed to analyze performance for file ${filePath}:`, error);
      }
    }

    return issues;
  }

  /**
   * Analyze bundle size and imports
   */
  private async analyzeBundleSize(context: AnalysisContext): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];

    // Check package.json for large dependencies
    const packageJsonPath = path.join(context.projectPath, 'package.json');
    try {
      const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageContent);
      
      const largeDependencies = this.getLargeDependencies();
      const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      for (const [depName, info] of largeDependencies) {
        if (allDeps[depName]) {
          issues.push({
            id: `bundle-large-dep-${depName}`,
            type: 'warning',
            severity: 'medium',
            category: 'performance',
            title: `Large Dependency: ${depName}`,
            description: `${depName} is a large dependency (${info.size}) - consider alternatives`,
            file: packageJsonPath,
            impact: `Increases bundle size by approximately ${info.size}`,
            confidence: 0.9,
            source: this.name,
            fix: info.alternative ? {
              description: `Consider using ${info.alternative} instead`,
              oldText: `"${depName}"`,
              newText: `"${info.alternative}"`,
              canAutoApply: false,
              riskLevel: 'high'
            } : undefined
          });
        }
      }
    } catch (error) {
      // package.json not found or invalid
    }

    return issues;
  }

  /**
   * Analyze memory usage patterns
   */
  private async analyzeMemoryUsage(context: AnalysisContext): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];

    for (const filePath of context.files) {
      if (!this.isFileSupported(filePath, context.language)) continue;

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        
        // Check for potential memory leaks
        const memoryLeakPatterns = [
          {
            pattern: /setInterval\s*\([^}]*\)(?![^{]*clearInterval)/gi,
            name: 'Uncleaned setInterval',
            description: 'setInterval without clearInterval can cause memory leaks'
          },
          {
            pattern: /setTimeout\s*\([^}]*\)(?![^{]*clearTimeout)/gi,
            name: 'Potential setTimeout Memory Leak',
            description: 'Long-running setTimeout without cleanup'
          },
          {
            pattern: /new\s+(?:Map|Set|WeakMap|WeakSet)\s*\(\)(?![^{]*(?:clear|delete))/gi,
            name: 'Uncleaned Collection',
            description: 'Collections without cleanup can accumulate memory'
          }
        ];

        for (const { pattern, name, description } of memoryLeakPatterns) {
          const matches = content.matchAll(pattern);
          for (const match of matches) {
            this.metrics.memoryLeaks++;
            const lineNumber = this.getLineNumber(content, match.index || 0);
            
            issues.push({
              id: `memory-${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
              type: 'warning',
              severity: 'medium',
              category: 'performance',
              title: name,
              description,
              file: filePath,
              line: lineNumber,
              impact: 'Potential memory leak leading to increased memory usage',
              confidence: 0.7,
              source: this.name
            });
          }
        }
      } catch (error) {
        console.error(`Failed to analyze memory usage for ${filePath}:`, error);
      }
    }

    return issues;
  }

  /**
   * Analyze async/await patterns
   */
  private async analyzeAsyncPatterns(context: AnalysisContext): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];

    for (const filePath of context.files) {
      if (!this.isFileSupported(filePath, context.language)) continue;

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        
        // Check for blocking async patterns
        const blockingPatterns = [
          {
            pattern: /await\s+[^;]+;\s*await\s+[^;]+;\s*await\s+[^;]+;/gi,
            name: 'Sequential Async Calls',
            description: 'Multiple sequential await calls that could be parallelized',
            fix: 'Use Promise.all() for independent async operations'
          },
          {
            pattern: /for\s*\([^}]*await\s+/gi,
            name: 'Await in Loop',
            description: 'Using await inside loops serializes async operations',
            fix: 'Use Promise.all() with map() for parallel execution'
          }
        ];

        for (const { pattern, name, description, fix } of blockingPatterns) {
          const matches = content.matchAll(pattern);
          for (const match of matches) {
            this.metrics.asyncIssues++;
            const lineNumber = this.getLineNumber(content, match.index || 0);
            
            issues.push({
              id: `async-${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
              type: 'warning',
              severity: 'medium',
              category: 'performance',
              title: name,
              description,
              file: filePath,
              line: lineNumber,
              impact: 'Reduces concurrency and increases execution time',
              confidence: 0.85,
              source: this.name,
              fix: {
                description: fix,
                oldText: match[0],
                newText: '',
                canAutoApply: false,
                riskLevel: 'medium'
              }
            });
          }
        }
      } catch (error) {
        console.error(`Failed to analyze async patterns for ${filePath}:`, error);
      }
    }

    return issues;
  }

  /**
   * Analyze database queries for performance issues
   */
  private async analyzeDatabaseQueries(context: AnalysisContext): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];

    for (const filePath of context.files) {
      if (!this.isFileSupported(filePath, context.language)) continue;

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        
        // Check for query performance issues
        const queryPatterns = [
          {
            pattern: /SELECT\s+\*\s+FROM/gi,
            name: 'SELECT * Query',
            description: 'SELECT * queries retrieve unnecessary data',
            severity: 'medium' as const
          },
          {
            pattern: /WHERE\s+[^=]*LIKE\s+['"][%][^%]*[%]['"]/gi,
            name: 'Inefficient LIKE Query',
            description: 'LIKE queries with leading wildcards cannot use indexes',
            severity: 'high' as const
          },
          {
            pattern: /(?:WHERE|AND|OR)\s+UPPER\s*\(|(?:WHERE|AND|OR)\s+LOWER\s*\(/gi,
            name: 'Function in WHERE Clause',
            description: 'Functions in WHERE clauses prevent index usage',
            severity: 'medium' as const
          }
        ];

        for (const { pattern, name, description, severity } of queryPatterns) {
          const matches = content.matchAll(pattern);
          for (const match of matches) {
            const lineNumber = this.getLineNumber(content, match.index || 0);
            
            issues.push({
              id: `db-${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
              type: 'warning',
              severity,
              category: 'performance',
              title: name,
              description,
              file: filePath,
              line: lineNumber,
              impact: 'Slow database queries can impact application performance',
              confidence: 0.8,
              source: this.name
            });
          }
        }
      } catch (error) {
        console.error(`Failed to analyze database queries for ${filePath}:`, error);
      }
    }

    return issues;
  }

  /**
   * Perform language-specific performance checks
   */
  private async performLanguageSpecificChecks(context: AnalysisContext): Promise<QualityIssue[]> {
    switch (context.language) {
      case 'javascript':
      case 'typescript':
        return this.checkJavaScriptPerformance(context);
      case 'python':
        return this.checkPythonPerformance(context);
      default:
        return [];
    }
  }

  // Language-specific performance checkers
  private async checkJavaScriptPerformance(context: AnalysisContext): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];
    
    for (const filePath of context.files) {
      if (!filePath.match(/\.(js|jsx|ts|tsx)$/)) continue;
      
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        
        // Check for React-specific performance issues
        if (content.includes('React') || content.includes('useState') || content.includes('useEffect')) {
          const reactIssues = await this.checkReactPerformance(filePath, content);
          issues.push(...reactIssues);
        }
        
        // Check for Node.js specific issues
        if (content.includes('require(') || content.includes('process.')) {
          const nodeIssues = await this.checkNodePerformance(filePath, content);
          issues.push(...nodeIssues);
        }
        
      } catch (error) {
        console.error(`Failed to check JavaScript performance for ${filePath}:`, error);
      }
    }

    return issues;
  }

  private async checkReactPerformance(filePath: string, content: string): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];
    
    // Check for missing React.memo on components
    if (content.includes('function ') && content.includes('return (') && !content.includes('React.memo') && !content.includes('memo(')) {
      issues.push({
        id: `react-missing-memo-${Date.now()}`,
        type: 'suggestion',
        severity: 'low',
        category: 'performance',
        title: 'Consider React.memo for Component',
        description: 'Component could benefit from React.memo to prevent unnecessary re-renders',
        file: filePath,
        impact: 'Unnecessary re-renders can impact React app performance',
        confidence: 0.6,
        source: this.name
      });
    }
    
    // Check for missing useCallback on functions
    const functionInEffectPattern = /useEffect\s*\(\s*\(\s*\)\s*=>\s*{[^}]*function\s+\w+/gi;
    if (functionInEffectPattern.test(content)) {
      issues.push({
        id: `react-missing-usecallback-${Date.now()}`,
        type: 'suggestion',
        severity: 'low',
        category: 'performance',
        title: 'Consider useCallback for Functions',
        description: 'Functions defined in useEffect should use useCallback to prevent unnecessary re-creation',
        file: filePath,
        impact: 'Function re-creation on every render',
        confidence: 0.7,
        source: this.name
      });
    }
    
    return issues;
  }

  private async checkNodePerformance(filePath: string, content: string): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];
    
    // Check for sync operations in Node.js
    const syncOperations = ['readFileSync', 'writeFileSync', 'statSync', 'readdirSync'];
    for (const syncOp of syncOperations) {
      if (content.includes(syncOp)) {
        issues.push({
          id: `node-sync-operation-${syncOp}-${Date.now()}`,
          type: 'warning',
          severity: 'medium',
          category: 'performance',
          title: `Synchronous Operation: ${syncOp}`,
          description: `${syncOp} blocks the event loop - use async alternative`,
          file: filePath,
          impact: 'Blocks event loop and reduces server throughput',
          confidence: 0.9,
          source: this.name
        });
      }
    }
    
    return issues;
  }

  private async checkPythonPerformance(context: AnalysisContext): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];
    
    for (const filePath of context.files) {
      if (!filePath.endsWith('.py')) continue;
      
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        
        // Check for inefficient list operations
        if (content.includes('list.append') && content.includes('for ')) {
          issues.push({
            id: `python-inefficient-list-append-${Date.now()}`,
            type: 'suggestion',
            severity: 'low',
            category: 'performance',
            title: 'Consider List Comprehension',
            description: 'List comprehensions are generally faster than append in loops',
            file: filePath,
            impact: 'List comprehensions can be 2-3x faster than append loops',
            confidence: 0.8,
            source: this.name
          });
        }
        
        // Check for global variables in loops
        if (content.includes('global ') && content.includes('for ')) {
          issues.push({
            id: `python-global-in-loop-${Date.now()}`,
            type: 'warning',
            severity: 'medium',
            category: 'performance',
            title: 'Global Variable Access in Loop',
            description: 'Accessing global variables in loops is slower than local variables',
            file: filePath,
            impact: 'Global variable access adds overhead in tight loops',
            confidence: 0.7,
            source: this.name
          });
        }
        
      } catch (error) {
        console.error(`Failed to check Python performance for ${filePath}:`, error);
      }
    }

    return issues;
  }

  // Helper methods
  private resetMetrics(): void {
    this.metrics = {
      complexity: 0,
      nestedLoops: 0,
      largeFiles: 0,
      inefficientOperations: 0,
      memoryLeaks: 0,
      asyncIssues: 0
    };
  }

  private updateMetrics(category: PerformanceRule['category']): void {
    switch (category) {
      case 'cpu':
        this.metrics.inefficientOperations++;
        break;
      case 'memory':
        this.metrics.memoryLeaks++;
        break;
      case 'io':
        this.metrics.asyncIssues++;
        break;
    }
  }

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

  private findRuleById(ruleId: string): PerformanceRule | undefined {
    return this.performanceRules.find(rule => rule.id === ruleId);
  }

  private createPerformanceIssue(params: {
    id: string;
    name: string;
    description: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    file: string;
    line?: number;
    impact: string;
    confidence: number;
  }): QualityIssue {
    return {
      id: `perf_${params.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: params.severity === 'critical' ? 'error' : 'warning',
      severity: params.severity,
      category: 'performance',
      title: params.name,
      description: params.description,
      file: params.file,
      line: params.line,
      impact: params.impact,
      confidence: params.confidence,
      source: this.name
    };
  }

  private createPerformanceIssueFromRule(params: {
    rule: PerformanceRule;
    file: string;
    line: number;
    match: string;
    context: AnalysisContext;
  }): QualityIssue {
    const { rule, file, line, match, context } = params;
    
    return {
      id: `perf_${rule.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: rule.severity === 'critical' ? 'error' : 'warning',
      severity: rule.severity,
      category: 'performance',
      title: rule.name,
      description: `${rule.description} - ${rule.impact.description}`,
      file,
      line,
      rule: rule.id,
      impact: rule.impact.description,
      confidence: 0.85,
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

  private analyzeNesting(filePath: string, lines: string[]): QualityIssue[] {
    const issues: QualityIssue[] = [];
    let maxNesting = 0;
    let currentNesting = 0;
    
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed.includes('{') || trimmed.includes('if ') || trimmed.includes('for ') || trimmed.includes('while ')) {
        currentNesting++;
        maxNesting = Math.max(maxNesting, currentNesting);
      }
      if (trimmed.includes('}')) {
        currentNesting = Math.max(0, currentNesting - 1);
      }
    });
    
    if (maxNesting > 5) {
      this.metrics.complexity++;
      issues.push({
        id: `nesting-complexity-${Date.now()}`,
        type: 'warning',
        severity: 'medium',
        category: 'performance',
        title: 'High Nesting Complexity',
        description: `Maximum nesting level of ${maxNesting} detected - consider refactoring`,
        file: filePath,
        impact: 'High complexity can impact maintainability and performance',
        confidence: 0.8,
        source: this.name
      });
    }
    
    return issues;
  }

  private analyzeFunctionLength(filePath: string, content: string): QualityIssue[] {
    const issues: QualityIssue[] = [];
    
    // Simple function detection (could be improved with AST parsing)
    const functionPattern = /function\s+\w+\s*\([^)]*\)\s*\{([^{}]*\{[^{}]*\}[^{}]*)*[^{}]*\}/gs;
    const matches = content.matchAll(functionPattern);
    
    for (const match of matches) {
      const functionCode = match[0];
      const lineCount = functionCode.split('\n').length;
      
      if (lineCount > 50) {
        const lineNumber = this.getLineNumber(content, match.index || 0);
        issues.push({
          id: `long-function-${Date.now()}`,
          type: 'warning',
          severity: 'medium',
          category: 'performance',
          title: 'Long Function',
          description: `Function has ${lineCount} lines - consider breaking into smaller functions`,
          file: filePath,
          line: lineNumber,
          impact: 'Long functions are harder to maintain and can impact performance',
          confidence: 0.7,
          source: this.name
        });
      }
    }
    
    return issues;
  }

  private getLargeDependencies(): Map<string, { size: string; alternative?: string }> {
    return new Map([
      ['moment', { size: '67KB', alternative: 'dayjs' }],
      ['lodash', { size: '71KB', alternative: 'lodash-es with tree shaking' }],
      ['rxjs', { size: '200KB+', alternative: 'specific operators only' }],
      ['antd', { size: '1MB+', alternative: 'individual component imports' }],
      ['material-ui', { size: '500KB+', alternative: 'individual component imports' }]
    ]);
  }
}

export default PerformanceAnalyzer;