#!/usr/bin/env node

/**
 * ENVIRONMENT VARIABLE DOCUMENTATION GENERATOR
 * 
 * This script automatically generates:
 * 1. .env.example file with all required variables
 * 2. Environment variable documentation
 * 3. Security audit report
 * 
 * Run: node scripts/generate-env-docs.js
 */

const fs = require('fs');
const path = require('path');

// Import the env validator definitions
const { ENV_VAR_DEFINITIONS } = require('../src/lib/security/env-validator.ts');

class EnvDocGenerator {
  constructor() {
    this.definitions = ENV_VAR_DEFINITIONS || this.getDefaultDefinitions();
  }

  // Fallback definitions if import fails
  getDefaultDefinitions() {
    return [
      {
        key: 'DATABASE_URL',
        description: 'PostgreSQL connection string',
        required: true,
        securityLevel: 'CRITICAL',
        example: 'postgresql://user:password@host:5432/dbname'
      },
      {
        key: 'JWT_SECRET',
        description: 'Secret key for JWT tokens',
        required: true,
        securityLevel: 'CRITICAL',
        example: 'base64EncodedRandomStringAtLeast32CharsLong=='
      },
      {
        key: 'NEXT_PUBLIC_SUPABASE_URL',
        description: 'Supabase project URL',
        required: true,
        securityLevel: 'PUBLIC',
        example: 'https://project.supabase.co'
      },
      {
        key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        description: 'Supabase anonymous key',
        required: true,
        securityLevel: 'PUBLIC',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
      },
      {
        key: 'OPENROUTER_API_KEY',
        description: 'OpenRouter API key',
        required: true,
        securityLevel: 'SECRET',
        example: 'sk-or-v1-xxxxxxxxxxxxx'
      }
    ];
  }

  generateEnvExample() {
    let content = `# ============================================
# SYNTHEX ENVIRONMENT VARIABLES
# ============================================
# Generated: ${new Date().toISOString()}
# 
# ⚠️  SECURITY WARNINGS:
# 1. NEVER commit this file with real values
# 2. NEVER expose SECRET/CRITICAL vars to client
# 3. ALWAYS use strong, random values for secrets
# 4. ALWAYS validate env vars at startup
# ============================================

`;

    // Group by category
    const grouped = this.groupByCategory();

    for (const [category, vars] of Object.entries(grouped)) {
      content += `\n# ========== ${category} ==========\n`;
      
      for (const def of vars) {
        content += `# ${def.description}\n`;
        content += `# Security Level: ${def.securityLevel}`;
        content += def.required ? ' [REQUIRED]' : ' [OPTIONAL]';
        content += '\n';
        
        if (def.dependsOn) {
          content += `# Depends on: ${def.dependsOn.join(', ')}\n`;
        }
        
        if (def.conflictsWith) {
          content += `# Conflicts with: ${def.conflictsWith.join(', ')}\n`;
        }
        
        content += `${def.key}=${def.example}\n\n`;
      }
    }

    return content;
  }

  generateMarkdownDocs() {
    let content = `# Environment Variables Documentation

> **⚠️ SECURITY NOTICE:** This document contains example values only. Never commit real secrets!

## Required Variables

These variables MUST be set for the application to function:

| Variable | Description | Security Level | Example |
|----------|-------------|---------------|---------|
`;

    const required = this.definitions.filter(d => d.required);
    for (const def of required) {
      content += `| \`${def.key}\` | ${def.description} | **${def.securityLevel}** | \`${this.maskExample(def.example)}\` |\n`;
    }

    content += `\n## Optional Variables

These variables enable additional features:

| Variable | Description | Security Level | Default | Example |
|----------|-------------|---------------|---------|---------|
`;

    const optional = this.definitions.filter(d => !d.required);
    for (const def of optional) {
      const defaultVal = def.defaultValue || 'None';
      content += `| \`${def.key}\` | ${def.description} | ${def.securityLevel} | ${defaultVal} | \`${this.maskExample(def.example)}\` |\n`;
    }

    content += `\n## Security Classifications

- **CRITICAL** 🔴: Highly sensitive data (database URLs, private keys). Never expose, never log.
- **SECRET** 🟠: Sensitive API keys and passwords. Keep server-side only.
- **INTERNAL** 🟡: Internal configuration. Not sensitive but keep server-side.
- **PUBLIC** 🟢: Safe for client-side exposure (use NEXT_PUBLIC_ prefix).

## Validation

All environment variables are validated at startup using \`src/lib/security/env-validator.ts\`.

To validate your configuration:

\`\`\`bash
node scripts/validate-env.js
\`\`\`

## Security Best Practices

1. **Use a password manager** to generate and store secrets
2. **Rotate secrets regularly** (every 90 days minimum)
3. **Use different values** for development, staging, and production
4. **Enable audit logging** for all secret access
5. **Use secret scanning** in your CI/CD pipeline

## Common Issues

### Missing Required Variables
If you see "Required env var X is missing", ensure:
1. The variable is set in your \`.env.local\` file
2. The variable name is spelled correctly
3. There are no spaces around the = sign

### Invalid Format
If you see "Invalid format for X", check:
1. The value matches the expected pattern
2. URLs include the protocol (https://)
3. Keys are properly encoded (base64, etc.)

### Dependency Errors
Some variables depend on others. For example:
- \`STRIPE_SECRET_KEY\` requires \`STRIPE_WEBHOOK_SECRET\`
- \`GOOGLE_CLIENT_ID\` requires \`GOOGLE_CLIENT_SECRET\`

---

*Generated on ${new Date().toISOString()}*
`;

    return content;
  }

