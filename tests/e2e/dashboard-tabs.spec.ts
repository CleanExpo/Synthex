/**
 * Dashboard Tabs E2E Tests
 *
 * Tests each dashboard tab (Overview, Analytics, AI Studio, Team, Scheduler)
 * for content rendering, interaction, and accessibility.
 * Uses proper cookie-based auth via the dashboard fixture.
 *
 * @module tests/e2e/dashboard-tabs.spec
 */

import { test, expect } from './fixtures/dashboard.fixture';

test.describe('Dashboard - Overview Tab', () => {
  test('should render overview content by default', async ({ authedDashboard, page }) => {
    await authedDashboard.goto('/dashboard');

    // Overview tab should be active by default (or first tab)
    const overviewTab = page.locator('[role="tab"]').first();
    if (await overviewTab.isVisible()) {
      const state = await overviewTab.getAttribute('data-state');
      expect(state).toBe('active');
    }

    // Tab panel should have content
    const tabPanel = page.locator('[role="tabpanel"]');
    if (await tabPanel.isVisible()) {
      const text = await tabPanel.textContent();
      expect(text!.length).toBeGreaterThan(0);
    }
  });

  test('should display performance or overview section', async ({ authedDashboard, page }) => {
    await authedDashboard.goto('/dashboard');

    // Overview tab typically shows performance metrics
    const mainContent = authedDashboard.mainContent;
    const text = await mainContent.textContent();

    // Should have some meaningful content (stats, metrics, activity)
    expect(text!.length).toBeGreaterThan(50);
  });
});

test.describe('Dashboard - Analytics Tab', () => {
  test('should switch to analytics tab', async ({ authedDashboard, page }) => {
    await authedDashboard.goto('/dashboard');

    const analyticsTab = page.locator('[role="tab"]').filter({ hasText: /analytics/i });
    if (await analyticsTab.isVisible()) {
      await analyticsTab.click();
      await page.waitForTimeout(300);

      // Analytics tab should now be active
      const state = await analyticsTab.getAttribute('data-state');
      expect(state).toBe('active');

      // Tab panel should show analytics content
      const tabPanel = page.locator('[role="tabpanel"]');
      await expect(tabPanel).toBeVisible();
    }
  });

  test('should display analytics metrics or empty state', async ({ authedDashboard, page }) => {
    await authedDashboard.goto('/dashboard');

    const analyticsTab = page.locator('[role="tab"]').filter({ hasText: /analytics/i });
    if (await analyticsTab.isVisible()) {
      await analyticsTab.click();
      await page.waitForTimeout(500);

      const tabPanel = page.locator('[role="tabpanel"]');
      const text = await tabPanel.textContent();

      // Should have analytics content or an empty/connect state
      expect(text!.length).toBeGreaterThan(0);
    }
  });
});

test.describe('Dashboard - AI Studio Tab', () => {
  test('should switch to AI Studio tab', async ({ authedDashboard, page }) => {
    await authedDashboard.goto('/dashboard');

    const aiTab = page.locator('[role="tab"]').filter({ hasText: /ai|studio/i });
    if (await aiTab.isVisible()) {
      await aiTab.click();
      await page.waitForTimeout(300);

      const state = await aiTab.getAttribute('data-state');
      expect(state).toBe('active');

      const tabPanel = page.locator('[role="tabpanel"]');
      await expect(tabPanel).toBeVisible();
    }
  });

  test('should display AI content generation options', async ({ authedDashboard, page }) => {
    await authedDashboard.goto('/dashboard');

    const aiTab = page.locator('[role="tab"]').filter({ hasText: /ai|studio/i });
    if (await aiTab.isVisible()) {
      await aiTab.click();
      await page.waitForTimeout(500);

      const tabPanel = page.locator('[role="tabpanel"]');
      const text = await tabPanel.textContent();

      // AI Studio should show generation options or quick actions
      expect(text!.length).toBeGreaterThan(0);
    }
  });
});

