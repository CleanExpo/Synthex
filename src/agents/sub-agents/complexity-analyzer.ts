/**
 * Complexity Analyzer Sub-Agent
 * Measures code complexity including cyclomatic, cognitive, and structural complexity
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

export interface ComplexityMetrics {
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  nestingDepth: number;
  linesOfCode: number;
  maintainabilityIndex: number;
}

export interface ComplexityRule {
  id: string;
  name: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  languages: SupportedLanguage[];
  threshold: number;
  category: 'cyclomatic' | 'cognitive' | 'nesting' | 'length' | 'duplication';
  fix?: ComplexityFix;
}

export interface ComplexityFix extends AutoFix {
  refactoringApproach: string;
  estimatedEffort: 'low' | 'medium' | 'high';
}

export interface FunctionComplexity {
  name: string;
  startLine: number;
  endLine: number;
  complexity: ComplexityMetrics;
  issues: string[];
}

export class ComplexityAnalyzer implements QualitySubAgent {
  public readonly name = 'Complexity Analyzer';
  public readonly category = 'complexity' as const;
  public readonly supportedLanguages: SupportedLanguage[] = [
    'javascript', 'typescript', 'python', 'swift', 'go', 'rust', 'java', 'csharp'
  ];

  private complexityRules: ComplexityRule[] = [];
  private complexityThresholds = {
    cyclomaticComplexity: { low: 10, medium: 15, high: 20 },
    cognitiveComplexity: { low: 15, medium: 25, high: 50 },
    nestingDepth: { low: 4, medium: 6, high: 8 },
    functionLength: { low: 50, medium: 100, high: 200 },
    classLength: { low: 300, medium: 500, high: 1000 }
  };

  constructor() {
    this.initializeComplexityRules();
  }

  /**
   * Analyze code complexity
   */
  async analyze(context: AnalysisContext): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];

    try {
      for (const filePath of context.files) {
        if (!this.isFileSupported(filePath, context.language)) continue;

        const fileIssues = await this.analyzeFile(filePath, context);
        issues.push(...fileIssues);
      }

      return issues.sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });

    } catch (error) {
      console.error('Complexity analysis failed:', error);
      return [];
    }
  }

  /**
   * Check if an issue can be auto-fixed
   */
  canAutoFix(issue: QualityIssue): boolean {
    // Complexity issues typically require manual refactoring
    return false;
  }

  /**
   * Apply automatic fix (mostly suggestions for complexity)
   */
  async applyFix(issue: QualityIssue): Promise<boolean> {
    // Complexity fixes are typically manual refactoring suggestions
    return false;
  }

  /**
   * Initialize complexity rules and thresholds
   */
  private initializeComplexityRules(): void {
    this.complexityRules = [
      {
        id: 'cyclomatic-complexity-high',
        name: 'High Cyclomatic Complexity',
        description: 'Function has high cyclomatic complexity',
        severity: 'high',
        languages: ['javascript', 'typescript', 'python', 'java', 'csharp'],
        threshold: this.complexityThresholds.cyclomaticComplexity.high,
        category: 'cyclomatic',
        fix: {
          description: 'Break down into smaller functions',
          oldText: '',
          newText: '',
          canAutoApply: false,
          riskLevel: 'medium',
          refactoringApproach: 'Extract Method pattern',
          estimatedEffort: 'medium'
        }
      },
      {
        id: 'cognitive-complexity-high',
        name: 'High Cognitive Complexity',
        description: 'Function is difficult to understand due to high cognitive load',
        severity: 'high',
        languages: ['javascript', 'typescript', 'python', 'java', 'csharp'],
        threshold: this.complexityThresholds.cognitiveComplexity.high,
        category: 'cognitive',
        fix: {
          description: 'Simplify logic and reduce nesting',
          oldText: '',
          newText: '',
          canAutoApply: false,
          riskLevel: 'high',
          refactoringApproach: 'Simplify conditions and extract complex logic',
          estimatedEffort: 'high'
        }
      },
      {
        id: 'deep-nesting',
        name: 'Deep Nesting',
        description: 'Code has too many nested levels',
        severity: 'medium',
        languages: ['javascript', 'typescript', 'python', 'java', 'csharp'],
        threshold: this.complexityThresholds.nestingDepth.high,
        category: 'nesting',
        fix: {
          description: 'Use early returns and guard clauses',
          oldText: '',
          newText: '',
          canAutoApply: false,
          riskLevel: 'low',
          refactoringApproach: 'Early return pattern and guard clauses',
          estimatedEffort: 'low'
        }
      },
      {
        id: 'long-function',
        name: 'Long Function',
        description: 'Function is too long and should be broken down',
        severity: 'medium',
        languages: ['javascript', 'typescript', 'python', 'java', 'csharp'],
        threshold: this.complexityThresholds.functionLength.high,
        category: 'length',
        fix: {
          description: 'Extract smaller, focused functions',
          oldText: '',
          newText: '',
          canAutoApply: false,
          riskLevel: 'medium',
          refactoringApproach: 'Extract Method and Single Responsibility',
          estimatedEffort: 'medium'
        }
      },
      {
        id: 'long-class',
        name: 'Long Class',
        description: 'Class is too large and likely violates Single Responsibility Principle',
        severity: 'medium',
        languages: ['javascript', 'typescript', 'python', 'java', 'csharp'],
        threshold: this.complexityThresholds.classLength.high,
        category: 'length',
        fix: {
          description: 'Split into multiple focused classes',
          oldText: '',
          newText: '',
          canAutoApply: false,
          riskLevel: 'high',
          refactoringApproach: 'Extract Class and composition patterns',
          estimatedEffort: 'high'
        }
      }
    ];
  }

  /**
   * Analyze individual file for complexity issues
   */
  private async analyzeFile(filePath: string, context: AnalysisContext): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      // Analyze overall file complexity
      const fileComplexity = this.calculateFileComplexity(content, lines);
      if (fileComplexity.linesOfCode > 1000) {
        issues.push(this.createComplexityIssue({
          id: 'large-file',
          name: 'Large File',
          description: `File has ${fileComplexity.linesOfCode} lines of code`,
          severity: 'medium',
          file: filePath,
          impact: 'Large files are harder to maintain and understand',
          confidence: 0.9,
          fix: 'Consider splitting into multiple files'
        }));
      }

      // Analyze functions
      const functions = await this.extractFunctions(content, context.language);
      for (const func of functions) {
        const functionIssues = this.analyzeFunctionComplexity(func, filePath);
        issues.push(...functionIssues);
      }

      // Analyze classes (for OOP languages)
      if (this.isObjectOrientedLanguage(context.language)) {
        const classes = await this.extractClasses(content, context.language);
        for (const cls of classes) {
          const classIssues = this.analyzeClassComplexity(cls, filePath);
          issues.push(...classIssues);
        }
      }

      // Check for code duplication
      const duplicationIssues = await this.detectCodeDuplication(filePath, content);
      issues.push(...duplicationIssues);

      // Language-specific complexity checks
      const languageIssues = await this.performLanguageSpecificChecks(filePath, content, context.language);
      issues.push(...languageIssues);

    } catch (error) {
      console.error(`Failed to analyze complexity for file ${filePath}:`, error);
    }

    return issues;
  }

  /**
   * Calculate file-level complexity metrics
   */
  private calculateFileComplexity(content: string, lines: string[]): ComplexityMetrics {
    let cyclomaticComplexity = 1; // Base complexity
    let cognitiveComplexity = 0;
    let maxNestingDepth = 0;
    let currentNestingDepth = 0;

    // Count decision points and nesting
    const complexityKeywords = [
      'if', 'else', 'while', 'for', 'switch', 'case', 'catch', 
      '&&', '||', '?', ':', 'try', 'except', 'elif'
    ];

    lines.forEach(line => {
      const trimmed = line.trim().toLowerCase();
      
      // Track nesting depth
      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;
      currentNestingDepth += openBraces - closeBraces;
      maxNestingDepth = Math.max(maxNestingDepth, currentNestingDepth);

      // Count complexity contributors
      complexityKeywords.forEach(keyword => {
        const matches = (trimmed.match(new RegExp(`\\b${keyword}\\b`, 'g')) || []).length;
        cyclomaticComplexity += matches;
        
        // Cognitive complexity adds extra weight for nesting
        if (matches > 0 && currentNestingDepth > 0) {
          cognitiveComplexity += matches * (currentNestingDepth + 1);
        } else {
          cognitiveComplexity += matches;
        }
      });
    });

    const linesOfCode = lines.filter(line => 
      line.trim() && !line.trim().startsWith('//') && !line.trim().startsWith('*')
    ).length;

    const maintainabilityIndex = this.calculateMaintainabilityIndex({
      cyclomaticComplexity,
      linesOfCode,
      volume: linesOfCode * 10 // Simplified volume calculation
    });

    return {
      cyclomaticComplexity,
      cognitiveComplexity,
      nestingDepth: maxNestingDepth,
      linesOfCode,
      maintainabilityIndex
    };
  }

  /**
   * Extract functions from code based on language
   */
  private async extractFunctions(content: string, language: SupportedLanguage): Promise<FunctionComplexity[]> {
    const functions: FunctionComplexity[] = [];

    switch (language) {
      case 'javascript':
      case 'typescript':
        return this.extractJavaScriptFunctions(content);
      case 'python':
        return this.extractPythonFunctions(content);
      case 'java':
      case 'csharp':
        return this.extractJavaFunctions(content);
      default:
        return this.extractGenericFunctions(content);
    }
  }

  /**
   * Extract JavaScript/TypeScript functions
   */
  private extractJavaScriptFunctions(content: string): FunctionComplexity[] {
    const functions: FunctionComplexity[] = [];
    const lines = content.split('\n');

    // Patterns for different function types
    const patterns = [
      /function\s+(\w+)\s*\(/g,                    // function declaration
      /const\s+(\w+)\s*=\s*\([^)]*\)\s*=>/g,      // arrow function
      /(\w+)\s*:\s*function\s*\(/g,               // method in object
      /(\w+)\s*\([^)]*\)\s*\{/g                   // method-like patterns
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const functionName = match[1];
        const startLine = this.getLineNumber(content, match.index);
        
        // Find function end (simplified - could use AST parsing)
        const endLine = this.findFunctionEnd(lines, startLine);
        const functionCode = lines.slice(startLine - 1, endLine).join('\n');
        
        const complexity = this.calculateFunctionComplexity(functionCode);
        
        functions.push({
          name: functionName,
          startLine,
          endLine,
          complexity,
          issues: this.identifyComplexityIssues(complexity)
        });
      }
    });

    return functions;
  }

  /**
   * Extract Python functions
   */
  private extractPythonFunctions(content: string): FunctionComplexity[] {
    const functions: FunctionComplexity[] = [];
    const lines = content.split('\n');

    const functionPattern = /def\s+(\w+)\s*\(/g;
    let match;

    while ((match = functionPattern.exec(content)) !== null) {
      const functionName = match[1];
      const startLine = this.getLineNumber(content, match.index);
      const endLine = this.findPythonFunctionEnd(lines, startLine);
      const functionCode = lines.slice(startLine - 1, endLine).join('\n');
      
      const complexity = this.calculateFunctionComplexity(functionCode);
      
      functions.push({
        name: functionName,
        startLine,
        endLine,
        complexity,
        issues: this.identifyComplexityIssues(complexity)
      });
    }

    return functions;
  }

  /**
   * Extract Java/C# functions
   */
  private extractJavaFunctions(content: string): FunctionComplexity[] {
    const functions: FunctionComplexity[] = [];
    const lines = content.split('\n');

    // Java/C# method pattern
    const methodPattern = /(?:public|private|protected|static|\s)+[\w<>\[\]]+\s+(\w+)\s*\([^)]*\)\s*\{/g;
    let match;

    while ((match = methodPattern.exec(content)) !== null) {
      const methodName = match[1];
      const startLine = this.getLineNumber(content, match.index);
      const endLine = this.findFunctionEnd(lines, startLine);
      const functionCode = lines.slice(startLine - 1, endLine).join('\n');
      
      const complexity = this.calculateFunctionComplexity(functionCode);
      
      functions.push({
        name: methodName,
        startLine,
        endLine,
        complexity,
        issues: this.identifyComplexityIssues(complexity)
      });
    }

    return functions;
  }

  /**
   * Generic function extraction for other languages
   */
  private extractGenericFunctions(content: string): FunctionComplexity[] {
    // Simplified generic function detection
    return [];
  }

  /**
   * Calculate complexity metrics for a specific function
   */
  private calculateFunctionComplexity(functionCode: string): ComplexityMetrics {
    const lines = functionCode.split('\n');
    return this.calculateFileComplexity(functionCode, lines);
  }

  /**
   * Analyze function complexity and create issues
   */
  private analyzeFunctionComplexity(func: FunctionComplexity, filePath: string): QualityIssue[] {
    const issues: QualityIssue[] = [];

    // Check cyclomatic complexity
    if (func.complexity.cyclomaticComplexity > this.complexityThresholds.cyclomaticComplexity.high) {
      issues.push(this.createComplexityIssue({
        id: 'function-cyclomatic-complexity',
        name: 'High Cyclomatic Complexity',
        description: `Function '${func.name}' has cyclomatic complexity of ${func.complexity.cyclomaticComplexity}`,
        severity: 'high',
        file: filePath,
        line: func.startLine,
        impact: 'Functions with high cyclomatic complexity are hard to test and maintain',
        confidence: 0.95,
        fix: 'Break down into smaller, focused functions'
      }));
    } else if (func.complexity.cyclomaticComplexity > this.complexityThresholds.cyclomaticComplexity.medium) {
      issues.push(this.createComplexityIssue({
        id: 'function-cyclomatic-complexity-medium',
        name: 'Medium Cyclomatic Complexity',
        description: `Function '${func.name}' has cyclomatic complexity of ${func.complexity.cyclomaticComplexity}`,
        severity: 'medium',
        file: filePath,
        line: func.startLine,
        impact: 'Consider simplifying function logic',
        confidence: 0.8,
        fix: 'Reduce branching logic or extract helper functions'
      }));
    }

    // Check cognitive complexity
    if (func.complexity.cognitiveComplexity > this.complexityThresholds.cognitiveComplexity.high) {
      issues.push(this.createComplexityIssue({
        id: 'function-cognitive-complexity',
        name: 'High Cognitive Complexity',
        description: `Function '${func.name}' has cognitive complexity of ${func.complexity.cognitiveComplexity}`,
        severity: 'high',
        file: filePath,
        line: func.startLine,
        impact: 'Function is difficult to understand and reason about',
        confidence: 0.9,
        fix: 'Simplify nested conditions and extract complex logic'
      }));
    }

    // Check nesting depth
    if (func.complexity.nestingDepth > this.complexityThresholds.nestingDepth.high) {
      issues.push(this.createComplexityIssue({
        id: 'function-nesting-depth',
        name: 'Deep Nesting',
        description: `Function '${func.name}' has nesting depth of ${func.complexity.nestingDepth}`,
        severity: 'medium',
        file: filePath,
        line: func.startLine,
        impact: 'Deep nesting makes code harder to read and understand',
        confidence: 0.85,
        fix: 'Use early returns and guard clauses to reduce nesting'
      }));
    }

    // Check function length
    if (func.complexity.linesOfCode > this.complexityThresholds.functionLength.high) {
      issues.push(this.createComplexityIssue({
        id: 'function-length',
        name: 'Long Function',
        description: `Function '${func.name}' has ${func.complexity.linesOfCode} lines of code`,
        severity: 'medium',
        file: filePath,
        line: func.startLine,
        impact: 'Long functions are harder to understand and maintain',
        confidence: 0.8,
        fix: 'Break into smaller, single-purpose functions'
      }));
    }

    // Check maintainability index
    if (func.complexity.maintainabilityIndex < 20) {
      issues.push(this.createComplexityIssue({
        id: 'function-maintainability',
        name: 'Poor Maintainability',
        description: `Function '${func.name}' has low maintainability index: ${func.complexity.maintainabilityIndex.toFixed(1)}`,
        severity: 'high',
        file: filePath,
        line: func.startLine,
        impact: 'Function will be expensive to maintain and modify',
        confidence: 0.85,
        fix: 'Refactor to reduce complexity and improve readability'
      }));
    }

    return issues;
  }

  /**
   * Extract and analyze classes
   */
  private async extractClasses(content: string, language: SupportedLanguage): Promise<any[]> {
    // Simplified class extraction - would need proper AST parsing for production
    const classes: any[] = [];
    
    const classPattern = /class\s+(\w+)[\s\S]*?\{([\s\S]*?)\n\}/g;
    let match;

    while ((match = classPattern.exec(content)) !== null) {
      const className = match[1];
      const classBody = match[2];
      const startLine = this.getLineNumber(content, match.index);
      const endLine = startLine + classBody.split('\n').length;
      const linesOfCode = classBody.split('\n').filter(line => 
        line.trim() && !line.trim().startsWith('//')
      ).length;

      classes.push({
        name: className,
        startLine,
        endLine,
        linesOfCode,
        body: classBody
      });
    }

    return classes;
  }

  /**
   * Analyze class complexity
   */
  private analyzeClassComplexity(cls: any, filePath: string): QualityIssue[] {
    const issues: QualityIssue[] = [];

    if (cls.linesOfCode > this.complexityThresholds.classLength.high) {
      issues.push(this.createComplexityIssue({
        id: 'class-length',
        name: 'Large Class',
        description: `Class '${cls.name}' has ${cls.linesOfCode} lines of code`,
        severity: 'medium',
        file: filePath,
        line: cls.startLine,
        impact: 'Large classes likely violate Single Responsibility Principle',
        confidence: 0.8,
        fix: 'Extract related functionality into separate classes'
      }));
    }

    return issues;
  }

  /**
   * Detect code duplication
   */
  private async detectCodeDuplication(filePath: string, content: string): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];
    const lines = content.split('\n');
    const minDuplicationLength = 5; // minimum lines for duplication detection

    // Simple duplication detection (sliding window)
    for (let i = 0; i < lines.length - minDuplicationLength; i++) {
      const block = lines.slice(i, i + minDuplicationLength)
        .map(line => line.trim())
        .join('\n');

      if (block.length < 50) continue; // Skip very short blocks

      for (let j = i + minDuplicationLength; j < lines.length - minDuplicationLength; j++) {
        const compareBlock = lines.slice(j, j + minDuplicationLength)
          .map(line => line.trim())
          .join('\n');

        if (block === compareBlock) {
          issues.push(this.createComplexityIssue({
            id: 'code-duplication',
            name: 'Code Duplication',
            description: `Duplicate code block found (${minDuplicationLength} lines)`,
            severity: 'medium',
            file: filePath,
            line: i + 1,
            impact: 'Code duplication increases maintenance burden',
            confidence: 0.9,
            fix: 'Extract common code into a shared function or method'
          }));
          break; // Only report first duplicate
        }
      }
    }

    return issues;
  }

  /**
   * Language-specific complexity checks
   */
  private async performLanguageSpecificChecks(
    filePath: string, 
    content: string, 
    language: SupportedLanguage
  ): Promise<QualityIssue[]> {
    switch (language) {
      case 'javascript':
      case 'typescript':
        return this.checkJavaScriptComplexity(filePath, content);
      case 'python':
        return this.checkPythonComplexity(filePath, content);
      default:
        return [];
    }
  }

  /**
   * JavaScript/TypeScript specific complexity checks
   */
  private async checkJavaScriptComplexity(filePath: string, content: string): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];

    // Check for callback hell
    const callbackDepth = this.detectCallbackHell(content);
    if (callbackDepth > 3) {
      issues.push(this.createComplexityIssue({
        id: 'callback-hell',
        name: 'Callback Hell',
        description: `Deep callback nesting detected (${callbackDepth} levels)`,
        severity: 'high',
        file: filePath,
        impact: 'Callback hell makes code hard to read and debug',
        confidence: 0.85,
        fix: 'Use Promises, async/await, or extract functions'
      }));
    }

    // Check for complex ternary operations
    const complexTernary = /\?[^:]*\?[^:]*:/g;
    const ternaryMatches = content.match(complexTernary);
    if (ternaryMatches && ternaryMatches.length > 0) {
      issues.push(this.createComplexityIssue({
        id: 'complex-ternary',
        name: 'Complex Ternary Operations',
        description: 'Nested ternary operations detected',
        severity: 'medium',
        file: filePath,
        impact: 'Complex ternary operations reduce readability',
        confidence: 0.8,
        fix: 'Replace with if-else statements or switch cases'
      }));
    }

    return issues;
  }

  /**
   * Python specific complexity checks
   */
  private async checkPythonComplexity(filePath: string, content: string): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];

    // Check for complex list comprehensions
    const complexListComp = /\[[^\]]*for[^\]]*for[^\]]*for[^\]]*\]/g;
    if (complexListComp.test(content)) {
      issues.push(this.createComplexityIssue({
        id: 'complex-list-comprehension',
        name: 'Complex List Comprehension',
        description: 'Deeply nested list comprehension detected',
        severity: 'medium',
        file: filePath,
        impact: 'Complex list comprehensions are hard to understand',
        confidence: 0.8,
        fix: 'Break into multiple steps or use regular loops'
      }));
    }

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

  private isObjectOrientedLanguage(language: SupportedLanguage): boolean {
    return ['javascript', 'typescript', 'python', 'java', 'csharp', 'swift'].includes(language);
  }

  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }

  private findFunctionEnd(lines: string[], startLine: number): number {
    let braceCount = 0;
    let foundStart = false;

    for (let i = startLine - 1; i < lines.length; i++) {
      const line = lines[i];
      
      for (const char of line) {
        if (char === '{') {
          braceCount++;
          foundStart = true;
        } else if (char === '}') {
          braceCount--;
          if (foundStart && braceCount === 0) {
            return i + 1;
          }
        }
      }
    }

    return lines.length;
  }

  private findPythonFunctionEnd(lines: string[], startLine: number): number {
    const functionIndent = this.getIndentLevel(lines[startLine - 1]);
    
    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '') continue;
      
      const currentIndent = this.getIndentLevel(line);
      if (currentIndent <= functionIndent) {
        return i;
      }
    }

    return lines.length;
  }

  private getIndentLevel(line: string): number {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
  }

  private calculateMaintainabilityIndex(params: {
    cyclomaticComplexity: number;
    linesOfCode: number;
    volume: number;
  }): number {
    // Simplified maintainability index calculation
    const { cyclomaticComplexity, linesOfCode, volume } = params;
    
    const maintainabilityIndex = Math.max(0, 
      171 - 5.2 * Math.log(volume) - 0.23 * cyclomaticComplexity - 16.2 * Math.log(linesOfCode)
    );
    
    return maintainabilityIndex;
  }

  private identifyComplexityIssues(complexity: ComplexityMetrics): string[] {
    const issues: string[] = [];

    if (complexity.cyclomaticComplexity > 15) {
      issues.push('High cyclomatic complexity');
    }
    if (complexity.cognitiveComplexity > 25) {
      issues.push('High cognitive complexity');
    }
    if (complexity.nestingDepth > 5) {
      issues.push('Deep nesting');
    }
    if (complexity.linesOfCode > 100) {
      issues.push('Long function');
    }
    if (complexity.maintainabilityIndex < 30) {
      issues.push('Poor maintainability');
    }

    return issues;
  }

  private detectCallbackHell(content: string): number {
    // Simple detection of nested callbacks
    const lines = content.split('\n');
    let maxDepth = 0;
    let currentDepth = 0;

    for (const line of lines) {
      if (line.includes('function(') || line.includes('=>')) {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
      }
      if (line.includes('});') || line.includes('})')) {
        currentDepth = Math.max(0, currentDepth - 1);
      }
    }

    return maxDepth;
  }

  private createComplexityIssue(params: {
    id: string;
    name: string;
    description: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    file: string;
    line?: number;
    impact: string;
    confidence: number;
    fix: string;
  }): QualityIssue {
    return {
      id: `complexity_${params.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: params.severity === 'critical' ? 'error' : 'warning',
      severity: params.severity,
      category: 'complexity',
      title: params.name,
      description: params.description,
      file: params.file,
      line: params.line,
      impact: params.impact,
      confidence: params.confidence,
      source: this.name,
      fix: {
        description: params.fix,
        oldText: '',
        newText: '',
        canAutoApply: false,
        riskLevel: 'medium'
      }
    };
  }
}

export default ComplexityAnalyzer;