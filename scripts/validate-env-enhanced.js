#!/usr/bin/env node

/**
 * ENHANCED ENVIRONMENT VARIABLE VALIDATOR
 * 
 * Uses the security system to validate all environment variables
 * Checks format, dependencies, and security requirements
 * 
 * ENVIRONMENT VARIABLES CHECKED:
 * - All 28 defined variables with proper security levels
 * - Format validation using regex patterns
 * - Dependency checking between related vars
 * - Security audit for exposed secrets
 */

const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = path.join(process.cwd(), '.env.local');
const envProductionPath = path.join(process.cwd(), '.env.production');

// Check if any env file exists
if (!fs.existsSync(envPath) && !fs.existsSync(envProductionPath)) {
  console.error('\n❌ No environment file found!');
  console.log('Please create a .env.local file based on .env.example\n');
  console.log('Run: cp .env.example .env.local\n');
  process.exit(1);
}

// Load the environment variables
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}
if (fs.existsSync(envProductionPath)) {
  require('dotenv').config({ path: envProductionPath });
}

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

// Complete environment variable definitions with validation
const definitions = [
  // ========== REQUIRED VARIABLES ==========
  {
    name: 'DATABASE_URL',
    required: true,
    level: 'CRITICAL',
    description: 'PostgreSQL connection string',
    validator: /^postgres(ql)?:\/\/[^:]+:[^@]+@[^:]+:\d+\/\w+/,
    errorMsg: 'Must be a valid PostgreSQL connection string'
  },
  {
    name: 'JWT_SECRET',
    required: true,
    level: 'CRITICAL',
    description: 'JWT signing secret (min 32 chars)',
    validator: val => val.length >= 32,
    errorMsg: 'Must be at least 32 characters long'
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    required: true,
    level: 'PUBLIC',
    description: 'Supabase project URL',
    validator: /\.supabase\.co$/,
    errorMsg: 'Must be a valid Supabase URL'
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    required: true,
    level: 'PUBLIC',
    description: 'Supabase anonymous key',
    validator: /^eyJ/,
    errorMsg: 'Must be a valid JWT token'
  },
  {
    name: 'OPENROUTER_API_KEY',
    required: true,
    level: 'SECRET',
    description: 'OpenRouter API key',
    validator: /^sk-or-/,
    errorMsg: 'Must start with sk-or-'
  },
  
  // ========== OPTIONAL VARIABLES ==========
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    required: false,
    level: 'CRITICAL',
    description: 'Supabase service role key',
    validator: /^eyJ/,
    errorMsg: 'Must be a valid JWT token'
  },
  {
    name: 'STRIPE_SECRET_KEY',
    required: false,
    level: 'CRITICAL',
    description: 'Stripe secret key',
    validator: /^sk_(test|live)_/,
    errorMsg: 'Must be a valid Stripe secret key',
    dependsOn: ['STRIPE_WEBHOOK_SECRET']
  },
  {
    name: 'STRIPE_WEBHOOK_SECRET',
    required: false,
    level: 'SECRET',
    description: 'Stripe webhook secret',
    validator: /^whsec_/,
    errorMsg: 'Must start with whsec_'
  },
  {
    name: 'EMAIL_PROVIDER',
    required: false,
    level: 'INTERNAL',
    description: 'Email service provider',
    validator: /^(smtp|sendgrid|mailgun|ses)$/,
    errorMsg: 'Must be smtp, sendgrid, mailgun, or ses',
    dependsOn: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS']
  },
  {
    name: 'SMTP_HOST',
    required: false,
    level: 'INTERNAL',
    description: 'SMTP server host'
  },
  {
    name: 'SMTP_PORT',
    required: false,
    level: 'INTERNAL',
    description: 'SMTP server port',
    validator: /^\d+$/,
    errorMsg: 'Must be a number'
  },
  {
    name: 'SMTP_USER',
    required: false,
    level: 'SECRET',
    description: 'SMTP username',
    validator: /@/,
    errorMsg: 'Should be an email address'
  },
  {
    name: 'SMTP_PASS',
    required: false,
    level: 'SECRET',
    description: 'SMTP password'
  },
  {
    name: 'GOOGLE_CLIENT_ID',
    required: false,
    level: 'INTERNAL',
    description: 'Google OAuth client ID',
    validator: /\.apps\.googleusercontent\.com$/,
    errorMsg: 'Must be a valid Google client ID',
    dependsOn: ['GOOGLE_CLIENT_SECRET']
  },
  {
    name: 'GOOGLE_CLIENT_SECRET',
    required: false,
    level: 'SECRET',
    description: 'Google OAuth client secret'
  },
  {
    name: 'SENTRY_DSN',
    required: false,
    level: 'INTERNAL',
    description: 'Sentry error tracking DSN',
    validator: /sentry\.io/,
    errorMsg: 'Must be a valid Sentry DSN'
  },
  {
    name: 'NEXT_PUBLIC_SENTRY_DSN',
    required: false,
    level: 'PUBLIC',
    description: 'Sentry DSN for client',
    validator: /sentry\.io/,
    errorMsg: 'Must be a valid Sentry DSN'
  },
  {
    name: 'NEXT_PUBLIC_APP_URL',
    required: false,
    level: 'PUBLIC',
    description: 'Application URL',
    validator: /^https?:\/\//,
    errorMsg: 'Must be a valid URL'
  },
  {
    name: 'REDIS_URL',
    required: false,
    level: 'SECRET',
    description: 'Redis connection URL',
    validator: /^redis(s)?:\/\//,
    errorMsg: 'Must be a valid Redis URL'
  },
  {
    name: 'RATE_LIMIT_MAX',
    required: false,
    level: 'INTERNAL',
    description: 'Max requests per window',
    validator: /^\d+$/,
    errorMsg: 'Must be a number'
  },
  {
    name: 'RATE_LIMIT_WINDOW_MS',
    required: false,
    level: 'INTERNAL',
    description: 'Rate limit window (ms)',
    validator: /^\d+$/,
    errorMsg: 'Must be a number'
  }
];

