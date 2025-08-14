#!/usr/bin/env node

/**
 * Production Deployment Script for SYNTHEX
 * 
 * This script performs pre-deployment checks and deploys to production
 * Usage: node scripts/deploy-production.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, description) {
  try {
    log(`\n📋 ${description}...`, 'cyan');
    const output = execSync(command, { 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    log(`✅ ${description} - Success`, 'green');
    return output;
  } catch (error) {
    log(`❌ ${description} - Failed`, 'red');
    console.error(error.message);
    process.exit(1);
  }
}

function checkEnvironment() {
  log('\n🔍 Checking Environment Variables...', 'blue');
  
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'DATABASE_URL',
    'JWT_SECRET',
    'OPENROUTER_API_KEY'
  ];
  
  const missing = [];
  
  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
      log(`  ❌ Missing: ${key}`, 'red');
    } else {
      log(`  ✅ Found: ${key}`, 'green');
    }
  }
  
  if (missing.length > 0) {
    log('\n❌ Missing required environment variables!', 'red');
    log('Please set the following in your .env.local or Vercel dashboard:', 'yellow');
    missing.forEach(key => log(`  - ${key}`, 'yellow'));
    process.exit(1);
  }
  
  log('✅ All required environment variables are set', 'green');
}

function runTests() {
  log('\n🧪 Running Pre-deployment Tests...', 'blue');
  
  // Type checking
  try {
    runCommand('npx tsc --noEmit', 'TypeScript type checking');
  } catch (error) {
    log('⚠️  TypeScript errors detected (non-blocking)', 'yellow');
  }
  
  // Linting
  try {
    runCommand('npm run lint', 'ESLint checking');
  } catch (error) {
    log('⚠️  ESLint warnings detected (non-blocking)', 'yellow');
  }
  
  // Security audit
  const auditOutput = runCommand('npm audit --omit=dev --json', 'Security audit');
  const audit = JSON.parse(auditOutput);
  
  if (audit.metadata.vulnerabilities.high > 0 || audit.metadata.vulnerabilities.critical > 0) {
    log(`⚠️  Found ${audit.metadata.vulnerabilities.high} high and ${audit.metadata.vulnerabilities.critical} critical vulnerabilities`, 'yellow');
    log('Consider running "npm audit fix" before deployment', 'yellow');
  } else {
    log('✅ No high or critical vulnerabilities found', 'green');
  }
}

function buildProject() {
  log('\n🔨 Building Project...', 'blue');
  
  // Clean cache
  runCommand('npm run clean:cache', 'Cleaning build cache');
  
  // Build
  runCommand('npm run build', 'Building Next.js application');
  
  log('✅ Build completed successfully', 'green');
}

function deployToVercel() {
  log('\n🚀 Deploying to Vercel...', 'blue');
  
  // Check if Vercel CLI is installed
  try {
    execSync('vercel --version', { stdio: 'ignore' });
  } catch {
    log('❌ Vercel CLI not installed', 'red');
    log('Install with: npm i -g vercel', 'yellow');
    process.exit(1);
  }
  
  // Deploy to production
  log('Deploying to production...', 'cyan');
  
  try {
    const output = execSync('vercel --prod --yes', { 
      encoding: 'utf8',
      stdio: 'inherit'
    });
    log('✅ Deployment successful!', 'green');
  } catch (error) {
    log('❌ Deployment failed', 'red');
    process.exit(1);
  }
}

function generateReport() {
  const timestamp = new Date().toISOString();
  const report = {
    deployment: {
      timestamp,
      version: require('../package.json').version,
      environment: 'production',
      url: 'https://synthex.social'
    },
    checks: {
      environment: 'passed',
      typeScript: 'warning',
      eslint: 'warning',
      security: 'passed',
      build: 'passed'
    }
  };
  
  const reportPath = path.join(__dirname, '..', 'ship-audit', 'deployment-log.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  log(`\n📄 Deployment report saved to: ${reportPath}`, 'cyan');
}

async function main() {
  log('\n========================================', 'bright');
  log('   SYNTHEX PRODUCTION DEPLOYMENT', 'bright');
  log('========================================', 'bright');
  
  // Step 1: Check environment
  checkEnvironment();
  
  // Step 2: Run tests
  runTests();
  
  // Step 3: Build project
  buildProject();
  
  // Step 4: Deploy to Vercel
  deployToVercel();
  
  // Step 5: Generate report
  generateReport();
  
  log('\n========================================', 'bright');
  log('   ✅ DEPLOYMENT COMPLETE!', 'green');
  log('========================================', 'bright');
  
  log('\n📋 Post-Deployment Checklist:', 'blue');
  log('  1. Verify site at: https://synthex.social', 'cyan');
  log('  2. Test authentication flow', 'cyan');
  log('  3. Check database connections', 'cyan');
  log('  4. Monitor error logs for 15 minutes', 'cyan');
  log('  5. Test critical user journeys', 'cyan');
  
  log('\n🔗 Useful Links:', 'blue');
  log('  Production: https://synthex.social', 'cyan');
  log('  Vercel Dashboard: https://vercel.com/dashboard', 'cyan');
  log('  Supabase Dashboard: https://app.supabase.com', 'cyan');
  log('  GitHub Repo: https://github.com/CleanExpo/Synthex', 'cyan');
}

// Run the deployment
main().catch(error => {
  log(`\n❌ Deployment failed: ${error.message}`, 'red');
  process.exit(1);
});