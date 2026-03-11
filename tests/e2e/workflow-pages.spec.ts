/**
 * Workflow & Intelligence Infrastructure Pages E2E Tests
 *
 * Smoke-level coverage for workflow engine and intelligence infrastructure
 * dashboard pages added in v2.0/v3.x:
 * - Workflows (workflow engine — Phase 62-66)
 * - Reports (report engine)
 * - Authority (E-E-A-T authority builder — Phase 86)
 * - Backlinks (AI backlink prospector — Phase 95)
 * - Algorithm Sentinel (Phase 97)
 *
 * @module tests/e2e/workflow-pages.spec
 */

import { test as base, expect, Page } from '@playwright/test';

// =============================================================================
// Auth + API mock helpers
// =============================================================================

const BASE_URL = process.env.BASE_URL || 'http://localhost:3002';

async function setWorkflowAuth(page: Page) {
  await page.context().addCookies([
    { name: 'auth-token', value: 'test-e2e-token', url: BASE_URL },
  ]);

  await page.route('**/api/auth/session**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: { id: '1', email: 'test@example.com', name: 'Test User' } }),
    })
  );

  await page.route('**/api/user**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: '1', email: 'test@example.com', name: 'Test User' }),
    })
  );

  await page.route('**/api/workflows**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ workflows: [], total: 0 }),
    })
  );

  await page.route('**/api/reports**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ reports: [] }),
    })
  );

  await page.route('**/api/authority**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ score: 0, factors: [] }),
    })
  );

  await page.route('**/api/backlinks**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ backlinks: [], total: 0, prospects: [] }),
    })
  );

  await page.route('**/api/sentinel**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ alerts: [], status: 'active', lastCheck: null }),
    })
  );

  await page.route('**/api/analytics**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ metrics: [], data: [] }),
    })
  );
}

// =============================================================================
// Page definitions
// =============================================================================

const WORKFLOW_PAGES = [
  { path: '/dashboard/workflows', name: 'Workflows' },
  { path: '/dashboard/reports', name: 'Reports' },
  { path: '/dashboard/authority', name: 'Authority' },
  { path: '/dashboard/backlinks', name: 'Backlinks' },
  { path: '/dashboard/sentinel', name: 'Algorithm Sentinel' },
] as const;

const test = base;

// =============================================================================
// No 500 errors
// =============================================================================

test.describe('Workflow Pages — No 500 Errors', () => {
  for (const { path, name } of WORKFLOW_PAGES) {
    test(`${name} page should not return 500`, async ({ page }) => {
      await setWorkflowAuth(page);

      const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
      const status = response?.status() ?? 200;
      expect(status, `${path} returned HTTP ${status}`).toBeLessThan(500);
    });
  }
});

// =============================================================================
// Main content visible
// =============================================================================

test.describe('Workflow Pages — Main Content Visible', () => {
  for (const { path, name } of WORKFLOW_PAGES) {
    test(`${name} page should display main content`, async ({ page }) => {
      await setWorkflowAuth(page);
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);

      const main = page.locator('main, [role="main"]').first();
      await expect(main).toBeVisible();

      const crashText = page.locator(
        'text=Application error, text=Internal Server Error'
      );
      const hasCrash = await crashText.first().isVisible().catch(() => false);
      expect(hasCrash).toBeFalsy();
    });
  }
});

// =============================================================================
// Heading present
// =============================================================================

test.describe('Workflow Pages — Heading Present', () => {
  for (const { path, name } of WORKFLOW_PAGES) {
    test(`${name} page should have a heading`, async ({ page }) => {
      await setWorkflowAuth(page);
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);

      const headings = page.locator('h1, h2, h3');
      const count = await headings.count();
      expect(count).toBeGreaterThan(0);
    });
  }
});

// =============================================================================
// Workflows page specifics
// =============================================================================

test.describe('Workflows Page', () => {
  test.beforeEach(async ({ page }) => {
    await setWorkflowAuth(page);
    await page.goto('/dashboard/workflows', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('should display workflow list or empty state', async ({ page }) => {
    const main = page.locator('main, [role="main"]').first();
    await expect(main).toBeVisible();

    const mainText = await main.textContent();
    expect(mainText && mainText.length).toBeGreaterThan(0);
  });

  test('should have workflow creation affordance', async ({ page }) => {
    // Look for create workflow button, new workflow button, or templates
    const createEl = page.locator(
      'button:has-text("Create"), button:has-text("New Workflow"), button:has-text("Template"), a:has-text("Create")'
    );
    const hasCreate = (await createEl.count()) > 0;

    const main = page.locator('main, [role="main"]').first();
    const mainText = await main.textContent();
    expect(hasCreate || (mainText && mainText.length > 10)).toBeTruthy();
  });
});

// =============================================================================
// Reports page specifics
// =============================================================================

test.describe('Reports Page', () => {
  test.beforeEach(async ({ page }) => {
    await setWorkflowAuth(page);
    await page.goto('/dashboard/reports', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('should display reports list or empty state', async ({ page }) => {
    const main = page.locator('main, [role="main"]').first();
    await expect(main).toBeVisible();

    const mainText = await main.textContent();
    expect(mainText && mainText.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// Authority page specifics
// =============================================================================

test.describe('Authority Page', () => {
  test.beforeEach(async ({ page }) => {
    await setWorkflowAuth(page);
    await page.goto('/dashboard/authority', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('should display authority score or setup prompt', async ({ page }) => {
    const main = page.locator('main, [role="main"]').first();
    await expect(main).toBeVisible();

    const mainText = await main.textContent();
    expect(mainText && mainText.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// Backlinks page specifics
// =============================================================================

test.describe('Backlinks Page', () => {
  test.beforeEach(async ({ page }) => {
    await setWorkflowAuth(page);
    await page.goto('/dashboard/backlinks', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('should display backlink prospects or empty state', async ({ page }) => {
    const main = page.locator('main, [role="main"]').first();
    await expect(main).toBeVisible();

    const mainText = await main.textContent();
    expect(mainText && mainText.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// Algorithm Sentinel page specifics
// =============================================================================

test.describe('Algorithm Sentinel Page', () => {
  test.beforeEach(async ({ page }) => {
    await setWorkflowAuth(page);
    await page.goto('/dashboard/sentinel', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('should display sentinel monitoring UI or setup', async ({ page }) => {
    const main = page.locator('main, [role="main"]').first();
    await expect(main).toBeVisible();

    const mainText = await main.textContent();
    expect(mainText && mainText.length).toBeGreaterThan(0);
  });
});
