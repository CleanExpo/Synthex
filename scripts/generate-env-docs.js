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

// Define env var definitions directly (since we can't import TypeScript)
class EnvDocGenerator {
  constructor() {
    this.definitions = this.getDefinitions();
  }

  // Complete env var definitions
  getDefinitions() {
    return [
      // ========== DATABASE ==========
      {
        key: 'DATABASE_URL',
        description: 'PostgreSQL connection string with credentials',
        required: true,
        securityLevel: 'CRITICAL',
        example: 'postgresql://user:password@host:5432/dbname'
      },
      
      // ========== AUTHENTICATION ==========
      {
        key: 'JWT_SECRET',
        description: 'Secret key for signing JWT tokens (min 32 chars)',
        required: true,
        securityLevel: 'CRITICAL',
        example: 'base64EncodedRandomStringAtLeast32CharsLong=='
      },
      {
        key: 'NEXTAUTH_SECRET',
        description: 'NextAuth.js secret for session encryption',
        required: false,
        securityLevel: 'CRITICAL',
        example: 'generated-random-string-for-nextauth',
        dependsOn: ['NEXTAUTH_URL']
      },
      {
        key: 'NEXTAUTH_URL',
        description: 'Canonical URL of the site for NextAuth',
        required: false,
        securityLevel: 'INTERNAL',
        example: 'https://synthex.vercel.app'
      },
      
      // ========== SUPABASE ==========
      {
        key: 'NEXT_PUBLIC_SUPABASE_URL',
        description: 'Supabase project URL (public)',
        required: true,
        securityLevel: 'PUBLIC',
        example: 'https://project.supabase.co'
      },
      {
        key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        description: 'Supabase anonymous/public key (safe for client)',
        required: true,
        securityLevel: 'PUBLIC',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
      },
      {
        key: 'SUPABASE_SERVICE_ROLE_KEY',
        description: 'Supabase service role key (NEVER expose to client)',
        required: false,
        securityLevel: 'CRITICAL',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
      },
      
      // ========== AI/LLM SERVICES ==========
      {
        key: 'OPENROUTER_API_KEY',
        description: 'OpenRouter API key for AI services',
        required: true,
        securityLevel: 'SECRET',
        example: 'sk-or-v1-xxxxxxxxxxxxx'
      },
      {
        key: 'OPENAI_API_KEY',
        description: 'OpenAI API key (alternative to OpenRouter)',
        required: false,
        securityLevel: 'SECRET',
        example: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        conflictsWith: ['ANTHROPIC_API_KEY']
      },
      {
        key: 'ANTHROPIC_API_KEY',
        description: 'Anthropic Claude API key',
        required: false,
        securityLevel: 'SECRET',
        example: 'sk-ant-xxxxxxxxxxxxx',
        conflictsWith: ['OPENAI_API_KEY']
      },
      
      // ========== PAYMENT PROCESSING ==========
      {
        key: 'STRIPE_SECRET_KEY',
        description: 'Stripe secret key for payment processing',
        required: false,
        securityLevel: 'CRITICAL',
        example: 'sk_test_xxxxxxxxxx',
        dependsOn: ['STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET']
      },
      {
        key: 'STRIPE_PUBLISHABLE_KEY',
        description: 'Stripe publishable key (safe for client)',
        required: false,
        securityLevel: 'PUBLIC',
        example: 'pk_test_xxxxxxxxxx'
      },
      {
        key: 'STRIPE_WEBHOOK_SECRET',
        description: 'Stripe webhook endpoint secret',
        required: false,
        securityLevel: 'SECRET',
        example: 'whsec_xxxxxxxxxx'
      },
      
      // ========== EMAIL SERVICE ==========
      {
        key: 'EMAIL_PROVIDER',
        description: 'Email service provider',
        required: false,
        securityLevel: 'INTERNAL',
        example: 'smtp',
        dependsOn: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS']
      },
      {
        key: 'SMTP_HOST',
        description: 'SMTP server hostname',
        required: false,
        securityLevel: 'INTERNAL',
        example: 'smtp.gmail.com'
      },
      {
        key: 'SMTP_PORT',
        description: 'SMTP server port',
        required: false,
        securityLevel: 'INTERNAL',
        example: '587',
        defaultValue: '587'
      },
      {
        key: 'SMTP_USER',
        description: 'SMTP authentication username',
        required: false,
        securityLevel: 'SECRET',
        example: 'your-email@gmail.com'
      },
      {
        key: 'SMTP_PASS',
        description: 'SMTP authentication password',
        required: false,
        securityLevel: 'SECRET',
        example: 'your-app-specific-password'
      },
      
      // ========== OAUTH PROVIDERS ==========
      {
        key: 'GOOGLE_CLIENT_ID',
        description: 'Google OAuth client ID',
        required: false,
        securityLevel: 'INTERNAL',
        example: 'xxxxx.apps.googleusercontent.com',
        dependsOn: ['GOOGLE_CLIENT_SECRET']
      },
      {
        key: 'GOOGLE_CLIENT_SECRET',
        description: 'Google OAuth client secret',
        required: false,
        securityLevel: 'SECRET',
        example: 'GOCSPX-xxxxxxxxxxxxx'
      },
      
      // ========== MONITORING & ANALYTICS ==========
      {
        key: 'SENTRY_DSN',
        description: 'Sentry error tracking DSN',
        required: false,
        securityLevel: 'INTERNAL',
        example: 'https://xxx@xxx.ingest.sentry.io/xxx'
      },
      {
        key: 'NEXT_PUBLIC_SENTRY_DSN',
        description: 'Sentry DSN for client-side',
        required: false,
        securityLevel: 'PUBLIC',
        example: 'https://xxx@xxx.ingest.sentry.io/xxx'
      },
      {
        key: 'NEXT_PUBLIC_GA_ID',
        description: 'Google Analytics tracking ID',
        required: false,
        securityLevel: 'PUBLIC',
        example: 'G-XXXXXXXXXX'
      },
      
      // ========== APPLICATION CONFIG ==========
      {
        key: 'NEXT_PUBLIC_APP_URL',
        description: 'Public application URL',
        required: false,
        securityLevel: 'PUBLIC',
        example: 'https://synthex.vercel.app',
        defaultValue: 'http://localhost:3000'
      },
      {
        key: 'NODE_ENV',
        description: 'Node environment',
        required: false,
        securityLevel: 'INTERNAL',
        example: 'production',
        defaultValue: 'development'
      },
      
      // ========== REDIS/CACHING ==========
      {
        key: 'REDIS_URL',
        description: 'Redis connection URL for caching',
        required: false,
        securityLevel: 'SECRET',
        example: 'redis://username:password@host:6379'
      },
      
      // ========== RATE LIMITING ==========
      {
        key: 'RATE_LIMIT_MAX',
        description: 'Maximum requests per window',
        required: false,
        securityLevel: 'INTERNAL',
        example: '100',
        defaultValue: '100'
      },
      {
        key: 'RATE_LIMIT_WINDOW_MS',
        description: 'Rate limit window in milliseconds',
        required: false,
        securityLevel: 'INTERNAL',
        example: '900000',
        defaultValue: '900000'
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