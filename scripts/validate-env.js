#!/usr/bin/env node

/**
 * Environment Variable Validation Script
 * Run before build and deployment to ensure all required variables are set
 */

// Simple color codes without chalk dependency
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bold: '\x1b[1m'
};

const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'DATABASE_URL',
  'JWT_SECRET',
  'OPENROUTER_API_KEY'
];

const optional = [
  'NEXT_PUBLIC_APP_URL',
  'SENTRY_DSN',
  'NEXT_PUBLIC_SENTRY_DSN',
  'EMAIL_PROVIDER',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET'
];

console.log(`${colors.blue}${colors.bold}\n🔍 Validating Environment Variables\n${colors.reset}`);
console.log(colors.gray + '='.repeat(50) + colors.reset);

// Check for demo mode
const isDemoMode = process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'production';
if (isDemoMode) {
  console.log(`${colors.green}✅ Demo/Production mode detected - skipping strict validation${colors.reset}\n`);
}

let hasErrors = false;
const missing = [];
const warnings = [];

// Check required variables
console.log(`${colors.cyan}\n📋 Required Variables:\n${colors.reset}`);
for (const key of required) {
  if (!process.env[key]) {
    console.error(`${colors.red}  ❌ ${key} - MISSING (Required)${colors.reset}`);
    missing.push(key);
    hasErrors = true;
  } else {
    const value = process.env[key];
    const masked = value.substring(0, 5) + '***' + value.substring(value.length - 3);
    console.log(`${colors.green}  ✅ ${key} - Set (${masked})${colors.reset}`);
  }
}

// Check optional variables
console.log(`${colors.cyan}\n📋 Optional Variables:\n${colors.reset}`);
for (const key of optional) {
  if (process.env[key]) {
    const value = process.env[key];
    const masked = value.length > 8 
      ? value.substring(0, 3) + '***' + value.substring(value.length - 2)
      : '***';
    console.log(`${colors.green}  ✅ ${key} - Set (${masked})${colors.reset}`);
  } else {
    console.log(`${colors.yellow}  ⚠️  ${key} - Not set (Optional)${colors.reset}`);
    warnings.push(key);
  }
}

// Special checks
console.log(`${colors.cyan}\n🔐 Security Checks:\n${colors.reset}`);

// Check DATABASE_URL format
if (process.env.DATABASE_URL) {
  if (!process.env.DATABASE_URL.startsWith('postgresql://')) {
    console.error(`${colors.red}  ❌ DATABASE_URL should start with postgresql://${colors.reset}`);
    hasErrors = true;
  } else {
    console.log(`${colors.green}  ✅ DATABASE_URL format looks correct${colors.reset}`);
  }
}

// Check JWT_SECRET strength
if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  console.warn(`${colors.yellow}  ⚠️  JWT_SECRET should be at least 32 characters${colors.reset}`);
}

// Check for Vercel deployment
if (process.env.VERCEL) {
  console.log(`${colors.green}  ✅ Running in Vercel environment${colors.reset}`);
}

// Check NODE_ENV
if (process.env.NODE_ENV) {
  console.log(`${colors.green}  ✅ NODE_ENV: ${process.env.NODE_ENV}${colors.reset}`);
} else {
  console.log(`${colors.yellow}  ⚠️  NODE_ENV not set (defaulting to development)${colors.reset}`);
}

console.log(colors.gray + '\n' + '='.repeat(50) + colors.reset);

// Summary
if (hasErrors && !isDemoMode) {
  console.error(`${colors.red}${colors.bold}\n❌ Environment Validation Failed!\n${colors.reset}`);
  console.error(`${colors.red}Missing required variables:${colors.reset}`);
  missing.forEach(v => console.error(`${colors.red}  • ${v}${colors.reset}`));
  
  console.log(`${colors.yellow}\n💡 How to fix:${colors.reset}`);
  console.log(`${colors.gray}1. Copy .env.example to .env.local${colors.reset}`);
  console.log(`${colors.gray}2. Fill in the required values${colors.reset}`);
  console.log(`${colors.gray}3. For Vercel deployment, add these in the dashboard${colors.reset}`);
  
  process.exit(1);
} else if (isDemoMode && hasErrors) {
  console.log(`${colors.yellow}${colors.bold}\n⚠️ Environment variables missing but continuing in demo/production mode\n${colors.reset}`);
  console.log(`${colors.yellow}Some features may be limited without proper configuration${colors.reset}`);
} else {
  console.log(`${colors.green}${colors.bold}\n✅ Environment Validation Passed!\n${colors.reset}`);
  
  if (warnings.length > 0) {
    console.log(`${colors.yellow}Optional variables not configured:${colors.reset}`);
    console.log(`${colors.gray}These features may be limited:${colors.reset}`);
    warnings.forEach(v => console.log(`${colors.gray}  • ${v}${colors.reset}`));
  }
  
  console.log(`${colors.green}\n🚀 Ready for build/deployment!\n${colors.reset}`);
}