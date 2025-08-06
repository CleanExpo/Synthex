import { EnvAgent, EnvVariable, AgentResult, AgentOptions, EnvConfig } from './base-env-agent';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

export interface MigrationRule {
  from: string;
  to: string;
  transform?: (value: string) => string;
  condition?: (value: string) => boolean;
  removeOriginal?: boolean;
}

export interface MigrationPlan {
  sourceEnvironment: string;
  targetEnvironment: string;
  rules: MigrationRule[];
  backupEnabled?: boolean;
  dryRun?: boolean;
  rollbackOnError?: boolean;
}

export interface MigrationHistory {
  id: string;
  timestamp: Date;
  sourceEnvironment: string;
  targetEnvironment: string;
  variablesMigrated: number;
  success: boolean;
  backupPath?: string;
  changes: MigrationChange[];
  rollbackAvailable: boolean;
}

export interface MigrationChange {
  variable: string;
  oldValue?: string;
  newValue: string;
  action: 'add' | 'update' | 'remove' | 'transform';
}

export class EnvMigrator extends EnvAgent {
  private migrationHistory: MigrationHistory[] = [];
  private currentMigration: MigrationHistory | null = null;

  constructor(options: AgentOptions) {
    super(options);
  }

  async createMigrationPlan(
    sourceEnv: string,
    targetEnv: string,
    autoDetect: boolean = true
  ): Promise<MigrationPlan> {
    const plan: MigrationPlan = {
      sourceEnvironment: sourceEnv,
      targetEnvironment: targetEnv,
      rules: [],
      backupEnabled: true,
      rollbackOnError: true
    };

    if (autoDetect) {
      const sourceFile = path.join(this.projectPath, `.env.${sourceEnv}`);
      const targetFile = path.join(this.projectPath, `.env.${targetEnv}`);

      const sourceVars = await this.loadEnvFile(sourceFile).catch(() => new Map());
      const targetVars = await this.loadEnvFile(targetFile).catch(() => new Map());

      for (const [key, value] of sourceVars) {
        const rule: MigrationRule = { from: key, to: key };

        if (this.requiresTransformation(key, sourceEnv, targetEnv)) {
          rule.transform = this.getTransformFunction(key, sourceEnv, targetEnv);
        }

        if (this.shouldExclude(key, targetEnv)) {
          rule.condition = () => false;
        }

        plan.rules.push(rule);
      }
    }

    return plan;
  }

  async migrate(plan: MigrationPlan): Promise<AgentResult> {
    this.currentMigration = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      sourceEnvironment: plan.sourceEnvironment,
      targetEnvironment: plan.targetEnvironment,
      variablesMigrated: 0,
      success: false,
      changes: [],
      rollbackAvailable: false
    };

