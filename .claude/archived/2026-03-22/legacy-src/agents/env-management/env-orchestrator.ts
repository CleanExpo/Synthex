import { EventEmitter } from 'events';
import { EnvAgent, AgentResult, AgentOptions } from './base-env-agent';
import { EnvValidator, ValidationSchema } from './env-validator';
import { EnvMigrator, MigrationPlan } from './env-migrator';
import { EnvSecurityAgent, SecurityConfig } from './env-security-agent';
import { EnvDiscovery } from './env-discovery';
import { EnvTransformer, TransformOptions, PlatformConfig } from './env-transformer';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface OrchestratorConfig {
  projectPath: string;
  environment: string;
  autoDiscovery?: boolean;
  autoValidation?: boolean;
  autoSecurity?: boolean;
  validationSchema?: ValidationSchema;
  securityConfig?: SecurityConfig;
  platformConfig?: Partial<PlatformConfig>;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export interface WorkflowStep {
  agent: string;
  action: string;
  params?: any;
  condition?: () => boolean;
  onSuccess?: (result: AgentResult) => void;
  onError?: (error: Error) => void;
}

export interface Workflow {
  name: string;
  description: string;
  steps: WorkflowStep[];
  parallel?: boolean;
}

export interface OrchestratorReport {
  timestamp: Date;
  environment: string;
  summary: {
    totalVariables: number;
    validationErrors: number;
    securityIssues: number;
    migrationChanges: number;
  };
  details: {
    discovery?: any;
    validation?: any;
    security?: any;
    migration?: any;
    transformation?: any;
  };
  recommendations: string[];
}

export class EnvOrchestrator extends EventEmitter {
  private config: OrchestratorConfig;
  private agents: Map<string, EnvAgent>;
  private workflowHistory: Array<{ workflow: string; result: AgentResult; timestamp: Date }> = [];

  constructor(config: OrchestratorConfig) {
    super();
    this.config = config;
    this.agents = new Map();
    this.initializeAgents();
  }

  private initializeAgents(): void {
    const baseOptions: AgentOptions = {
      projectPath: this.config.projectPath,
      environment: this.config.environment,
      logLevel: this.config.logLevel
    };

    this.agents.set('validator', new EnvValidator({
      ...baseOptions,
      schema: this.config.validationSchema
    }));

    this.agents.set('migrator', new EnvMigrator(baseOptions));

    this.agents.set('security', new EnvSecurityAgent({
      ...baseOptions,
      securityConfig: this.config.securityConfig
    }));

    this.agents.set('discovery', new EnvDiscovery(baseOptions));

    this.agents.set('transformer', new EnvTransformer({
      ...baseOptions,
      platformConfig: this.config.platformConfig
    }));

    for (const [name, agent] of this.agents) {
      agent.on('log', (log) => this.emit('agent-log', { agent: name, ...log }));
    }
  }

  async runWorkflow(workflow: Workflow): Promise<AgentResult> {
    this.emit('workflow-start', { workflow: workflow.name });
    
    try {
      let results: AgentResult[] = [];
      
      if (workflow.parallel) {
        results = await this.runParallelSteps(workflow.steps);
      } else {
        results = await this.runSequentialSteps(workflow.steps);
      }

      const success = results.every(r => r.success);
      const errors = results.flatMap(r => r.errors || []);
      const warnings = results.flatMap(r => r.warnings || []);

      const result: AgentResult = {
        success,
        message: success 
          ? `Workflow "${workflow.name}" completed successfully`
          : `Workflow "${workflow.name}" completed with errors`,
        data: {
          workflow: workflow.name,
          steps: results.length,
          results
        },
        errors,
        warnings,
        timestamp: new Date()
      };

      this.workflowHistory.push({
        workflow: workflow.name,
        result,
        timestamp: new Date()
      });

      this.emit('workflow-complete', result);
      return result;

    } catch (error) {
      const result: AgentResult = {
        success: false,
        message: `Workflow "${workflow.name}" failed: ${error}`,
        errors: [String(error)],
        timestamp: new Date()
      };

      this.emit('workflow-error', { workflow: workflow.name, error });
      return result;
    }
  }

  private async runSequentialSteps(steps: WorkflowStep[]): Promise<AgentResult[]> {
    const results: AgentResult[] = [];

    for (const step of steps) {
      if (step.condition && !step.condition()) {
        continue;
      }

      try {
        const result = await this.executeStep(step);
        results.push(result);

        if (result.success && step.onSuccess) {
          step.onSuccess(result);
        } else if (!result.success && step.onError) {
          step.onError(new Error(result.message));
        }

        if (!result.success) {
          break;
        }
      } catch (error) {
        if (step.onError) {
          step.onError(error as Error);
        }
        throw error;
      }
    }

    return results;
  }

  private async runParallelSteps(steps: WorkflowStep[]): Promise<AgentResult[]> {
    const promises = steps
      .filter(step => !step.condition || step.condition())
      .map(async (step) => {
        try {
          const result = await this.executeStep(step);
          
          if (result.success && step.onSuccess) {
            step.onSuccess(result);
          } else if (!result.success && step.onError) {
            step.onError(new Error(result.message));
          }
          
          return result;
        } catch (error) {
          if (step.onError) {
            step.onError(error as Error);
          }
          throw error;
        }
      });

    return Promise.all(promises);
  }

  private async executeStep(step: WorkflowStep): Promise<AgentResult> {
    const agent = this.agents.get(step.agent);
    
    if (!agent) {
      throw new Error(`Agent "${step.agent}" not found`);
    }

    this.emit('step-start', { agent: step.agent, action: step.action });

    let result: AgentResult;
    
    switch (step.agent) {
      case 'validator':
        result = await this.executeValidatorAction(agent as EnvValidator, step.action, step.params);
        break;
      case 'migrator':
        result = await this.executeMigratorAction(agent as EnvMigrator, step.action, step.params);
        break;
      case 'security':
        result = await this.executeSecurityAction(agent as EnvSecurityAgent, step.action, step.params);
        break;
      case 'discovery':
        result = await this.executeDiscoveryAction(agent as EnvDiscovery, step.action, step.params);
        break;
      case 'transformer':
        result = await this.executeTransformerAction(agent as EnvTransformer, step.action, step.params);
        break;
      default:
        result = await agent.execute();
    }

    this.emit('step-complete', { agent: step.agent, action: step.action, result });
    return result;
  }

  private async executeValidatorAction(
    agent: EnvValidator,
    action: string,
    params?: any
  ): Promise<AgentResult> {
    switch (action) {
      case 'validate':
        return agent.execute();
      case 'generateSchema':
        const schema = await agent.generateSchema(params?.outputPath);
        return {
          success: true,
          message: 'Schema generated successfully',
          data: { schema },
          timestamp: new Date()
        };
      default:
        return agent.execute();
    }
  }

  private async executeMigratorAction(
    agent: EnvMigrator,
    action: string,
    params?: any
  ): Promise<AgentResult> {
    switch (action) {
      case 'migrate':
        const plan = params?.plan || await agent.createMigrationPlan(
          params?.sourceEnv || 'development',
          params?.targetEnv || this.config.environment,
          params?.autoDetect !== false
        );
        return agent.migrate(plan);
      case 'compare':
        const comparison = await agent.compareEnvironments(
          params?.env1 || 'development',
          params?.env2 || 'production'
        );
        return {
          success: true,
          message: 'Environment comparison complete',
          data: comparison,
          timestamp: new Date()
        };
      case 'rollback':
        return agent.rollback(params?.migrationId);
      default:
        return agent.execute();
    }
  }

  private async executeSecurityAction(
    agent: EnvSecurityAgent,
    action: string,
    params?: any
  ): Promise<AgentResult> {
    switch (action) {
      case 'scan':
        return agent.execute();
      case 'encrypt':
        const encrypted = await agent.encryptValue(params?.value, params?.key);
        return {
          success: true,
          message: 'Value encrypted successfully',
          data: { encrypted },
          timestamp: new Date()
        };
      case 'decrypt':
        const decrypted = await agent.decryptValue(params?.value, params?.key);
        return {
          success: true,
          message: 'Value decrypted successfully',
          data: { decrypted },
          timestamp: new Date()
        };
      default:
        return agent.execute();
    }
  }

  private async executeDiscoveryAction(
    agent: EnvDiscovery,
    action: string,
    params?: any
  ): Promise<AgentResult> {
    switch (action) {
      case 'discover':
        return agent.execute();
      case 'generateTemplate':
        const template = await agent.generateEnvTemplate();
        if (params?.outputPath) {
          await fs.writeFile(params.outputPath, template, 'utf-8');
        }
        return {
          success: true,
          message: 'Template generated successfully',
          data: { template },
          timestamp: new Date()
        };
      default:
        return agent.execute();
    }
  }

  private async executeTransformerAction(
    agent: EnvTransformer,
    action: string,
    params?: any
  ): Promise<AgentResult> {
    switch (action) {
      case 'transform':
        return agent.transform(
          params?.inputPath,
          params?.outputPath,
          params?.options || {}
        );
      case 'convertToPlatform':
        return agent.convertToPlatform(
          params?.inputPath,
          params?.platform,
          params?.deploy || false
        );
      default:
        return agent.execute();
    }
  }

  async healthCheck(): Promise<OrchestratorReport> {
    const discovery = this.agents.get('discovery') as EnvDiscovery;
    const validator = this.agents.get('validator') as EnvValidator;
    const security = this.agents.get('security') as EnvSecurityAgent;

    const [discoveryResult, validationResult, securityResult] = await Promise.all([
      discovery.execute(),
      validator.execute(),
      security.execute()
    ]);

    const recommendations: string[] = [];

    if (!validationResult.success) {
      recommendations.push('Fix validation errors before deployment');
    }

    if (securityResult.data?.summary?.critical > 0) {
      recommendations.push('Address critical security issues immediately');
    }

    if (discoveryResult.data?.undefined > 0) {
      recommendations.push(`Define ${discoveryResult.data.undefined} missing environment variables`);
    }

    if (discoveryResult.data?.unused > 0) {
      recommendations.push(`Consider removing ${discoveryResult.data.unused} unused variables`);
    }

    const report: OrchestratorReport = {
      timestamp: new Date(),
      environment: this.config.environment,
      summary: {
        totalVariables: discoveryResult.data?.totalVariables || 0,
        validationErrors: validationResult.errors?.length || 0,
        securityIssues: securityResult.data?.issues?.length || 0,
        migrationChanges: 0
      },
      details: {
        discovery: discoveryResult.data,
        validation: validationResult.data,
        security: securityResult.data
      },
      recommendations
    };

    this.emit('health-check-complete', report);
    return report;
  }

  getPrebuiltWorkflows(): Map<string, Workflow> {
    const workflows = new Map<string, Workflow>();

    workflows.set('full-scan', {
      name: 'full-scan',
      description: 'Complete environment analysis',
      steps: [
        { agent: 'discovery', action: 'discover' },
        { agent: 'validator', action: 'validate' },
        { agent: 'security', action: 'scan' }
      ],
      parallel: true
    });

    workflows.set('deployment-prep', {
      name: 'deployment-prep',
      description: 'Prepare environment for deployment',
      steps: [
        { agent: 'discovery', action: 'discover' },
        { agent: 'validator', action: 'validate' },
        { agent: 'security', action: 'scan' },
        {
          agent: 'migrator',
          action: 'migrate',
          condition: () => this.config.environment !== 'development'
        }
      ],
      parallel: false
    });

    workflows.set('platform-deploy', {
      name: 'platform-deploy',
      description: 'Deploy to specific platform',
      steps: [
        { agent: 'validator', action: 'validate' },
        { agent: 'security', action: 'scan' },
        {
          agent: 'transformer',
          action: 'convertToPlatform',
          params: { platform: 'vercel', deploy: false }
        }
      ],
      parallel: false
    });

    workflows.set('security-audit', {
      name: 'security-audit',
      description: 'Comprehensive security audit',
      steps: [
        { agent: 'discovery', action: 'discover' },
        { agent: 'security', action: 'scan' },
        {
          agent: 'validator',
          action: 'validate',
          onError: (error) => console.warn('Validation warnings:', error)
        }
      ],
      parallel: false
    });

    workflows.set('environment-sync', {
      name: 'environment-sync',
      description: 'Synchronize environments',
      steps: [
        {
          agent: 'migrator',
          action: 'compare',
          params: { env1: 'development', env2: 'production' }
        },
        {
          agent: 'migrator',
          action: 'migrate',
          params: { sourceEnv: 'development', targetEnv: 'staging' }
        }
      ],
      parallel: false
    });

    return workflows;
  }

  async runPrebuiltWorkflow(workflowName: string): Promise<AgentResult> {
    const workflows = this.getPrebuiltWorkflows();
    const workflow = workflows.get(workflowName);

    if (!workflow) {
      return {
        success: false,
        message: `Workflow "${workflowName}" not found`,
        errors: [`Available workflows: ${Array.from(workflows.keys()).join(', ')}`],
        timestamp: new Date()
      };
    }

    return this.runWorkflow(workflow);
  }

  async generateReport(outputPath?: string): Promise<string> {
    const report = await this.healthCheck();
    
    const markdown = `# Environment Management Report

## Summary
- **Environment**: ${report.environment}
- **Generated**: ${report.timestamp.toISOString()}
- **Total Variables**: ${report.summary.totalVariables}
- **Validation Errors**: ${report.summary.validationErrors}
- **Security Issues**: ${report.summary.securityIssues}

## Discovery Results
${JSON.stringify(report.details.discovery, null, 2)}

## Validation Results
${JSON.stringify(report.details.validation, null, 2)}

## Security Scan Results
${JSON.stringify(report.details.security, null, 2)}

## Recommendations
${report.recommendations.map(r => `- ${r}`).join('\n')}

## Workflow History
${this.workflowHistory.map(h => `- ${h.workflow}: ${h.result.success ? 'Success' : 'Failed'} (${h.timestamp.toISOString()})`).join('\n')}
`;

    if (outputPath) {
      await fs.writeFile(outputPath, markdown, 'utf-8');
    }

    return markdown;
  }

  getAgent(name: string): EnvAgent | undefined {
    return this.agents.get(name);
  }

  async initialize(): Promise<void> {
    if (this.config.autoDiscovery) {
      const discovery = this.agents.get('discovery') as EnvDiscovery;
      await discovery.execute();
    }

    if (this.config.autoValidation) {
      const validator = this.agents.get('validator') as EnvValidator;
      await validator.execute();
    }

    if (this.config.autoSecurity) {
      const security = this.agents.get('security') as EnvSecurityAgent;
      await security.execute();
    }

    this.emit('initialized', {
      agents: Array.from(this.agents.keys()),
      config: this.config
    });
  }
}