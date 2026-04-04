#!/usr/bin/env node

/**
 * Production Validation Script
 * Verifies deployment is successful and all systems operational
 */

const https = require('https');
const { execSync } = require('child_process');

const PRODUCTION_URL = 'https://synthex.social';
const TESTS = [];
let PASSED = 0;
let FAILED = 0;

// Color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testEndpoint(name, path, expectedStatus = 200) {
  return new Promise((resolve) => {
    const url = `${PRODUCTION_URL}${path}`;
    
    https.get(url, (res) => {
      if (res.statusCode === expectedStatus) {
        log(`  ✅ ${name}: ${res.statusCode}`, 'green');
        PASSED++;
        resolve(true);
      } else {
        log(`  ❌ ${name}: Expected ${expectedStatus}, got ${res.statusCode}`, 'red');
        FAILED++;
        resolve(false);
      }
    }).on('error', (err) => {
      log(`  ❌ ${name}: ${err.message}`, 'red');
      FAILED++;
      resolve(false);
    });
  });
}

async function checkHeaders(name, path, requiredHeaders) {
  return new Promise((resolve) => {
    const url = `${PRODUCTION_URL}${path}`;
    
    https.get(url, (res) => {
      let allPresent = true;
      
      for (const header of requiredHeaders) {
        if (res.headers[header.toLowerCase()]) {
          log(`    ✓ ${header}: ${res.headers[header.toLowerCase()]}`, 'green');
        } else {
          log(`    ✗ ${header}: Missing`, 'red');
          allPresent = false;
        }
      }
      
      if (allPresent) {
        log(`  ✅ ${name}: All headers present`, 'green');
        PASSED++;
      } else {
        log(`  ❌ ${name}: Some headers missing`, 'red');
        FAILED++;
      }
      
      resolve(allPresent);
    }).on('error', (err) => {
      log(`  ❌ ${name}: ${err.message}`, 'red');
      FAILED++;
      resolve(false);
    });
  });
}

async function checkResponseTime(name, path, maxTime = 2000) {
  return new Promise((resolve) => {
    const url = `${PRODUCTION_URL}${path}`;
    const start = Date.now();
    
    https.get(url, (res) => {
      const duration = Date.now() - start;
      
      if (duration < maxTime) {
        log(`  ✅ ${name}: ${duration}ms (< ${maxTime}ms)`, 'green');
        PASSED++;
        resolve(true);
      } else {
        log(`  ❌ ${name}: ${duration}ms (> ${maxTime}ms)`, 'red');
        FAILED++;
        resolve(false);
      }
    }).on('error', (err) => {
      log(`  ❌ ${name}: ${err.message}`, 'red');
      FAILED++;
      resolve(false);
    });
  });
}

async function runTests() {
  log('\n🔍 SYNTHEX Production Validation\n', 'cyan');
  log(`Target: ${PRODUCTION_URL}`, 'cyan');
  log(`Time: ${new Date().toISOString()}\n`, 'cyan');
  
  // 1. Core endpoints
  log('📌 Testing Core Endpoints:', 'yellow');
  await testEndpoint('Homepage', '/');
  await testEndpoint('API Health', '/api/health');
  await testEndpoint('Login Page', '/login');
  await testEndpoint('Signup Page', '/signup');
  await testEndpoint('Dashboard (redirect)', '/dashboard', 307);
  
  // 2. Security headers
  log('\n🔐 Testing Security Headers:', 'yellow');
  await checkHeaders('Security Headers', '/', [
    'strict-transport-security',
    'x-frame-options',
    'x-content-type-options'
  ]);
  
  // 3. Performance
  log('\n⚡ Testing Performance:', 'yellow');
  await checkResponseTime('Homepage Load', '/', 3000);
  await checkResponseTime('API Response', '/api/health', 1000);
  
  // 4. API endpoints
  log('\n🔌 Testing API Endpoints:', 'yellow');
  await testEndpoint('Auth API', '/api/auth/unified', 405); // Expects POST
  await testEndpoint('Campaigns API', '/api/campaigns', 401); // Requires auth
  await testEndpoint('Analytics API', '/api/analytics', 401); // Requires auth
  
  // 5. Static assets
  log('\n📦 Testing Static Assets:', 'yellow');
  await testEndpoint('Robots.txt', '/robots.txt');
  await testEndpoint('Sitemap', '/sitemap.xml');
  
  // Summary
  log('\n' + '='.repeat(50), 'cyan');
  log('📊 VALIDATION SUMMARY', 'cyan');
  log('='.repeat(50), 'cyan');
  
  const total = PASSED + FAILED;
  const percentage = Math.round((PASSED / total) * 100);
  
  log(`  Passed: ${PASSED}/${total} (${percentage}%)`, PASSED > 0 ? 'green' : 'red');
  log(`  Failed: ${FAILED}/${total}`, FAILED > 0 ? 'red' : 'green');
  
  if (percentage >= 80) {
    log('\n✅ PRODUCTION VALIDATION PASSED', 'green');
    log(`🚀 Ship Readiness: ${percentage}%`, 'green');
  } else if (percentage >= 60) {
    log('\n⚠️  PRODUCTION VALIDATION PARTIAL', 'yellow');
    log(`Ship Readiness: ${percentage}% (Needs attention)`, 'yellow');
  } else {
    log('\n❌ PRODUCTION VALIDATION FAILED', 'red');
    log(`Ship Readiness: ${percentage}% (Critical issues)`, 'red');
  }
  
  // Feature flags check
  log('\n🎯 Feature Flags Status:', 'yellow');
  log('  Run: vercel env ls production | grep FF_', 'cyan');
  
  // Deployment info
  log('\n📦 Latest Deployment:', 'yellow');
  try {
    const deployments = execSync('vercel ls synthex --scope unite-group 2>/dev/null | head -3', { encoding: 'utf8' });
    console.log(deployments);
  } catch (e) {
    log('  Unable to fetch deployment info', 'yellow');
  }
  
  process.exit(FAILED > 0 ? 1 : 0);
}

// Run validation
runTests().catch(error => {
  log(`\n❌ Validation error: ${error.message}`, 'red');
  process.exit(1);
});