    try {
      const sourceFile = path.join(this.projectPath, `.env.${plan.sourceEnvironment}`);
      const targetFile = path.join(this.projectPath, `.env.${plan.targetEnvironment}`);

      const sourceVars = await this.loadEnvFile(sourceFile);
      let targetVars = await this.loadEnvFile(targetFile).catch(() => new Map());

      if (plan.backupEnabled) {
        await this.createBackup(targetFile, plan.targetEnvironment);
      }

      const changes: MigrationChange[] = [];

      for (const rule of plan.rules) {
        const sourceValue = sourceVars.get(rule.from);
        if (sourceValue === undefined) continue;

        if (rule.condition && !rule.condition(sourceValue)) {
          this.log('debug', `Skipping ${rule.from} due to condition`);
          continue;
        }

        let newValue = sourceValue;
        if (rule.transform) {
          newValue = rule.transform(sourceValue);
        }

        const oldValue = targetVars.get(rule.to);
        const action = oldValue === undefined ? 'add' : 
                       newValue !== oldValue ? 'update' : null;

        if (action) {
          targetVars.set(rule.to, newValue);
          changes.push({
            variable: rule.to,
            oldValue,
            newValue,
            action
          });
        }

        if (rule.removeOriginal) {
          sourceVars.delete(rule.from);
        }
      }

      if (!plan.dryRun) {
        await this.saveEnvFile(targetFile, targetVars);
        
        if (changes.some(c => c.action === 'remove' || c.oldValue !== undefined)) {
          await this.saveEnvFile(sourceFile, sourceVars);
        }
      }

      this.currentMigration.changes = changes;
      this.currentMigration.variablesMigrated = changes.length;
      this.currentMigration.success = true;
      this.currentMigration.rollbackAvailable = plan.backupEnabled ?? false;

      this.migrationHistory.push(this.currentMigration);
      
      this.emit('migration-complete', this.currentMigration);

      return {
        success: true,
        message: `Migration completed: ${changes.length} variables processed`,
        data: {
          migrationId: this.currentMigration.id,
          changes,
          dryRun: plan.dryRun
        },
        timestamp: new Date()
      };

    } catch (error) {
      if (plan.rollbackOnError && this.currentMigration.backupPath) {
        await this.rollback(this.currentMigration.id);
      }

      return {
        success: false,
        message: `Migration failed: ${error}`,
        errors: [String(error)],
        timestamp: new Date()
      };
    }
  }

  async rollback(migrationId: string): Promise<AgentResult> {
    const migration = this.migrationHistory.find(m => m.id === migrationId);
    
    if (!migration) {
      return {
        success: false,
        message: 'Migration not found',
        errors: ['Invalid migration ID'],
        timestamp: new Date()
      };
    }

    if (!migration.backupPath) {
      return {
        success: false,
        message: 'No backup available for this migration',
        errors: ['Backup was not created during migration'],
        timestamp: new Date()
      };
    }

    try {
      const targetFile = path.join(this.projectPath, `.env.${migration.targetEnvironment}`);
      await fs.copyFile(migration.backupPath, targetFile);

      this.log('info', `Rolled back migration ${migrationId}`);
      
      return {
        success: true,
        message: 'Migration rolled back successfully',
        data: { migrationId },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        message: `Rollback failed: ${error}`,
        errors: [String(error)],
        timestamp: new Date()
      };
    }
  }

  private async createBackup(filePath: string, environment: string): Promise<string> {
    const backupDir = path.join(this.projectPath, '.env-backups');
    await fs.mkdir(backupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `${environment}-${timestamp}.env`);

    try {
      await fs.copyFile(filePath, backupFile);
      this.log('info', `Created backup: ${backupFile}`);
      
      if (this.currentMigration) {
        this.currentMigration.backupPath = backupFile;
      }
      
      return backupFile;
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        throw error;
      }
      return '';
    }
  }

  private requiresTransformation(
    key: string, 
    sourceEnv: string, 
    targetEnv: string
  ): boolean {
    const transformKeys = ['DATABASE_URL', 'API_URL', 'REDIS_URL', 'APP_URL'];
    
    if (!transformKeys.includes(key)) return false;
    
    const envTransitions = [
      { from: 'development', to: 'staging' },
      { from: 'staging', to: 'production' },
      { from: 'development', to: 'production' }
    ];

    return envTransitions.some(
      t => t.from === sourceEnv && t.to === targetEnv
    );
  }

  private getTransformFunction(
    key: string,
    sourceEnv: string,
    targetEnv: string
  ): (value: string) => string {
    const transformations: Record<string, (value: string) => string> = {
      DATABASE_URL: (value) => {
        if (targetEnv === 'production') {
          return value.replace('localhost', 'prod-db-server')
                     .replace(':5432', ':5433');
        }
        if (targetEnv === 'staging') {
          return value.replace('localhost', 'staging-db-server');
        }
        return value;
      },
      API_URL: (value) => {
        if (targetEnv === 'production') {
          return value.replace('http://', 'https://')
                     .replace('localhost:3000', 'api.production.com');
        }
        if (targetEnv === 'staging') {
          return value.replace('localhost:3000', 'staging-api.com');
        }
        return value;
      },
      REDIS_URL: (value) => {
        if (targetEnv === 'production') {
          return value.replace('localhost:6379', 'redis.production.com:6379');
        }
        return value;
      },
      APP_URL: (value) => {
        if (targetEnv === 'production') {
          return value.replace('http://localhost', 'https://app.production.com');
        }
        if (targetEnv === 'staging') {
          return value.replace('http://localhost', 'https://staging.app.com');
        }
        return value;
      }
    };

    return transformations[key] || ((v) => v);
  }

  private shouldExclude(key: string, targetEnv: string): boolean {
    const excludeInProduction = ['DEBUG', 'VERBOSE_LOGGING', 'DEV_MODE'];
    const excludeInDevelopment = ['SENTRY_DSN', 'ANALYTICS_KEY'];

    if (targetEnv === 'production' && excludeInProduction.includes(key)) {
      return true;
    }
    
    if (targetEnv === 'development' && excludeInDevelopment.includes(key)) {
      return true;
    }

    return false;
  }

  async compareEnvironments(env1: string, env2: string): Promise<{
    onlyInFirst: Map<string, string>;
    onlyInSecond: Map<string, string>;
    different: Map<string, { first: string; second: string }>;
    same: Map<string, string>;
  }> {
    const file1 = path.join(this.projectPath, `.env.${env1}`);
    const file2 = path.join(this.projectPath, `.env.${env2}`);

    const vars1 = await this.loadEnvFile(file1);
    const vars2 = await this.loadEnvFile(file2);

    const result = {
      onlyInFirst: new Map<string, string>(),
      onlyInSecond: new Map<string, string>(),
      different: new Map<string, { first: string; second: string }>(),
      same: new Map<string, string>()
    };

    for (const [key, value] of vars1) {
      if (!vars2.has(key)) {
        result.onlyInFirst.set(key, value);
      } else if (vars2.get(key) !== value) {
        result.different.set(key, { first: value, second: vars2.get(key)! });
      } else {
        result.same.set(key, value);
      }
    }

    for (const [key, value] of vars2) {
      if (!vars1.has(key)) {
        result.onlyInSecond.set(key, value);
      }
    }

    return result;
  }

  async execute(): Promise<AgentResult> {
    const plan = await this.createMigrationPlan(
      'development',
      this.environment,
      true
    );

    return this.migrate(plan);
  }

  async validate(): Promise<boolean> {
    const envFiles = await this.findEnvFiles();
    return envFiles.length > 0;
  }
}