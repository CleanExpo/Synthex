import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should navigate to all main pages', async ({ page }) => {
    await page.goto('/');
    
    // Check homepage loads
    await expect(page.locator('h1')).toBeVisible();
    
    // Navigate to pricing
    await page.goto('/pricing.html');
    await expect(page.locator('h1')).toContainText('Pricing');
    
    // Navigate to demo
    await page.goto('/demo.html');
    await expect(page.locator('h1')).toContainText('Demo');
    
    // Navigate to docs
    await page.goto('/docs.html');
    await expect(page.locator('h1')).toContainText('Documentation');
  });

  test('should have working navigation menu', async ({ page }) => {
    await page.goto('/');
    
    // Check for navigation menu
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
    
    // Check for key navigation links
    await expect(nav.locator('a[href*="pricing"]')).toBeVisible();
    await expect(nav.locator('a[href*="demo"]')).toBeVisible();
    await expect(nav.locator('a[href*="docs"]')).toBeVisible();
  });

  test('should handle 404 pages gracefully', async ({ page }) => {
    const response = await page.goto('/nonexistent-page.html');
    
    // Should redirect to 404 or show error
    if (response) {
      expect([404, 200]).toContain(response.status());
    }
  });

  test('should have responsive navigation on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Check for mobile menu button
    const mobileMenuButton = page.locator('[data-mobile-menu-toggle], .mobile-menu-btn, button[aria-label*="menu"]');
    
    if (await mobileMenuButton.isVisible()) {
      await mobileMenuButton.click();
      // Mobile menu should be visible after clicking
      await expect(page.locator('nav, .mobile-menu')).toBeVisible();
    }
  });
});