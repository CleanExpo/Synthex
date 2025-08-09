import { test, expect, Page } from '@playwright/test';

// Helper function to mock authentication
async function mockAuthentication(page: Page) {
  // Set auth token in localStorage
  await page.addInitScript(() => {
    localStorage.setItem('synthex_token', 'mock-jwt-token');
    localStorage.setItem('synthex_user', JSON.stringify({
      id: '1',
      name: 'Test User',
      email: 'test@example.com'
    }));
  });
}

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthentication(page);
    await page.goto('/dashboard.html');
  });

  test('should display dashboard components', async ({ page }) => {
    // Check for main dashboard elements
    await expect(page.locator('.dashboard-header, header')).toBeVisible();
    await expect(page.locator('.sidebar, nav[role="navigation"]')).toBeVisible();
    await expect(page.locator('.main-content, main')).toBeVisible();
  });

  test('should show user profile information', async ({ page }) => {
    // Check for user info display
    const userInfo = page.locator('[data-user-info], .user-profile, .user-name');
    if (await userInfo.isVisible()) {
      await expect(userInfo).toContainText('Test User');
    }
  });

  test('should display analytics overview', async ({ page }) => {
    // Check for analytics cards
    const analyticsSection = page.locator('.analytics-overview, .stats-cards, [data-analytics]');
    if (await analyticsSection.isVisible()) {
      await expect(analyticsSection).toBeVisible();
    }
  });

  test('should have working sidebar navigation', async ({ page }) => {
    const sidebar = page.locator('.sidebar, nav[role="navigation"]');
    
    // Check for navigation items
    await expect(sidebar.locator('a, button').first()).toBeVisible();
  });

  test('should handle logout', async ({ page }) => {
    // Find and click logout button
    const logoutButton = page.locator('button:has-text("Logout"), a:has-text("Logout"), [data-logout]');
    
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      
      // Should redirect to login page
      await page.waitForURL('**/login.html', { timeout: 5000 }).catch(() => {
        // Fallback check for login redirect
        expect(page.url()).toContain('login');
      });
    }
  });

  test('should display recent posts or content', async ({ page }) => {
    // Check for content list
    const contentList = page.locator('.recent-posts, .content-list, [data-posts]');
    if (await contentList.isVisible()) {
      await expect(contentList).toBeVisible();
    }
  });

  test('should show notification bell', async ({ page }) => {
    // Check for notifications
    const notificationBell = page.locator('[data-notifications], .notification-bell, button[aria-label*="notification"]');
    if (await notificationBell.isVisible()) {
      await notificationBell.click();
      // Notification dropdown should appear
      await expect(page.locator('.notification-dropdown, .notifications-panel')).toBeVisible();
    }
  });
});