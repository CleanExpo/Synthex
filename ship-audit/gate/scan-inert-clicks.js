#!/usr/bin/env node
/**
 * No-BS Ship Gate v2 - Dynamic Playwright Scanner
 * Anti-false-positive logic with strict effect verification
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

class InertClickScanner {
  constructor() {
    this.BASE_URL = this.detectBaseUrl();
    this.findings = {
      inertControls: [],
      unresolvedEndpoints: [],
      placeholderAnchors: [],
      oauthIssues: [],
      notificationIssues: [],
      envMissing: []
    };
    this.stats = {
      totalControls: 0,
      verifiedControls: 0,
      inertControls: 0,
      totalEndpoints: 0,
      resolvedEndpoints: 0,
      oauthProviders: []
    };
  }

  detectBaseUrl() {
    // Try to detect from env files
    if (fs.existsSync('.env.local')) {
      const env = fs.readFileSync('.env.local', 'utf-8');
      const match = env.match(/NEXT_PUBLIC_APP_URL=(.+)/);
      if (match) return match[1];
    }
    
    // Default
    return 'http://localhost:3000';
  }

  async scan() {
    console.log('🚀 Starting dynamic discovery with Playwright...');
    console.log(`📍 Base URL: ${this.BASE_URL}`);
    
    const browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox']
    });
    
    try {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        ignoreHTTPSErrors: true
      });
      
      const page = await context.newPage();
      
      // Load inventory
      const inventory = JSON.parse(
        fs.readFileSync(path.join(__dirname, 'inventory.json'), 'utf-8')
      );
      
      // Test main pages
      const pagesToTest = [
        '/',
        '/login',
        '/signup',
        '/dashboard',
        '/pricing'
      ];
      
      for (const pagePath of pagesToTest) {
        console.log(`\n📄 Testing page: ${pagePath}`);
        await this.testPage(page, pagePath);
      }
      
      // Test API endpoints
      console.log('\n🔌 Testing API endpoints...');
      await this.testAPIEndpoints(page, inventory.apiCalls);
      
      // Check OAuth providers
      console.log('\n🔐 Checking OAuth providers...');
      await this.checkOAuthProviders(page);
      
      // Check notifications
      console.log('\n🔔 Checking notifications...');
      await this.checkNotifications(page);
      
      // Check env completeness
      console.log('\n🔐 Checking environment variables...');
      this.checkEnvCompleteness(inventory.envUsage);
      
    } finally {
      await browser.close();
    }
    
    this.generateReport();
  }

  async testPage(page, pagePath) {
    try {
      const url = `${this.BASE_URL}${pagePath}`;
      const response = await page.goto(url, { 
        waitUntil: 'networkidle',
        timeout: 10000 
      });
      
      if (!response || response.status() >= 400) {
        this.findings.unresolvedEndpoints.push({
          path: pagePath,
          status: response?.status() || 'TIMEOUT',
          type: 'page'
        });
        return;
      }
      
      // Find all clickable elements
      const controls = await page.evaluate(() => {
        const elements = [];
        
        // Buttons
        document.querySelectorAll('button, [role="button"]').forEach(el => {
          elements.push({
            type: 'button',
            selector: el.id ? `#${el.id}` : null,
            text: el.textContent?.trim(),
            disabled: el.disabled || el.getAttribute('aria-disabled') === 'true',
            rect: el.getBoundingClientRect()
          });
        });
        
        // Links
        document.querySelectorAll('a').forEach(el => {
          elements.push({
            type: 'link',
            selector: el.id ? `#${el.id}` : null,
            href: el.href,
            text: el.textContent?.trim(),
            rect: el.getBoundingClientRect()
          });
        });
        
        // Clickable divs/spans
        document.querySelectorAll('[onClick], [data-action]').forEach(el => {
          if (!el.matches('button, a, [role="button"]')) {
            elements.push({
              type: 'clickable',
              selector: el.id ? `#${el.id}` : null,
              text: el.textContent?.trim(),
              rect: el.getBoundingClientRect()
            });
          }
        });
        
        return elements.filter(el => el.rect.width > 0 && el.rect.height > 0);
      });
      
      this.stats.totalControls += controls.length;
      
      // Test each control
      for (const control of controls) {
        // Skip disabled controls
        if (control.disabled) continue;
        
        // Check for placeholder anchors
        if (control.type === 'link' && 
            (control.href === '#' || 
             control.href?.includes('javascript:void') ||
             control.href?.endsWith('#'))) {
          this.findings.placeholderAnchors.push({
            page: pagePath,
            text: control.text,
            href: control.href
          });
          continue;
        }
        
        // Test click effect
        const hasEffect = await this.testClickEffect(page, control, pagePath);
        
        if (hasEffect) {
          this.stats.verifiedControls++;
        } else {
          this.stats.inertControls++;
          this.findings.inertControls.push({
            page: pagePath,
            control: control,
            screenshot: await this.captureEvidence(page, control)
          });
        }
      }
      
    } catch (err) {
      console.error(`  ❌ Error testing ${pagePath}:`, err.message);
      this.findings.unresolvedEndpoints.push({
        path: pagePath,
        error: err.message,
        type: 'page'
      });
    }
  }

  async testClickEffect(page, control, pagePath) {
    // Anti-false-positive: strict effect verification
    const MAX_RETRIES = 2;
    const WAIT_TIME = 2000;
    
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // Take snapshot before click
        const beforeState = await page.evaluate(() => ({
          url: window.location.href,
          historyLength: window.history.length,
          fetchCount: window.performance.getEntriesByType('fetch').length + 
                      window.performance.getEntriesByType('xmlhttprequest').length,
          dialogOpen: !!document.querySelector('[role="dialog"]:not([aria-hidden="true"])'),
          alertOpen: !!document.querySelector('[role="alert"], [role="status"]')
        }));
        
        // Try to click
        if (control.selector) {
          await page.click(control.selector, { timeout: 1000 }).catch(() => {});
        } else if (control.rect) {
          await page.mouse.click(
            control.rect.x + control.rect.width / 2,
            control.rect.y + control.rect.height / 2
          );
        }
        
        // Wait for potential effects
        await page.waitForTimeout(400);
        
        // Check for navigation or network activity
        const afterState = await page.evaluate(() => ({
          url: window.location.href,
          historyLength: window.history.length,
          fetchCount: window.performance.getEntriesByType('fetch').length + 
                      window.performance.getEntriesByType('xmlhttprequest').length,
          dialogOpen: !!document.querySelector('[role="dialog"]:not([aria-hidden="true"])'),
          alertOpen: !!document.querySelector('[role="alert"], [role="status"]')
        }));
        
        // Verify effect
        if (afterState.url !== beforeState.url ||
            afterState.historyLength > beforeState.historyLength ||
            afterState.fetchCount > beforeState.fetchCount ||
            afterState.dialogOpen !== beforeState.dialogOpen ||
            afterState.alertOpen !== beforeState.alertOpen) {
          return true; // Has effect
        }
        
        // Check for DOM changes
        const domChanged = await page.evaluate(() => {
          const observer = new MutationObserver(() => {});
          observer.observe(document.body, { 
            childList: true, 
            subtree: true, 
            attributes: true 
          });
          const records = observer.takeRecords();
          observer.disconnect();
          return records.length > 0;
        });
        
        if (domChanged) return true;
        
      } catch (err) {
        // Click failed, likely element not found
      }
      
      // Retry with backoff
      if (attempt < MAX_RETRIES - 1) {
        await page.waitForTimeout(400);
      }
    }
    
    return false; // No effect detected
  }

  async testAPIEndpoints(page, apiCalls) {
    const uniqueEndpoints = [...new Set(apiCalls.map(c => c.endpoint))];
    this.stats.totalEndpoints = uniqueEndpoints.length;
    
    for (const endpoint of uniqueEndpoints) {
      try {
        const url = endpoint.startsWith('http') 
          ? endpoint 
          : `${this.BASE_URL}${endpoint}`;
          
        const response = await page.evaluate(async (url) => {
          try {
            const res = await fetch(url, { method: 'GET' });
            return { status: res.status, ok: res.ok };
          } catch (err) {
            return { error: err.message };
          }
        }, url);
        
        if (response.error || !response.ok) {
          this.findings.unresolvedEndpoints.push({
            endpoint,
            status: response.status || 'ERROR',
            error: response.error
          });
        } else {
          this.stats.resolvedEndpoints++;
        }
      } catch (err) {
        this.findings.unresolvedEndpoints.push({
          endpoint,
          error: err.message
        });
      }
    }
  }

  async checkOAuthProviders(page) {
    // Check login page for OAuth buttons
    try {
      await page.goto(`${this.BASE_URL}/login`, { waitUntil: 'networkidle' });
      
      const oauthButtons = await page.evaluate(() => {
        const providers = [];
        const buttons = document.querySelectorAll('button, a, [role="button"]');
        
        buttons.forEach(btn => {
          const text = btn.textContent?.toLowerCase() || '';
          const dataProvider = btn.getAttribute('data-provider');
          
          if (text.includes('google') || dataProvider === 'google') {
            providers.push({ provider: 'google', element: btn.outerHTML });
          }
          if (text.includes('facebook') || text.includes('meta') || dataProvider === 'facebook') {
            providers.push({ provider: 'facebook', element: btn.outerHTML });
          }
          if (text.includes('twitter') || text.includes('𝕏') || dataProvider === 'twitter') {
            providers.push({ provider: 'twitter', element: btn.outerHTML });
          }
          if (text.includes('linkedin') || dataProvider === 'linkedin') {
            providers.push({ provider: 'linkedin', element: btn.outerHTML });
          }
          if (text.includes('instagram') || dataProvider === 'instagram') {
            providers.push({ provider: 'instagram', element: btn.outerHTML });
          }
        });
        
        return providers;
      });
      
      this.stats.oauthProviders = oauthButtons.map(b => b.provider);
      
      // Check if OAuth is configured
      for (const btn of oauthButtons) {
        // Check env vars
        const envVarName = `${btn.provider.toUpperCase()}_CLIENT_ID`;
        const hasEnv = this.checkEnvVar(envVarName);
        
        if (!hasEnv) {
          this.findings.oauthIssues.push({
            provider: btn.provider,
            issue: 'Missing environment variables',
            required: [
              `${btn.provider.toUpperCase()}_CLIENT_ID`,
              `${btn.provider.toUpperCase()}_CLIENT_SECRET`
            ]
          });
        }
      }
      
    } catch (err) {
      console.error('  Error checking OAuth:', err.message);
    }
  }

  async checkNotifications(page) {
    try {
      // Look for notification bell
      await page.goto(`${this.BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
      
      const hasBell = await page.evaluate(() => {
        const bells = document.querySelectorAll('[aria-label*="notification"], [title*="notification"], .notification-bell');
        return bells.length > 0;
      });
      
      if (hasBell) {
        // Try to click it
        const bellWorks = await page.evaluate(async () => {
          const bell = document.querySelector('[aria-label*="notification"], [title*="notification"], .notification-bell');
          if (bell) {
            bell.click();
            await new Promise(r => setTimeout(r, 500));
            const panel = document.querySelector('[role="dialog"], .notification-panel, [aria-label*="notification"]');
            return !!panel;
          }
          return false;
        });
        
        if (!bellWorks) {
          this.findings.notificationIssues.push({
            issue: 'Notification bell does not open panel',
            page: '/dashboard'
          });
        }
      }
      
      // Check API endpoint
      const apiResponse = await page.evaluate(async () => {
        try {
          const res = await fetch('/api/notifications');
          return { status: res.status };
        } catch (err) {
          return { error: err.message };
        }
      });
      
      if (apiResponse.error || apiResponse.status >= 400) {
        this.findings.notificationIssues.push({
          issue: 'Notification API not responding',
          endpoint: '/api/notifications',
          status: apiResponse.status || 'ERROR'
        });
      }
      
    } catch (err) {
      console.error('  Error checking notifications:', err.message);
    }
  }

  checkEnvCompleteness(envUsage) {
    // Check .env.example
    const envExamplePath = path.join(process.cwd(), '.env.example');
    let envExample = '';
    
    if (fs.existsSync(envExamplePath)) {
      envExample = fs.readFileSync(envExamplePath, 'utf-8');
    }
    
    const uniqueVars = [...new Set(envUsage.map(e => e.variable))];
    
    uniqueVars.forEach(varName => {
      if (!envExample.includes(varName)) {
        this.findings.envMissing.push(varName);
      }
    });
  }

  checkEnvVar(varName) {
    // Check various env files
    const envFiles = ['.env', '.env.local', '.env.production'];
    
    for (const file of envFiles) {
      const filePath = path.join(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        if (content.includes(varName)) return true;
      }
    }
    
    return false;
  }

  async captureEvidence(page, control) {
    const timestamp = Date.now();
    const filename = `inert-control-${timestamp}.png`;
    const filepath = path.join(__dirname, 'screens', filename);
    
    try {
      await page.screenshot({ 
        path: filepath,
        clip: control.rect
      });
      return filename;
    } catch (err) {
      return null;
    }
  }

  generateReport() {
    const coverage = {
      controls: this.stats.totalControls > 0 
        ? (this.stats.verifiedControls / this.stats.totalControls * 100).toFixed(1)
        : 0,
      endpoints: this.stats.totalEndpoints > 0
        ? (this.stats.resolvedEndpoints / this.stats.totalEndpoints * 100).toFixed(1)
        : 0,
      oauth: this.findings.oauthIssues.length === 0 ? 100 : 0,
      env: this.findings.envMissing.length === 0 ? 100 : 0
    };
    
    const PASS = coverage.controls === '100.0' && 
                 coverage.endpoints === '100.0' && 
                 coverage.oauth === 100 && 
                 coverage.env === 100;
    
    const report = {
      timestamp: new Date().toISOString(),
      result: PASS ? 'PASS' : 'FAIL',
      coverage,
      stats: this.stats,
      findings: this.findings,
      summary: {
        inertControls: this.findings.inertControls.length,
        unresolvedEndpoints: this.findings.unresolvedEndpoints.length,
        placeholderAnchors: this.findings.placeholderAnchors.length,
        oauthIssues: this.findings.oauthIssues.length,
        notificationIssues: this.findings.notificationIssues.length,
        envMissing: this.findings.envMissing.length
      }
    };
    
    // Write findings
    fs.writeFileSync(
      path.join(__dirname, 'findings.json'),
      JSON.stringify(report, null, 2)
    );
    
    // Generate markdown report
    this.generateMarkdownReport(report);
    
    console.log('\n' + '='.repeat(50));
    console.log(PASS ? '✅ GATE PASSED' : '❌ GATE FAILED');
    console.log('='.repeat(50));
    console.log(`Controls Coverage: ${coverage.controls}%`);
    console.log(`Endpoints Coverage: ${coverage.endpoints}%`);
    console.log(`OAuth Ready: ${coverage.oauth}%`);
    console.log(`Env Complete: ${coverage.env}%`);
    
    if (!PASS) {
      console.log('\n⚠️ Blockers:');
      if (this.findings.inertControls.length > 0) {
        console.log(`  - ${this.findings.inertControls.length} inert controls`);
      }
      if (this.findings.unresolvedEndpoints.length > 0) {
        console.log(`  - ${this.findings.unresolvedEndpoints.length} unresolved endpoints`);
      }
      if (this.findings.placeholderAnchors.length > 0) {
        console.log(`  - ${this.findings.placeholderAnchors.length} placeholder anchors`);
      }
      if (this.findings.oauthIssues.length > 0) {
        console.log(`  - ${this.findings.oauthIssues.length} OAuth provider issues`);
      }
      if (this.findings.envMissing.length > 0) {
        console.log(`  - ${this.findings.envMissing.length} missing env vars`);
      }
    }
  }

  generateMarkdownReport(report) {
    const md = `# No-BS Ship Gate v2 Report

**Date:** ${report.timestamp}
**Result:** **${report.result}**

## Coverage Metrics

| Metric | Coverage | Target | Status |
|--------|----------|--------|--------|
| Controls | ${report.coverage.controls}% | 100% | ${report.coverage.controls === '100.0' ? '✅' : '❌'} |
| Endpoints | ${report.coverage.endpoints}% | 100% | ${report.coverage.endpoints === '100.0' ? '✅' : '❌'} |
| OAuth | ${report.coverage.oauth}% | 100% | ${report.coverage.oauth === 100 ? '✅' : '❌'} |
| Environment | ${report.coverage.env}% | 100% | ${report.coverage.env === 100 ? '✅' : '❌'} |

## Statistics

- Total Controls: ${report.stats.totalControls}
- Verified Controls: ${report.stats.verifiedControls}
- Inert Controls: ${report.stats.inertControls}
- Total Endpoints: ${report.stats.totalEndpoints}
- Resolved Endpoints: ${report.stats.resolvedEndpoints}

## Issues Found

### Inert Controls (${report.findings.inertControls.length})
${report.findings.inertControls.slice(0, 5).map(c => 
  `- Page: ${c.page}, Control: ${c.control.type} "${c.control.text || 'unnamed'}"`
).join('\n')}

### Unresolved Endpoints (${report.findings.unresolvedEndpoints.length})
${report.findings.unresolvedEndpoints.slice(0, 5).map(e => 
  `- ${e.endpoint || e.path} - Status: ${e.status || e.error}`
).join('\n')}

### Placeholder Anchors (${report.findings.placeholderAnchors.length})
${report.findings.placeholderAnchors.slice(0, 5).map(a => 
  `- Page: ${a.page}, Link: "${a.text}" -> ${a.href}`
).join('\n')}

### OAuth Issues (${report.findings.oauthIssues.length})
${report.findings.oauthIssues.map(o => 
  `- ${o.provider}: ${o.issue}`
).join('\n')}

### Missing Environment Variables (${report.findings.envMissing.length})
${report.findings.envMissing.map(e => `- ${e}`).join('\n')}

## Next Actions

${report.result === 'FAIL' ? `
1. Fix inert controls by adding proper onClick handlers
2. Resolve missing API endpoints
3. Replace placeholder anchors with real routes
4. Configure OAuth providers with proper env variables
5. Add missing environment variables to .env.example
` : 'All checks passed! Ready to ship.'}
`;

    fs.writeFileSync(
      path.join(__dirname, 'NoBS-Report.md'),
      md
    );
  }
}

// Run scanner
const scanner = new InertClickScanner();
scanner.scan().catch(console.error);