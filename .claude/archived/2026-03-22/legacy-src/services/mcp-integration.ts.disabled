import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

export class MCPIntegration {
  private clients: Map<string, Client> = new Map();
  
  async initializeContextProvider(name: string, command: string, args: string[] = []) {
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
  
  async initializeSequentialThinking() {
    return this.initializeContextProvider(
      'sequential-thinking',
      'npx',
      ['@modelcontextprotocol/server-sequential-thinking']
    );
  }
  
  async executeWithContext(contextName: string, operation: string, params: any) {
    const client = this.clients.get(contextName);
    if (!client) {
      throw new Error(`Context provider ${contextName} not initialized`);
    }
    
    try {
      const result = await (client as any).callTool(operation, params);
      return result;
    } catch (error) {
      console.error(`Error executing ${operation} on ${contextName}:`, error);
      throw error;
    }
  }
  
  async sequentialThink(problem: string, steps: string[]) {
    const client = this.clients.get('sequential-thinking');
    if (!client) {
      await this.initializeSequentialThinking();
    }
    
    const results = [];
    for (const step of steps) {
      const result = await this.executeWithContext('sequential-thinking', 'think', {
        problem,
        step,
        previousResults: results
      });
      results.push(result);
    }
    
    return results;
  }
}

export const mcpIntegration = new MCPIntegration();