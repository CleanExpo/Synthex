const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Test configuration
const BASE_URL = 'http://localhost:3002';
const TEST_INTERVAL = 30000; // Test every 30 seconds
const ISSUES_LOG_FILE = 'testing-issues.json';

// Initialize issues storage
let issues = [];
let testRuns = 0;

// Load existing issues if file exists
if (fs.existsSync(ISSUES_LOG_FILE)) {
  const data = fs.readFileSync(ISSUES_LOG_FILE, 'utf8');
  issues = JSON.parse(data);
}

// Save issues to file
function saveIssues() {
  fs.writeFileSync(ISSUES_LOG_FILE, JSON.stringify(issues, null, 2));
}

// Add new issue if not already tracked
function addIssue(type, description, url = '', details = {}) {
  const issueKey = `${type}:${description}:${url}`;
  
  // Check if issue already exists
  const exists = issues.some(issue => 
    issue.type === type && 
    issue.description === description && 
    issue.url === url
  );
  
  if (!exists) {
    const issue = {
      id: issues.length + 1,
      type,
      description,
      url,
      details,
      firstDetected: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      occurrences: 1,
      status: 'open'
    };
    
    issues.push(issue);
    console.log(`🔴 NEW ISSUE FOUND: ${description}`);
    saveIssues();
  } else {
    // Update last seen and occurrence count
    const issue = issues.find(i => 
      i.type === type && 
      i.description === description && 
      i.url === url
    );
    issue.lastSeen = new Date().toISOString();
    issue.occurrences++;
    saveIssues();
  }
}

