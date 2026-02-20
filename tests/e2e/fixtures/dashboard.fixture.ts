/**
 * Dashboard E2E Test Fixtures
 *
 * Provides reusable test fixtures for dashboard testing.
 * Extends auth fixtures with dashboard-specific page objects.
 *
 * @module tests/e2e/fixtures/dashboard.fixture
 */

import { Page, BrowserContext } from '@playwright/test';
import { test as authTest, expect, createAuthenticatedContext } from './auth.fixture';

// =============================================================================
// Auth + Stats Mock Helpers
// =============================================================================

const BASE_URL = process.env.BASE_URL || 'http://localhost:3002';

/** Minimal stats API response matching the shape expected by app/dashboard/page.tsx */
const MOCK_STATS_RESPONSE = {
  stats: {
    totalPosts: 10,
    scheduledPosts: 2,
    avgEngagementRate: '2.5',
    totalFollowers: 5000,
    activeCampaigns: 1,
    totalEngagement: 0,
    totalImpressions: 0,
  },
  trendingTopics: ['#AI', '#Marketing', '#Growth'],
  recentActivity: [
    {
      platform: 'Twitter',
      action: 'Published post',
      time: new Date().toISOString(),
      engagement: 150,
    },
  ],
  engagementData: [],
  platformData: [],
};

/** Set auth cookie AND mock common APIs so pages render content */
async function setDashboardAuth(page: Page) {
  await page.context().addCookies([
    { name: 'auth-token', value: 'test-e2e-token', url: BASE_URL },
  ]);

  // Mock common API routes to prevent error states
  await page.route('**/api/campaigns**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ campaigns: [], total: 0 }),
    })
  );

  await page.route('**/api/posts**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ posts: [], total: 0 }),
    })
  );

  await page.route('**/api/analytics**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ metrics: [], engagementData: [], platformData: [] }),
    })
  );

  await page.route('**/api/content**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ content: [], total: 0 }),
    })
  );

  await page.route('**/api/schedule**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ posts: [], events: [] }),
    })
  );

  // Mock auth session so middleware doesn't redirect to login
  await page.route('**/api/auth/session**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: { id: '1', email: 'test@example.com', name: 'Test User' } }),
    })
  );

  // Mock user/profile API that dashboard pages may call
  await page.route('**/api/user**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: '1', email: 'test@example.com', name: 'Test User' }),
    })
  );
}

/** Set auth cookie AND mock core APIs so the full dashboard UI renders */
async function setupDashboardWithStats(page: Page) {
  await setDashboardAuth(page);

  // Mock stats API
  await page.route('**/api/dashboard/stats', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_STATS_RESPONSE),
    })
  );

  // Mock campaigns API
  await page.route('**/api/campaigns**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ campaigns: [], total: 0 }),
    })
  );

  // Mock posts API
  await page.route('**/api/posts**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ posts: [], total: 0 }),
    })
  );

  // Mock analytics API
  await page.route('**/api/analytics**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ metrics: [], engagementData: [], platformData: [] }),
    })
  );

  // Mock user/session API
  await page.route('**/api/auth/session**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: { id: '1', email: 'test@example.com', name: 'Test User' } }),
    })
  );
}

// =============================================================================
// Page Object Models
// =============================================================================

export class DashboardPage {
  constructor(private page: Page) {}

  // Navigation — target aside specifically (nav matches hidden mobile menu before aside in DOM)
  get sidebar() {
    return this.page.locator('aside, [data-sidebar]').first();
  }

  get sidebarLinks() {
    return this.sidebar.locator('a');
  }

  // Header
  get header() {
    return this.page.locator('header').first();
  }

  get userMenu() {
    return this.page.locator('[data-user-menu], .user-menu, button:has-text("Account")');
  }

  get notificationBell() {
    return this.page.locator('[aria-label*="notification"], [data-notifications]');
  }

  // Main content
  get mainContent() {
    return this.page.locator('main, [role="main"]').first();
  }

  get pageTitle() {
    return this.page.locator('h1').first();
  }

  // Common actions
  async goto(path: string = '/dashboard') {
    await this.page.goto(path);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async navigateTo(linkText: string) {
    const link = this.sidebar.locator(`a:has-text("${linkText}")`);
    if (await link.isVisible()) {
      await link.click();
      await this.page.waitForLoadState('domcontentloaded');
    }
  }

  async waitForContent() {
    await this.page.waitForSelector('main, [role="main"]', { timeout: 10000 });
  }
}

export class CampaignPage {
  constructor(private page: Page) {}

  get createButton() {
    return this.page.locator('button:has-text("Create"), button:has-text("New Campaign")');
  }

  get campaignList() {
    return this.page.locator('[data-campaigns], .campaign-list, table');
  }

  get campaignCards() {
    return this.page.locator('[data-campaign-card], .campaign-card');
  }

  get nameInput() {
    return this.page.locator('input[name="name"], input[placeholder*="name" i]');
  }

