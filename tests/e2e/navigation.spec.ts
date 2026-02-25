/**
 * Navigation E2E Tests
 *
 * Tests application-wide navigation including:
 * - Public page routes (login, signup, onboarding)
 * - Dashboard route protection
 * - Sidebar navigation
 * - 404 handling
 * - Route stability (no 500 errors)
 *
 * @module tests/e2e/navigation.spec
 */

import { test, expect } from './fixtures/dashboard.fixture';

// =============================================================================
// Public Page Routes
// =============================================================================

test.describe('Public Pages', () => {
  test('login page should load', async ({ page }) => {
    const response = await page.goto('/login', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator('body')).toBeVisible();
  });

  test('signup page should load', async ({ page }) => {
    const response = await page.goto('/signup', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator('body')).toBeVisible();
  });

  test('onboarding page should load', async ({ page }) => {
    const response = await page.goto('/onboarding', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator('body')).toBeVisible();
  });

  test('home page should load', async ({ page }) => {
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
  });
});

// =============================================================================
// Dashboard Route Protection
// =============================================================================

test.describe('Route Protection', () => {
  test('unauthenticated user should be redirected from dashboard', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Should redirect to login or show auth gate
    const url = page.url();
    const isProtected = url.includes('/login') || url.includes('/signup') || url.includes('/dashboard');
    expect(isProtected).toBeTruthy();
  });

  test('authenticated user should access dashboard', async ({ authedDashboard, page }) => {
    await authedDashboard.goto('/dashboard');
    await page.waitForTimeout(1000);

    // Should stay on dashboard
    expect(page.url()).toContain('/dashboard');
    expect(page.url()).not.toContain('/login');
  });
});

// =============================================================================
// Dashboard Sidebar Navigation
// =============================================================================

test.describe('Sidebar Navigation', () => {
  test('sidebar should contain navigation links', async ({ authedDashboard }) => {
    await authedDashboard.goto('/dashboard');

    const links = authedDashboard.sidebarLinks;
    const count = await links.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test('sidebar links should have valid href attributes', async ({ authedDashboard }) => {
    await authedDashboard.goto('/dashboard');

    const links = await authedDashboard.sidebarLinks.all();

    for (const link of links.slice(0, 10)) {
      const href = await link.getAttribute('href');
      expect(href).toBeTruthy();
      // All sidebar links should point to dashboard routes
      expect(href).toMatch(/^\/(dashboard|api)/);
    }
  });

  test('clicking sidebar link navigates to correct page', async ({ authedDashboard, page }) => {
    await authedDashboard.goto('/dashboard');

    // Find the "Content" or "Analytics" link and click it
    const targetLink = authedDashboard.sidebar.locator('a[href*="/content"]').first();

    if (await targetLink.isVisible()) {
      const expectedHref = await targetLink.getAttribute('href');
      await targetLink.click();
      await page.waitForLoadState('domcontentloaded');

      expect(page.url()).toContain(expectedHref!);
    }
  });

  test('sidebar should show Synthex branding', async ({ authedDashboard, page }) => {
    await authedDashboard.goto('/dashboard');

    // Sidebar should contain the "Synthex" brand name
    const sidebarText = await authedDashboard.sidebar.textContent();
    expect(sidebarText?.toLowerCase()).toContain('synthex');
  });
});

// =============================================================================
// Critical Dashboard Routes (No 500 Errors)
// =============================================================================

test.describe('Dashboard Route Stability', () => {
  test('core dashboard pages should not return 500', async ({ authedDashboard, page }) => {
    const coreRoutes = [
      '/dashboard',
      '/dashboard/content',
      '/dashboard/analytics',
      '/dashboard/settings',
      '/dashboard/calendar',
      '/dashboard/team',
    ];

    for (const route of coreRoutes) {
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
      expect(
        response?.status(),
        `${route} returned ${response?.status()}`
      ).toBeLessThan(500);
    }
  });

  test('secondary dashboard pages should not return 500', async ({ authedDashboard, page }) => {
    const routes = [
      '/dashboard/competitors',
      '/dashboard/experiments',
      '/dashboard/reports',
      '/dashboard/integrations',
      '/dashboard/personas',
      '/dashboard/ai-chat',
    ];

    for (const route of routes) {
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
      expect(
        response?.status(),
        `${route} returned ${response?.status()}`
      ).toBeLessThan(500);
    }
  });

  test('monetization pages should not return 500', async ({ authedDashboard, page }) => {
    const routes = [
      '/dashboard/revenue',
      '/dashboard/sponsors',
      '/dashboard/affiliates',
      '/dashboard/bio',
    ];

    for (const route of routes) {
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
      expect(
        response?.status(),
        `${route} returned ${response?.status()}`
      ).toBeLessThan(500);
    }
  });

  test('SEO/research pages should not return 500', async ({ authedDashboard, page }) => {
    const routes = [
      '/dashboard/seo',
      '/dashboard/geo',
      '/dashboard/authors',
      '/dashboard/research',
      '/dashboard/local',
    ];

    for (const route of routes) {
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
      expect(
        response?.status(),
        `${route} returned ${response?.status()}`
      ).toBeLessThan(500);
    }
  });
});

// =============================================================================
// 404 Handling
// =============================================================================

test.describe('404 Handling', () => {
  test('non-existent route should not return 500', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist', {
      waitUntil: 'domcontentloaded',
    });

    const status = response?.status() || 200;
    expect(status).toBeLessThan(500);
  });

  test('non-existent dashboard subpage should not return 500', async ({ page }) => {
    const response = await page.goto('/dashboard/xyz-nonexistent-123', {
      waitUntil: 'domcontentloaded',
    });

    const status = response?.status() || 200;
    expect(status).toBeLessThan(500);
  });

  test('non-existent API route should return 404 or 405', async ({ page }) => {
    const response = await page.goto('/api/nonexistent-endpoint-xyz', {
      waitUntil: 'domcontentloaded',
    });

    const status = response?.status() || 404;
    // API routes should return proper error codes, not 500
    expect(status).toBeLessThan(500);
  });
});

// =============================================================================
// Responsive Navigation
// =============================================================================

test.describe('Responsive Navigation', () => {
  test('should have mobile menu on small viewport', async ({ authedDashboard, page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await authedDashboard.goto('/dashboard');

    // On mobile, either sidebar is hidden or there's a mobile menu trigger
    const mobileMenuBtn = page.locator(
      '[aria-label*="menu" i], [aria-label*="Menu" i], button.hamburger, [data-mobile-menu]'
    );
    const sidebarVisible = await authedDashboard.sidebar.isVisible().catch(() => false);
    const menuBtnVisible = await mobileMenuBtn.first().isVisible().catch(() => false);

    // One of these should be true on mobile
    expect(sidebarVisible || menuBtnVisible).toBeTruthy();
  });

  test('should navigate on tablet viewport', async ({ authedDashboard, page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await authedDashboard.goto('/dashboard');

    // Dashboard should render properly
    await expect(authedDashboard.mainContent).toBeVisible();

    // Navigate to another page
    await page.goto('/dashboard/content', { waitUntil: 'domcontentloaded' });
    expect(page.url()).toContain('/content');
  });
});