// Main test suite
async function runTests() {
  testRuns++;
  console.log(`\n🔄 Starting test run #${testRuns} at ${new Date().toLocaleTimeString()}`);
  
  const browser = await chromium.launch({ 
    headless: true,
    timeout: 30000 
  });
  
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        addIssue('console-error', msg.text(), page.url(), { 
          stack: msg.location() 
        });
      }
    });
    
    // Listen for page errors
    page.on('pageerror', error => {
      addIssue('page-error', error.message, page.url(), { 
        stack: error.stack 
      });
    });
    
    // Listen for failed requests
    page.on('requestfailed', request => {
      addIssue('network-error', `Failed request: ${request.url()}`, page.url(), {
        method: request.method(),
        failure: request.failure()
      });
    });
    
    // Test 1: Homepage loads
    console.log('  ✓ Testing homepage...');
    try {
      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 10000 });
      const title = await page.title();
      if (!title.includes('SYNTHEX')) {
        addIssue('page-load', 'Homepage title incorrect', BASE_URL, { title });
      }
    } catch (error) {
      addIssue('page-load', 'Homepage failed to load', BASE_URL, { 
        error: error.message 
      });
    }
    
    // Test 2: Check all navigation links
    console.log('  ✓ Testing navigation links...');
    const navLinks = [
      { url: '/login', expected: 'Login' },
      { url: '/login.html', expected: 'Login' },
      { url: '/dashboard.html', expected: 'Dashboard' },
      { url: '/pricing.html', expected: 'Pricing' },
      { url: '/docs', expected: 'Documentation' },
      { url: '/privacy', expected: 'Privacy' },
      { url: '/terms', expected: 'Terms' },
      { url: '/support', expected: 'Support' },
      { url: '/signup.html', expected: 'Sign Up' }
    ];
    
    for (const link of navLinks) {
      try {
        const response = await page.goto(`${BASE_URL}${link.url}`, { 
          waitUntil: 'domcontentloaded',
          timeout: 5000 
        });
        
        if (!response || response.status() === 404) {
          addIssue('missing-page', `Page not found: ${link.url}`, link.url);
        }
      } catch (error) {
        addIssue('navigation', `Cannot access ${link.url}`, link.url, { 
          error: error.message 
        });
      }
    }
    
    // Test 3: API endpoints
    console.log('  ✓ Testing API endpoints...');
    const apiEndpoints = [
      '/api/health',
      '/api/auth/login',
      '/api/auth/register',
      '/api/dashboard/stats',
      '/api/campaigns',
      '/api/content/generate'
    ];
    
    for (const endpoint of apiEndpoints) {
      try {
        const response = await page.goto(`${BASE_URL}${endpoint}`, { 
          timeout: 5000 
        });
        
        if (!response || response.status() === 404) {
          addIssue('missing-api', `API endpoint not found: ${endpoint}`, endpoint);
        }
      } catch (error) {
        // This is expected for POST endpoints
        if (!endpoint.includes('health')) {
          // Check with actual request
          try {
            const response = await page.evaluate(async (url) => {
              const res = await fetch(url, { 
                method: endpoint.includes('login') || endpoint.includes('register') ? 'POST' : 'GET',
                headers: { 'Content-Type': 'application/json' },
                body: endpoint.includes('login') || endpoint.includes('register') ? 
                  JSON.stringify({ email: 'test@test.com', password: 'test' }) : undefined
              });
              return { status: res.status, ok: res.ok };
            }, `${BASE_URL}${endpoint}`);
            
            if (response.status === 404) {
              addIssue('missing-api', `API endpoint not found: ${endpoint}`, endpoint);
            }
          } catch (e) {
            // Ignore fetch errors for now
          }
        }
      }
    }
    
    // Test 4: Login form functionality
    console.log('  ✓ Testing login form...');
    try {
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
      
      // Check for form elements
      const emailInput = await page.$('input[type="email"], input[name="email"], input#email');
      const passwordInput = await page.$('input[type="password"], input[name="password"], input#password');
      const submitButton = await page.$('button[type="submit"], button:has-text("Sign In")');
      
      if (!emailInput) {
        addIssue('form-element', 'Email input not found on login page', '/login');
      }
      if (!passwordInput) {
        addIssue('form-element', 'Password input not found on login page', '/login');
      }
      if (!submitButton) {
        addIssue('form-element', 'Submit button not found on login page', '/login');
      }
      
      // Test form submission
      if (emailInput && passwordInput && submitButton) {
        await emailInput.fill('test@example.com');
        await passwordInput.fill('testpassword');
        await submitButton.click();
        
        // Wait for response
        await page.waitForTimeout(2000);
        
        // Check if we're still on login page (indicates error)
        if (page.url().includes('/login')) {
          const errorElement = await page.$('.error, .alert, [role="alert"]');
          if (!errorElement) {
            console.log('    ℹ️  Login form submitted but no redirect occurred');
          }
        }
      }
    } catch (error) {
      addIssue('form-test', 'Login form test failed', '/login', { 
        error: error.message 
      });
    }
    
    // Test 5: Mobile responsiveness
    console.log('  ✓ Testing mobile responsiveness...');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    
    // Check if mobile menu exists
    const mobileMenu = await page.$('[aria-label="Mobile menu"], .mobile-menu, .hamburger');
    if (!mobileMenu) {
      console.log('    ℹ️  No mobile menu found (may not be implemented)');
    }
    
    // Test 6: Performance metrics
    console.log('  ✓ Checking performance...');
    const metrics = await page.evaluate(() => {
      const perf = performance.getEntriesByType('navigation')[0];
      return {
        loadTime: perf.loadEventEnd - perf.fetchStart,
        domReady: perf.domContentLoadedEventEnd - perf.fetchStart,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0
      };
    });
    
    if (metrics.loadTime > 3000) {
      addIssue('performance', `Slow page load: ${metrics.loadTime}ms`, BASE_URL, metrics);
    }
    
    // Test 7: Check for accessibility issues
    console.log('  ✓ Checking accessibility...');
    const accessibilityIssues = await page.evaluate(() => {
      const issues = [];
      
      // Check for images without alt text
      const imagesWithoutAlt = document.querySelectorAll('img:not([alt])');
      if (imagesWithoutAlt.length > 0) {
        issues.push(`${imagesWithoutAlt.length} images without alt text`);
      }
      
      // Check for form inputs without labels
      const inputsWithoutLabels = document.querySelectorAll('input:not([aria-label]):not([aria-labelledby])');
      let unlabeledInputs = 0;
      inputsWithoutLabels.forEach(input => {
        const label = document.querySelector(`label[for="${input.id}"]`);
        if (!label && !input.closest('label')) {
          unlabeledInputs++;
        }
      });
      if (unlabeledInputs > 0) {
        issues.push(`${unlabeledInputs} form inputs without labels`);
      }
      
      return issues;
    });
    
    accessibilityIssues.forEach(issue => {
      addIssue('accessibility', issue, page.url());
    });
    
    console.log(`  ✅ Test run #${testRuns} completed`);
    
  } catch (error) {
    console.error('Test suite error:', error);
    addIssue('test-suite', 'Test suite crashed', '', { error: error.message });
  } finally {
    await browser.close();
  }
  
  // Show summary
  const openIssues = issues.filter(i => i.status === 'open');
  if (openIssues.length > 0) {
    console.log(`\n📊 ISSUES SUMMARY: ${openIssues.length} open issues found`);
    console.log('Recent issues:');
    openIssues.slice(-5).forEach(issue => {
      console.log(`  - [${issue.type}] ${issue.description}`);
    });
  } else {
    console.log('\n✨ No issues detected!');
  }
}

// Start continuous testing
async function startContinuousTesting() {
  console.log('🚀 Starting SYNTHEX Continuous Testing');
  console.log(`📍 Target URL: ${BASE_URL}`);
  console.log(`⏱️  Test interval: ${TEST_INTERVAL / 1000} seconds`);
  console.log('Press Ctrl+C to stop\n');
  
  // Run initial test
  await runTests();
  
  // Schedule continuous tests
  setInterval(async () => {
    await runTests();
  }, TEST_INTERVAL);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Stopping continuous testing...');
  console.log(`📊 Total test runs: ${testRuns}`);
  console.log(`📝 Total issues found: ${issues.length}`);
  console.log(`💾 Issues saved to: ${ISSUES_LOG_FILE}`);
  process.exit(0);
});

// Check if server is running before starting tests
const http = require('http');
http.get(BASE_URL, (res) => {
  if (res.statusCode === 200 || res.statusCode === 302) {
    startContinuousTesting();
  } else {
    console.error(`❌ Server not responding at ${BASE_URL}`);
    console.log('Please start the server with: node test-server.js');
    process.exit(1);
  }
}).on('error', (err) => {
  console.error(`❌ Cannot connect to ${BASE_URL}`);
  console.log('Please start the server with: node test-server.js');
  console.error(err.message);
  process.exit(1);
});