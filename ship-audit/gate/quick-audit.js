#!/usr/bin/env node
/**
 * No-BS Ship Gate v2 - Quick Audit
 * Fast critical issue detection
 */

const fs = require('fs');
const path = require('path');

class QuickAudit {
  constructor() {
    this.issues = {
      placeholderLinks: [],
      missingEnvVars: [],
      oauthMissing: [],
      inertButtons: [],
      unresolvedRoutes: []
    };
  }

  async run() {
    console.log('🚀 Running quick audit...\n');
    
    // Load inventory
    const inventory = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'inventory.json'), 'utf-8')
    );
    
    // Check for placeholder links
    this.checkPlaceholderLinks(inventory.controls);
    
    // Check OAuth configuration
    this.checkOAuthConfig();
    
    // Check environment variables
    this.checkEnvVars(inventory.envUsage);
    
    // Check for inert buttons
    this.checkInertButtons(inventory.controls);
    
    // Check API endpoint resolution
    this.checkAPIEndpoints(inventory.apiCalls, inventory.routes);
    
    this.generateQuickReport();
  }

  checkPlaceholderLinks(controls) {
    console.log('🔗 Checking for placeholder links...');
    
    controls.forEach(control => {
      if (control.type === 'link' && control.href) {
        if (control.href === '#' || 
            control.href === 'javascript:void(0)' ||
            control.href === 'javascript:void(0);') {
          this.issues.placeholderLinks.push({
            file: control.file,
            line: control.line,
            href: control.href
          });
        }
      }
    });
    
    console.log(`  Found ${this.issues.placeholderLinks.length} placeholder links`);
  }

  checkOAuthConfig() {
    console.log('🔐 Checking OAuth configuration...');
    
    // Check for OAuth provider buttons in login/signup pages
    const authPages = ['app/login/page.tsx', 'app/signup/page.tsx'];
    const providers = ['google', 'facebook', 'twitter', 'linkedin', 'instagram'];
    
    authPages.forEach(pagePath => {
      const fullPath = path.join(process.cwd(), pagePath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf-8').toLowerCase();
        
        providers.forEach(provider => {
          if (content.includes(provider)) {
            // Check for env vars
            const envVars = [
              `${provider.toUpperCase()}_CLIENT_ID`,
              `${provider.toUpperCase()}_CLIENT_SECRET`
            ];
            
            const hasEnvVars = this.checkEnvExists(envVars);
            if (!hasEnvVars) {
              this.issues.oauthMissing.push({
                provider,
                page: pagePath,
                missingVars: envVars
              });
            }
          }
        });
      }
    });
    
    console.log(`  Found ${this.issues.oauthMissing.length} OAuth configuration issues`);
  }

  checkEnvExists(varNames) {
    const envExample = path.join(process.cwd(), '.env.example');
    if (!fs.existsSync(envExample)) return false;
    
    const content = fs.readFileSync(envExample, 'utf-8');
    return varNames.every(varName => content.includes(varName));
  }

  checkEnvVars(envUsage) {
    console.log('🔐 Checking environment variables...');
    
    const envExample = path.join(process.cwd(), '.env.example');
    let envExampleContent = '';
    
    if (fs.existsSync(envExample)) {
      envExampleContent = fs.readFileSync(envExample, 'utf-8');
    }
    
    const uniqueVars = [...new Set(envUsage.map(e => e.variable))];
    
    uniqueVars.forEach(varName => {
      if (!envExampleContent.includes(varName)) {
        this.issues.missingEnvVars.push(varName);
      }
    });
    
    console.log(`  Found ${this.issues.missingEnvVars.length} missing env vars in .env.example`);
  }

  checkInertButtons(controls) {
    console.log('🎮 Checking for inert buttons...');
    
    controls.forEach(control => {
      if (control.type === 'button' && !control.onClick) {
        this.issues.inertButtons.push({
          file: control.file,
          line: control.line
        });
      }
    });
    
    console.log(`  Found ${this.issues.inertButtons.length} buttons without onClick handlers`);
  }

  checkAPIEndpoints(apiCalls, routes) {
    console.log('🔌 Checking API endpoint resolution...');
    
    const apiRoutes = routes.filter(r => r.type === 'api').map(r => r.path);
    
    apiCalls.forEach(call => {
      const endpoint = call.endpoint;
      
      // Skip external URLs
      if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
        return;
      }
      
      // Normalize endpoint
      const normalizedEndpoint = endpoint.replace(/\?.*$/, '').replace(/\/$/, '');
      
      // Check if route exists
      const routeExists = apiRoutes.some(route => {
        const normalizedRoute = route.replace(/\/$/, '');
        return normalizedRoute === normalizedEndpoint ||
               normalizedRoute.includes(':') && this.matchDynamicRoute(normalizedRoute, normalizedEndpoint);
      });
      
      if (!routeExists) {
        this.issues.unresolvedRoutes.push({
          endpoint: call.endpoint,
          file: call.file,
          line: call.line,
          method: call.method
        });
      }
    });
    
    console.log(`  Found ${this.issues.unresolvedRoutes.length} unresolved API endpoints`);
  }

  matchDynamicRoute(route, endpoint) {
    // Simple dynamic route matching
    const routeParts = route.split('/');
    const endpointParts = endpoint.split('/');
    
    if (routeParts.length !== endpointParts.length) return false;
    
    return routeParts.every((part, i) => 
      part.startsWith(':') || part === endpointParts[i]
    );
  }

  generateQuickReport() {
    const totalIssues = 
      this.issues.placeholderLinks.length +
      this.issues.missingEnvVars.length +
      this.issues.oauthMissing.length +
      this.issues.inertButtons.length +
      this.issues.unresolvedRoutes.length;
    
    const PASS = totalIssues === 0;
    
    console.log('\n' + '='.repeat(60));
    console.log(PASS ? '✅ QUICK AUDIT PASSED' : '❌ QUICK AUDIT FAILED');
    console.log('='.repeat(60));
    
    if (!PASS) {
      console.log('\n📊 Issues Summary:');
      console.log(`  Placeholder Links: ${this.issues.placeholderLinks.length}`);
      console.log(`  Missing Env Vars: ${this.issues.missingEnvVars.length}`);
      console.log(`  OAuth Issues: ${this.issues.oauthMissing.length}`);
      console.log(`  Inert Buttons: ${this.issues.inertButtons.length}`);
      console.log(`  Unresolved Routes: ${this.issues.unresolvedRoutes.length}`);
      console.log(`  TOTAL: ${totalIssues}`);
      
      // Show sample issues
      if (this.issues.placeholderLinks.length > 0) {
        console.log('\n🔗 Sample Placeholder Links:');
        this.issues.placeholderLinks.slice(0, 3).forEach(link => {
          console.log(`  ${link.file}:${link.line} - href="${link.href}"`);
        });
      }
      
      if (this.issues.missingEnvVars.length > 0) {
        console.log('\n🔐 Missing Environment Variables:');
        this.issues.missingEnvVars.slice(0, 5).forEach(varName => {
          console.log(`  ${varName}`);
        });
      }
      
      if (this.issues.oauthMissing.length > 0) {
        console.log('\n🔑 OAuth Configuration Issues:');
        this.issues.oauthMissing.forEach(oauth => {
          console.log(`  ${oauth.provider}: Missing ${oauth.missingVars.join(', ')}`);
        });
      }
      
      if (this.issues.unresolvedRoutes.length > 0) {
        console.log('\n🔌 Sample Unresolved API Endpoints:');
        this.issues.unresolvedRoutes.slice(0, 3).forEach(route => {
          console.log(`  ${route.endpoint} (${route.method}) - ${route.file}:${route.line}`);
        });
      }
    }
    
    // Write detailed report
    const report = {
      timestamp: new Date().toISOString(),
      result: PASS ? 'PASS' : 'FAIL',
      totalIssues,
      issues: this.issues
    };
    
    fs.writeFileSync(
      path.join(__dirname, 'quick-audit-results.json'),
      JSON.stringify(report, null, 2)
    );
    
    // Generate patches if there are issues
    if (!PASS) {
      this.generatePatches();
    }
    
    return PASS;
  }

  generatePatches() {
    console.log('\n🔧 Generating patches...');
    
    // Patch 1: Fix placeholder links
    if (this.issues.placeholderLinks.length > 0) {
      const patch = `diff --git a/fix-placeholder-links.patch b/fix-placeholder-links.patch
--- Fix placeholder links
+++ Replace with actual routes
@@ Summary
Replace all href="#" and javascript:void(0) with proper routes or onClick handlers

@@ Changes needed:
${this.issues.placeholderLinks.slice(0, 5).map(link => 
  `- ${link.file}:${link.line} - Replace href="${link.href}" with actual route or onClick`
).join('\n')}

@@ Suggested fix:
Replace href="#" with one of:
1. href="/dashboard" (or other valid route)
2. onClick={() => handleAction()} with href removed
3. role="button" with proper onClick handler
`;
      
      fs.writeFileSync(
        path.join(__dirname, 'patches', '01-fix-placeholder-links.patch'),
        patch
      );
    }
    
    // Patch 2: Add missing env vars
    if (this.issues.missingEnvVars.length > 0) {
      const envPatch = `# Add to .env.example

${this.issues.missingEnvVars.map(varName => 
  `${varName}=`
).join('\n')}
`;
      
      fs.writeFileSync(
        path.join(__dirname, 'patches', '02-add-missing-env.patch'),
        envPatch
      );
    }
    
    // Patch 3: OAuth configuration
    if (this.issues.oauthMissing.length > 0) {
      const oauthPatch = `# OAuth Configuration Required

${this.issues.oauthMissing.map(oauth => `
## ${oauth.provider.toUpperCase()} Provider

1. Add to .env.example:
${oauth.missingVars.map(v => `${v}=`).join('\n')}

2. Register OAuth app at:
- Google: https://console.cloud.google.com/
- Facebook: https://developers.facebook.com/
- Twitter: https://developer.twitter.com/
- LinkedIn: https://www.linkedin.com/developers/
- Instagram: https://developers.facebook.com/

3. Set redirect URI to:
http://localhost:3000/api/auth/callback/${oauth.provider}

4. Update NextAuth config or OAuth handler
`).join('\n')}
`;
      
      fs.writeFileSync(
        path.join(__dirname, 'patches', '03-oauth-setup.md'),
        oauthPatch
      );
    }
    
    console.log(`  Generated ${3} patch files in ship-audit/gate/patches/`);
  }
}

// Run audit
const audit = new QuickAudit();
audit.run().catch(console.error);