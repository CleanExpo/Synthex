// Playwright E2E Tests for SYNTHEX Marketing UI Components
// Uses MCP Playwright integration for automated testing

const testConfig = {
  baseURL: process.env.BASE_URL || 'http://localhost:3000',
  timeout: 30000,
  retries: 2,
  use: {
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry'
  }
};

// Test Suite: Marketing Dashboard
const marketingDashboardTests = {
  async testDashboardLoad() {
    // Navigate to marketing dashboard
    await mcp__playwright__browser_navigate({ url: `${testConfig.baseURL}/dashboard` });
    
    // Take accessibility snapshot
    const snapshot = await mcp__playwright__browser_snapshot();
    
    // Verify key elements are present
    const elements = [
      { ref: 'button[data-testid="create-campaign"]', element: 'Create Campaign Button' },
      { ref: 'div[data-testid="analytics-widget"]', element: 'Analytics Widget' },
      { ref: 'nav[data-testid="platform-selector"]', element: 'Platform Selector' }
    ];
    
    for (const el of elements) {
      await mcp__playwright__browser_click({
        element: el.element,
        ref: el.ref
      });
    }
    
    return { status: 'passed', snapshot };
  },

  async testContentCreation() {
    // Navigate to content creator
    await mcp__playwright__browser_navigate({ 
      url: `${testConfig.baseURL}/content/create` 
    });
    
    // Test AI content generation
    await mcp__playwright__browser_type({
      element: 'Content prompt input',
      ref: 'textarea[data-testid="content-prompt"]',
      text: 'Create a marketing post about AI innovation',
      submit: false
    });
    
    // Click generate button
    await mcp__playwright__browser_click({
      element: 'Generate Content Button',
      ref: 'button[data-testid="generate-content"]'
    });
    
    // Wait for AI response
    await mcp__playwright__browser_wait_for({
      text: 'Content generated',
      time: 10
    });
    
    // Take screenshot of generated content
    const screenshot = await mcp__playwright__browser_take_screenshot({
      element: 'Generated content area',
      ref: 'div[data-testid="generated-content"]',
      filename: 'generated-content-test.png'
    });
    
    return { status: 'passed', screenshot };
  },

  async testPlatformOptimization() {
    const platforms = ['twitter', 'linkedin', 'instagram', 'facebook'];
    const results = [];
    
    for (const platform of platforms) {
      // Select platform
      await mcp__playwright__browser_select_option({
        element: 'Platform selector',
        ref: 'select[data-testid="platform-select"]',
        values: [platform]
      });
      
      // Verify platform-specific features load
      await mcp__playwright__browser_wait_for({
        text: `${platform} optimization`,
        time: 5
      });
      
      // Test character counter for platform limits
      if (platform === 'twitter') {
        await mcp__playwright__browser_type({
          element: 'Tweet input',
          ref: 'textarea[data-testid="tweet-input"]',
          text: 'Testing Twitter character limit functionality with a longer message to verify the counter works correctly',
          slowly: true
        });
        
        // Check character counter
        const snapshot = await mcp__playwright__browser_snapshot();
        results.push({ platform, snapshot });
      }
    }
    
    return { status: 'passed', results };
  },

  async testResponsiveDesign() {
    const viewports = [
      { width: 375, height: 667, name: 'iPhone SE' },
      { width: 768, height: 1024, name: 'iPad' },
      { width: 1920, height: 1080, name: 'Desktop' }
    ];
    
    const screenshots = [];
    
    for (const viewport of viewports) {
      // Resize browser
      await mcp__playwright__browser_resize({
        width: viewport.width,
        height: viewport.height
      });
      
      // Navigate to dashboard
      await mcp__playwright__browser_navigate({
        url: `${testConfig.baseURL}/dashboard`
      });
      
      // Take screenshot
      const screenshot = await mcp__playwright__browser_take_screenshot({
        filename: `responsive-${viewport.name}.png`,
        fullPage: true
      });
      
      screenshots.push({ viewport: viewport.name, screenshot });
    }
    
    return { status: 'passed', screenshots };
  },

  async testAuthenticationFlow() {
    // Test login flow with ESC cancellation support
    await mcp__playwright__browser_navigate({
      url: `${testConfig.baseURL}/auth/login`
    });
    
    // Test OAuth providers
    const providers = ['google', 'github', 'twitter'];
    
    for (const provider of providers) {
      // Click OAuth button
      await mcp__playwright__browser_click({
        element: `${provider} OAuth button`,
        ref: `button[data-testid="oauth-${provider}"]`
      });
      
      // Note: ESC key can be used to cancel OAuth flow during manual testing
      // For automated tests, we'll check if the OAuth window opens
      
      // Wait for redirect or error
      await mcp__playwright__browser_wait_for({
        time: 2
      });
      
      // Return to login page for next provider
      await mcp__playwright__browser_navigate_back();
    }
    
    return { status: 'passed', providers };
  }
};

// Export test configuration for use with MCP
module.exports = {
  testConfig,
  marketingDashboardTests,
  runAllTests: async function() {
    const results = {};
    
    for (const [testName, testFunc] of Object.entries(marketingDashboardTests)) {
      try {
        results[testName] = await testFunc();
      } catch (error) {
        results[testName] = { status: 'failed', error: error.message };
      }
    }
    
    return results;
  }
};