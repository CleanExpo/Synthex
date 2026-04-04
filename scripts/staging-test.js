#!/usr/bin/env node

/**
 * Staging Deployment Test Script
 * Run this after deploying to staging to verify everything works
 */

const https = require('https');
const http = require('http');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m'
};

// Get staging URL from command line or environment
const STAGING_URL = process.argv[2] || process.env.STAGING_URL || 'http://localhost:3000';
const isLocal = STAGING_URL.includes('localhost');
const protocol = STAGING_URL.startsWith('https') ? https : http;

console.log(`${colors.blue}${colors.bold}\n🧪 Testing Staging Deployment\n${colors.reset}`);
console.log(`URL: ${STAGING_URL}\n`);
console.log('='.repeat(50) + '\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = [];

/**
 * Test a URL endpoint
 */
async function testEndpoint(path, expectedStatus = 200, description = '') {
  totalTests++;
  const url = `${STAGING_URL}${path}`;
  
  return new Promise((resolve) => {
    const request = protocol.get(url, (res) => {
      if (res.statusCode === expectedStatus) {
        console.log(`${colors.green}✅ ${path} - ${res.statusCode} OK${colors.reset}`);
        if (description) console.log(`   ${colors.green}${description}${colors.reset}`);
        passedTests++;
        resolve(true);
      } else {
        console.log(`${colors.red}❌ ${path} - Expected ${expectedStatus}, got ${res.statusCode}${colors.reset}`);
        failedTests.push(`${path} (${res.statusCode})`);
        resolve(false);
      }
    });
    
    request.on('error', (err) => {
      console.log(`${colors.red}❌ ${path} - Error: ${err.message}${colors.reset}`);
      failedTests.push(`${path} (Error)`);
      resolve(false);
    });
    
    request.setTimeout(5000, () => {
      console.log(`${colors.red}❌ ${path} - Timeout${colors.reset}`);
      failedTests.push(`${path} (Timeout)`);
      request.destroy();
      resolve(false);
    });
  });
}

/**
 * Test API response content
 */
async function testAPI(path, expectedKeys = []) {
  totalTests++;
  const url = `${STAGING_URL}${path}`;
  
  return new Promise((resolve) => {
    const request = protocol.get(url, (res) => {
      let data = '';
      
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const hasKeys = expectedKeys.every(key => key in json);
          
          if (res.statusCode === 200 && hasKeys) {
            console.log(`${colors.green}✅ ${path} - API responds correctly${colors.reset}`);
            passedTests++;
            resolve(true);
          } else {
            console.log(`${colors.red}❌ ${path} - Invalid API response${colors.reset}`);
            failedTests.push(`${path} (Invalid response)`);
            resolve(false);
          }
        } catch (e) {
          console.log(`${colors.red}❌ ${path} - Not valid JSON${colors.reset}`);
          failedTests.push(`${path} (Invalid JSON)`);
          resolve(false);
        }
      });
    });
    
    request.on('error', (err) => {
      console.log(`${colors.red}❌ ${path} - Error: ${err.message}${colors.reset}`);
      failedTests.push(`${path} (Error)`);
      resolve(false);
    });
  });
}

/**
 * Run all tests
 */
async function runTests() {
  console.log(`${colors.cyan}📋 Testing Page Routes${colors.reset}\n`);
  
  // Test main pages
  await testEndpoint('/', 200, 'Homepage loads');
  await testEndpoint('/login', 200, 'Login page accessible');
  await testEndpoint('/signup', 200, 'Signup page accessible');
  await testEndpoint('/pricing', 200, 'Pricing page loads');
  await testEndpoint('/about', 200, 'About page loads');
  await testEndpoint('/docs', 200, 'Documentation accessible');
  
  console.log(`\n${colors.cyan}📋 Testing API Endpoints${colors.reset}\n`);
  
  // Test API health
  await testAPI('/api/health', ['status']);
  
  // Test removed endpoints should 404
  await testEndpoint('/api/test-db', 404, 'Test endpoint removed');
  await testEndpoint('/api/test-email', 404, 'Test endpoint removed');
  await testEndpoint('/api/auth/dev-login', 404, 'Dev login removed');
  
  // Test auth endpoints exist
  await testEndpoint('/api/auth/unified', 405, 'Unified auth (GET not allowed)');
  
  console.log(`\n${colors.cyan}📋 Testing Security Headers${colors.reset}\n`);
  
  // Check security headers
  const securityTest = await new Promise((resolve) => {
    const request = protocol.get(`${STAGING_URL}/api/health`, (res) => {
      const headers = res.headers;
      let securityPassed = true;
      
      // Check for security headers
      if (headers['x-frame-options']) {
        console.log(`${colors.green}✅ X-Frame-Options present${colors.reset}`);
      } else {
        console.log(`${colors.yellow}⚠️  X-Frame-Options missing${colors.reset}`);
        securityPassed = false;
      }
      
      if (headers['x-content-type-options']) {
        console.log(`${colors.green}✅ X-Content-Type-Options present${colors.reset}`);
      } else {
        console.log(`${colors.yellow}⚠️  X-Content-Type-Options missing${colors.reset}`);
        securityPassed = false;
      }
      
      if (headers['access-control-allow-origin'] !== '*') {
        console.log(`${colors.green}✅ CORS properly restricted${colors.reset}`);
      } else {
        console.log(`${colors.red}❌ CORS allows all origins${colors.reset}`);
        securityPassed = false;
      }
      
      resolve(securityPassed);
    });
    
    request.on('error', () => resolve(false));
  });
  
  if (securityTest) passedTests++;
  else failedTests.push('Security headers');
  totalTests++;
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`${colors.bold}\n📊 Test Results Summary\n${colors.reset}`);
  
  const successRate = Math.round((passedTests / totalTests) * 100);
  
  console.log(`Total Tests: ${totalTests}`);
  console.log(`${colors.green}Passed: ${passedTests}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failedTests.length}${colors.reset}`);
  console.log(`Success Rate: ${successRate}%`);
  
  if (failedTests.length > 0) {
    console.log(`\n${colors.red}Failed Tests:${colors.reset}`);
    failedTests.forEach(test => console.log(`  • ${test}`));
  }
  
  if (successRate >= 90) {
    console.log(`\n${colors.green}${colors.bold}✅ STAGING DEPLOYMENT HEALTHY${colors.reset}`);
    console.log('Ready for production deployment!');
    process.exit(0);
  } else if (successRate >= 70) {
    console.log(`\n${colors.yellow}${colors.bold}⚠️  STAGING NEEDS ATTENTION${colors.reset}`);
    console.log('Fix issues before production deployment.');
    process.exit(1);
  } else {
    console.log(`\n${colors.red}${colors.bold}❌ STAGING DEPLOYMENT FAILED${colors.reset}`);
    console.log('Critical issues detected. Do not deploy to production.');
    process.exit(1);
  }
}

// Run tests
runTests().catch(err => {
  console.error(`${colors.red}Test runner error: ${err.message}${colors.reset}`);
  process.exit(1);
});