  get descriptionInput() {
    return this.page.locator('textarea[name="description"], textarea[placeholder*="description" i]');
  }

  get platformSelect() {
    return this.page.locator('select[name="platform"], [data-platform-select]');
  }

  get submitButton() {
    return this.page.locator('button[type="submit"]');
  }

  async goto() {
    // /dashboard/campaigns does not exist — /dashboard/schedule is the nearest equivalent
    await this.page.goto('/dashboard/schedule');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async createCampaign(data: { name: string; description?: string }) {
    await this.createButton.click();
    await this.page.waitForTimeout(500);

    await this.nameInput.fill(data.name);
    if (data.description && await this.descriptionInput.isVisible()) {
      await this.descriptionInput.fill(data.description);
    }

    await this.submitButton.click();
  }
}

export class PostPage {
  constructor(private page: Page) {}

  get createButton() {
    return this.page.locator('button:has-text("Create"), button:has-text("New Post")');
  }

  get postList() {
    return this.page.locator('[data-posts], .post-list, table');
  }

  get contentEditor() {
    return this.page.locator('[contenteditable="true"], textarea[name="content"]');
  }

  get scheduleDatePicker() {
    return this.page.locator('input[type="datetime-local"], [data-date-picker]');
  }

  get platformCheckboxes() {
    return this.page.locator('input[type="checkbox"][name*="platform"]');
  }

  get submitButton() {
    return this.page.locator('button[type="submit"]');
  }

  async goto() {
    await this.page.goto('/dashboard/content');
    await this.page.waitForLoadState('domcontentloaded');
  }
}

export class AnalyticsPage {
  constructor(private page: Page) {}

  get dateRangePicker() {
    return this.page.locator('[data-date-range], .date-range-picker');
  }

  get platformFilter() {
    return this.page.locator('select[name="platform"], [data-platform-filter]');
  }

  get charts() {
    return this.page.locator('[data-chart], .recharts-wrapper, canvas');
  }

  get metricCards() {
    return this.page.locator('[data-metric], .metric-card, .stat-card');
  }

  get exportButton() {
    return this.page.locator('button:has-text("Export"), button:has-text("Download")');
  }

  async goto() {
    await this.page.goto('/dashboard/analytics');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async selectDateRange(range: string) {
    if (await this.dateRangePicker.isVisible()) {
      await this.dateRangePicker.click();
      const rangeOption = this.page.locator(`text="${range}"`);
      if (await rangeOption.isVisible()) {
        await rangeOption.click();
      }
    }
  }
}

export class SettingsPage {
  constructor(private page: Page) {}

  get profileTab() {
    return this.page.locator('button:has-text("Profile"), a:has-text("Profile")');
  }

  get notificationsTab() {
    return this.page.locator('button:has-text("Notifications"), a:has-text("Notifications")');
  }

  get securityTab() {
    return this.page.locator('button:has-text("Security"), a:has-text("Security")');
  }

  get nameInput() {
    return this.page.locator('input[name="name"]');
  }

  get emailInput() {
    return this.page.locator('input[name="email"]');
  }

  get saveButton() {
    return this.page.locator('button[type="submit"], button:has-text("Save")');
  }

  get successMessage() {
    return this.page.locator('[role="status"], .toast-success, [data-success]');
  }

  async goto() {
    await this.page.goto('/dashboard/settings');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async updateProfile(data: { name?: string }) {
    if (data.name && await this.nameInput.isVisible()) {
      await this.nameInput.clear();
      await this.nameInput.fill(data.name);
    }
    await this.saveButton.click();
  }
}

// =============================================================================
// Extended Test Fixture
// =============================================================================

type DashboardFixtures = {
  dashboardPage: DashboardPage;
  campaignPage: CampaignPage;
  postPage: PostPage;
  analyticsPage: AnalyticsPage;
  settingsPage: SettingsPage;
  authedDashboard: DashboardPage;
};

export const test = authTest.extend<DashboardFixtures>({
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },

  campaignPage: async ({ page }, use) => {
    // Set auth cookie so /dashboard/schedule is accessible
    await setDashboardAuth(page);
    await use(new CampaignPage(page));
  },

  postPage: async ({ page }, use) => {
    // Set auth cookie so /dashboard/content is accessible
    await setDashboardAuth(page);
    await use(new PostPage(page));
  },

  analyticsPage: async ({ page }, use) => {
    // Set auth cookie so /dashboard/analytics is accessible
    await setDashboardAuth(page);
    await use(new AnalyticsPage(page));
  },

  settingsPage: async ({ page }, use) => {
    // Set auth cookie so /dashboard/settings is accessible
    await setDashboardAuth(page);
    await use(new SettingsPage(page));
  },

  authedDashboard: async ({ context, page }, use) => {
    await createAuthenticatedContext(context, page);
    // Mock the stats API so the dashboard renders in success state (not error state)
    await setupDashboardWithStats(page);
    const dashboard = new DashboardPage(page);
    await use(dashboard);
  },
});

export { expect };
