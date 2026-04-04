/**
 * Todo Prediction Engine
 * Intelligent system for enhancing and predicting developer tasks
 */

import { EventEmitter } from 'events';
import * as natural from 'natural';

export interface TodoItem {
  id: string;
  title: string;
  description?: string;
  category: TaskCategory;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  estimatedHours?: number;
  dependencies?: string[];
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
  predictedCompletion?: Date;
  suggestedSubtasks?: TodoItem[];
}

export type TaskCategory = 
  | 'feature' 
  | 'bugfix' 
  | 'refactor' 
  | 'documentation' 
  | 'testing' 
  | 'deployment' 
  | 'optimization'
  | 'security'
  | 'infrastructure';

export interface PredictionContext {
  projectType: string;
  techStack: string[];
  teamSize: number;
  velocity: number; // tasks per week
  historicalData: CompletedTask[];
}

export interface CompletedTask {
  category: TaskCategory;
  actualHours: number;
  estimatedHours: number;
  complexity: number; // 1-10
  dependencies: number;
  completedAt: Date;
}

export interface TaskPrediction {
  estimatedHours: number;
  confidence: number;
  suggestedPriority: TodoItem['priority'];
  potentialBlockers: string[];
  relatedTasks: string[];
  optimizationSuggestions: string[];
}

export class TodoPredictionEngine extends EventEmitter {
  private context: PredictionContext;
  private taskPatterns: Map<string, TaskPattern> = new Map();
  private nlp: any; // Natural language processor
  private taskGraph: TaskDependencyGraph;

  constructor(context: PredictionContext) {
    super();
    this.context = context;
    this.taskGraph = new TaskDependencyGraph();
    this.initializeNLP();
    this.initializePatterns();
  }

  /**
   * Initialize natural language processing
   */
  private initializeNLP(): void {
    // Initialize tokenizer and classifier
    this.nlp = {
      tokenizer: new natural.WordTokenizer(),
      classifier: new natural.BayesClassifier(),
      sentiment: new natural.SentimentAnalyzer('English', natural.PorterStemmer, 'afinn')
    };

    // Train classifier with common task patterns
    this.trainClassifier();
  }

  /**
   * Initialize task patterns
   */
  private initializePatterns(): void {
    // Feature patterns
    this.taskPatterns.set('feature-api', {
      keywords: ['api', 'endpoint', 'route', 'rest', 'graphql'],
      category: 'feature',
      averageHours: 8,
      subtaskTemplate: [
        'Design API schema',
        'Implement endpoint logic',
        'Add validation',
        'Write tests',
        'Update documentation'
      ]
    });

    this.taskPatterns.set('feature-ui', {
      keywords: ['ui', 'component', 'page', 'screen', 'interface'],
      category: 'feature',
      averageHours: 6,
      subtaskTemplate: [
        'Design UI mockup',
        'Implement component',
        'Add styling',
        'Handle state management',
        'Add accessibility',
        'Write tests'
      ]
    });

    // Bugfix patterns
    this.taskPatterns.set('bugfix-critical', {
      keywords: ['crash', 'error', 'bug', 'fix', 'broken', 'failing'],
      category: 'bugfix',
      averageHours: 4,
      subtaskTemplate: [
        'Reproduce issue',
        'Identify root cause',
        'Implement fix',
        'Add regression test',
        'Verify fix in staging'
      ]
    });

    // Refactor patterns
    this.taskPatterns.set('refactor-performance', {
      keywords: ['optimize', 'performance', 'slow', 'refactor', 'improve'],
      category: 'refactor',
      averageHours: 12,
      subtaskTemplate: [
        'Profile current performance',
        'Identify bottlenecks',
        'Plan optimization strategy',
        'Implement improvements',
        'Benchmark results',
        'Update documentation'
      ]
    });

    // Security patterns
    this.taskPatterns.set('security-audit', {
      keywords: ['security', 'vulnerability', 'audit', 'penetration', 'encrypt'],
      category: 'security',
      averageHours: 16,
      subtaskTemplate: [
        'Run security scanner',
        'Review dependencies',
        'Check authentication flows',
        'Test authorization rules',
        'Fix vulnerabilities',
        'Update security docs'
      ]
    });
  }

