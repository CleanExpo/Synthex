import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mleStarFramework } from './mle-star-framework';

interface Context7Window {
  id: number;
  name: string;
  content: any;
  priority: number;
  timestamp: number;
  tokens: number;
}

interface SequentialThinkingStep {
  step: number;
  description: string;
  input: any;
  output: any;
  context: Context7Window[];
  duration: number;
}

export class MCPContext7Integration {
  private contextWindows: Map<number, Context7Window> = new Map();
  private sequentialSteps: SequentialThinkingStep[] = [];
  private clients: Map<string, Client> = new Map();
  private maxWindows: number = 7;
  private maxTokensPerWindow: number = 4000;
  
  constructor() {
    this.initializeContextWindows();
  }
  
  private initializeContextWindows() {
    for (let i = 1; i <= this.maxWindows; i++) {
      this.contextWindows.set(i, {
        id: i,
        name: `Context-${i}`,
        content: null,
        priority: 0,
        timestamp: Date.now(),
        tokens: 0
      });
    }
  }
  
  async initializeProviders() {
    const providers = [
      { name: 'sequential-thinking', command: 'npx', args: ['@modelcontextprotocol/server-sequential-thinking'] },
      { name: 'filesystem', command: 'npx', args: ['@modelcontextprotocol/server-filesystem', '--allowed-directories', '.'] }
    ];
    
    for (const provider of providers) {
      try {
        await this.initializeProvider(provider.name, provider.command, provider.args);
        console.log(`✅ Initialized ${provider.name} provider`);
      } catch (error) {
        console.error(`❌ Failed to initialize ${provider.name}:`, error);
      }
    }
  }
  
  private async initializeProvider(name: string, command: string, args: string[] = []) {
    const transport = new StdioClientTransport({
      command,
      args,
    });
    
    const client = new Client({
      name: `mcp-${name}`,
      version: '1.0.0',
    }, {
      capabilities: {}
    });
    
    await client.connect(transport);
    this.clients.set(name, client);
    
    return client;
  }
  
  async updateContext(windowId: number, content: any, priority: number = 0) {
    const window = this.contextWindows.get(windowId);
    if (!window) {
      throw new Error(`Context window ${windowId} not found`);
    }
    
    const tokens = this.estimateTokens(content);
    
    if (tokens > this.maxTokensPerWindow) {
      content = await this.compressContent(content);
    }
    
    window.content = content;
    window.priority = priority;
    window.timestamp = Date.now();
    window.tokens = tokens;
    
    this.rebalanceContexts();
  }
  
  async sequentialThinkWithContext(problem: string, steps: string[]): Promise<any> {
    const results = [];
    this.sequentialSteps = [];
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const startTime = Date.now();
      
      // Gather relevant context windows
      const relevantContext = this.gatherRelevantContext(step);
      
      // Build enhanced prompt with context
      const enhancedPrompt = this.buildEnhancedPrompt(problem, step, relevantContext, results);
      
      // Execute step with context
      const result = await this.executeWithContext('sequential-thinking', 'think', {
        problem: enhancedPrompt,
        step,
        previousResults: results,
        context: relevantContext
      });
      
      const duration = Date.now() - startTime;
      
      // Store step information
      this.sequentialSteps.push({
        step: i + 1,
        description: step,
        input: { problem, step },
        output: result,
        context: relevantContext,
        duration
      });
      
      results.push(result);
      
      // Update context window with result
      await this.updateContext((i % this.maxWindows) + 1, {
        step,
        result,
        duration
      }, this.calculateResultPriority(result));
    }
    
