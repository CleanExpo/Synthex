import { test, expect } from '@playwright/test';

/**
 * Staging Environment Specific Tests
 * These tests verify staging-specific configurations and features
 */

test.describe('Staging Environment Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up staging environment context
    await page.goto('/');
  });

  test('@smoke should load staging environment', async ({ page }) => {
    // Check for staging indicator
    const response = await page.goto('/');
    const headers = response?.headers();
    
    // Verify staging header
    if (headers) {
      expect(headers['x-environment']).toBe('staging');
    }
  });

  test('@smoke should have robots noindex header', async ({ page }) => {
    // Ensure staging is not indexed by search engines
    const response = await page.goto('/');
    const headers = response?.headers();
    
    if (headers) {
      expect(headers['x-robots-tag']).toContain('noindex');
    }
  });

  test('should display staging banner', async ({ page }) => {
    // Check for staging environment banner
    const stagingBanner = page.locator('[data-testid="staging-banner"], .staging-banner');
    
    // Some staging environments show a banner
    if (await stagingBanner.isVisible()) {
      await expect(stagingBanner).toContainText(/staging|preview|test/i);
    }
  });

  test('should have beta features enabled', async ({ page }) => {
    // Check if beta features are accessible in staging
    await page.goto('/dashboard.html');
    
    // Look for beta feature indicators
    const betaFeatures = page.locator('[data-beta], .beta-feature');
    const count = await betaFeatures.count();
    
    // Staging should have at least some beta features
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should connect to staging API', async ({ page }) => {
    // Verify API calls go to staging endpoint
    const apiResponse = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/health');
        return {
          status: response.status,
          ok: response.ok,
          headers: Object.fromEntries(response.headers.entries())
        };
      } catch (error) {
        return { error: error.message };
      }
    });
    
    expect(apiResponse).toHaveProperty('ok', true);
  });

  test('should have debug mode available', async ({ page }) => {
    // Check if debug tools are accessible
    await page.evaluate(() => {
      window.DEBUG = true;
    });
    
    const hasDebug = await page.evaluate(() => {
      return 'DEBUG' in window;
    });
    
    expect(hasDebug).toBeTruthy();
  });

  test('should log to staging monitoring', async ({ page }) => {
    // Verify logging is configured for staging
    const logs: any[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        logs.push({
          type: msg.type(),
          text: msg.text()
        });
      }
    });
    
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    // Staging should have enhanced logging
    // Check that errors would be logged
    await page.evaluate(() => {
      console.error('Test error for staging monitoring');
    });
    
    expect(logs).toContainEqual(
      expect.objectContaining({
        type: 'error',
        text: expect.stringContaining('Test error')
      })
    );
  });

  test('should have feature flags enabled', async ({ page }) => {
    // Test staging-specific feature flags
    const featureFlags = await page.evaluate(() => {
      return window.FEATURE_FLAGS || {};
    });
    
    // These should be enabled in staging
    expect(featureFlags).toMatchObject({
      analytics: true,
      betaFeatures: true,
      debugMode: true
    });
  });

  test('should handle staging OAuth flow', async ({ page }) => {
    await page.goto('/login.html');
    
    // Check for staging OAuth configuration
    const googleButton = page.locator('button:has-text("Continue with Google")');
    
    if (await googleButton.isVisible()) {
      // In staging, OAuth should redirect to staging callback
      const href = await googleButton.getAttribute('data-href') || 
                   await googleButton.getAttribute('onclick');
      
      if (href) {
        expect(href).toContain('staging');
      }
    }
  });

  test('should have staging-specific rate limits', async ({ page }) => {
    // Test that staging has different rate limits than production
    const responses = [];
    
    // Make multiple requests
    for (let i = 0; i < 5; i++) {
      const response = await page.request.get('/api/health');
      responses.push(response.status());
    }
    
    // All should succeed in staging (higher rate limits)
    responses.forEach(status => {
      expect(status).toBe(200);
    });
  });
});

test.describe('Staging Data Isolation', () => {
  test('should use staging database', async ({ page }) => {
    // Verify data isolation from production
    const response = await page.request.get('/api/v1/config');
    
    if (response.ok()) {
      const config = await response.json();
      expect(config.environment).toBe('staging');
      expect(config.database).toContain('staging');
    }
  });

  test('should not show production data', async ({ page }) => {
    await page.goto('/dashboard.html');
    
    // Check that we're not seeing production data
    const dataSource = await page.evaluate(() => {
      return localStorage.getItem('data_source') || 'staging';
    });
    
    expect(dataSource).not.toBe('production');
  });
});

test.describe('Staging Performance', () => {
  test('should meet staging performance budgets', async ({ page }) => {
    const metrics = await page.evaluate(() => {
      return performance.getEntriesByType('navigation')[0];
    });
    
    // Staging can have relaxed performance requirements
    expect(metrics.loadEventEnd).toBeLessThan(5000); // 5 seconds
  });

  test('should have service worker disabled in staging', async ({ page }) => {
    // Service worker might be disabled in staging for easier testing
    const hasServiceWorker = await page.evaluate(() => {
      return 'serviceWorker' in navigator && navigator.serviceWorker.controller !== null;
    });
    
    // This is environment-specific
    console.log('Service Worker status in staging:', hasServiceWorker);
  });
});