  /**
   * Analyze a task and provide predictions
   */
  async analyzeTask(task: Partial<TodoItem>): Promise<TaskPrediction> {
    const taskText = `${task.title} ${task.description || ''}`.toLowerCase();
    const tokens = this.nlp.tokenizer.tokenize(taskText);
    
    // Determine task pattern
    const pattern = this.identifyPattern(tokens);
    const category = pattern?.category || this.classifyTask(taskText);
    
    // Calculate estimates based on historical data
    const estimation = this.estimateEffort(category, tokens, pattern);
    
    // Identify dependencies and blockers
    const dependencies = await this.identifyDependencies(task, tokens);
    const blockers = await this.predictBlockers(task, dependencies);
    
    // Generate optimization suggestions
    const suggestions = this.generateOptimizations(task, pattern);
    
    // Determine priority
    const priority = this.calculatePriority(task, blockers.length, dependencies.length);

    return {
      estimatedHours: estimation.hours,
      confidence: estimation.confidence,
      suggestedPriority: priority,
      potentialBlockers: blockers,
      relatedTasks: dependencies,
      optimizationSuggestions: suggestions
    };
  }

  /**
   * Enhance a todo item with predictions and suggestions
   */
  async enhanceTodo(todo: Partial<TodoItem>): Promise<TodoItem> {
    const prediction = await this.analyzeTask(todo);
    const pattern = this.identifyPattern(
      this.nlp.tokenizer.tokenize(`${todo.title} ${todo.description || ''}`)
    );

    // Generate subtasks if not provided
    const subtasks = todo.suggestedSubtasks || 
      (pattern ? this.generateSubtasks(todo, pattern) : []);

    // Calculate predicted completion
    const predictedCompletion = this.calculateCompletionDate(
      prediction.estimatedHours,
      todo.priority || prediction.suggestedPriority
    );

    const enhanced: TodoItem = {
      id: todo.id || this.generateId(),
      title: todo.title || 'New Task',
      description: todo.description,
      category: todo.category || pattern?.category || 'feature',
      priority: todo.priority || prediction.suggestedPriority,
      status: todo.status || 'pending',
      estimatedHours: prediction.estimatedHours,
      dependencies: prediction.relatedTasks,
      tags: this.extractTags(todo),
      createdAt: todo.createdAt || new Date(),
      updatedAt: new Date(),
      predictedCompletion,
      suggestedSubtasks: subtasks
    };

    // Add to task graph
    this.taskGraph.addTask(enhanced);

    // Emit enhancement event
    this.emit('taskEnhanced', enhanced, prediction);

    return enhanced;
  }

  /**
   * Predict next tasks based on current progress
   */
  async predictNextTasks(completedTasks: TodoItem[], currentTasks: TodoItem[]): Promise<TodoItem[]> {
    const predictions: TodoItem[] = [];
    
    // Analyze completion patterns
    const patterns = this.analyzeCompletionPatterns(completedTasks);
    
    // Identify gaps in current tasks
    const gaps = this.identifyTaskGaps(currentTasks, patterns);
    
    // Generate predictions for each gap
    for (const gap of gaps) {
      const predictedTask = await this.generatePredictedTask(gap, patterns);
      predictions.push(predictedTask);
    }

    // Sort by predicted priority
    predictions.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    return predictions;
  }

  /**
   * Batch analyze multiple tasks
   */
  async batchAnalyze(tasks: Partial<TodoItem>[]): Promise<Map<string, TaskPrediction>> {
    const results = new Map<string, TaskPrediction>();
    
    // Process in parallel for efficiency
    const analyses = await Promise.all(
      tasks.map(async task => ({
        id: task.id || this.generateId(),
        prediction: await this.analyzeTask(task)
      }))
    );

    analyses.forEach(({ id, prediction }) => {
      results.set(id, prediction);
    });

    return results;
  }

