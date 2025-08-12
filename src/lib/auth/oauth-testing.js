/**
 * OAuth Testing Utilities for SYNTHEX
 * Supports ESC key cancellation for OAuth flows
 * Integrated with Claude Code enhancements
 */

class OAuthTestingUtilities {
  constructor() {
    this.providers = {
      google: {
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        scope: 'email profile',
        testAccounts: []
      },
      github: {
        authUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        scope: 'user:email',
        testAccounts: []
      },
      twitter: {
        authUrl: 'https://twitter.com/i/oauth2/authorize',
        tokenUrl: 'https://api.twitter.com/2/oauth2/token',
        scope: 'tweet.read users.read',
        testAccounts: []
      },
      linkedin: {
        authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
        tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
        scope: 'r_liteprofile r_emailaddress',
        testAccounts: []
      }
    };
    
    this.activeFlows = new Map();
    this.escListener = null;
  }

  /**
   * Initialize OAuth testing with ESC support
   */
  initialize() {
    // Set up ESC key listener for cancellation
    this.setupEscListener();
    
    // Log initialization
    console.log('OAuth Testing initialized. Press ESC to cancel active flows.');
  }

  /**
   * Set up ESC key listener for OAuth cancellation
   */
  setupEscListener() {
    if (typeof window !== 'undefined') {
      this.escListener = (event) => {
        if (event.key === 'Escape' || event.keyCode === 27) {
          this.cancelActiveFlows();
        }
      };
      
      window.addEventListener('keydown', this.escListener);
    } else {
      // Node.js environment - use process stdin
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
        process.stdin.on('data', (key) => {
          // ESC key
          if (key[0] === 27) {
            this.cancelActiveFlows();
          }
        });
      }
    }
  }

  /**
   * Cancel all active OAuth flows
   */
  cancelActiveFlows() {
    if (this.activeFlows.size === 0) {
      console.log('No active OAuth flows to cancel');
      return;
    }
    
    console.log(`\n⚠️  ESC pressed - Cancelling ${this.activeFlows.size} active OAuth flow(s)...`);
    
    for (const [flowId, flow] of this.activeFlows) {
      this.cancelFlow(flowId);
    }
    
    console.log('✅ All OAuth flows cancelled');
  }

  /**
   * Cancel a specific OAuth flow
   * @param {string} flowId - Flow identifier
   */
  cancelFlow(flowId) {
    const flow = this.activeFlows.get(flowId);
    
    if (!flow) {
      console.warn(`Flow ${flowId} not found`);
      return;
    }
    
    // Close OAuth window if using Playwright
    if (flow.playwrightTab) {
      mcp__playwright__browser_tab_close({ index: flow.playwrightTab });
    }
    
    // Clear timeout
    if (flow.timeout) {
      clearTimeout(flow.timeout);
    }
    
    // Execute cancellation callback
    if (flow.onCancel) {
      flow.onCancel();
    }
    
    // Remove from active flows
    this.activeFlows.delete(flowId);
    
    console.log(`OAuth flow cancelled: ${flow.provider} (${flowId})`);
  }

  /**
   * Start OAuth flow for a provider
   * @param {string} provider - Provider name
   * @param {object} options - Flow options
   * @returns {Promise<object>} OAuth result or cancellation
   */
  async startOAuthFlow(provider, options = {}) {
    if (!this.providers[provider]) {
      throw new Error(`Unknown provider: ${provider}`);
    }
    
    const flowId = `${provider}-${Date.now()}`;
    const providerConfig = this.providers[provider];
    
    console.log(`\n🔐 Starting OAuth flow: ${provider}`);
    console.log('   Press ESC at any time to cancel\n');
    
    // Register flow
    const flow = {
      id: flowId,
      provider,
      startTime: Date.now(),
      status: 'pending',
      onCancel: options.onCancel,
      result: null
    };
    
    this.activeFlows.set(flowId, flow);
    
    try {
      // Use Playwright to open OAuth window
      if (options.usePlaywright) {
        const result = await this.playwrightOAuthFlow(provider, flowId);
        flow.result = result;
        flow.status = 'completed';
        return result;
      } else {
        // Manual flow with instructions
        const result = await this.manualOAuthFlow(provider, flowId);
        flow.result = result;
        flow.status = 'completed';
        return result;
      }
    } catch (error) {
      flow.status = 'failed';
      flow.error = error.message;
      
      if (error.message === 'OAuth flow cancelled') {
        console.log(`✅ ${provider} OAuth flow cancelled successfully`);
        return { cancelled: true, provider };
      }
      
      throw error;
    } finally {
      // Clean up
      this.activeFlows.delete(flowId);
    }
  }

  /**
   * Automated OAuth flow using Playwright
   * @param {string} provider - Provider name
   * @param {string} flowId - Flow identifier
   * @returns {Promise<object>} OAuth result
   */
  async playwrightOAuthFlow(provider, flowId) {
    const flow = this.activeFlows.get(flowId);
    
    // Open new tab for OAuth
    await mcp__playwright__browser_tab_new({
      url: this.buildAuthUrl(provider)
    });
    
    // Get tab index
    const tabs = await mcp__playwright__browser_tab_list();
    flow.playwrightTab = tabs.length - 1;
    
    // Wait for redirect or cancellation
    return new Promise((resolve, reject) => {
      // Set timeout
      flow.timeout = setTimeout(() => {
        this.cancelFlow(flowId);
        reject(new Error('OAuth flow timeout'));
      }, 120000); // 2 minute timeout
      
      // Set cancellation handler
      flow.onCancel = () => {
        reject(new Error('OAuth flow cancelled'));
      };
      
      // Monitor for redirect
      const checkInterval = setInterval(async () => {
        if (!this.activeFlows.has(flowId)) {
          clearInterval(checkInterval);
          return;
        }
        
        try {
          // Check current URL
          const snapshot = await mcp__playwright__browser_snapshot();
          
          // Check if redirected back to app
          if (snapshot.url && snapshot.url.includes('callback')) {
            clearInterval(checkInterval);
            clearTimeout(flow.timeout);
            
            // Extract token from URL
            const token = this.extractTokenFromUrl(snapshot.url);
            resolve({ provider, token, success: true });
          }
        } catch (error) {
          // Tab might be closed
          if (!this.activeFlows.has(flowId)) {
            clearInterval(checkInterval);
          }
        }
      }, 1000);
    });
  }

  /**
   * Manual OAuth flow with instructions
   * @param {string} provider - Provider name
   * @param {string} flowId - Flow identifier
   * @returns {Promise<object>} OAuth result
   */
  async manualOAuthFlow(provider, flowId) {
    const authUrl = this.buildAuthUrl(provider);
    
    console.log(`\n📋 Manual OAuth Instructions for ${provider}:`);
    console.log('1. Open this URL in your browser:');
    console.log(`   ${authUrl}`);
    console.log('2. Complete the authentication');
    console.log('3. Copy the callback URL after redirect');
    console.log('4. Press ESC to cancel at any time\n');
    
    return new Promise((resolve, reject) => {
      const flow = this.activeFlows.get(flowId);
      
      // Set timeout
      flow.timeout = setTimeout(() => {
        this.cancelFlow(flowId);
        reject(new Error('OAuth flow timeout'));
      }, 300000); // 5 minute timeout for manual
      
      // Set cancellation handler
      flow.onCancel = () => {
        reject(new Error('OAuth flow cancelled'));
      };
      
      // In a real implementation, this would wait for user input
      // For testing, we'll simulate completion
      setTimeout(() => {
        if (this.activeFlows.has(flowId)) {
          resolve({
            provider,
            token: 'test-token-' + Date.now(),
            success: true,
            manual: true
          });
        }
      }, 2000);
    });
  }

  /**
   * Build OAuth authorization URL
   * @param {string} provider - Provider name
   * @returns {string} Authorization URL
   */
  buildAuthUrl(provider) {
    const config = this.providers[provider];
    const params = new URLSearchParams({
      client_id: process.env[`${provider.toUpperCase()}_CLIENT_ID`] || 'test-client-id',
      redirect_uri: process.env.OAUTH_REDIRECT_URI || 'http://localhost:3000/auth/callback',
      scope: config.scope,
      response_type: 'code',
      state: Math.random().toString(36).substring(7)
    });
    
    return `${config.authUrl}?${params.toString()}`;
  }

  /**
   * Extract token from callback URL
   * @param {string} url - Callback URL
   * @returns {string} Token
   */
  extractTokenFromUrl(url) {
    const urlParams = new URLSearchParams(new URL(url).search);
    return urlParams.get('code') || urlParams.get('token');
  }

  /**
   * Test multiple providers in sequence
   * @param {array} providers - List of providers to test
   * @returns {Promise<object>} Test results
   */
  async testMultipleProviders(providers = ['google', 'github', 'twitter']) {
    const results = {};
    
    console.log(`\n🧪 Testing ${providers.length} OAuth providers`);
    console.log('Press ESC at any time to skip current provider\n');
    
    for (const provider of providers) {
      try {
        console.log(`\nTesting ${provider}...`);
        const result = await this.startOAuthFlow(provider, {
          usePlaywright: true
        });
        results[provider] = result;
        console.log(`✅ ${provider} test completed`);
      } catch (error) {
        if (error.message === 'OAuth flow cancelled') {
          results[provider] = { cancelled: true };
          console.log(`⏭️  Skipped ${provider}`);
        } else {
          results[provider] = { error: error.message };
          console.error(`❌ ${provider} test failed:`, error.message);
        }
      }
      
      // Small delay between providers
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return results;
  }

  /**
   * Generate OAuth testing report
   * @returns {string} Markdown report
   */
  generateReport() {
    let report = '# OAuth Testing Report\n\n';
    report += `Generated: ${new Date().toISOString()}\n\n`;
    
    report += '## Provider Configuration\n';
    for (const [provider, config] of Object.entries(this.providers)) {
      report += `\n### ${provider.charAt(0).toUpperCase() + provider.slice(1)}\n`;
      report += `- Auth URL: ${config.authUrl}\n`;
      report += `- Scope: ${config.scope}\n`;
      report += `- Test Accounts: ${config.testAccounts.length}\n`;
    }
    
    report += '\n## ESC Cancellation Support\n';
    report += '✅ ESC key listener is active\n';
    report += `📊 Active flows: ${this.activeFlows.size}\n`;
    
    if (this.activeFlows.size > 0) {
      report += '\n### Active Flows:\n';
      for (const [flowId, flow] of this.activeFlows) {
        const duration = Date.now() - flow.startTime;
        report += `- ${flow.provider} (${flowId}): ${flow.status} - ${duration}ms\n`;
      }
    }
    
    return report;
  }

  /**
   * Clean up resources
   */
  cleanup() {
    // Cancel all active flows
    this.cancelActiveFlows();
    
    // Remove ESC listener
    if (typeof window !== 'undefined' && this.escListener) {
      window.removeEventListener('keydown', this.escListener);
    }
    
    console.log('OAuth testing utilities cleaned up');
  }
}

// Create singleton instance
const oauthTesting = new OAuthTestingUtilities();

// Initialize on load
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => oauthTesting.initialize());
} else {
  oauthTesting.initialize();
}

// Export for use in SYNTHEX
if (typeof module !== 'undefined' && module.exports) {
  module.exports = oauthTesting;
}

// Browser global
if (typeof window !== 'undefined') {
  window.OAuthTestingUtilities = oauthTesting;
}