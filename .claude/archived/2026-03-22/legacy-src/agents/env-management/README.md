# Environment Variable Management Agent System

A comprehensive, agent-based system for managing environment variables from development through production deployment. This system provides intelligent discovery, validation, security scanning, migration, and transformation capabilities for environment configurations.

## Features

### 🔍 **Intelligent Discovery**
- Automatically discovers environment variables used in your codebase
- Identifies undefined variables and suggests definitions
- Detects unused variables for cleanup
- Generates comprehensive environment templates

### ✅ **Advanced Validation**
- Type validation (string, number, boolean, URL, email, JSON, base64, port, IP)
- Required/optional variable enforcement
- Min/max constraints for numeric values
- Pattern matching with regex
- Cross-variable dependency validation
- Custom validation functions

### 🔒 **Security Scanning**
- Detects exposed secrets and credentials
- Validates encryption status
- Checks against common security patterns
- Scans git history for leaked secrets
- File permission validation
- .gitignore verification

### 🚀 **Environment Migration**
- Seamless transitions between environments
- Automatic transformation rules
- Backup and rollback capabilities
- Dry-run mode for testing
- Environment comparison tools

### 🔄 **Format Transformation**
- Supports multiple formats: dotenv, JSON, YAML, INI, XML, TOML, Shell, Docker, Kubernetes
- Platform-specific conversions (Vercel, Netlify, Heroku, AWS, Azure, GCP)
- Variable expansion and interpolation
- Automatic categorization and grouping

### 🎯 **Orchestration**
- Coordinated multi-agent workflows
- Pre-built workflows for common tasks
- Custom workflow creation
- Parallel and sequential execution
- Event-driven architecture

## Installation

```bash
npm install @synthex/env-management
```

## Quick Start

```typescript
import { EnvManagement } from '@synthex/env-management';

// Perform a complete environment scan
const scanResult = await EnvManagement.scan('./my-project');

// Prepare for deployment
const deployResult = await EnvManagement.prepareDeployment(
  './my-project',
  'production'
);

// Generate environment template
const template = await EnvManagement.generateTemplate('./my-project');

// Migrate between environments
const migrationResult = await EnvManagement.migrate(
  './my-project',
  'development',
  'production',
  false // dryRun
);
```

## Detailed Usage

### Creating an Orchestrator

```typescript
import { createEnvManagementSystem } from '@synthex/env-management';

const envSystem = await createEnvManagementSystem({
  projectPath: './my-project',
  environment: 'production',
  autoDiscovery: true,
  autoValidation: true,
  autoSecurity: true,
  validationSchema: {
    rules: [
      { name: 'NODE_ENV', type: 'string', required: true },
      { name: 'PORT', type: 'number', required: true, min: 1, max: 65535 },
      { name: 'DATABASE_URL', type: 'url', required: true },
      { name: 'JWT_SECRET', type: 'string', required: true, minLength: 32 }
    ]
  },
  securityConfig: {
    sensitiveKeys: ['API_KEY', 'SECRET_KEY'],
    encryptionRequired: ['JWT_SECRET', 'DATABASE_PASSWORD'],
    checkGitIgnore: true
  }
});
```

### Running Pre-built Workflows

```typescript
// Full environment scan
await envSystem.runPrebuiltWorkflow('full-scan');

// Deployment preparation
await envSystem.runPrebuiltWorkflow('deployment-prep');

// Security audit
await envSystem.runPrebuiltWorkflow('security-audit');

// Environment synchronization
await envSystem.runPrebuiltWorkflow('environment-sync');

// Platform deployment
await envSystem.runPrebuiltWorkflow('platform-deploy');
```

### Creating Custom Workflows

```typescript
const customWorkflow = {
  name: 'pre-commit-check',
  description: 'Pre-commit environment validation',
  steps: [
    { agent: 'discovery', action: 'discover' },
    { agent: 'validator', action: 'validate' },
    { agent: 'security', action: 'scan' },
    {
      agent: 'transformer',
      action: 'transform',
      params: {
        inputPath: '.env',
        outputPath: '.env.encrypted',
        options: { encryptSensitive: true }
      }
    }
  ],
  parallel: false
};

const result = await envSystem.runWorkflow(customWorkflow);
```

### Individual Agent Usage

#### Validator

```typescript
import { EnvValidator } from '@synthex/env-management';

const validator = new EnvValidator({
  projectPath: './my-project',
  environment: 'production',
  schema: {
    rules: [
      {
        name: 'EMAIL',
        type: 'email',
        required: true,
        description: 'Admin email address'
      },
      {
        name: 'MAX_CONNECTIONS',
        type: 'number',
        required: true,
        min: 1,
        max: 100,
        default: 10
      },
      {
        name: 'ENVIRONMENT',
        enum: ['development', 'staging', 'production'],
        required: true
      }
    ]
  }
});

const validationResult = await validator.execute();
```

#### Security Scanner