  /**
   * Get task insights
   */
  getInsights(tasks: TodoItem[]): TaskInsights {
    const byCategory = this.groupByCategory(tasks);
    const byPriority = this.groupByPriority(tasks);
    const velocityTrend = this.calculateVelocityTrend();
    const bottlenecks = this.identifyBottlenecks(tasks);
    
    return {
      summary: {
        total: tasks.length,
        completed: tasks.filter(t => t.status === 'completed').length,
        blocked: tasks.filter(t => t.status === 'blocked').length,
        estimatedHours: tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0)
      },
      distribution: {
        byCategory,
        byPriority
      },
      velocity: {
        current: this.context.velocity,
        trend: velocityTrend,
        prediction: this.predictFutureVelocity()
      },
      bottlenecks,
      recommendations: this.generateRecommendations(tasks, bottlenecks)
    };
  }

  // Helper methods
  private trainClassifier(): void {
    // Training data for task classification
    const trainingData = [
      { text: 'implement user authentication', category: 'feature' },
      { text: 'fix login bug', category: 'bugfix' },
      { text: 'refactor database queries', category: 'refactor' },
      { text: 'write api documentation', category: 'documentation' },
      { text: 'add unit tests', category: 'testing' },
      { text: 'deploy to production', category: 'deployment' },
      { text: 'optimize page load time', category: 'optimization' },
      { text: 'security audit', category: 'security' },
      { text: 'setup ci/cd pipeline', category: 'infrastructure' }
    ];

    trainingData.forEach(item => {
      this.nlp.classifier.addDocument(item.text, item.category);
    });

    this.nlp.classifier.train();
  }

  private identifyPattern(tokens: string[]): TaskPattern | null {
    let bestMatch: TaskPattern | null = null;
    let highestScore = 0;

    for (const [_, pattern] of this.taskPatterns) {
      const score = this.calculatePatternScore(tokens, pattern.keywords);
      if (score > highestScore) {
        highestScore = score;
        bestMatch = pattern;
      }
    }

    return highestScore > 0.3 ? bestMatch : null;
  }

  private calculatePatternScore(tokens: string[], keywords: string[]): number {
    const matches = tokens.filter(token => 
      keywords.some(keyword => token.includes(keyword))
    ).length;
    
    return matches / Math.max(tokens.length, keywords.length);
  }

  private classifyTask(text: string): TaskCategory {
    return this.nlp.classifier.classify(text) as TaskCategory;
  }

  private estimateEffort(
    category: TaskCategory, 
    tokens: string[], 
    pattern: TaskPattern | null
  ): { hours: number; confidence: number } {
    // Base estimate from pattern or historical average
    const baseHours = pattern?.averageHours || 
      this.getHistoricalAverage(category);
    
    // Adjust based on complexity indicators
    const complexityMultiplier = this.calculateComplexity(tokens);
    const adjustedHours = baseHours * complexityMultiplier;
    
    // Calculate confidence based on historical accuracy
    const confidence = this.calculateConfidence(category, tokens.length);
    
    return {
      hours: Math.round(adjustedHours * 10) / 10,
      confidence
    };
  }

  private getHistoricalAverage(category: TaskCategory): number {
    const categoryTasks = this.context.historicalData
      .filter(task => task.category === category);
    
    if (categoryTasks.length === 0) {
      // Default estimates by category
      const defaults: Record<TaskCategory, number> = {
        feature: 8,
        bugfix: 4,
        refactor: 6,
        documentation: 3,
        testing: 4,
        deployment: 2,
        optimization: 8,
        security: 12,
        infrastructure: 10
      };
      return defaults[category];
    }
    
    const totalHours = categoryTasks.reduce((sum, task) => sum + task.actualHours, 0);
    return totalHours / categoryTasks.length;
  }

  private calculateComplexity(tokens: string[]): number {
    const complexityIndicators = [
      'complex', 'difficult', 'challenging', 'large', 'major',
      'entire', 'complete', 'full', 'extensive', 'comprehensive'
    ];
    
    const simplicityIndicators = [
      'simple', 'basic', 'minor', 'small', 'quick',
      'easy', 'straightforward', 'trivial'
    ];
    
    let complexity = 1.0;
    
    tokens.forEach(token => {
      if (complexityIndicators.includes(token)) complexity *= 1.3;
      if (simplicityIndicators.includes(token)) complexity *= 0.7;
    });
    
    return Math.max(0.5, Math.min(2.0, complexity));
  }

  private calculateConfidence(category: TaskCategory, tokenCount: number): number {
    const historicalAccuracy = this.getHistoricalAccuracy(category);
    const dataPoints = this.context.historicalData
      .filter(task => task.category === category).length;
    
    // More historical data = higher confidence
    const dataConfidence = Math.min(1.0, dataPoints / 20);
    
    // More detailed description = higher confidence
    const descriptionConfidence = Math.min(1.0, tokenCount / 30);
    
    return (historicalAccuracy * 0.5 + dataConfidence * 0.3 + descriptionConfidence * 0.2);
  }

  private getHistoricalAccuracy(category: TaskCategory): number {
    const categoryTasks = this.context.historicalData
      .filter(task => task.category === category);
    
    if (categoryTasks.length === 0) return 0.5;
    
    const accuracySum = categoryTasks.reduce((sum, task) => {
      const accuracy = 1 - Math.abs(task.actualHours - task.estimatedHours) / task.actualHours;
      return sum + Math.max(0, accuracy);
    }, 0);
    
    return accuracySum / categoryTasks.length;
  }

  private async identifyDependencies(
    task: Partial<TodoItem>, 
    tokens: string[]
  ): Promise<string[]> {
    const dependencies: string[] = [];
    
    // Check for explicit dependencies
    if (task.dependencies) {
      dependencies.push(...task.dependencies);
    }
    
    // Analyze tokens for implicit dependencies
    const dependencyKeywords = {
      'after': ['complete', 'finish', 'done'],
      'requires': ['needs', 'depends', 'relies'],
      'blocked': ['waiting', 'pending', 'blocks']
    };
    
    // Look for dependency patterns in text
    tokens.forEach((token, index) => {
      Object.entries(dependencyKeywords).forEach(([key, synonyms]) => {
        if ([key, ...synonyms].includes(token) && index < tokens.length - 1) {
          dependencies.push(`Depends on: ${tokens.slice(index + 1, index + 4).join(' ')}`);
        }
      });
    });
    
    return [...new Set(dependencies)];
  }

  private async predictBlockers(
    task: Partial<TodoItem>, 
    dependencies: string[]
  ): Promise<string[]> {
    const blockers: string[] = [];
    
    // Check for common blocker patterns
    if (task.category === 'deployment' && !dependencies.some(d => d.includes('test'))) {
      blockers.push('Tests should be completed before deployment');
    }
    
    if (dependencies.length > 3) {
      blockers.push('High number of dependencies may cause delays');
    }
    
    // Tech stack specific blockers
    if (this.context.techStack.includes('typescript') && task.title?.includes('javascript')) {
      blockers.push('TypeScript migration may be required');
    }
    
    return blockers;
  }

  private generateOptimizations(
    task: Partial<TodoItem>, 
    pattern: TaskPattern | null
  ): string[] {
    const suggestions: string[] = [];
    
    if (pattern && pattern.averageHours > 8) {
      suggestions.push('Consider breaking this into smaller tasks');
    }
    
    if (task.dependencies && task.dependencies.length > 2) {
      suggestions.push('Parallelize independent subtasks to reduce timeline');
    }
    
    if (task.category === 'feature' && !task.description?.includes('test')) {
      suggestions.push('Add testing as part of the implementation');
    }
    
    return suggestions;
  }

  private calculatePriority(
    task: Partial<TodoItem>, 
    blockerCount: number, 
    dependencyCount: number
  ): TodoItem['priority'] {
    // Priority factors
    let score = 0;
    
    // Sentiment analysis
    const sentiment = this.nlp.sentiment.getSentiment(
      this.nlp.tokenizer.tokenize(task.title || '')
    );
    
    if (sentiment < -0.5) score += 3; // Negative sentiment = urgent
    
    // Keywords
    const urgentKeywords = ['urgent', 'critical', 'asap', 'immediately', 'blocking'];
    const title = (task.title || '').toLowerCase();
    if (urgentKeywords.some(keyword => title.includes(keyword))) score += 4;
    
    // Blockers and dependencies
    score += blockerCount * 2;
    score += Math.min(dependencyCount, 3);
    
    // Category weights
    const categoryWeights: Record<TaskCategory, number> = {
      security: 3,
      bugfix: 2,
      deployment: 1,
      feature: 0,
      optimization: -1,
      refactor: -1,
      documentation: -2,
      testing: 0,
      infrastructure: 1
    };
    
    score += categoryWeights[task.category || 'feature'];
    
    // Map score to priority
    if (score >= 7) return 'critical';
    if (score >= 4) return 'high';
    if (score >= 1) return 'medium';
    return 'low';
  }

  private generateSubtasks(
    todo: Partial<TodoItem>, 
    pattern: TaskPattern
  ): TodoItem[] {
    return pattern.subtaskTemplate.map((title, index) => ({
      id: `${todo.id || this.generateId()}_sub_${index}`,
      title,
      category: pattern.category,
      priority: 'medium' as const,
      status: 'pending' as const,
      estimatedHours: pattern.averageHours / pattern.subtaskTemplate.length,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
  }

  private calculateCompletionDate(hours: number, priority: TodoItem['priority']): Date {
    const hoursPerDay = 6; // Productive hours
    const priorityMultipliers = {
      critical: 0.5,
      high: 0.7,
      medium: 1.0,
      low: 1.5
    };
    
    const adjustedHours = hours * priorityMultipliers[priority];
    const days = Math.ceil(adjustedHours / hoursPerDay);
    
    const completion = new Date();
    completion.setDate(completion.getDate() + days);
    
    // Skip weekends
    while (completion.getDay() === 0 || completion.getDay() === 6) {
      completion.setDate(completion.getDate() + 1);
    }
    
    return completion;
  }

  private extractTags(todo: Partial<TodoItem>): string[] {
    const tags: string[] = [];
    const text = `${todo.title} ${todo.description || ''}`.toLowerCase();
    
    // Tech stack tags
    this.context.techStack.forEach(tech => {
      if (text.includes(tech.toLowerCase())) {
        tags.push(tech);
      }
    });
    
    // Feature tags
    const featureTags = ['api', 'ui', 'database', 'auth', 'performance', 'security'];
    featureTags.forEach(tag => {
      if (text.includes(tag)) {
        tags.push(tag);
      }
    });
    
    return [...new Set(tags)];
  }

  private analyzeCompletionPatterns(tasks: TodoItem[]): CompletionPattern[] {
    // Group by category and analyze
    const patterns: CompletionPattern[] = [];
    const categories = new Set(tasks.map(t => t.category));
    
    categories.forEach(category => {
      const categoryTasks = tasks.filter(t => t.category === category);
      const avgTime = categoryTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0) / categoryTasks.length;
      
      patterns.push({
        category,
        frequency: categoryTasks.length / tasks.length,
        averageTime: avgTime,
        commonTags: this.findCommonTags(categoryTasks)
      });
    });
    
    return patterns;
  }

  private findCommonTags(tasks: TodoItem[]): string[] {
    const tagCounts = new Map<string, number>();
    
    tasks.forEach(task => {
      task.tags?.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });
    
    return Array.from(tagCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([tag]) => tag);
  }

  private identifyTaskGaps(
    currentTasks: TodoItem[], 
    patterns: CompletionPattern[]
  ): TaskGap[] {
    const gaps: TaskGap[] = [];
    
    // Check for missing categories
    patterns.forEach(pattern => {
      const currentCount = currentTasks.filter(t => t.category === pattern.category).length;
      const expectedCount = Math.round(currentTasks.length * pattern.frequency);
      
      if (currentCount < expectedCount * 0.7) {
        gaps.push({
          type: 'category',
          category: pattern.category,
          severity: 'medium',
          description: `Low number of ${pattern.category} tasks`
        });
      }
    });
    
    // Check for missing testing
    if (!currentTasks.some(t => t.category === 'testing')) {
      gaps.push({
        type: 'category',
        category: 'testing',
        severity: 'high',
        description: 'No testing tasks found'
      });
    }
    
    // Check for missing documentation
    if (!currentTasks.some(t => t.category === 'documentation')) {
      gaps.push({
        type: 'category',
        category: 'documentation',
        severity: 'medium',
        description: 'Documentation tasks missing'
      });
    }
    
    return gaps;
  }

  private async generatePredictedTask(
    gap: TaskGap, 
    patterns: CompletionPattern[]
  ): Promise<TodoItem> {
    const pattern = patterns.find(p => p.category === gap.category);
    
    return {
      id: this.generateId(),
      title: this.generateTaskTitle(gap.category),
      description: gap.description,
      category: gap.category,
      priority: gap.severity === 'high' ? 'high' : 'medium',
      status: 'pending',
      estimatedHours: pattern?.averageTime || 4,
      tags: pattern?.commonTags || [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private generateTaskTitle(category: TaskCategory): string {
    const templates: Record<TaskCategory, string[]> = {
      feature: ['Implement new feature', 'Add functionality for'],
      bugfix: ['Fix issue with', 'Resolve bug in'],
      refactor: ['Refactor code in', 'Improve structure of'],
      documentation: ['Document', 'Write guide for'],
      testing: ['Add tests for', 'Test coverage for'],
      deployment: ['Deploy to', 'Release version'],
      optimization: ['Optimize performance of', 'Improve speed of'],
      security: ['Security review of', 'Audit security for'],
      infrastructure: ['Setup', 'Configure infrastructure for']
    };
    
    const options = templates[category] || ['Task for'];
    return options[Math.floor(Math.random() * options.length)];
  }

  private groupByCategory(tasks: TodoItem[]): Record<TaskCategory, number> {
    const groups: Partial<Record<TaskCategory, number>> = {};
    
    tasks.forEach(task => {
      groups[task.category] = (groups[task.category] || 0) + 1;
    });
    
    return groups as Record<TaskCategory, number>;
  }

  private groupByPriority(tasks: TodoItem[]): Record<TodoItem['priority'], number> {
    const groups: Partial<Record<TodoItem['priority'], number>> = {};
    
    tasks.forEach(task => {
      groups[task.priority] = (groups[task.priority] || 0) + 1;
    });
    
    return groups as Record<TodoItem['priority'], number>;
  }

  private calculateVelocityTrend(): 'increasing' | 'stable' | 'decreasing' {
    // Simplified - would analyze historical velocity
    return 'stable';
  }

  private predictFutureVelocity(): number {
    // Machine learning prediction would go here
    return this.context.velocity * 1.1; // 10% improvement
  }

  private identifyBottlenecks(tasks: TodoItem[]): string[] {
    const bottlenecks: string[] = [];
    
    const blockedTasks = tasks.filter(t => t.status === 'blocked');
    if (blockedTasks.length > tasks.length * 0.2) {
      bottlenecks.push(`${blockedTasks.length} tasks are blocked`);
    }
    
    // Check for overloaded categories
    const categoryDistribution = this.groupByCategory(tasks);
    Object.entries(categoryDistribution).forEach(([category, count]) => {
      if (count > tasks.length * 0.4) {
        bottlenecks.push(`Too many ${category} tasks (${count})`);
      }
    });
    
    return bottlenecks;
  }

  private generateRecommendations(tasks: TodoItem[], bottlenecks: string[]): string[] {
    const recommendations: string[] = [];
    
    if (bottlenecks.length > 0) {
      recommendations.push('Address bottlenecks to improve velocity');
    }
    
    const criticalTasks = tasks.filter(t => t.priority === 'critical');
    if (criticalTasks.length > 3) {
      recommendations.push('Too many critical tasks - reassess priorities');
    }
    
    const oldTasks = tasks.filter(t => 
      Date.now() - t.createdAt.getTime() > 30 * 24 * 60 * 60 * 1000
    );
    if (oldTasks.length > 0) {
      recommendations.push(`${oldTasks.length} tasks are over 30 days old`);
    }
    
    return recommendations;
  }

  private generateId(): string {
    return `todo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Supporting classes and interfaces
class TaskDependencyGraph {
  private nodes: Map<string, TodoItem> = new Map();
  private edges: Map<string, Set<string>> = new Map();

  addTask(task: TodoItem): void {
    this.nodes.set(task.id, task);
    if (!this.edges.has(task.id)) {
      this.edges.set(task.id, new Set());
    }
    
    task.dependencies?.forEach(dep => {
      this.edges.get(task.id)?.add(dep);
    });
  }

  getTopologicalOrder(): TodoItem[] {
    // Implementation of topological sort
    return Array.from(this.nodes.values());
  }
}

interface TaskPattern {
  keywords: string[];
  category: TaskCategory;
  averageHours: number;
  subtaskTemplate: string[];
}

interface CompletionPattern {
  category: TaskCategory;
  frequency: number;
  averageTime: number;
  commonTags: string[];
}

interface TaskGap {
  type: 'category' | 'dependency';
  category: TaskCategory;
  severity: 'high' | 'medium' | 'low';
  description: string;
}

interface TaskInsights {
  summary: {
    total: number;
    completed: number;
    blocked: number;
    estimatedHours: number;
  };
  distribution: {
    byCategory: Record<TaskCategory, number>;
    byPriority: Record<TodoItem['priority'], number>;
  };
  velocity: {
    current: number;
    trend: 'increasing' | 'stable' | 'decreasing';
    prediction: number;
  };
  bottlenecks: string[];
  recommendations: string[];
}

export default TodoPredictionEngine;