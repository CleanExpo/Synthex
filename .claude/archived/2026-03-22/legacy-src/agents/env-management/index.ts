export { EnvAgent, EnvVariable, EnvConfig, AgentResult, AgentOptions } from './base-env-agent';
export { EnvValidator, ValidationRule, ValidationSchema, ValidationError } from './env-validator';
export { EnvMigrator, MigrationRule, MigrationPlan, MigrationHistory, MigrationChange } from './env-migrator';
export { EnvSecurityAgent, SecurityIssue, SecurityConfig } from './env-security-agent';
export { EnvDiscovery, DiscoveredVariable, VariableUsage } from './env-discovery';
export { EnvTransformer, EnvFormat, TransformOptions, PlatformConfig } from './env-transformer';
export { EnvOrchestrator, OrchestratorConfig, WorkflowStep, Workflow, OrchestratorReport } from './env-orchestrator';

import { EnvOrchestrator, OrchestratorConfig } from './env-orchestrator';

/**
 * Create and initialize a new Environment Variable Management System
 * @param config - Configuration for the orchestrator
 * @returns Initialized EnvOrchestrator instance
 */
export async function createEnvManagementSystem(config: OrchestratorConfig): Promise<EnvOrchestrator> {
  const orchestrator = new EnvOrchestrator(config);
  await orchestrator.initialize();
  return orchestrator;
}

/**
 * Quick start function for common use cases
 */
export const EnvManagement = {
  /**
   * Perform a complete environment scan
   */
  async scan(projectPath: string, environment: string = 'development'): Promise<any> {
    const orchestrator = new EnvOrchestrator({
      projectPath,
      environment,
      autoDiscovery: true,
      autoValidation: true,
      autoSecurity: true
    });
    
    await orchestrator.initialize();
    return orchestrator.runPrebuiltWorkflow('full-scan');
  },

  /**
   * Prepare for deployment
   */
  async prepareDeployment(projectPath: string, targetEnvironment: string): Promise<any> {
    const orchestrator = new EnvOrchestrator({
      projectPath,
      environment: targetEnvironment
    });
    
    await orchestrator.initialize();
    return orchestrator.runPrebuiltWorkflow('deployment-prep');
  },

  /**
   * Perform security audit
   */
  async auditSecurity(projectPath: string): Promise<any> {
    const orchestrator = new EnvOrchestrator({
      projectPath,
      environment: 'production',
      autoSecurity: true
    });
    
    await orchestrator.initialize();
    return orchestrator.runPrebuiltWorkflow('security-audit');
  },

  /**
   * Generate environment template
   */
  async generateTemplate(projectPath: string, outputPath?: string): Promise<string> {
    const orchestrator = new EnvOrchestrator({
      projectPath,
      environment: 'development'
    });
    
    await orchestrator.initialize();
    const discovery = orchestrator.getAgent('discovery') as any;
    return discovery.generateEnvTemplate();
  },

  /**
   * Migrate environment variables
   */
  async migrate(
    projectPath: string,
    sourceEnv: string,
    targetEnv: string,
    dryRun: boolean = false
  ): Promise<any> {
    const orchestrator = new EnvOrchestrator({
      projectPath,
      environment: targetEnv
    });
    
    await orchestrator.initialize();
    const migrator = orchestrator.getAgent('migrator') as any;
    
    const plan = await migrator.createMigrationPlan(sourceEnv, targetEnv, true);
    plan.dryRun = dryRun;
    
    return migrator.migrate(plan);
  },

  /**
   * Transform environment file format
   */
  async transform(
    projectPath: string,
    inputPath: string,
    outputPath: string,
    sourceFormat: string,
    targetFormat: string
  ): Promise<any> {
    const orchestrator = new EnvOrchestrator({
      projectPath,
      environment: 'development'
    });
    
    await orchestrator.initialize();
    const transformer = orchestrator.getAgent('transformer') as any;
    
    return transformer.transform(inputPath, outputPath, {
      sourceFormat,
      targetFormat,
      expandVariables: true,
      includeComments: true
    });
  }
};

export default EnvManagement;