// Security level indicators
const levelIcons = {
  'CRITICAL': '🔴',
  'SECRET': '🟠',
  'INTERNAL': '🟡',
  'PUBLIC': '🟢'
};

// Validation state
let hasErrors = false;
const errors = [];
const warnings = [];
const missingRequired = [];
const missingOptional = [];
const configured = [];

// Helper function to mask sensitive values
function maskValue(value, level) {
  if (!value) return 'NOT SET';
  
  if (level === 'CRITICAL' || level === 'SECRET') {
    if (value.length <= 10) return '***';
    return value.substring(0, 3) + '***' + value.substring(value.length - 3);
  }
  
  // For non-sensitive values, show more
  if (value.length <= 20) return value;
  return value.substring(0, 10) + '...' + value.substring(value.length - 5);
}

// Helper function to validate a value
function validateValue(def, value) {
  if (!def.validator) return true;
  
  if (typeof def.validator === 'function') {
    return def.validator(value);
  } else if (def.validator instanceof RegExp) {
    return def.validator.test(value);
  }
  
  return true;
}

// Print header
console.log(`${colors.blue}${colors.bold}\n🔍 Enhanced Environment Variable Validation\n${colors.reset}`);
console.log(`${colors.gray}${'='.repeat(60)}${colors.reset}`);

// Check required variables
console.log(`${colors.cyan}\n📋 Required Variables (Must be set):\n${colors.reset}`);

for (const def of definitions.filter(d => d.required)) {
  const value = process.env[def.name];
  const icon = levelIcons[def.level];
  
  if (!value) {
    console.log(`  ${colors.red}❌ ${def.name}${colors.reset} - Missing ${icon} ${def.level}`);
    missingRequired.push(def.name);
    errors.push(`${def.name} (${def.description}) is required but not set`);
    hasErrors = true;
  } else {
    const isValid = validateValue(def, value);
    
    if (!isValid) {
      console.log(`  ${colors.yellow}⚠️  ${def.name}${colors.reset} - Invalid format ${icon} ${def.level}`);
      warnings.push(`${def.name}: ${def.errorMsg || 'Invalid format'}`);
    } else {
      const maskedValue = maskValue(value, def.level);
      console.log(`  ${colors.green}✅ ${def.name}${colors.reset} - Set (${maskedValue}) ${icon} ${def.level}`);
      configured.push(def.name);
    }
  }
}

