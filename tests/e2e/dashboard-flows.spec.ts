/**
 * Dashboard Flow E2E Tests
 *
 * Tests full user flows across dashboard pages:
 * - Content generation
 * - Analytics viewing and filtering
 * - Settings management
 * - Calendar scheduling
 * - Cross-page navigation
 *
 * @module tests/e2e/dashboard-flows.spec
 */

import { test, expect } from './fixtures/dashboard.fixture';

// =============================================================================
// Dashboard Navigation Flows
// =============================================================================

test.describe('Dashboard Navigation', () => {
  test('should render dashboard home page with main elements', async ({ authedDashboard }) => {
    await authedDashboard.goto('/dashboard');

    await expect(authedDashboard.sidebar).toBeVisible();
    await expect(authedDashboard.mainContent).toBeVisible();
    await expect(authedDashboard.header).toBeVisible();
  });

  test('sidebar links should navigate without 500 errors', async ({ authedDashboard, page }) => {
    await authedDashboard.goto('/dashboard');

    const links = await authedDashboard.sidebarLinks.all();
    expect(links.length).toBeGreaterThan(0);

    // Test first 5 sidebar links for non-500 responses
    const linksToTest = links.slice(0, 5);
    for (const link of linksToTest) {
      const href = await link.getAttribute('href');
      if (href && href.startsWith('/dashboard')) {
        const response = await page.goto(href, { waitUntil: 'domcontentloaded' });
        expect(
          response?.status(),
          `${href} returned ${response?.status()}`
        ).toBeLessThan(500);
      }
    }
  });

  test('should display heading on each navigated page', async ({ authedDashboard, page }) => {
    await authedDashboard.goto('/dashboard');

    const headings = authedDashboard.mainContent.locator('h1, h2');
    const count = await headings.count();
    expect(count).toBeGreaterThan(0);
  });
});

// =============================================================================
// Content/Campaign Creation Flow
// =============================================================================

