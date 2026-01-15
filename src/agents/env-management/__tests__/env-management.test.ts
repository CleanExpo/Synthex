import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  EnvOrchestrator,
  EnvValidator,
  EnvMigrator,
  EnvSecurityAgent,
  EnvDiscovery,
  EnvTransformer,
  createEnvManagementSystem,
  EnvManagement
} from '../index';

describe('Environment Variable Management System', () => {
  const testProjectPath = path.join(__dirname, 'test-project');
  const testEnvFile = path.join(testProjectPath, '.env');
  const testEnvContent = `
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:securepass@localhost:5432/appdb
API_KEY=live-api-key-9876543210
JWT_SECRET=jwtvalue-abcdef6789abcdef
REDIS_URL=redis://localhost:6379
DEBUG=true
FEATURE_FLAG_NEW_UI=false
`;

  beforeEach(async () => {
    await fs.mkdir(testProjectPath, { recursive: true });
    await fs.writeFile(testEnvFile, testEnvContent);
    await fs.writeFile(path.join(testProjectPath, '.env.development'), testEnvContent);
    await fs.writeFile(path.join(testProjectPath, '.gitignore'), '.env*\n');
  });

  afterEach(async () => {
    await fs.rm(testProjectPath, { recursive: true, force: true });
  });

  describe('EnvValidator', () => {
    it('should validate environment variables against schema', async () => {
      const validator = new EnvValidator({
        projectPath: testProjectPath,
        environment: 'development',
        schema: {
          rules: [
            { name: 'NODE_ENV', type: 'string', required: true, enum: ['development', 'production', 'test'] },
            { name: 'PORT', type: 'number', required: true, min: 1, max: 65535 },
            { name: 'DATABASE_URL', type: 'url', required: true },
            { name: 'API_KEY', type: 'string', required: true, minLength: 10 },
            { name: 'JWT_SECRET', type: 'string', required: true, minLength: 16 },
            { name: 'DEBUG', type: 'boolean', required: false }
          ]
        }
      });

      const result = await validator.execute();
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required variables', async () => {
      const originalEnv = {
        PORT: process.env.PORT,
        DATABASE_URL: process.env.DATABASE_URL
      };
      delete process.env.PORT;
      delete process.env.DATABASE_URL;

      await fs.writeFile(testEnvFile, 'NODE_ENV=development\n');
      await fs.writeFile(path.join(testProjectPath, '.env.development'), 'NODE_ENV=development\n');
      
      const validator = new EnvValidator({
        projectPath: testProjectPath,
        environment: 'development',
        schema: {
          rules: [
            { name: 'NODE_ENV', type: 'string', required: true },
            { name: 'PORT', type: 'number', required: true },
            { name: 'DATABASE_URL', type: 'url', required: true }
          ]
        }
      });

      const result = await validator.execute();
      expect(result.success).toBe(false);
      expect(result.errors).toContain('PORT: Required variable is missing or empty');
      expect(result.errors).toContain('DATABASE_URL: Required variable is missing or empty');

      if (originalEnv.PORT) {
        process.env.PORT = originalEnv.PORT;
      } else {
        delete process.env.PORT;
      }
      if (originalEnv.DATABASE_URL) {
        process.env.DATABASE_URL = originalEnv.DATABASE_URL;
      } else {
        delete process.env.DATABASE_URL;
      }
    });

    it('should validate variable types', async () => {
      const originalEnv = {
        PORT: process.env.PORT,
        DEBUG: process.env.DEBUG
      };
      delete process.env.PORT;
      delete process.env.DEBUG;

      await fs.writeFile(testEnvFile, 'PORT=not-a-number\nDEBUG=not-a-boolean\n');
      await fs.writeFile(path.join(testProjectPath, '.env.development'), 'PORT=not-a-number\nDEBUG=not-a-boolean\n');
      
      const validator = new EnvValidator({
        projectPath: testProjectPath,
        environment: 'development',
        schema: {
          rules: [
            { name: 'PORT', type: 'number', required: true },
            { name: 'DEBUG', type: 'boolean', required: true }
          ]
        }
      });

      const result = await validator.execute();
      expect(result.success).toBe(false);
      expect(result.errors?.length).toBeGreaterThan(0);

      if (originalEnv.PORT) {
        process.env.PORT = originalEnv.PORT;
      } else {
        delete process.env.PORT;
      }
      if (originalEnv.DEBUG) {
        process.env.DEBUG = originalEnv.DEBUG;
      } else {
        delete process.env.DEBUG;
      }
    });

    it('should generate schema from existing environment', async () => {
      const validator = new EnvValidator({
        projectPath: testProjectPath,
        environment: 'development'
      });

      const schema = await validator.generateSchema();
      expect(schema.rules).toHaveLength(8);
      expect(schema.rules.find(r => r.name === 'PORT')).toBeDefined();
      expect(schema.rules.find(r => r.name === 'DATABASE_URL')).toBeDefined();
    });
  });

  describe('EnvMigrator', () => {
    const stagingEnvFile = path.join(testProjectPath, '.env.staging');
    const productionEnvFile = path.join(testProjectPath, '.env.production');

    beforeEach(async () => {
      await fs.writeFile(stagingEnvFile, 'NODE_ENV=staging\nPORT=3001\n');
      await fs.writeFile(productionEnvFile, 'NODE_ENV=production\nPORT=8080\n');
    });

    it('should create migration plan', async () => {
      const migrator = new EnvMigrator({
        projectPath: testProjectPath,
        environment: 'staging'
      });

      const plan = await migrator.createMigrationPlan('development', 'staging', true);
      expect(plan.sourceEnvironment).toBe('development');
      expect(plan.targetEnvironment).toBe('staging');
      expect(plan.rules.length).toBeGreaterThan(0);
    });

    it('should migrate variables between environments', async () => {
      const migrator = new EnvMigrator({
        projectPath: testProjectPath,
        environment: 'staging'
      });

      const plan = await migrator.createMigrationPlan('development', 'staging', true);
      const result = await migrator.migrate(plan);
      
      expect(result.success).toBe(true);
      expect(result.data.changes).toBeDefined();
    });

    it('should compare environments', async () => {
      const migrator = new EnvMigrator({
        projectPath: testProjectPath,
        environment: 'development'
      });

      const comparison = await migrator.compareEnvironments('development', 'staging');
      
      expect(comparison.onlyInFirst.size).toBeGreaterThan(0);
      expect(comparison.different.has('NODE_ENV')).toBe(true);
      expect(comparison.different.has('PORT')).toBe(true);
    });

    it('should support rollback', async () => {
      const migrator = new EnvMigrator({
        projectPath: testProjectPath,
        environment: 'staging'
      });

      const plan = await migrator.createMigrationPlan('development', 'staging', true);
      plan.backupEnabled = true;
      
      const migrationResult = await migrator.migrate(plan);
      expect(migrationResult.success).toBe(true);
      
      const migrationId = migrationResult.data.migrationId;
      const rollbackResult = await migrator.rollback(migrationId);
      expect(rollbackResult.success).toBe(true);
    });
  });

  describe('EnvSecurityAgent', () => {
    it('should detect security issues', async () => {
      const insecureEnv = `
API_KEY=test
PASSWORD=password123
SECRET_KEY=changeme
DATABASE_URL=http://user:pass@localhost:5432/db
`;
      await fs.writeFile(testEnvFile, insecureEnv);

      const security = new EnvSecurityAgent({
        projectPath: testProjectPath,
        environment: 'development'
      });

      const result = await security.execute();
      expect(result.success).toBe(false);
      expect(result.data.issues.length).toBeGreaterThan(0);
      
      const criticalIssues = result.data.issues.filter((i: any) => i.severity === 'critical');
      expect(criticalIssues.length).toBeGreaterThan(0);
    });

    it('should check for exposed secrets in patterns', async () => {
      const exposedSecrets = `
AWS_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE
GITHUB_TOKEN=ghp_16CharactersSecretsToken1234567890
STRIPE_KEY=sk_test_4eC39HqLyjWDarjtT1zdp7dc
`;
      await fs.writeFile(testEnvFile, exposedSecrets);

      const security = new EnvSecurityAgent({
        projectPath: testProjectPath,
        environment: 'development'
      });

      const issues = await security.scanForSecrets();
      const criticalIssues = issues.filter(i => i.severity === 'critical');
      expect(criticalIssues.length).toBeGreaterThan(0);
    });

    it('should encrypt and decrypt values', async () => {
      const security = new EnvSecurityAgent({
        projectPath: testProjectPath,
        environment: 'development'
      });

      const originalValue = 'my-secret-value';
      const encryptionKey = 'a'.repeat(64);
      
      const encrypted = await security.encryptValue(originalValue, encryptionKey);
      expect(encrypted).toMatch(/^enc\[/);
      
      const decrypted = await security.decryptValue(encrypted, encryptionKey);
      expect(decrypted).toBe(originalValue);
    });
  });

  describe('EnvDiscovery', () => {
    beforeEach(async () => {
      const sampleCode = `
const port = process.env.PORT || 3000;
const dbUrl = process.env.DATABASE_URL;
const apiKey = process.env.API_KEY;
const undefinedVar = process.env.UNDEFINED_VAR;
const featureFlag = process.env.FEATURE_FLAG_NEW_UI === 'true';
`;
      await fs.writeFile(path.join(testProjectPath, 'index.js'), sampleCode);
    });

    it('should discover environment variables from code', async () => {
      const discovery = new EnvDiscovery({
        projectPath: testProjectPath,
        environment: 'development'
      });

      const variables = await discovery.discoverVariables();
      
      expect(variables.has('PORT')).toBe(true);
      expect(variables.has('DATABASE_URL')).toBe(true);
      expect(variables.has('API_KEY')).toBe(true);
      expect(variables.has('UNDEFINED_VAR')).toBe(true);
      
      const undefinedVar = variables.get('UNDEFINED_VAR');
      expect(undefinedVar?.defined).toBe(false);
    });

    it('should generate environment template', async () => {
      const discovery = new EnvDiscovery({
        projectPath: testProjectPath,
        environment: 'development'
      });

      await discovery.discoverVariables();
      const template = await discovery.generateEnvTemplate();
      
      expect(template).toContain('PORT=');
      expect(template).toContain('DATABASE_URL=');
      expect(template).toContain('# Auto-generated environment template');
    });
  });

  describe('EnvTransformer', () => {
    it('should transform between formats', async () => {
      const transformer = new EnvTransformer({
        projectPath: testProjectPath,
        environment: 'development'
      });

      const jsonOutput = path.join(testProjectPath, 'env.json');
      const result = await transformer.transform(
        testEnvFile,
        jsonOutput,
        {
          sourceFormat: 'dotenv',
          targetFormat: 'json',
          groupByCategory: true
        }
      );

      expect(result.success).toBe(true);
      
      const jsonContent = await fs.readFile(jsonOutput, 'utf-8');
      const json = JSON.parse(jsonContent);
      expect(json).toBeDefined();
    });

    it('should convert to platform-specific formats', async () => {
      const transformer = new EnvTransformer({
        projectPath: testProjectPath,
        environment: 'development'
      });

      const result = await transformer.convertToPlatform(
        testEnvFile,
        'vercel',
        false
      );

      expect(result.success).toBe(true);
      
      const vercelConfig = await fs.readFile(
        path.join(testProjectPath, 'vercel.json'),
        'utf-8'
      );
      const config = JSON.parse(vercelConfig);
      expect(config.env).toBeDefined();
    });

    it('should expand variables', async () => {
      const envWithRefs = `
BASE_URL=https://api.example.com
API_ENDPOINT=\${BASE_URL}/v1
AUTH_ENDPOINT=\${BASE_URL}/auth
`;
      await fs.writeFile(testEnvFile, envWithRefs);

      const transformer = new EnvTransformer({
        projectPath: testProjectPath,
        environment: 'development'
      });

      const outputFile = path.join(testProjectPath, 'expanded.env');
      await transformer.transform(
        testEnvFile,
        outputFile,
        {
          sourceFormat: 'dotenv',
          targetFormat: 'dotenv',
          expandVariables: true
        }
      );

      const content = await fs.readFile(outputFile, 'utf-8');
      expect(content).toContain('API_ENDPOINT=https://api.example.com/v1');
      expect(content).toContain('AUTH_ENDPOINT=https://api.example.com/auth');
    });
  });

  describe('EnvOrchestrator', () => {
    it('should run full scan workflow', async () => {
      const orchestrator = new EnvOrchestrator({
        projectPath: testProjectPath,
        environment: 'development'
      });

      await orchestrator.initialize();
      const result = await orchestrator.runPrebuiltWorkflow('full-scan');
      
      expect(result.success).toBe(true);
      expect(result.data.results).toHaveLength(3);
    });

    it('should generate health check report', async () => {
      const orchestrator = new EnvOrchestrator({
        projectPath: testProjectPath,
        environment: 'development'
      });

      await orchestrator.initialize();
      const report = await orchestrator.healthCheck();
      
      expect(report.environment).toBe('development');
      expect(report.summary.totalVariables).toBeGreaterThan(0);
      expect(report.recommendations).toBeDefined();
    });

    it('should run custom workflow', async () => {
      const orchestrator = new EnvOrchestrator({
        projectPath: testProjectPath,
        environment: 'development'
      });

      await orchestrator.initialize();
      
      const customWorkflow = {
        name: 'custom-workflow',
        description: 'Custom test workflow',
        steps: [
          { agent: 'discovery', action: 'discover' },
          { agent: 'validator', action: 'generateSchema' }
        ],
        parallel: false
      };

      const result = await orchestrator.runWorkflow(customWorkflow);
      expect(result.success).toBe(true);
    });
  });

  describe('EnvManagement Quick Functions', () => {
    it('should perform quick scan', async () => {
      const result = await EnvManagement.scan(testProjectPath);
      expect(result.success).toBe(true);
    });

    it('should generate template', async () => {
      const template = await EnvManagement.generateTemplate(testProjectPath);
      expect(template).toContain('PORT=');
      expect(template).toContain('DATABASE_URL=');
    });

    it('should transform formats', async () => {
      const outputFile = path.join(testProjectPath, 'output.json');
      const result = await EnvManagement.transform(
        testProjectPath,
        testEnvFile,
        outputFile,
        'dotenv',
        'json'
      );
      expect(result.success).toBe(true);
    });
  });
});