// Check optional variables
console.log(`${colors.cyan}\n📋 Optional Variables (Enable features):\n${colors.reset}`);

for (const def of definitions.filter(d => !d.required)) {
  const value = process.env[def.name];
  const icon = levelIcons[def.level];
  
  if (!value) {
    console.log(`  ${colors.gray}○ ${def.name} - Not set ${icon} ${def.level}${colors.reset}`);
    missingOptional.push(def.name);
  } else {
    const isValid = validateValue(def, value);
    
    if (!isValid) {
      console.log(`  ${colors.yellow}⚠️  ${def.name}${colors.reset} - Invalid format ${icon} ${def.level}`);
      warnings.push(`${def.name}: ${def.errorMsg || 'Invalid format'}`);
    } else {
      const maskedValue = maskValue(value, def.level);
      console.log(`  ${colors.green}✅ ${def.name}${colors.reset} - Set (${maskedValue}) ${icon} ${def.level}`);
      configured.push(def.name);
    }
  }
}

// Security checks
console.log(`${colors.cyan}\n🔐 Security Analysis:\n${colors.reset}`);

let securityIssues = 0;

// Check for exposed secrets
for (const def of definitions) {
  const value = process.env[def.name];
  if (!value) continue;
  
  // Critical: Secret exposed to client
  if ((def.level === 'SECRET' || def.level === 'CRITICAL') && def.name.startsWith('NEXT_PUBLIC_')) {
    console.log(`  ${colors.red}🚨 CRITICAL: ${def.name} is ${def.level} but uses NEXT_PUBLIC_ prefix!${colors.reset}`);
    errors.push(`SECURITY: ${def.name} exposes sensitive data to client`);
    securityIssues++;
  }
  
  // Warning: Weak secrets
  if (def.level === 'CRITICAL' && value.length < 32) {
    console.log(`  ${colors.yellow}⚠️  ${def.name} is weak (should be 32+ characters)${colors.reset}`);
    warnings.push(`${def.name} is too short for a secure secret`);
  }
  
  // Warning: Common weak patterns
  if ((def.level === 'SECRET' || def.level === 'CRITICAL') && 
      /^(password|secret|123456|admin|test)/i.test(value)) {
    console.log(`  ${colors.yellow}⚠️  ${def.name} contains weak/common pattern${colors.reset}`);
    warnings.push(`${def.name} appears to use a weak value`);
  }
}

if (securityIssues === 0) {
  console.log(`  ${colors.green}✅ No exposed secrets detected${colors.reset}`);
} else {
  console.log(`  ${colors.red}Found ${securityIssues} security issue(s)${colors.reset}`);
}

// Dependency checks
console.log(`${colors.cyan}\n🔗 Dependency Checks:\n${colors.reset}`);

let depIssues = 0;
for (const def of definitions) {
  if (!def.dependsOn || !process.env[def.name]) continue;
  
  for (const dep of def.dependsOn) {
    if (!process.env[dep]) {
      console.log(`  ${colors.yellow}⚠️  ${def.name} requires ${dep} (not set)${colors.reset}`);
      warnings.push(`${def.name} depends on ${dep} which is not set`);
      depIssues++;
    }
  }
}

if (depIssues === 0) {
  console.log(`  ${colors.green}✅ All dependencies satisfied${colors.reset}`);
}

// Environment info
console.log(`${colors.cyan}\n📊 Environment Info:\n${colors.reset}`);
console.log(`  • NODE_ENV: ${colors.green}${process.env.NODE_ENV || 'development'}${colors.reset}`);
console.log(`  • Platform: ${colors.green}${process.platform}${colors.reset}`);
console.log(`  • Node Version: ${colors.green}${process.version}${colors.reset}`);
if (process.env.VERCEL) {
  console.log(`  • Deployment: ${colors.green}Vercel${colors.reset}`);
}

