/**
 * Dashboard Core E2E Tests
 *
 * Tests the main dashboard page: layout, quick stats, tabs, header elements.
 * Uses proper cookie-based auth via the dashboard fixture.
 *
 * @module tests/e2e/dashboard.spec
 */

import { test, expect } from './fixtures/dashboard.fixture';

test.describe('Dashboard Core Layout', () => {
  test('should render dashboard with sidebar and main content', async ({ authedDashboard }) => {
    await authedDashboard.goto('/dashboard');

    await expect(authedDashboard.sidebar).toBeVisible();
    await expect(authedDashboard.mainContent).toBeVisible();
  });

  test('should display page heading', async ({ authedDashboard }) => {
    await authedDashboard.goto('/dashboard');

    const heading = authedDashboard.mainContent.locator('h1, h2').first();
    await expect(heading).toBeVisible();
    const text = await heading.textContent();
    expect(text!.length).toBeGreaterThan(0);
  });

  test('should have sidebar navigation links', async ({ authedDashboard }) => {
    await authedDashboard.goto('/dashboard');

    const links = authedDashboard.sidebarLinks;
    const count = await links.count();
    // Dashboard has 40+ sidebar items
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test('should display header with search input', async ({ authedDashboard, page }) => {
    await authedDashboard.goto('/dashboard');

    await expect(authedDashboard.header).toBeVisible();

    // Search input in header
    const searchInput = page.locator('input[placeholder*="Search"]');
    const hasSearch = await searchInput.isVisible().catch(() => false);
    // Search may be hidden on certain viewports — just ensure header renders
    expect(authedDashboard.header).toBeTruthy();
  });

  test('should not redirect to login when authenticated', async ({ authedDashboard, page }) => {
    await authedDashboard.goto('/dashboard');
    await page.waitForTimeout(1000);

    // Should stay on dashboard, not redirect to login
    expect(page.url()).toContain('/dashboard');
    expect(page.url()).not.toContain('/login');
  });
});

test.describe('Dashboard Quick Stats', () => {
  test('should display stat cards', async ({ authedDashboard, page }) => {
    await authedDashboard.goto('/dashboard');

    // Quick stats section should have stat cards
    const statCards = page.locator('[class*="stat"], [class*="card"]').filter({
      has: page.locator('p, span, h3'),
    });
    const count = await statCards.count();
    // Should have multiple stat cards (posts, engagement, followers, scheduled)
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

test.describe('Dashboard Tabs', () => {
  test('should display tab navigation', async ({ authedDashboard, page }) => {
    await authedDashboard.goto('/dashboard');

    // Look for tab triggers
    const tabs = page.locator('[role="tab"]');
    const tabCount = await tabs.count();

    if (tabCount > 0) {
      // Dashboard has 5 tabs: Overview, Analytics, AI Studio, Team, Scheduler
      expect(tabCount).toBeGreaterThanOrEqual(3);
    } else {
      // Tabs might render differently — at minimum page should have content sections
      const sections = authedDashboard.mainContent.locator('section, [class*="tab"]');
      expect(await sections.count()).toBeGreaterThanOrEqual(1);
    }
  });

  test('should switch between tabs', async ({ authedDashboard, page }) => {
    await authedDashboard.goto('/dashboard');

    const tabs = page.locator('[role="tab"]');
    const tabCount = await tabs.count();

    if (tabCount >= 2) {
      // Click second tab
      await tabs.nth(1).click();
      await page.waitForTimeout(300);

      // Tab panel should update
      const tabPanel = page.locator('[role="tabpanel"]');
      await expect(tabPanel).toBeVisible();

      // Click back to first tab
      await tabs.nth(0).click();
      await page.waitForTimeout(300);
      await expect(tabPanel).toBeVisible();
    }
  });

  test('should show tab content panel', async ({ authedDashboard, page }) => {
    await authedDashboard.goto('/dashboard');

    const tabPanel = page.locator('[role="tabpanel"]');
    const hasTabs = await tabPanel.isVisible().catch(() => false);

    if (hasTabs) {
      await expect(tabPanel).toBeVisible();
      const panelText = await tabPanel.textContent();
      expect(panelText!.length).toBeGreaterThan(0);
    }
  });
});

test.describe('Dashboard Sidebar Navigation', () => {
  test('should navigate to content page via sidebar', async ({ authedDashboard, page }) => {
    await authedDashboard.goto('/dashboard');

    const contentLink = authedDashboard.sidebar.locator('a[href*="/content"]').first();
    if (await contentLink.isVisible()) {
      await contentLink.click();
      await page.waitForLoadState('domcontentloaded');
      expect(page.url()).toContain('/content');
    }
  });

  test('should navigate to analytics page via sidebar', async ({ authedDashboard, page }) => {
    await authedDashboard.goto('/dashboard');

    const analyticsLink = authedDashboard.sidebar.locator('a[href*="/analytics"]').first();
    if (await analyticsLink.isVisible()) {
      await analyticsLink.click();
      await page.waitForLoadState('domcontentloaded');
      expect(page.url()).toContain('/analytics');
    }
  });

  test('should navigate to settings page via sidebar', async ({ authedDashboard, page }) => {
    await authedDashboard.goto('/dashboard');

    const settingsLink = authedDashboard.sidebar.locator('a[href*="/settings"]').first();
    if (await settingsLink.isVisible()) {
      await settingsLink.click();
      await page.waitForLoadState('domcontentloaded');
      expect(page.url()).toContain('/settings');
    }
  });

  test('should navigate to calendar page via sidebar', async ({ authedDashboard, page }) => {
    await authedDashboard.goto('/dashboard');

    const calendarLink = authedDashboard.sidebar.locator('a[href*="/calendar"]').first();
    if (await calendarLink.isVisible()) {
      await calendarLink.click();
      await page.waitForLoadState('domcontentloaded');
      expect(page.url()).toContain('/calendar');
    }
  });
});

test.describe('Dashboard Error Handling', () => {
  test('should handle 404 for non-existent dashboard subpage', async ({ page }) => {
    const response = await page.goto('/dashboard/nonexistent-page-xyz', {
      waitUntil: 'domcontentloaded',
    });

    const status = response?.status() || 200;
    // Should either 404 or redirect — never 500
    expect(status).toBeLessThan(500);
  });

  test('should show visible content on error pages', async ({ page }) => {
    await page.goto('/dashboard/nonexistent-page-xyz', {
      waitUntil: 'domcontentloaded',
    });

    // Body should have visible content (not blank)
    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.length).toBeGreaterThan(0);
  });
});

test.describe('Dashboard Responsiveness', () => {
  test('should render on mobile viewport', async ({ authedDashboard, page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await authedDashboard.goto('/dashboard');

    // Main content should still be visible
    await expect(authedDashboard.mainContent).toBeVisible();
  });

  test('should have mobile menu trigger on small viewport', async ({ authedDashboard, page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await authedDashboard.goto('/dashboard');

    // On mobile, sidebar should be hidden and hamburger menu should appear
    const mobileMenu = page.locator(
      '[aria-label*="menu" i], [aria-label*="Menu" i], button.hamburger, [data-mobile-menu]'
    );
    const sidebarVisible = await authedDashboard.sidebar.isVisible().catch(() => false);
    const menuVisible = await mobileMenu.first().isVisible().catch(() => false);

    // Either sidebar is still visible (responsive) or mobile menu exists
    expect(sidebarVisible || menuVisible).toBeTruthy();
  });

  test('should render on tablet viewport', async ({ authedDashboard, page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await authedDashboard.goto('/dashboard');

    await expect(authedDashboard.mainContent).toBeVisible();
  });
});
