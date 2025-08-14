#!/usr/bin/env node

/**
 * Production Verification Script
 * Checks all critical systems before and after deployment
 */

const https = require('https');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

// Production configuration
const config = {
  domain: 'https://synthex.social',
  endpoints: [
    '/api/health',
    '/demo/integrations',
    '/demo/settings',
    '/dashboard',
    '/auth/login'
  ],
  requiredEnvVars: [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'ENCRYPTION_KEY',
    'JWT_SECRET',
    'NEXTAUTH_SECRET',
    'NEXT_PUBLIC_APP_URL'
  ]
};

// Helper functions
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(50));
  log(title, 'blue');
  console.log('='.repeat(50));
}

// Check if URL is accessible
function checkEndpoint(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          url,
          status: res.statusCode,
          success: res.statusCode === 200 || res.statusCode === 302,
          contentLength: data.length
        });
      });
    }).on('error', (err) => {
      resolve({
        url,
        status: 'ERROR',
        success: false,
        error: err.message
      });
    });
  });
}

// Check environment variables
async function checkEnvironment() {
  logSection('🔍 Environment Variables Check');
  
  const missing = [];
  const configured = [];
  
  for (const envVar of config.requiredEnvVars) {
    if (process.env[envVar]) {
      configured.push(envVar);
      log(`  ✅ ${envVar} is configured`, 'green');
    } else {
      missing.push(envVar);
      log(`  ❌ ${envVar} is missing`, 'red');
    }
  }
  
  if (missing.length > 0) {
    log(`\n  ⚠️  Missing ${missing.length} required environment variables`, 'yellow');
    log('  Add them to Vercel dashboard or .env.production.local', 'yellow');
  } else {
    log('\n  ✅ All environment variables configured!', 'green');
  }
  
  return { configured, missing };
}

// Check API endpoints
async function checkEndpoints() {
  logSection('🌐 Endpoint Availability Check');
  
  const results = [];
  
  for (const endpoint of config.endpoints) {
    const url = config.domain + endpoint;
    process.stdout.write(`  Checking ${endpoint}...`);
    
    const result = await checkEndpoint(url);
    results.push(result);
    
    if (result.success) {
      console.log(` ${colors.green}✅ ${result.status}${colors.reset}`);
    } else {
      console.log(` ${colors.red}❌ ${result.status || result.error}${colors.reset}`);
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  
  console.log();
  if (successCount === totalCount) {
    log(`  ✅ All ${totalCount} endpoints are accessible!`, 'green');
  } else {
    log(`  ⚠️  ${successCount}/${totalCount} endpoints accessible`, 'yellow');
  }
  
  return results;
}

// Check Git status
async function checkGitStatus() {
  logSection('📦 Git Repository Status');
  
  try {
    const { stdout: status } = await execPromise('git status --short');
    const { stdout: branch } = await execPromise('git branch --show-current');
    const { stdout: lastCommit } = await execPromise('git log -1 --oneline');
    
    log(`  Branch: ${branch.trim()}`, 'magenta');
    log(`  Last Commit: ${lastCommit.trim()}`, 'magenta');
    
    if (status.trim()) {
      log('  ⚠️  Uncommitted changes detected:', 'yellow');
      console.log(status);
    } else {
      log('  ✅ No uncommitted changes', 'green');
    }
  } catch (error) {
    log('  ❌ Unable to check git status', 'red');
  }
}

// Check Vercel deployment
async function checkVercelDeployment() {
  logSection('🚀 Vercel Deployment Status');
  
  try {
    // Check if vercel CLI is installed
    await execPromise('vercel --version');
    
    // Get latest deployment info
    const { stdout } = await execPromise('vercel ls synthex --json 2>/dev/null || echo "{}"');
    
    try {
      const deployments = JSON.parse(stdout);
      if (deployments.length > 0) {
        const latest = deployments[0];
        log(`  Latest Deployment:`, 'magenta');
        log(`    URL: ${latest.url}`, 'blue');
        log(`    State: ${latest.state}`, latest.state === 'READY' ? 'green' : 'yellow');
        log(`    Created: ${new Date(latest.created).toLocaleString()}`, 'blue');
      }
    } catch (e) {
      log('  ℹ️  Run "vercel ls synthex" manually for deployment details', 'yellow');
    }
  } catch (error) {
    log('  ℹ️  Vercel CLI not installed or not logged in', 'yellow');
    log('  Install: npm i -g vercel', 'yellow');
    log('  Login: vercel login', 'yellow');
  }
}

// Check build
async function checkBuild() {
  logSection('🔨 Build Status Check');
  
  try {
    log('  Running build test (this may take a minute)...', 'yellow');
    const { stdout, stderr } = await execPromise('npm run build', { 
      timeout: 120000 // 2 minute timeout
    });
    
    if (stderr && stderr.includes('error')) {
      log('  ❌ Build has errors:', 'red');
      console.log(stderr);
    } else {
      log('  ✅ Build completed successfully!', 'green');
    }
  } catch (error) {
    log('  ❌ Build failed:', 'red');
    console.log(error.message);
  }
}

// Main verification flow
async function runVerification() {
  console.clear();
  log(`
╔═══════════════════════════════════════════════╗
║     SYNTHEX PRODUCTION VERIFICATION TOOL      ║
╚═══════════════════════════════════════════════╝`, 'magenta');
  
  log(`\n📅 Date: ${new Date().toLocaleString()}`, 'blue');
  log(`🌐 Target: ${config.domain}`, 'blue');
  
  // Run all checks
  const envCheck = await checkEnvironment();
  await checkGitStatus();
  const endpointCheck = await checkEndpoints();
  await checkVercelDeployment();
  
  // Optional: Run build check (uncomment if needed)
  // await checkBuild();
  
  // Summary
  logSection('📊 Verification Summary');
  
  const readyForProduction = 
    envCheck.missing.length === 0 && 
    endpointCheck.filter(e => e.success).length === endpointCheck.length;
  
  if (readyForProduction) {
    log('  🎉 System is READY for production!', 'green');
  } else {
    log('  ⚠️  System needs configuration before production', 'yellow');
    
    if (envCheck.missing.length > 0) {
      log(`\n  Required Actions:`, 'yellow');
      log(`  1. Configure missing environment variables in Vercel`, 'yellow');
    }
    
    const failedEndpoints = endpointCheck.filter(e => !e.success);
    if (failedEndpoints.length > 0) {
      log(`  2. Fix failing endpoints:`, 'yellow');
      failedEndpoints.forEach(e => {
        log(`     - ${e.url}`, 'red');
      });
    }
  }
  
  logSection('📚 Next Steps');
  log('  1. Set up Supabase database', 'blue');
  log('  2. Configure environment variables in Vercel', 'blue');
  log('  3. Run: vercel --prod --yes', 'blue');
  log('  4. Verify production domain', 'blue');
  log('  5. Test user registration and login', 'blue');
  
  console.log('\n' + '='.repeat(50) + '\n');
}

// Run the verification
runVerification().catch(console.error);