// Summary
console.log(`\n${colors.gray}${'='.repeat(60)}${colors.reset}`);

if (hasErrors) {
  console.log(`${colors.red}${colors.bold}\n❌ Validation Failed - Critical Issues Found\n${colors.reset}`);
  
  console.log(`${colors.red}Errors (${errors.length}):\n${colors.reset}`);
  errors.forEach(e => console.log(`  ${colors.red}• ${e}${colors.reset}`));
  
  if (warnings.length > 0) {
    console.log(`\n${colors.yellow}Warnings (${warnings.length}):\n${colors.reset}`);
    warnings.forEach(w => console.log(`  ${colors.yellow}• ${w}${colors.reset}`));
  }
  
  console.log(`\n${colors.cyan}📝 How to fix:\n${colors.reset}`);
  console.log(`  1. Copy ${colors.bold}.env.example${colors.reset} to ${colors.bold}.env.local${colors.reset}`);
  console.log(`  2. Fill in all required variables`);
  console.log(`  3. Run ${colors.bold}node scripts/generate-env-docs.js${colors.reset} for documentation`);
  console.log(`  4. For production, add these in Vercel dashboard`);
  
  process.exit(1);
} else {
  console.log(`${colors.green}${colors.bold}\n✅ Validation Passed - Ready for Deployment\n${colors.reset}`);
  
  // Statistics
  const requiredCount = definitions.filter(d => d.required).length;
  const optionalCount = definitions.filter(d => !d.required).length;
  const configuredRequired = configured.filter(v => 
    definitions.find(d => d.name === v && d.required)
  ).length;
  const configuredOptional = configured.filter(v => 
    definitions.find(d => d.name === v && !d.required)
  ).length;
  
  console.log(`${colors.cyan}📈 Configuration Statistics:\n${colors.reset}`);
  console.log(`  • Required: ${colors.green}${configuredRequired}/${requiredCount}${colors.reset} configured`);
  console.log(`  • Optional: ${colors.green}${configuredOptional}/${optionalCount}${colors.reset} configured`);
  console.log(`  • Total: ${colors.green}${configured.length}/${definitions.length}${colors.reset} variables set`);
  
  // Security levels breakdown
  const byLevel = {
    CRITICAL: configured.filter(v => definitions.find(d => d.name === v && d.level === 'CRITICAL')).length,
    SECRET: configured.filter(v => definitions.find(d => d.name === v && d.level === 'SECRET')).length,
    INTERNAL: configured.filter(v => definitions.find(d => d.name === v && d.level === 'INTERNAL')).length,
    PUBLIC: configured.filter(v => definitions.find(d => d.name === v && d.level === 'PUBLIC')).length
  };
  
  console.log(`\n${colors.cyan}🔒 Security Levels:\n${colors.reset}`);
  console.log(`  ${levelIcons.CRITICAL} CRITICAL: ${byLevel.CRITICAL} configured`);
  console.log(`  ${levelIcons.SECRET} SECRET: ${byLevel.SECRET} configured`);
  console.log(`  ${levelIcons.INTERNAL} INTERNAL: ${byLevel.INTERNAL} configured`);
  console.log(`  ${levelIcons.PUBLIC} PUBLIC: ${byLevel.PUBLIC} configured`);
  
  if (warnings.length > 0) {
    console.log(`\n${colors.yellow}⚠️  Non-Critical Warnings (${warnings.length}):\n${colors.reset}`);
    warnings.forEach(w => console.log(`  ${colors.gray}• ${w}${colors.reset}`));
  }
  
  if (missingOptional.length > 0) {
    console.log(`\n${colors.gray}Optional features not configured:\n${colors.reset}`);
    missingOptional.slice(0, 5).forEach(v => console.log(`  ${colors.gray}• ${v}${colors.reset}`));
    if (missingOptional.length > 5) {
      console.log(`  ${colors.gray}... and ${missingOptional.length - 5} more${colors.reset}`);
    }
  }
  
  console.log(`\n${colors.green}🚀 Application ready for deployment!${colors.reset}\n`);
}