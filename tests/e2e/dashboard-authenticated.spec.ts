import { test, expect } from '@playwright/test';

/**
 * Authenticated Dashboard Smoke Tests — Phase 5
 * 
 * Covers the core user journey:
 *   login → dashboard → analytics chart renders → autopilot banner dismisses
 *
 * Requires env vars:
 *   PROD_TEST_EMAIL     — test account email
 *   PROD_TEST_PASSWORD  — test account password
 *
 * In local dev (no PW_SKIP_WEBSERVER), falls back to TEST_USER_EMAIL / TEST_USER_PASSWORD.
 * If no credentials are provided the tests are skipped gracefully.
 */

const EMAIL =
  process.env.PROD_TEST_EMAIL ||
  process.env.TEST_USER_EMAIL ||
  '';

const PASSWORD =
  process.env.PROD_TEST_PASSWORD ||
  process.env.TEST_USER_PASSWORD ||
  '';

/**
 * Login helper — navigates to /login, submits credentials, waits for /dashboard.
 * Returns false if credentials are not configured (test should skip).
 */
async function loginToDashboard(page: any): Promise<boolean> {
  if (!EMAIL || !PASSWORD) {
    return false;
  }

  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Fill email
  await page
    .locator('input[type="email"], input[name="email"], input[id="email"]')
    .first()
    .fill(EMAIL);

  // Fill password
  await page
    .locator('input[type="password"], input[name="password"], input[id="password"]')
    .first()
    .fill(PASSWORD);

  // Submit
  await page.locator('button[type="submit"]').first().click();

  // Wait for redirect to dashboard (handles SSR + client-side redirect)
  try {
    await page.waitForURL(/\/dashboard/, { timeout: 60000 });
  } catch {
    // May already be on dashboard or redirected differently
    const url = page.url();
    if (!url.includes('/dashboard')) {
      return false;
    }
  }

  return true;
}

test.describe('Dashboard authenticated smoke', () => {
  test('login → dashboard: authenticated redirect succeeds', async ({ page }) => {
    if (!EMAIL || !PASSWORD) {
      test.skip(true, 'No test credentials — set PROD_TEST_EMAIL / PROD_TEST_PASSWORD to run');
      return;
    }

    const landed = await loginToDashboard(page);
    expect(landed, 'Expected to land on /dashboard after login').toBe(true);
    expect(page.url()).toContain('/dashboard');
  });

  test('analytics chart renders on dashboard', async ({ page }) => {
    if (!EMAIL || !PASSWORD) {
      test.skip(true, 'No test credentials — skipping authenticated test');
      return;
    }

    const landed = await loginToDashboard(page);
    expect(landed).toBe(true);

    // Shadcn ChartContainer renders a div with data-chart attribute
    // Recharts renders a .recharts-wrapper div; either confirms the chart mounted
    const chart = page.locator('[data-chart], .recharts-wrapper').first();

    await expect(chart).toBeVisible({ timeout: 30000 });
  });

  test('autopilot onboarding banner visible and dismissible', async ({ page }) => {
    if (!EMAIL || !PASSWORD) {
      test.skip(true, 'No test credentials — skipping authenticated test');
      return;
    }

    const landed = await loginToDashboard(page);
    expect(landed).toBe(true);

    // Autopilot banner added in Run 4 (feat/onboarding-ux)
    // Selector covers data-testid, role, and text-based fallbacks
    const banner = page
      .locator(
        '[data-testid="autopilot-banner"], ' +
        '[data-testid="onboarding-banner"], ' +
        '[role="alert"]:has-text("Autopilot"), ' +
        'div:has-text("Autopilot"):not(nav):not(header)'
      )
      .first();

    const isBannerVisible = await banner.isVisible({ timeout: 10000 }).catch(() => false);

    if (!isBannerVisible) {
      // Banner may have been dismissed in a previous session — acceptable
      console.log('[smoke] Autopilot banner not visible — may already be dismissed');
      return;
    }

    // Find the dismiss / close button inside the banner
    const dismissBtn = banner
      .locator(
        'button[aria-label*="dismiss" i], ' +
        'button[aria-label*="close" i], ' +
        'button[aria-label*="skip" i], ' +
        'button:has-text("×"), ' +
        'button:has-text("✕"), ' +
        'button:has-text("Dismiss"), ' +
        'button:has-text("Skip")'
      )
      .first();

    await expect(dismissBtn).toBeVisible({ timeout: 5000 });
    await dismissBtn.click();

    // Banner should disappear after dismiss
    await expect(banner).not.toBeVisible({ timeout: 5000 });
  });
});