    return {
      problem,
      steps,
      results,
      sequentialSteps: this.sequentialSteps,
      totalDuration: this.sequentialSteps.reduce((sum, s) => sum + s.duration, 0)
    };
  }
  
  private gatherRelevantContext(step: string): Context7Window[] {
    const relevant: Context7Window[] = [];
    const keywords = step.toLowerCase().split(' ');
    
    this.contextWindows.forEach(window => {
      if (!window.content) return;
      
      const contentStr = JSON.stringify(window.content).toLowerCase();
      const relevanceScore = keywords.filter(keyword => 
        contentStr.includes(keyword)
      ).length;
      
      if (relevanceScore > 0) {
        relevant.push({ ...window });
      }
    });
    
    // Sort by priority and recency
    relevant.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return b.timestamp - a.timestamp;
    });
    
    // Return top 3 most relevant contexts
    return relevant.slice(0, 3);
  }
  
  private buildEnhancedPrompt(problem: string, step: string, context: Context7Window[], previousResults: any[]): string {
    let prompt = `Problem: ${problem}\n\nCurrent Step: ${step}\n\n`;
    
    if (context.length > 0) {
      prompt += 'Relevant Context:\n';
      context.forEach(ctx => {
        prompt += `- ${ctx.name}: ${JSON.stringify(ctx.content).substring(0, 200)}...\n`;
      });
      prompt += '\n';
    }
    
    if (previousResults.length > 0) {
      prompt += 'Previous Results:\n';
      previousResults.slice(-2).forEach((result, idx) => {
        prompt += `Step ${previousResults.length - 2 + idx}: ${JSON.stringify(result).substring(0, 200)}...\n`;
      });
      prompt += '\n';
    }
    
    prompt += 'Please provide detailed analysis for this step.';
    
    return prompt;
  }
  
  private async executeWithContext(contextName: string, operation: string, params: any) {
    const client = this.clients.get(contextName);
    if (!client) {
      // Fallback to mock execution
      return this.mockExecution(operation, params);
    }
    
    try {
      const result = await (client as any).callTool(operation, params);
      return result;
    } catch (error) {
      console.error(`Error executing ${operation} on ${contextName}:`, error);
      return this.mockExecution(operation, params);
    }
  }
  
  private mockExecution(operation: string, params: any): any {
    // Simulate execution for development
    return {
      operation,
      status: 'completed',
      result: `Executed ${operation} with context`,
      timestamp: new Date().toISOString()
    };
  }
  
  async integrateWithMLEStar(modelConfig: any): Promise<any> {
    // Use Context7 for MLE Star evaluation
    const mleSteps = [
      'Evaluate Scoping dimension',
      'Evaluate Training dimension',
      'Evaluate Analysis dimension',
      'Evaluate Reliability dimension',
      'Evaluate Excellence dimension'
    ];
    
    // Load MLE Star context into windows
    await this.updateContext(1, { dimension: 'Scoping', config: modelConfig }, 5);
    await this.updateContext(2, { dimension: 'Training', data: modelConfig.training }, 4);
    await this.updateContext(3, { dimension: 'Analysis', metrics: modelConfig.metrics }, 4);
    await this.updateContext(4, { dimension: 'Reliability', deployment: modelConfig.deployment }, 3);
    await this.updateContext(5, { dimension: 'Excellence', documentation: modelConfig.docs }, 3);
    
    const evaluation = await this.sequentialThinkWithContext(
      'Evaluate ML model using MLE Star framework',
      mleSteps
    );
    
    // Generate MLE Star score
    const starScore = await mleStarFramework.calculateOverallScore();
    
    return {
      evaluation,
      starScore,
      recommendations: this.generateMLERecommendations(evaluation, starScore)
    };
  }
  
  private generateMLERecommendations(evaluation: any, starScore: any): string[] {
    const recommendations = [];
    
    if (starScore.scoping < 70) {
      recommendations.push('Improve problem definition and success metrics');
    }
    if (starScore.training < 70) {
      recommendations.push('Enhance training pipeline automation');
    }
    if (starScore.analysis < 70) {
      recommendations.push('Add comprehensive model evaluation');
    }
    if (starScore.reliability < 70) {
      recommendations.push('Implement production monitoring');
    }
    if (starScore.excellence < 70) {
      recommendations.push('Complete documentation and testing');
    }
    
    return recommendations;
  }
  
  private estimateTokens(content: any): number {
    const str = JSON.stringify(content);
    return Math.ceil(str.length / 4);
  }
  
  private async compressContent(content: any): Promise<any> {
    // Simple compression: keep only essential fields
    if (typeof content === 'object' && content !== null) {
      const compressed: any = {};
      const importantKeys = ['id', 'name', 'result', 'status', 'error', 'metrics', 'score'];
      
      for (const key of importantKeys) {
        if (content[key] !== undefined) {
          compressed[key] = content[key];
        }
      }
      
      return compressed;
    }
    
    return content;
  }
  
  private rebalanceContexts() {
    // Remove old low-priority contexts if we're at capacity
    const windows = Array.from(this.contextWindows.values());
    const totalTokens = windows.reduce((sum, w) => sum + w.tokens, 0);
    
    if (totalTokens > this.maxTokensPerWindow * this.maxWindows * 0.8) {
      // Sort by priority and age
      windows.sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        return a.timestamp - b.timestamp;
      });
      
      // Clear lowest priority window
      const toClear = windows[0];
      toClear.content = null;
      toClear.tokens = 0;
      toClear.priority = 0;
    }
  }
  
  private calculateResultPriority(result: any): number {
    let priority = 1;
    
    if (result.error) priority += 3;
    if (result.metrics) priority += 2;
    if (result.recommendations) priority += 2;
    if (result.status === 'completed') priority += 1;
    
    return Math.min(priority, 5);
  }
  
  async generateContextReport(): Promise<any> {
    const windows = Array.from(this.contextWindows.values());
    const activeWindows = windows.filter(w => w.content !== null);
    
    return {
      totalWindows: this.maxWindows,
      activeWindows: activeWindows.length,
      totalTokens: windows.reduce((sum, w) => sum + w.tokens, 0),
      maxTokens: this.maxTokensPerWindow * this.maxWindows,
      windows: activeWindows.map(w => ({
        id: w.id,
        name: w.name,
        priority: w.priority,
        tokens: w.tokens,
        age: Date.now() - w.timestamp
      })),
      sequentialSteps: this.sequentialSteps.length,
      averageStepDuration: this.sequentialSteps.length > 0 
        ? this.sequentialSteps.reduce((sum, s) => sum + s.duration, 0) / this.sequentialSteps.length
        : 0
    };
  }
}

export const mcpContext7 = new MCPContext7Integration();