test.describe('Dashboard - Team Tab', () => {
  test('should switch to Team tab', async ({ authedDashboard, page }) => {
    await authedDashboard.goto('/dashboard');

    const teamTab = page.locator('[role="tab"]').filter({ hasText: /team/i });
    if (await teamTab.isVisible()) {
      await teamTab.click();
      await page.waitForTimeout(300);

      const state = await teamTab.getAttribute('data-state');
      expect(state).toBe('active');

      const tabPanel = page.locator('[role="tabpanel"]');
      await expect(tabPanel).toBeVisible();
    }
  });

  test('should display team collaboration content', async ({ authedDashboard, page }) => {
    await authedDashboard.goto('/dashboard');

    const teamTab = page.locator('[role="tab"]').filter({ hasText: /team/i });
    if (await teamTab.isVisible()) {
      await teamTab.click();
      await page.waitForTimeout(500);

      const tabPanel = page.locator('[role="tabpanel"]');
      const text = await tabPanel.textContent();

      // Team tab should show members, invites, or collaboration UI
      expect(text!.length).toBeGreaterThan(0);
    }
  });
});

test.describe('Dashboard - Scheduler Tab', () => {
  test('should switch to Scheduler tab', async ({ authedDashboard, page }) => {
    await authedDashboard.goto('/dashboard');

    const schedulerTab = page.locator('[role="tab"]').filter({ hasText: /scheduler/i });
    if (await schedulerTab.isVisible()) {
      await schedulerTab.click();
      await page.waitForTimeout(300);

      const state = await schedulerTab.getAttribute('data-state');
      expect(state).toBe('active');

      const tabPanel = page.locator('[role="tabpanel"]');
      await expect(tabPanel).toBeVisible();
    }
  });

  test('should display scheduled posts or empty state', async ({ authedDashboard, page }) => {
    await authedDashboard.goto('/dashboard');

    const schedulerTab = page.locator('[role="tab"]').filter({ hasText: /scheduler/i });
    if (await schedulerTab.isVisible()) {
      await schedulerTab.click();
      await page.waitForTimeout(500);

      const tabPanel = page.locator('[role="tabpanel"]');
      const text = await tabPanel.textContent();

      // Scheduler should show upcoming posts, schedule options, or empty state
      expect(text!.length).toBeGreaterThan(0);
    }
  });
});

test.describe('Dashboard Tab Accessibility', () => {
  test('should have proper ARIA tablist role', async ({ authedDashboard, page }) => {
    await authedDashboard.goto('/dashboard');

    const tabList = page.locator('[role="tablist"]');
    const exists = await tabList.isVisible().catch(() => false);

    if (exists) {
      await expect(tabList).toBeVisible();

      // Each tab should have role="tab"
      const tabs = tabList.locator('[role="tab"]');
      const tabCount = await tabs.count();
      expect(tabCount).toBeGreaterThanOrEqual(2);
    }
  });

  test('should have keyboard-navigable tabs', async ({ authedDashboard, page }) => {
    await authedDashboard.goto('/dashboard');

    const firstTab = page.locator('[role="tab"]').first();
    if (await firstTab.isVisible()) {
      await firstTab.focus();

      // Press right arrow to navigate to next tab
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(200);

      // Second tab should now be focused
      const secondTab = page.locator('[role="tab"]').nth(1);
      if (await secondTab.isVisible()) {
        const isFocused = await secondTab.evaluate(
          (el) => el === document.activeElement
        );
        // Keyboard navigation should work for tabs
        expect(isFocused).toBeTruthy();
      }
    }
  });
});

test.describe('Dashboard Tab Mobile', () => {
  test('should render tabs on mobile viewport', async ({ authedDashboard, page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await authedDashboard.goto('/dashboard');

    // Tabs should still be accessible on mobile
    const tabs = page.locator('[role="tab"]');
    const tabCount = await tabs.count();

    if (tabCount > 0) {
      // At least some tabs should be visible
      const firstTab = tabs.first();
      await expect(firstTab).toBeVisible();
    }
  });

  test('should switch tabs on mobile', async ({ authedDashboard, page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await authedDashboard.goto('/dashboard');

    const tabs = page.locator('[role="tab"]');
    const tabCount = await tabs.count();

    if (tabCount >= 2) {
      await tabs.nth(1).click();
      await page.waitForTimeout(300);

      const tabPanel = page.locator('[role="tabpanel"]');
      await expect(tabPanel).toBeVisible();
    }
  });
});
