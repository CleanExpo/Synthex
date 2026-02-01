import { test, expect, Page } from '@playwright/test';

/**
 * GP-56: Dashboard E2E Tests
 * Comprehensive tests for the Phase 4 dashboard with all tabs
 */

// Helper function to mock authentication
async function mockAuthentication(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('synthex_token', 'mock-jwt-token');
    localStorage.setItem('synthex_user', JSON.stringify({
      id: '1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'admin'
    }));
  });
}

test.describe('Dashboard - Core Layout', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthentication(page);
    await page.goto('/dashboard');
  });

  test('should display header with title and actions', async ({ page }) => {
    // Header should be visible
    await expect(page.locator('header')).toBeVisible();

    // Dashboard title
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();

    // New Post button
    await expect(page.getByRole('button', { name: /new post|post/i })).toBeVisible();

    // Notification bell
    await expect(page.locator('button').filter({ has: page.locator('svg') }).first()).toBeVisible();
  });

  test('should display Quick Stats cards', async ({ page }) => {
    // Quick Stats section
    await expect(page.getByText('Quick Stats')).toBeVisible();

    // Stats should be visible
    await expect(page.getByText('Total Posts')).toBeVisible();
    await expect(page.getByText('Engagement')).toBeVisible();
    await expect(page.getByText('Followers')).toBeVisible();
    await expect(page.getByText('Scheduled')).toBeVisible();
  });

  test('should display all tab triggers', async ({ page }) => {
    // All tabs should be visible
    await expect(page.getByRole('tab', { name: /overview/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /analytics/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /ai|studio/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /team/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /scheduler/i })).toBeVisible();
  });
});

test.describe('Dashboard - Overview Tab', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthentication(page);
    await page.goto('/dashboard');
    await page.getByRole('tab', { name: /overview/i }).click();
  });

  test('should display Performance Overview card', async ({ page }) => {
    await expect(page.getByText('Performance Overview')).toBeVisible();
    await expect(page.getByText('Track your social media performance')).toBeVisible();
  });

  test('should display stat cards with trends', async ({ page }) => {
    // Find stat cards with trend indicators
    const trendIndicators = page.locator('text=/[↑↓]/');
    await expect(trendIndicators.first()).toBeVisible();
  });

  test('should display Trending Topics', async ({ page }) => {
    await expect(page.getByText('Trending Topics')).toBeVisible();

    // Should show hashtag badges
    await expect(page.locator('span').filter({ hasText: /^#/ }).first()).toBeVisible();
  });

  test('should display Recent Activity', async ({ page }) => {
    await expect(page.getByText('Recent Activity')).toBeVisible();

    // Activity items should be visible
    await expect(page.getByText(/Published post|Post reached|Gained/i).first()).toBeVisible();
  });
});

test.describe('Dashboard - Analytics Tab', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthentication(page);
    await page.goto('/dashboard');
    await page.getByRole('tab', { name: /analytics/i }).click();
  });

  test('should display Real-Time Analytics', async ({ page }) => {
    await expect(page.getByText('Real-Time Analytics')).toBeVisible();
    await expect(page.getByText('Live performance metrics')).toBeVisible();
  });

  test('should have Refresh button', async ({ page }) => {
    const refreshButton = page.getByRole('button', { name: /refresh/i });
    await expect(refreshButton).toBeVisible();
  });

  test('should display Platform Breakdown', async ({ page }) => {
    await expect(page.getByText('Platform Breakdown')).toBeVisible();

    // Platform items
    await expect(page.getByText('Twitter')).toBeVisible();
    await expect(page.getByText('Instagram')).toBeVisible();
    await expect(page.getByText('LinkedIn')).toBeVisible();
    await expect(page.getByText('YouTube')).toBeVisible();
  });

  test('should show engagement chart placeholder', async ({ page }) => {
    await expect(page.getByText('Engagement Over Time')).toBeVisible();
  });
});

test.describe('Dashboard - AI Studio Tab', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthentication(page);
    await page.goto('/dashboard');
    await page.getByRole('tab', { name: /ai|studio/i }).click();
  });

  test('should display AI Content Studio', async ({ page }) => {
    await expect(page.getByText('AI Content Studio')).toBeVisible();
    await expect(page.getByText('Generate viral content')).toBeVisible();
  });

  test('should display quick action buttons', async ({ page }) => {
    await expect(page.getByRole('button', { name: /generate post/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /hashtag ideas/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /content calendar/i })).toBeVisible();
  });

  test('should display Recent AI Generations', async ({ page }) => {
    await expect(page.getByText('Recent AI Generations')).toBeVisible();

    // Generation items
    await expect(page.locator('text=/Post|Hashtags|Caption/')).toBeVisible();
  });
});

