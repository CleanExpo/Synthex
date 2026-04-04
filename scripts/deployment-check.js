#!/usr/bin/env node

/**
 * Deployment Readiness Check
 * Run this before deploying to ensure everything is ready
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m'
};

console.log(`${colors.blue}${colors.bold}\n🚀 Deployment Readiness Check\n${colors.reset}`);
console.log('='.repeat(50) + '\n');

let issues = [];
let warnings = [];
let passed = [];

// Check 1: Test endpoints removed
const testEndpoints = [
  'app/api/test-db/route.ts',
  'app/api/test-database/route.ts',
  'app/api/test-email/route.ts',
  'app/api/auth/dev-login/route.ts',
  'app/test-email/page.tsx'
];

console.log('🔍 Checking for test endpoints...');
testEndpoints.forEach(file => {
  if (fs.existsSync(path.join(process.cwd(), file))) {
    issues.push(`Test endpoint still exists: ${file}`);
    console.log(`  ${colors.red}❌ ${file} - Still exists${colors.reset}`);
  } else {
    passed.push(`Test endpoint removed: ${file}`);
  }
});

if (issues.length === 0) {
  console.log(`  ${colors.green}✅ All test endpoints removed${colors.reset}`);
}

// Check 2: Environment variables
console.log('\n🔍 Checking environment variables...');
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'DATABASE_URL',
  'JWT_SECRET',
  'OPENROUTER_API_KEY'
];

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    warnings.push(`Missing environment variable: ${varName}`);
    console.log(`  ${colors.yellow}⚠️  ${varName} - Not configured${colors.reset}`);
  } else {
    passed.push(`Environment variable set: ${varName}`);
  }
});

// Check 3: Build configuration
console.log('\n🔍 Checking build configuration...');
const nextConfig = fs.readFileSync('next.config.mjs', 'utf8');

if (nextConfig.includes('ignoreBuildErrors: true')) {
  warnings.push('TypeScript errors are ignored in build');
  console.log(`  ${colors.yellow}⚠️  TypeScript errors ignored${colors.reset}`);
} else {
  passed.push('TypeScript checking enabled');
  console.log(`  ${colors.green}✅ TypeScript checking enabled${colors.reset}`);
}

if (nextConfig.includes('ignoreDuringBuilds: true')) {
  warnings.push('ESLint errors are ignored in build');
  console.log(`  ${colors.yellow}⚠️  ESLint errors ignored${colors.reset}`);
} else {
  passed.push('ESLint checking enabled');
  console.log(`  ${colors.green}✅ ESLint checking enabled${colors.reset}`);
}

// Check 4: CORS configuration
console.log('\n🔍 Checking CORS configuration...');
if (nextConfig.includes("'Access-Control-Allow-Origin', value: '*'")) {
  issues.push('CORS allows all origins (security risk)');
  console.log(`  ${colors.red}❌ CORS allows all origins${colors.reset}`);
} else {
  passed.push('CORS properly restricted');
  console.log(`  ${colors.green}✅ CORS properly restricted${colors.reset}`);
}

// Check 5: Console removal
console.log('\n🔍 Checking console removal...');
if (nextConfig.includes('removeConsole')) {
  passed.push('Console statements removed in production');
  console.log(`  ${colors.green}✅ Console removal configured${colors.reset}`);
} else {
  warnings.push('Console statements not removed in production');
  console.log(`  ${colors.yellow}⚠️  Console removal not configured${colors.reset}`);
}

// Summary
console.log('\n' + '='.repeat(50));
console.log(`${colors.bold}\n📊 Deployment Readiness Summary\n${colors.reset}`);

const readinessScore = Math.round(
  (passed.length / (passed.length + issues.length + warnings.length)) * 100
);

if (issues.length > 0) {
  console.log(`${colors.red}🔴 Critical Issues (${issues.length}):${colors.reset}`);
  issues.forEach(issue => console.log(`  • ${issue}`));
}

if (warnings.length > 0) {
  console.log(`${colors.yellow}\n⚠️  Warnings (${warnings.length}):${colors.reset}`);
  warnings.forEach(warning => console.log(`  • ${warning}`));
}

console.log(`${colors.green}\n✅ Passed Checks (${passed.length}):${colors.reset}`);
console.log(`  • ${passed.length} checks passed successfully`);

console.log(`\n${colors.bold}Readiness Score: ${readinessScore}%${colors.reset}`);

if (issues.length > 0) {
  console.log(`\n${colors.red}${colors.bold}❌ NOT READY FOR DEPLOYMENT${colors.reset}`);
  console.log('Fix critical issues before deploying.');
  process.exit(1);
} else if (warnings.length > 5) {
  console.log(`\n${colors.yellow}${colors.bold}⚠️  DEPLOYMENT POSSIBLE WITH RISKS${colors.reset}`);
  console.log('Consider addressing warnings for production stability.');
  process.exit(0);
} else {
  console.log(`\n${colors.green}${colors.bold}✅ READY FOR DEPLOYMENT${colors.reset}`);
  console.log('All critical checks passed!');
  process.exit(0);
}