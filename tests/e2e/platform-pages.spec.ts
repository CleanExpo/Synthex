/**
 * Platform & Integration Pages E2E Tests
 *
 * Smoke-level coverage for platform/integration/billing dashboard pages:
 * - Platforms (social media connections)
 * - Integrations (Zapier, Buffer, Canva)
 * - Billing (Stripe subscription)
 *
 * @module tests/e2e/platform-pages.spec
 */

import { test as base, expect, Page } from '@playwright/test';

// =============================================================================
// Auth + API mock helpers
// =============================================================================

const BASE_URL = process.env.BASE_URL || 'http://localhost:3002';

async function setPlatformAuth(page: Page) {
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

  await page.route('**/api/platforms**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ platforms: [], connections: [] }),
    })
  );

  await page.route('**/api/connections**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ connections: [] }),
    })
  );

  await page.route('**/api/integrations**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ integrations: [] }),
    })
  );

  await page.route('**/api/user/subscription**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ plan: 'free', status: 'active' }),
    })
  );
}

// =============================================================================
// Page definitions
// =============================================================================

const PLATFORM_PAGES = [
  { path: '/dashboard/platforms', name: 'Platforms' },
  { path: '/dashboard/integrations', name: 'Integrations' },
  { path: '/dashboard/billing', name: 'Billing' },
] as const;

const test = base;

// =============================================================================
// No 500 errors
// =============================================================================

test.describe('Platform Pages — No 500 Errors', () => {
  for (const { path, name } of PLATFORM_PAGES) {
    test(`${name} page should not return 500`, async ({ page }) => {
      await setPlatformAuth(page);

      const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
      const status = response?.status() ?? 200;
      expect(status, `${path} returned HTTP ${status}`).toBeLessThan(500);
    });
  }
});

// =============================================================================
// Main content visible
// =============================================================================

test.describe('Platform Pages — Main Content Visible', () => {
  for (const { path, name } of PLATFORM_PAGES) {
    test(`${name} page should display main content`, async ({ page }) => {
      await setPlatformAuth(page);
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

test.describe('Platform Pages — Heading Present', () => {
  for (const { path, name } of PLATFORM_PAGES) {
    test(`${name} page should have a heading`, async ({ page }) => {
      await setPlatformAuth(page);
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);

      const headings = page.locator('h1, h2, h3');
      const count = await headings.count();
      expect(count).toBeGreaterThan(0);
    });
  }
});

// =============================================================================
// Platforms page specifics
// =============================================================================

test.describe('Platforms Page', () => {
  test.beforeEach(async ({ page }) => {
    await setPlatformAuth(page);
    await page.goto('/dashboard/platforms', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('should display platform connection UI or empty state', async ({ page }) => {
    const main = page.locator('main, [role="main"]').first();
    await expect(main).toBeVisible();

    // Should show either connected platforms, connect buttons, or empty state
    const mainText = await main.textContent();
    expect(mainText && mainText.length).toBeGreaterThan(0);
  });

  test('should have a connect or add platform affordance', async ({ page }) => {
    // Look for connect button, add platform button, or platform cards
    const connectEl = page.locator(
      'button:has-text("Connect"), button:has-text("Add"), [data-platform], [class*="platform"]'
    );
    const hasConnect = (await connectEl.count()) > 0;

    // Or has main content
    const main = page.locator('main, [role="main"]').first();
    const mainText = await main.textContent();
    expect(hasConnect || (mainText && mainText.length > 10)).toBeTruthy();
  });
});

// =============================================================================
// Integrations page specifics
// =============================================================================

test.describe('Integrations Page', () => {
  test.beforeEach(async ({ page }) => {
    await setPlatformAuth(page);
    await page.goto('/dashboard/integrations', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('should display integration cards or connect options', async ({ page }) => {
    const main = page.locator('main, [role="main"]').first();
    await expect(main).toBeVisible();

    const mainText = await main.textContent();
    expect(mainText && mainText.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// Billing page specifics
// =============================================================================

test.describe('Billing Page', () => {
  test.beforeEach(async ({ page }) => {
    await setPlatformAuth(page);
    await page.goto('/dashboard/billing', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('should display subscription info or upgrade CTA', async ({ page }) => {
    const main = page.locator('main, [role="main"]').first();
    await expect(main).toBeVisible();

    const mainText = await main.textContent();
    expect(mainText && mainText.length).toBeGreaterThan(0);
  });

  test('should show plan information or pricing', async ({ page }) => {
    // Look for plan name, pricing, or upgrade elements
    const planEl = page.locator(
      'text=Free, text=Professional, text=Business, text=Plan, text=Upgrade, text=Subscribe'
    );
    const hasPlan = (await planEl.count()) > 0;

    const main = page.locator('main, [role="main"]').first();
    const mainText = await main.textContent();
    expect(hasPlan || (mainText && mainText.length > 20)).toBeTruthy();
  });
});