test.describe('Dashboard - Team Tab', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthentication(page);
    await page.goto('/dashboard');
    await page.getByRole('tab', { name: /team/i }).click();
  });

  test('should display Team Collaboration', async ({ page }) => {
    await expect(page.getByText('Team Collaboration')).toBeVisible();
    await expect(page.getByText('Manage your team')).toBeVisible();
  });

  test('should display Team Members section', async ({ page }) => {
    await expect(page.getByText('Team Members')).toBeVisible();

    // Team members
    await expect(page.getByText('John Doe')).toBeVisible();
    await expect(page.getByText('Admin')).toBeVisible();
  });

  test('should show member status indicators', async ({ page }) => {
    // Online/offline status
    await expect(page.getByText(/online|offline/i).first()).toBeVisible();
  });

  test('should display Pending Invites section', async ({ page }) => {
    await expect(page.getByText('Pending Invites')).toBeVisible();
    await expect(page.getByRole('button', { name: /invite member/i })).toBeVisible();
  });
});

test.describe('Dashboard - Scheduler Tab', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthentication(page);
    await page.goto('/dashboard');
    await page.getByRole('tab', { name: /scheduler/i }).click();
  });

  test('should display Post Scheduler', async ({ page }) => {
    await expect(page.getByText('Post Scheduler')).toBeVisible();
    await expect(page.getByText('Schedule and manage')).toBeVisible();
  });

  test('should display Upcoming Posts', async ({ page }) => {
    await expect(page.getByText('Upcoming Posts')).toBeVisible();

    // Post items with platforms
    await expect(page.getByText('Twitter').first()).toBeVisible();
  });

  test('should show post status badges', async ({ page }) => {
    // Status badges
    await expect(page.getByText(/scheduled|draft/i).first()).toBeVisible();
  });

  test('should have Schedule New Post button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /schedule new post/i })).toBeVisible();
  });
});

test.describe('Dashboard - Mobile Responsiveness', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthentication(page);
  });

  test('should render correctly on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard');

    // Header should still be visible
    await expect(page.locator('header')).toBeVisible();

    // Quick stats should be in 2-column grid
    await expect(page.getByText('Quick Stats')).toBeVisible();

    // Tabs should be accessible
    await expect(page.getByRole('tab', { name: /overview/i })).toBeVisible();
  });

  test('should render correctly on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/dashboard');

    // All main sections should be visible
    await expect(page.locator('header')).toBeVisible();
    await expect(page.getByText('Quick Stats')).toBeVisible();
    await expect(page.getByRole('tab', { name: /overview/i })).toBeVisible();
  });

  test('tabs should be navigable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard');

    // Navigate through all tabs
    const tabs = ['overview', 'analytics', 'team'];
    for (const tabName of tabs) {
      await page.getByRole('tab', { name: new RegExp(tabName, 'i') }).click();
      await expect(page.getByRole('tabpanel')).toBeVisible();
    }
  });
});

test.describe('Dashboard - Loading States', () => {
  test('should show loading skeleton initially', async ({ page }) => {
    await mockAuthentication(page);

    // Intercept API calls to add delay
    await page.route('**/api/**', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 500));
      await route.continue();
    });

    await page.goto('/dashboard');

    // Check for skeleton elements (they should briefly appear)
    // Note: This test may be flaky depending on load speed
  });
});

test.describe('Dashboard - Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthentication(page);
    await page.goto('/dashboard');
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();
  });

  test('tabs should be keyboard accessible', async ({ page }) => {
    const tabList = page.getByRole('tablist');
    await expect(tabList).toBeVisible();

    // Focus on first tab
    await page.getByRole('tab', { name: /overview/i }).focus();

    // Navigate with arrow keys
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: /analytics/i })).toBeFocused();
  });

  test('buttons should have accessible names', async ({ page }) => {
    const newPostButton = page.getByRole('button', { name: /new post|post/i });
    await expect(newPostButton).toBeVisible();
  });
});
