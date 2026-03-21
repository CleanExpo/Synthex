#!/usr/bin/env node

/**
 * Production Environment Validation
 * Uses the Environment Management Agent System to validate production configuration
 */

import { EnvOrchestrator } from './env-orchestrator';
import { ValidationSchema } from './env-validator';
import * as path from 'path';
import * as fs from 'fs';

const productionSchema: ValidationSchema = {
  rules: [
    // Core Configuration
    {
      name: 'NODE_ENV',
      type: 'string',
      required: true,
      enum: ['production'],
      description: 'Must be set to production'
    },
    {
      name: 'PORT',
      type: 'number',
      required: false,
      default: 3000,
      min: 1,
      max: 65535
    },
    
    // Database Configuration
    {
      name: 'DATABASE_URL',
      type: 'string',
      required: true,
      pattern: /^(postgresql|prisma\+postgres):\/\/.+/,
      description: 'PostgreSQL or Prisma Accelerate connection string'
    },
    {
      name: 'NEXT_PUBLIC_SUPABASE_URL',
      type: 'url',
      required: true,
      pattern: /https:\/\/.+\.supabase\.co/,
      description: 'Supabase project URL'
    },
    {
      name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      type: 'string',
      required: true,
      minLength: 100,
      pattern: /^eyJ/,
      description: 'Supabase anonymous key (JWT format)'
    },
    {
      name: 'SUPABASE_SERVICE_ROLE_KEY',
      type: 'string',
      required: true,
      minLength: 100,
      pattern: /^eyJ/,
      description: 'Supabase service role key (keep secret!)'
    },
    
    // Authentication
    {
      name: 'JWT_SECRET',
      type: 'string',
      required: true,
      minLength: 64,
      description: 'JWT signing secret (minimum 64 characters)'
    },
    {
      name: 'GOOGLE_CLIENT_ID',
      type: 'string',
      required: false,
      pattern: /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/,
      description: 'Google OAuth client ID'
    },
    {
      name: 'GOOGLE_CLIENT_SECRET',
      type: 'string',
      required: false,
      pattern: /^GOCSPX-/,
      description: 'Google OAuth client secret'
    },
    
    // AI Services
    {
      name: 'OPENROUTER_API_KEY',
      type: 'string',
      required: true,
      pattern: /^sk-or-/,
      minLength: 20,
      description: 'OpenRouter API key'
    },
    {
      name: 'ANTHROPIC_API_KEY',
      type: 'string',
      required: false,
      pattern: /^sk-ant-/,
      minLength: 50,
      description: 'Anthropic API key (optional)'
    },
    {
      name: 'OPENAI_API_KEY',
      type: 'string',
      required: false,
      pattern: /^sk-/,
      minLength: 40,
      description: 'OpenAI API key (optional)'
    },
    
    // Security & Rate Limiting
    {
      name: 'RATE_LIMIT_WINDOW_GENERAL',
      type: 'number',
      required: false,
      default: 900000,
      min: 60000,
      max: 3600000
    },
    {
      name: 'RATE_LIMIT_MAX_GENERAL',
      type: 'number',
      required: false,
      default: 100,
      min: 10,
      max: 1000
    },
    {
      name: 'CORS_ALLOWED_ORIGINS',
      type: 'string',
      required: false,
      pattern: /^https:\/\/.+/,
      description: 'Comma-separated list of allowed origins'
    },
    
    // Cost Management
    {
      name: 'DAILY_BUDGET_LIMIT',
      type: 'number',
      required: false,
      default: 50.00,
      min: 0,
      max: 1000
    },
    {
      name: 'MONTHLY_BUDGET_LIMIT',
      type: 'number',
      required: false,
      default: 1000.00,
      min: 0,
      max: 10000
    }
  ],
  allowExtraVars: true,
  strictMode: false,
  environments: ['production']
};

async function validateProduction() {
  console.log('🔍 SYNTHEX Production Environment Validation\n');
  console.log('='.repeat(50) + '\n');
  
  const projectPath = process.cwd();
  
  // Initialize orchestrator
  const orchestrator = new EnvOrchestrator({
    projectPath,
    environment: 'production',
    validationSchema: productionSchema,
    autoDiscovery: true,
    autoValidation: false,
    autoSecurity: true,
    logLevel: 'info'
  });
  
  await orchestrator.initialize();
  
  // Run validation workflow
  const validationWorkflow = {
    name: 'production-validation',
    description: 'Validate production environment configuration',
    steps: [
      { agent: 'discovery', action: 'discover' },
      { agent: 'validator', action: 'validate' },
      { agent: 'security', action: 'scan' }
    ],
    parallel: false
  };
  
  const result = await orchestrator.runWorkflow(validationWorkflow);
  
  // Generate report
  const report = await orchestrator.healthCheck();
  
  // Display results
  console.log('\n📊 Validation Results:\n');
  console.log('-'.repeat(50));
  
  if (result.success) {
    console.log('✅ Environment validation PASSED\n');
  } else {
    console.log('❌ Environment validation FAILED\n');
    console.log('Errors:');
    result.errors?.forEach(error => console.log(`  - ${error}`));
  }
  
  // Show summary
  console.log('\n📈 Summary:');
  console.log(`  Total Variables: ${report.summary.totalVariables}`);
  console.log(`  Validation Errors: ${report.summary.validationErrors}`);
  console.log(`  Security Issues: ${report.summary.securityIssues}`);
  
  // Show recommendations
  if (report.recommendations.length > 0) {
    console.log('\n💡 Recommendations:');
    report.recommendations.forEach(rec => console.log(`  - ${rec}`));
  }
  
  // Show security issues if any
  if (report.details.security?.issues?.length > 0) {
    console.log('\n🔒 Security Issues:');
    const criticalIssues = report.details.security.issues.filter(
      (i: any) => i.severity === 'critical'
    );
    const highIssues = report.details.security.issues.filter(
      (i: any) => i.severity === 'high'
    );
    
    if (criticalIssues.length > 0) {
      console.log('  CRITICAL:');
      criticalIssues.forEach((issue: any) => {
        console.log(`    - ${issue.variable}: ${issue.issue}`);
      });
    }
    
    if (highIssues.length > 0) {
      console.log('  HIGH:');
      highIssues.forEach((issue: any) => {
        console.log(`    - ${issue.variable}: ${issue.issue}`);
      });
    }
  }
  
  // Save report
  const reportPath = path.join(projectPath, 'production-validation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Full report saved to: ${reportPath}`);
  
  // Exit with appropriate code
  process.exit(result.success ? 0 : 1);
}

// Run validation
validateProduction().catch(error => {
  console.error('❌ Validation failed with error:', error);
  process.exit(1);
});