```typescript
import { EnvSecurityAgent } from '@synthex/env-management';

const security = new EnvSecurityAgent({
  projectPath: './my-project',
  environment: 'production',
  securityConfig: {
    sensitiveKeys: ['PASSWORD', 'TOKEN', 'SECRET'],
    checkCommitHistory: true,
    maxValueLength: 500
  }
});

const issues = await security.scanForSecrets();

// Encrypt sensitive values
const encrypted = await security.encryptValue('my-secret', 'encryption-key');
const decrypted = await security.decryptValue(encrypted, 'encryption-key');
```

#### Migrator

```typescript
import { EnvMigrator } from '@synthex/env-management';

const migrator = new EnvMigrator({
  projectPath: './my-project',
  environment: 'production'
});

// Create migration plan
const plan = await migrator.createMigrationPlan(
  'staging',
  'production',
  true // autoDetect
);

// Execute migration
const result = await migrator.migrate(plan);

// Compare environments
const comparison = await migrator.compareEnvironments('staging', 'production');

// Rollback if needed
await migrator.rollback(result.data.migrationId);
```

#### Discovery

```typescript
import { EnvDiscovery } from '@synthex/env-management';

const discovery = new EnvDiscovery({
  projectPath: './my-project',
  environment: 'development'
});

// Discover all variables
const variables = await discovery.discoverVariables();

// Generate template
const template = await discovery.generateEnvTemplate();
```

#### Transformer

```typescript
import { EnvTransformer } from '@synthex/env-management';

const transformer = new EnvTransformer({
  projectPath: './my-project',
  environment: 'production'
});

// Transform to JSON
await transformer.transform('.env', 'config.json', {
  sourceFormat: 'dotenv',
  targetFormat: 'json',
  expandVariables: true,
  groupByCategory: true
});

// Convert to platform format
await transformer.convertToPlatform('.env', 'vercel', false);
```

## Configuration

### Validation Schema

```typescript
interface ValidationRule {
  name: string;
  type?: 'string' | 'number' | 'boolean' | 'url' | 'email' | 'json' | 'base64' | 'port' | 'ip';
  required?: boolean;
  pattern?: RegExp | string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  enum?: any[];
  default?: any;
  dependsOn?: string[];
  validate?: (value: any, allVars: Map<string, string>) => boolean | string;
  description?: string;
}
```

### Security Configuration

```typescript
interface SecurityConfig {
  scanPatterns: RegExp[];
  sensitiveKeys: string[];
  allowedDomains?: string[];
  encryptionRequired?: string[];
  maxValueLength?: number;
  checkGitIgnore?: boolean;
  checkCommitHistory?: boolean;
}
```

### Migration Rules

```typescript
interface MigrationRule {
  from: string;
  to: string;
  transform?: (value: string) => string;
  condition?: (value: string) => boolean;
  removeOriginal?: boolean;
}
```

## Events

The system emits various events for monitoring and logging:

```typescript
envSystem.on('workflow-start', (data) => {
  console.log(`Starting workflow: ${data.workflow}`);
});

envSystem.on('step-complete', (data) => {
  console.log(`Completed: ${data.agent}.${data.action}`);
});

envSystem.on('validation-complete', (data) => {
  console.log(`Validation: ${data.valid ? 'Passed' : 'Failed'}`);
});

envSystem.on('security-scan-complete', (data) => {
  console.log(`Found ${data.issues.length} security issues`);
});

envSystem.on('migration-complete', (data) => {
  console.log(`Migrated ${data.variablesMigrated} variables`);
});
```

## Best Practices

1. **Always validate before deployment**
   ```typescript
   await envSystem.runPrebuiltWorkflow('deployment-prep');
   ```

2. **Use dry-run for migrations**
   ```typescript
   const plan = await migrator.createMigrationPlan('dev', 'prod', true);
   plan.dryRun = true;
   await migrator.migrate(plan);
   ```

3. **Enable automatic backups**
   ```typescript
   plan.backupEnabled = true;
   plan.rollbackOnError = true;
   ```

4. **Regular security audits**
   ```typescript
   const schedule = '0 0 * * *'; // Daily
   scheduleJob(schedule, async () => {
     await envSystem.runPrebuiltWorkflow('security-audit');
   });
   ```

5. **Document your variables**
   ```typescript
   const schema = await validator.generateSchema();
   await fs.writeFile('env-schema.json', JSON.stringify(schema, null, 2));
   ```

## CLI Usage

```bash
# Install globally
npm install -g @synthex/env-management

# Scan environment
env-manage scan

# Validate against schema
env-manage validate --schema=env-schema.json

# Security audit
env-manage security

# Migrate environments
env-manage migrate --from=staging --to=production

# Transform format
env-manage transform --input=.env --output=config.json --format=json

# Generate template
env-manage template > .env.example
```

## Testing

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --testNamePattern="EnvValidator"

# Coverage report
npm run test:coverage
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT

## Support

- Issues: [GitHub Issues](https://github.com/synthex/env-management/issues)
- Documentation: [Full Documentation](https://docs.synthex.com/env-management)
- Examples: [Example Projects](https://github.com/synthex/env-management-examples)