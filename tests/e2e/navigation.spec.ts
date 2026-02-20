import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should navigate to all main pages', async ({ page }) => {
    await page.goto('/');
    // Homepages load successfully
    await expect(page.locator('body')).toBeVisible();

    // Navigate to login
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();

    // Navigate to signup
    await page.goto('/signup', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
  });

  test('should have working navigation menu', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Check for any navigation element
    const nav = page.locator('nav, header, [role="navigation"]');
    await expect(nav.first()).toBeVisible();
  });

  test('should handle 404 pages gracefully', async ({ page }) => {
    const response = await page.goto('/nonexistent-page-xyz-12345', {
      waitUntil: 'domcontentloaded',
    });

    // Should return 404 or redirect (Next.js not-found page returns 200 with 404 content)
    if (response) {
      expect([200, 302, 404]).toContain(response.status());
    }

    // Page should not crash
    await expect(page.locator('body')).toBeVisible();
  });

  test('should have responsive navigation on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Page should render without error
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Check for some navigation element (may be hamburger or full nav)
    const mobileMenuButton = page.locator(
      '[data-mobile-menu-toggle], .mobile-menu-btn, button[aria-label*="menu"]'
    );

    if (await mobileMenuButton.isVisible()) {
      await mobileMenuButton.click();
      await expect(page.locator('nav, .mobile-menu')).toBeVisible();
    }
  });
});
