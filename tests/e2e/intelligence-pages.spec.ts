/**
 * Intelligence Pages E2E Tests
 *
 * Smoke-level coverage for AI/intelligence dashboard pages added in v5.0/v6.0:
 * - Forecasting (Prophet time-series + BayesNF spatiotemporal)
 * - GEO Optimiser
 * - Citation Tracking Dashboard
 * - Insights
 * - E-E-A-T Score Builder
 *
 * These tests verify pages render without 500 errors and display basic content.
 *
 * @module tests/e2e/intelligence-pages.spec
 */

import { test as base, expect, Page } from '@playwright/test';

// =============================================================================
// Auth + API mock helpers (mirroring dashboard.fixture.ts pattern)
// =============================================================================

const BASE_URL = process.env.BASE_URL || 'http://localhost:3002';

async function setIntelligenceAuth(page: Page) {
  await page.context().addCookies([
    { name: 'auth-token', value: 'test-e2e-token', url: BASE_URL },
  ]);

  // Core session / user mocks (prevent middleware redirect to /login)
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

  // Intelligence page-specific API mocks
  await page.route('**/api/forecasting**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ predictions: [], models: [], status: 'ready' }),
    })
  );

  await page.route('**/api/geo/**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [], optimisations: [] }),
    })
  );

  await page.route('**/api/geo**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [], optimisations: [] }),
    })
  );

  await page.route('**/api/citation**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ citations: [], total: 0 }),
    })
  );

  await page.route('**/api/insights**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ insights: [], recommendations: [] }),
    })
  );

  await page.route('**/api/eeat**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ score: 0, factors: [], recommendations: [] }),
    })
  );

  // Catch-all for any other API calls from these pages
  await page.route('**/api/analytics**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ metrics: [], data: [] }),
    })
  );
}

// =============================================================================
// Intelligence page definitions
// =============================================================================

const INTELLIGENCE_PAGES = [
  { path: '/dashboard/forecasting', name: 'Forecasting' },
  { path: '/dashboard/geo', name: 'GEO Optimiser' },
  { path: '/dashboard/citation', name: 'Citation Dashboard' },
  { path: '/dashboard/insights', name: 'Insights' },
  { path: '/dashboard/eeat', name: 'E-E-A-T Score' },
] as const;

// =============================================================================
// Tests
// =============================================================================

const test = base;

test.describe('Intelligence Pages — No 500 Errors', () => {
  for (const { path, name } of INTELLIGENCE_PAGES) {
    test(`${name} page should not return 500`, async ({ page }) => {
      await setIntelligenceAuth(page);

      const response = await page.goto(path, { waitUntil: 'domcontentloaded' });

      // Accept 200, 304 (cached), or redirects (3xx) — NOT 5xx
      const status = response?.status() ?? 200;
      expect(
        status,
        `${path} returned HTTP ${status}`
      ).toBeLessThan(500);
    });
  }
});

test.describe('Intelligence Pages — Main Content Visible', () => {
  for (const { path, name } of INTELLIGENCE_PAGES) {
    test(`${name} page should display main content`, async ({ page }) => {
      await setIntelligenceAuth(page);
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000); // React hydration

      // Main content area should be present
      const main = page.locator('main, [role="main"]').first();
      await expect(main).toBeVisible();

      // Page should NOT show a generic application error
      const crashText = page.locator(
        'text=Application error, text=Internal Server Error, text=500'
      );
      const hasCrash = await crashText.first().isVisible().catch(() => false);
      expect(hasCrash).toBeFalsy();
    });
  }
});

test.describe('Intelligence Pages — Heading Present', () => {
  for (const { path, name } of INTELLIGENCE_PAGES) {
    test(`${name} page should have a heading`, async ({ page }) => {
      await setIntelligenceAuth(page);
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000); // React hydration

      // Should have at least one heading (h1, h2, or h3)
      const headings = page.locator('h1, h2, h3');
      const count = await headings.count();
      expect(count).toBeGreaterThan(0);
    });
  }
});

// =============================================================================
// Forecasting-specific tests (Prophet + BayesNF — Phase 106/107)
// =============================================================================

test.describe('Forecasting Page', () => {
  test.beforeEach(async ({ page }) => {
    await setIntelligenceAuth(page);
    await page.goto('/dashboard/forecasting', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('should display forecast controls or model selector', async ({ page }) => {
    const main = page.locator('main, [role="main"]').first();
    await expect(main).toBeVisible();

    // Should have some form of model/forecast UI
    const controls = page.locator(
      'select, [role="combobox"], button:has-text("Forecast"), button:has-text("Prophet"), button:has-text("Run"), [data-model]'
    );
    const hasControls = (await controls.count()) > 0;

    // Or at minimum, has meaningful text content
    const mainText = await main.textContent();
    expect(hasControls || (mainText && mainText.length > 20)).toBeTruthy();
  });

  test('should not have uncaught React errors on forecasting page', async ({ page }) => {
    // Look for React error boundary messages
    const errorBoundary = page.locator(
      'text=Something went wrong, text=There was an error, h2:has-text("Error")'
    );
    const hasError = await errorBoundary.first().isVisible().catch(() => false);
    expect(hasError).toBeFalsy();
  });
});

// =============================================================================
// GEO Optimiser-specific tests (Phase 87)
// =============================================================================

test.describe('GEO Optimiser Page', () => {
  test.beforeEach(async ({ page }) => {
    await setIntelligenceAuth(page);
    await page.goto('/dashboard/geo', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('should display GEO content or empty state', async ({ page }) => {
    const main = page.locator('main, [role="main"]').first();
    await expect(main).toBeVisible();

    const mainText = await main.textContent();
    expect(mainText && mainText.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// Citation Dashboard-specific tests (Phase 99)
// =============================================================================

test.describe('Citation Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    await setIntelligenceAuth(page);
    await page.goto('/dashboard/citation', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('should display citation tracking UI or empty state', async ({ page }) => {
    const main = page.locator('main, [role="main"]').first();
    await expect(main).toBeVisible();

    // Should show citation data, empty state, or loading state
    const mainText = await main.textContent();
    expect(mainText && mainText.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// E-E-A-T Score Builder-specific tests (Phase 90)
// =============================================================================

test.describe('E-E-A-T Score Page', () => {
  test.beforeEach(async ({ page }) => {
    await setIntelligenceAuth(page);
    await page.goto('/dashboard/eeat', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('should display E-E-A-T score or setup prompt', async ({ page }) => {
    const main = page.locator('main, [role="main"]').first();
    await expect(main).toBeVisible();

    // Look for score display, setup wizard, or empty state
    const mainText = await main.textContent();
    expect(mainText && mainText.length).toBeGreaterThan(0);
  });
});