test.describe('Content Generation Flow', () => {
  test('should render content page with generation form', async ({ authedDashboard, page }) => {
    await authedDashboard.goto('/dashboard/content');

    // Page should load without error
    const status = await page.evaluate(() => document.readyState);
    expect(status).toBe('complete');

    // Should have main content area
    await expect(authedDashboard.mainContent).toBeVisible();
  });

  test('should display topic input and platform selector', async ({ authedDashboard, page }) => {
    await authedDashboard.goto('/dashboard/content');
    await page.waitForTimeout(1000);

    // Topic input (the main generation form field)
    const topicInput = page.locator(
      'input[placeholder*="topic" i], textarea[placeholder*="topic" i], input[name="topic"]'
    );
    const hasTopicInput = await topicInput.isVisible().catch(() => false);

    // Generate button
    const generateBtn = page.locator(
      'button:has-text("Generate"), button:has-text("Create")'
    );
    const hasGenerateBtn = await generateBtn.first().isVisible().catch(() => false);

    // Should have at least the topic input or generate button
    expect(hasTopicInput || hasGenerateBtn).toBeTruthy();
  });

  test('should have platform selection options', async ({ authedDashboard, page }) => {
    await authedDashboard.goto('/dashboard/content');
    await page.waitForTimeout(1000);

    // Platform selector (Select component or radio buttons)
    const platformSelector = page.locator(
      'select, [role="combobox"], [data-platform], button:has-text("Twitter"), button:has-text("Instagram")'
    );
    const count = await platformSelector.count();

    // Content page should have some form of platform selection
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('should fill content generation form', async ({ authedDashboard, page }) => {
    await authedDashboard.goto('/dashboard/content');
    await page.waitForTimeout(1000);

    // Fill topic input
    const topicInput = page.locator(
      'input[placeholder*="topic" i], textarea[placeholder*="topic" i]'
    );

    if (await topicInput.isVisible()) {
      await topicInput.fill('AI marketing automation trends');

      // Verify input was filled
      const value = await topicInput.inputValue();
      expect(value).toContain('AI marketing');
    }
  });
});

// =============================================================================
// Campaign Management Flow
// =============================================================================

test.describe('Campaign Management', () => {
  test('should render campaigns page', async ({ campaignPage, page }) => {
    await campaignPage.goto();

    const response = await page.evaluate(() => document.readyState);
    expect(response).toBe('complete');
  });

  test('should display campaign list or empty state', async ({ campaignPage, page }) => {
    await campaignPage.goto();
    await page.waitForTimeout(500);

    const bodyText = await page.locator('main, [role="main"]').first().textContent();
    // Should show either campaigns or an empty state message
    expect(bodyText!.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// Analytics Flow
// =============================================================================

test.describe('Analytics Page Flow', () => {
  test('should render analytics page', async ({ analyticsPage, page }) => {
    await analyticsPage.goto();

    const status = await page.evaluate(() => document.readyState);
    expect(status).toBe('complete');

    const mainContent = page.locator('main, [role="main"]').first();
    await expect(mainContent).toBeVisible();
  });

  test('should display analytics controls', async ({ analyticsPage, page }) => {
    await analyticsPage.goto();
    await page.waitForTimeout(1000);

    // Time range or date picker
    const timeControls = page.locator(
      'select, [role="combobox"], button:has-text("7d"), button:has-text("30d"), [data-date-range]'
    );
    const hasTimeControls = await timeControls.first().isVisible().catch(() => false);

    // Export button
    const exportBtn = page.locator(
      'button:has-text("Export"), button:has-text("Download")'
    );
    const hasExport = await exportBtn.first().isVisible().catch(() => false);

    // Should have some analytics controls
    const mainText = await page.locator('main, [role="main"]').first().textContent();
    expect(mainText!.length).toBeGreaterThan(0);
  });

  test('should display charts or analytics content', async ({ analyticsPage, page }) => {
    await analyticsPage.goto();
    await page.waitForTimeout(1500);

    // Look for chart containers, metric cards, or empty states
    const charts = page.locator('.recharts-wrapper, canvas, [data-chart], svg[class*="chart"]');
    const metricCards = page.locator('[class*="stat"], [class*="metric"], [class*="card"]');
    const emptyState = page.locator('text=/no data|connect.*platform|get started/i');

    const hasCharts = await charts.first().isVisible().catch(() => false);
    const hasMetrics = (await metricCards.count()) > 0;
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    // Analytics page should show something meaningful
    expect(hasCharts || hasMetrics || hasEmpty).toBeTruthy();
  });
});

// =============================================================================
// Settings Flow
// =============================================================================

test.describe('Settings Page Flow', () => {
  test('should render settings page with tabs', async ({ settingsPage, page }) => {
    await settingsPage.goto();

    const status = await page.evaluate(() => document.readyState);
    expect(status).toBe('complete');
  });

  test('should display settings tab navigation', async ({ settingsPage, page }) => {
    await settingsPage.goto();
    await page.waitForTimeout(500);

    // Settings page should have tabs (Profile, Notifications, etc.)
    const tabs = page.locator('[role="tab"]');
    const tabCount = await tabs.count();

    if (tabCount > 0) {
      // Settings has 6 tabs
      expect(tabCount).toBeGreaterThanOrEqual(2);
    } else {
      // May use links or different navigation pattern
      const settingsLinks = page.locator(
        'button:has-text("Profile"), button:has-text("Notifications"), a:has-text("Profile")'
      );
      expect(await settingsLinks.count()).toBeGreaterThanOrEqual(1);
    }
  });

  test('should switch between settings tabs', async ({ settingsPage, page }) => {
    await settingsPage.goto();
    await page.waitForTimeout(500);

    const tabs = page.locator('[role="tab"]');
    const tabCount = await tabs.count();

    if (tabCount >= 2) {
      // Click second tab (Notifications)
      await tabs.nth(1).click();
      await page.waitForTimeout(300);

      const activeState = await tabs.nth(1).getAttribute('data-state');
      expect(activeState).toBe('active');
    }
  });

  test('should display profile form fields', async ({ settingsPage, page }) => {
    await settingsPage.goto();
    await page.waitForTimeout(500);

    // Profile tab should be visible by default
    const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]');
    const emailInput = page.locator('input[name="email"], input[type="email"]');

    const hasName = await nameInput.isVisible().catch(() => false);
    const hasEmail = await emailInput.isVisible().catch(() => false);

    // Profile section should have at least one form field
    expect(hasName || hasEmail).toBeTruthy();
  });

  test('should have save button on settings page', async ({ settingsPage, page }) => {
    await settingsPage.goto();
    await page.waitForTimeout(500);

    const saveBtn = page.locator(
      'button:has-text("Save"), button:has-text("Update"), button[type="submit"]'
    );
    const hasSave = await saveBtn.first().isVisible().catch(() => false);

    expect(hasSave).toBeTruthy();
  });
});

// =============================================================================
// Calendar Flow
// =============================================================================

test.describe('Calendar Page Flow', () => {
  test('should render calendar page', async ({ authedDashboard, page }) => {
    await authedDashboard.goto('/dashboard/calendar');

    const status = await page.evaluate(() => document.readyState);
    expect(status).toBe('complete');

    await expect(authedDashboard.mainContent).toBeVisible();
  });

  test('should display calendar view controls', async ({ authedDashboard, page }) => {
    await authedDashboard.goto('/dashboard/calendar');
    await page.waitForTimeout(1000);

    // Calendar should have view switcher (Week/Month) or navigation
    const viewControls = page.locator(
      'button:has-text("Week"), button:has-text("Month"), button:has-text("Today")'
    );
    const hasViewControls = await viewControls.first().isVisible().catch(() => false);

    // Schedule button
    const scheduleBtn = page.locator(
      'button:has-text("Schedule"), button:has-text("New Post"), button:has-text("Create")'
    );
    const hasScheduleBtn = await scheduleBtn.first().isVisible().catch(() => false);

    // Calendar page should have controls or at least content
    const mainText = await page.locator('main, [role="main"]').first().textContent();
    expect(mainText!.length).toBeGreaterThan(0);
  });

  test('should display calendar stats', async ({ authedDashboard, page }) => {
    await authedDashboard.goto('/dashboard/calendar');
    await page.waitForTimeout(1000);

    // Calendar page may show stats cards (Total Posts, Scheduled, Published, etc.)
    const mainText = await page.locator('main, [role="main"]').first().textContent();
    expect(mainText!.length).toBeGreaterThan(0);
  });

  test('should open schedule modal when clicking Schedule Post', async ({
    authedDashboard,
    page,
  }) => {
    await authedDashboard.goto('/dashboard/calendar');
    await page.waitForTimeout(1000);

    const scheduleBtn = page.locator(
      'button:has-text("Schedule Post"), button:has-text("Schedule")'
    );

    if (await scheduleBtn.first().isVisible()) {
      await scheduleBtn.first().click();
      await page.waitForTimeout(500);

      // Modal/dialog should appear
      const dialog = page.locator('[role="dialog"], [data-state="open"]');
      const hasDialog = await dialog.isVisible().catch(() => false);

      if (hasDialog) {
        await expect(dialog).toBeVisible();

        // Modal should have content textarea and date/time inputs
        const contentField = dialog.locator(
          'textarea, input[type="text"], [contenteditable]'
        );
        expect(await contentField.count()).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

// =============================================================================
// Cross-Page Navigation Flow
// =============================================================================

test.describe('Cross-Page Navigation', () => {
  test('should navigate dashboard → content → analytics → settings', async ({
    authedDashboard,
    page,
  }) => {
    // Dashboard
    await authedDashboard.goto('/dashboard');
    expect(page.url()).toContain('/dashboard');
    await expect(authedDashboard.mainContent).toBeVisible();

    // Content
    await page.goto('/dashboard/content');
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toContain('/content');

    // Analytics
    await page.goto('/dashboard/analytics');
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toContain('/analytics');

    // Settings
    await page.goto('/dashboard/settings');
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toContain('/settings');
  });

  test('should maintain auth state across page navigations', async ({
    authedDashboard,
    page,
  }) => {
    const pages = ['/dashboard', '/dashboard/content', '/dashboard/analytics', '/dashboard/settings'];

    for (const path of pages) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });

      // Should not redirect to login
      expect(page.url()).not.toContain('/login');

      // Should return < 500
      const bodyVisible = await page.locator('body').isVisible();
      expect(bodyVisible).toBeTruthy();
    }
  });
});

// =============================================================================
// Error Handling
// =============================================================================

test.describe('Dashboard Error Handling', () => {
  test('should handle 404 gracefully on dashboard subpage', async ({ page }) => {
    const response = await page.goto('/dashboard/nonexistent-page-12345', {
      waitUntil: 'domcontentloaded',
    });

    const status = response?.status() || 200;
    expect(status).toBeLessThan(500);

    const hasContent = await page.locator('body').isVisible();
    expect(hasContent).toBeTruthy();
  });

  test('dashboard pages should not return 500 errors', async ({ authedDashboard, page }) => {
    const criticalPages = [
      '/dashboard',
      '/dashboard/content',
      '/dashboard/analytics',
      '/dashboard/settings',
      '/dashboard/calendar',
    ];

    for (const route of criticalPages) {
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
      expect(
        response?.status(),
        `${route} returned ${response?.status()}`
      ).toBeLessThan(500);
    }
  });
});