  generateSecurityAudit() {
    const audit = {
      timestamp: new Date().toISOString(),
      totalVariables: this.definitions.length,
      required: this.definitions.filter(d => d.required).length,
      optional: this.definitions.filter(d => !d.required).length,
      bySecurityLevel: {
        CRITICAL: this.definitions.filter(d => d.securityLevel === 'CRITICAL').length,
        SECRET: this.definitions.filter(d => d.securityLevel === 'SECRET').length,
        INTERNAL: this.definitions.filter(d => d.securityLevel === 'INTERNAL').length,
        PUBLIC: this.definitions.filter(d => d.securityLevel === 'PUBLIC').length
      },
      publicVariables: this.definitions
        .filter(d => d.key.startsWith('NEXT_PUBLIC_'))
        .map(d => d.key),
      warnings: [],
      recommendations: []
    };

    // Check for security issues
    for (const def of this.definitions) {
      // Check if secret is marked as public
      if (def.key.startsWith('NEXT_PUBLIC_') && 
          (def.securityLevel === 'SECRET' || def.securityLevel === 'CRITICAL')) {
        audit.warnings.push(`${def.key} is marked as ${def.securityLevel} but uses NEXT_PUBLIC_ prefix!`);
      }

      // Check if non-public var doesn't have security level
      if (!def.key.startsWith('NEXT_PUBLIC_') && def.securityLevel === 'PUBLIC') {
        audit.warnings.push(`${def.key} is marked PUBLIC but doesn't use NEXT_PUBLIC_ prefix`);
      }
    }

    // Add recommendations
    if (!this.definitions.find(d => d.key === 'SENTRY_DSN')) {
      audit.recommendations.push('Add error tracking with Sentry');
    }
    if (!this.definitions.find(d => d.key === 'REDIS_URL')) {
      audit.recommendations.push('Add Redis for caching and rate limiting');
    }

    return audit;
  }

  groupByCategory() {
    const grouped = {
      DATABASE: [],
      AUTHENTICATION: [],
      AI_SERVICES: [],
      PAYMENT: [],
      EMAIL: [],
      OAUTH: [],
      MONITORING: [],
      APPLICATION: [],
      OTHER: []
    };

    for (const def of this.definitions) {
      if (def.key.includes('DATABASE') || def.key.includes('DB')) {
        grouped.DATABASE.push(def);
      } else if (def.key.includes('JWT') || def.key.includes('AUTH')) {
        grouped.AUTHENTICATION.push(def);
      } else if (def.key.includes('OPENROUTER') || def.key.includes('OPENAI') || def.key.includes('ANTHROPIC')) {
        grouped.AI_SERVICES.push(def);
      } else if (def.key.includes('STRIPE')) {
        grouped.PAYMENT.push(def);
      } else if (def.key.includes('SMTP') || def.key.includes('EMAIL')) {
        grouped.EMAIL.push(def);
      } else if (def.key.includes('GOOGLE')) {
        grouped.OAUTH.push(def);
      } else if (def.key.includes('SENTRY') || def.key.includes('GA')) {
        grouped.MONITORING.push(def);
      } else if (def.key.includes('APP') || def.key.includes('NODE')) {
        grouped.APPLICATION.push(def);
      } else {
        grouped.OTHER.push(def);
      }
    }

    // Remove empty categories
    for (const key in grouped) {
      if (grouped[key].length === 0) {
        delete grouped[key];
      }
    }

    return grouped;
  }

  maskExample(example) {
    if (example.length <= 10) {
      return 'xxx';
    }
    return example.substring(0, 5) + '...' + example.substring(example.length - 3);
  }

  async writeFiles() {
    const envExample = this.generateEnvExample();
    const markdownDocs = this.generateMarkdownDocs();
    const securityAudit = this.generateSecurityAudit();

    // Write .env.example
    fs.writeFileSync(
      path.join(process.cwd(), '.env.example'),
      envExample
    );
    console.log('✅ Generated .env.example');

    // Write documentation
    fs.writeFileSync(
      path.join(process.cwd(), 'docs', 'ENVIRONMENT_VARIABLES.md'),
      markdownDocs
    );
    console.log('✅ Generated docs/ENVIRONMENT_VARIABLES.md');

    // Write security audit
    fs.writeFileSync(
      path.join(process.cwd(), '.env.audit.json'),
      JSON.stringify(securityAudit, null, 2)
    );
    console.log('✅ Generated .env.audit.json');

    // Print audit summary
    console.log('\n📊 Security Audit Summary:');
    console.log(`   Total Variables: ${securityAudit.totalVariables}`);
    console.log(`   Required: ${securityAudit.required}`);
    console.log(`   Optional: ${securityAudit.optional}`);
    console.log('\n   By Security Level:');
    console.log(`   🔴 CRITICAL: ${securityAudit.bySecurityLevel.CRITICAL}`);
    console.log(`   🟠 SECRET: ${securityAudit.bySecurityLevel.SECRET}`);
    console.log(`   🟡 INTERNAL: ${securityAudit.bySecurityLevel.INTERNAL}`);
    console.log(`   🟢 PUBLIC: ${securityAudit.bySecurityLevel.PUBLIC}`);

    if (securityAudit.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      for (const warning of securityAudit.warnings) {
        console.log(`   - ${warning}`);
      }
    }

    if (securityAudit.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      for (const rec of securityAudit.recommendations) {
        console.log(`   - ${rec}`);
      }
    }
  }
}

// Run the generator
async function main() {
  console.log('🔧 Generating environment variable documentation...\n');
  
  const generator = new EnvDocGenerator();
  
  try {
    await generator.writeFiles();
    console.log('\n✨ Documentation generation complete!');
  } catch (error) {
    console.error('❌ Error generating documentation:', error);
    process.exit(1);
  }
}

main();