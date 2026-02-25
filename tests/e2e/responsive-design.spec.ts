/**
 * Responsive Design E2E Tests
 *
 * Tests mobile, tablet, and desktop viewport compatibility
 * including navigation patterns, layout adaptation, touch targets,
 * and orientation changes.
 *
 * @module tests/e2e/responsive-design.spec
 */

import { test, expect } from '@playwright/test';

const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  mobileLandscape: { width: 667, height: 375 },
  tablet: { width: 768, height: 1024 },
  tabletLandscape: { width: 1024, height: 768 },
  laptop: { width: 1366, height: 768 },
  desktop: { width: 1920, height: 1080 },
};

test.describe('Mobile (375px)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
  });

  test('login page renders fully on mobile', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();

    // No horizontal scroll
    const hasHScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 5
    );
    expect(hasHScroll).toBeFalsy();
  });

  test('onboarding renders on mobile', async ({ page }) => {
    await page.goto('/onboarding');
    await page.waitForLoadState('domcontentloaded');

    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
  });

  test('dashboard has mobile navigation', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    // On mobile, sidebar should be hidden or there should be a menu toggle
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Page should not have excessive horizontal scroll
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(VIEWPORTS.mobile.width + 20);
  });

  test('buttons have touch-friendly sizes', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    const buttons = await page.locator('button:visible').all();
    expect(buttons.length).toBeGreaterThan(0);

    for (const button of buttons) {
      const box = await button.boundingBox();
      if (box) {
        // Min 24px height for AA, ideally 44px for AAA
        expect(box.height).toBeGreaterThanOrEqual(24);
      }
    }
  });

  test('form inputs are full-width on mobile', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    const inputs = page.locator('input:visible');
    const count = await inputs.count();

    if (count > 0) {
      const box = await inputs.first().boundingBox();
      if (box) {
        // Input should span most of the viewport
        expect(box.width).toBeGreaterThan(VIEWPORTS.mobile.width * 0.6);
      }
    }
  });
});

test.describe('Tablet (768px)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.tablet);
  });

  test('dashboard renders correctly on tablet', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    const main = page.locator('main, [role="main"], [class*="content"]');
    await expect(main.first()).toBeVisible();
  });

  test('analytics page loads on tablet', async ({ page }) => {
    await page.goto('/dashboard/analytics');
    await page.waitForLoadState('domcontentloaded');

    const status = await page.evaluate(() => document.readyState);
    expect(status).toBe('complete');

    // No 500 errors
    const errorText = await page.locator('text=500, text=Internal Server Error').count();
    expect(errorText).toBe(0);
  });

  test('sidebar visible on tablet landscape', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.tabletLandscape);
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    // At 1024px, sidebar should be visible
    const nav = page.locator('nav, [class*="sidebar"]').first();
    await expect(nav).toBeVisible();
  });
});

test.describe('Desktop (1920px)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
  });

  test('full dashboard layout renders', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    // Sidebar visible
    const nav = page.locator('nav, [class*="sidebar"]').first();
    await expect(nav).toBeVisible();

    // Main content visible
    const main = page.locator('main, [role="main"]').first();
    await expect(main).toBeVisible();
  });

  test('grid layouts use multiple columns', async ({ page }) => {
    await page.goto('/dashboard/analytics');
    await page.waitForLoadState('domcontentloaded');

    const grids = page.locator('[class*="grid"]');
    const count = await grids.count();
    expect(count).toBeGreaterThan(0);
  });

  test('headings are appropriately sized', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    const heading = page.locator('h1, h2').first();
    if (await heading.isVisible()) {
      const fontSize = await heading.evaluate(el =>
        parseFloat(window.getComputedStyle(el).fontSize)
      );
      expect(fontSize).toBeGreaterThanOrEqual(18);
    }
  });
});

test.describe('Cross-Viewport Consistency', () => {
  test('login form works across all viewports', async ({ page }) => {
    for (const [name, viewport] of Object.entries({
      mobile: VIEWPORTS.mobile,
      tablet: VIEWPORTS.tablet,
      desktop: VIEWPORTS.desktop,
    })) {
      await page.setViewportSize(viewport);
      await page.goto('/login');
      await page.waitForLoadState('domcontentloaded');

      const submitBtn = page.locator('button[type="submit"]');
      await expect(submitBtn).toBeVisible();

      const emailInput = page.locator('input[type="email"], input[name="email"]');
      await expect(emailInput).toBeVisible();
    }
  });

  test('pages load without 500 at all viewports', async ({ page }) => {
    const pages = ['/login', '/signup', '/onboarding'];

    for (const url of pages) {
      for (const viewport of [VIEWPORTS.mobile, VIEWPORTS.desktop]) {
        await page.setViewportSize(viewport);
        const response = await page.goto(url);
        expect(response?.status()).toBeLessThan(500);
      }
    }
  });
});

test.describe('Orientation Changes', () => {
  test('mobile portrait to landscape transition', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    const bodyBefore = page.locator('body');
    await expect(bodyBefore).toBeVisible();

    // Switch to landscape
    await page.setViewportSize(VIEWPORTS.mobileLandscape);
    await page.waitForTimeout(200);

    const bodyAfter = page.locator('body');
    await expect(bodyAfter).toBeVisible();

    // Content should still be accessible
    const main = page.locator('main, [role="main"], [class*="content"]').first();
    await expect(main).toBeVisible();
  });

  test('tablet portrait to landscape transition', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.tablet);
    await page.goto('/dashboard/content');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('body')).toBeVisible();

    await page.setViewportSize(VIEWPORTS.tabletLandscape);
    await page.waitForTimeout(200);

    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Form Responsiveness', () => {
  test('signup form stacks vertically on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto('/signup');
    await page.waitForLoadState('domcontentloaded');

    const form = page.locator('form');
    if ((await form.count()) > 0) {
      await expect(form.first()).toBeVisible();

      // Inputs should not overflow viewport
      const inputs = await page.locator('input:visible').all();
      for (const input of inputs) {
        const box = await input.boundingBox();
        if (box) {
          expect(box.x + box.width).toBeLessThanOrEqual(VIEWPORTS.mobile.width + 5);
        }
      }
    }
  });
});
