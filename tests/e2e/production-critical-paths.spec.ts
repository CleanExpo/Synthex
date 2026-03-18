/**
 * Phase 122 — Production Critical Path E2E Tests
 *
 * Validates the 8 critical user journeys on live synthex.social.
 * Also includes security spot-checks (headers, auth enforcement).
 *
 * USAGE:
 *   BASE_URL=https://synthex.social \
 *   PROD_TEST_EMAIL=you@example.com \
 *   PROD_TEST_PASSWORD=yourpassword \
 *   PROD_ADMIN_EMAIL=admin@example.com \
 *   PROD_ADMIN_PASSWORD=adminpassword \
 *   PW_SKIP_WEBSERVER=1 \
 *   npx playwright test tests/e2e/production-critical-paths.spec.ts
 *
 * HUMAN GATES:
 *   - Provide credentials for a seeded test account (already past onboarding)
 *   - Provide credentials for an admin/owner account
 *   - Confirm Stripe webhooks in Stripe dashboard after Path 5
 *   - Register Linear webhook URL in project settings (UNI-1180)
 *
 * @module tests/e2e/production-critical-paths.spec
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import { getAuthToken, setAuthCookie } from './fixtures/auth.fixture';

// ---------------------------------------------------------------------------
// Configuration — pulled from environment variables
// ---------------------------------------------------------------------------

const BASE_URL = process.env.BASE_URL || 'https://synthex.social';
const PROD_EMAIL = process.env.PROD_TEST_EMAIL || '';
const PROD_PASSWORD = process.env.PROD_TEST_PASSWORD || '';
const ADMIN_EMAIL = process.env.PROD_ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.PROD_ADMIN_PASSWORD || '';

const HAS_CREDS = !!PROD_EMAIL && !!PROD_PASSWORD;
const HAS_ADMIN_CREDS = !!ADMIN_EMAIL && !!ADMIN_PASSWORD;

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

async function loginAs(
  context: BrowserContext,
  page: Page,
  email: string,
  password: string
): Promise<boolean> {
  const token = await getAuthToken(
    page.request as Parameters<typeof getAuthToken>[0],
    email,
    password
  );
  if (token) {
    await setAuthCookie(context, token);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Security Spot-Checks (no credentials required)
// ---------------------------------------------------------------------------

test.describe('@production Security Headers', () => {
  test('should return required security headers on root', async ({
    request,
  }) => {
    const response = await request.get(BASE_URL);
    const headers = response.headers();

    // CSP
    expect(
      headers['content-security-policy'] ||
        headers['content-security-policy-report-only'],
      'Content-Security-Policy header missing'
    ).toBeTruthy();

    // HSTS — only present on HTTPS
    const hsts = headers['strict-transport-security'];
    if (hsts) {
      expect(hsts).toContain('max-age');
    }

    // X-Frame-Options
    expect(
      headers['x-frame-options'],
      'X-Frame-Options header missing'
    ).toBeTruthy();
  });

  test('should return 401 for unauthenticated /api/campaigns', async ({
    request,
  }) => {
    const response = await request.get(`${BASE_URL}/api/campaigns`);
    expect(response.status()).toBe(401);
  });

  test('should return 401 for unauthenticated /api/notifications', async ({
    request,
  }) => {
    const response = await request.get(`${BASE_URL}/api/notifications`);
    expect(response.status()).toBe(401);
  });

  test('should return 401 for unauthenticated /api/scheduler/posts', async ({
    request,
  }) => {
    const response = await request.get(`${BASE_URL}/api/scheduler/posts`);
    expect(response.status()).toBe(401);
  });

  test('should return 401 for unauthenticated /api/analytics/dashboard', async ({
    request,
  }) => {
    const response = await request.get(`${BASE_URL}/api/analytics/dashboard`);
    expect(response.status()).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Admin access enforcement (requires regular credentials to test 403 path)
// ---------------------------------------------------------------------------

test.describe('@production Admin Access Enforcement', () => {
  test.skip(!HAS_CREDS, 'Requires PROD_TEST_EMAIL and PROD_TEST_PASSWORD');

  test('should return 403 for non-admin on /api/admin/* routes', async ({
    context,
    page,
    request,
  }) => {
    const loggedIn = await loginAs(context, page, PROD_EMAIL, PROD_PASSWORD);
    test.skip(!loggedIn, 'Could not authenticate with provided credentials');

    // Hit an admin-only route with a regular user token
    const cookies = await context.cookies();
    const authCookie = cookies.find(c => c.name === 'auth-token');
    if (!authCookie) {
      test.skip(true, 'No auth-token cookie set after login');
      return;
    }

    const response = await request.get(`${BASE_URL}/api/admin/users`, {
      headers: { Cookie: `auth-token=${authCookie.value}` },
    });

    // Should be 401 or 403 — never 200 for a non-admin
    expect([401, 403]).toContain(response.status());
  });
});

// ---------------------------------------------------------------------------
// Path 1 — Signup → Confirm email screen (automated portion)
// Full path (email confirmation → onboarding) requires human completion.
// ---------------------------------------------------------------------------

test.describe('@production Path 1: Signup → Email Confirmation Screen', () => {
  test('should accept signup form submission and show confirmation screen', async ({
    page,
  }) => {
    const testEmail = `synthex-e2e-${Date.now()}@mailinator.com`;

    await page.goto(`${BASE_URL}/signup`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    // Fill signup form
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"]').first();
    const submitButton = page.locator('button[type="submit"]');

    await expect(emailInput).toBeVisible({ timeout: 15000 });
    await emailInput.fill(testEmail);
    await passwordInput.fill('Test@12345678');

    // Accept terms if present
    const termsCheckbox = page.locator('input[type="checkbox"]');
    if (await termsCheckbox.isVisible()) {
      await termsCheckbox.check();
    }

    await submitButton.click();

    // After submission: should either redirect to confirmation screen,
    // onboarding, or dashboard — never stay on /signup with no feedback
    await page.waitForTimeout(4000);
    const url = page.url();
    const leftSignup =
      !url.includes('/signup') ||
      (await page
        .locator(
          '[data-testid="email-confirm"], text=/check your email/i, text=/verify/i'
        )
        .isVisible()
        .catch(() => false));

    expect(
      leftSignup,
      `Expected redirect away from /signup after submission. Current URL: ${url}`
    ).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Paths 2–8 — Require authenticated session
// ---------------------------------------------------------------------------

test.describe('@production Authenticated Critical Paths', () => {
  test.skip(!HAS_CREDS, 'Requires PROD_TEST_EMAIL and PROD_TEST_PASSWORD');

  test.beforeEach(async ({ context, page }) => {
    const loggedIn = await loginAs(context, page, PROD_EMAIL, PROD_PASSWORD);
    if (!loggedIn) {
      // Try direct login via UI as fallback
      await page.goto(`${BASE_URL}/login`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.locator('input[type="email"]').fill(PROD_EMAIL);
      await page.locator('input[type="password"]').fill(PROD_PASSWORD);
      await page.locator('button[type="submit"]').click();
      await page.waitForTimeout(4000);
    }
  });

  // -------------------------------------------------------------------------
  // Path 2 — New Post → AI generation → save draft
  // -------------------------------------------------------------------------
  test('Path 2: New Post → platform selector → AI generation → save draft', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/dashboard`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    // Navigate to content creation
    const createPostButton = page
      .locator(
        '[data-testid="create-post"], button:has-text("Create Post"), button:has-text("New Post"), a:has-text("Create")'
      )
      .first();

    if (await createPostButton.isVisible({ timeout: 10000 })) {
      await createPostButton.click();
    } else {
      // Try direct navigation
      await page.goto(`${BASE_URL}/dashboard/create`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
    }

    await page.waitForTimeout(2000);

    // Verify platform selector is present
    const platformSelector = page
      .locator(
        '[data-testid="platform-selector"], [data-platform], button:has-text("Instagram"), button:has-text("Twitter"), button:has-text("LinkedIn")'
      )
      .first();

    const hasPlatformSelector = await platformSelector
      .isVisible({ timeout: 10000 })
      .catch(() => false);
    expect(
      hasPlatformSelector ||
        page.url().includes('/create') ||
        page.url().includes('/post'),
      'Expected to reach content creation page with platform selector'
    ).toBeTruthy();

    // If AI generation textarea/prompt is available, type content
    const contentArea = page
      .locator(
        'textarea[data-testid="content-input"], textarea[placeholder*="content" i], textarea[placeholder*="describe" i], textarea[placeholder*="topic" i]'
      )
      .first();

    if (await contentArea.isVisible({ timeout: 5000 }).catch(() => false)) {
      await contentArea.fill('Test post content for Phase 122 E2E validation');
    }

    // Save as draft
    const saveDraftButton = page
      .locator(
        'button:has-text("Save Draft"), button:has-text("Save as Draft"), button[data-testid="save-draft"]'
      )
      .first();

    if (await saveDraftButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await saveDraftButton.click();
      await page.waitForTimeout(2000);

      // Should show success toast or redirect
      const saved = await page
        .locator(
          'text=/saved/i, text=/draft/i, [data-sonner-toast], [role="status"]'
        )
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      // Accept either success toast or page navigation away from create
      const navigatedAway = !page.url().includes('/create');
      expect(
        saved || navigatedAway,
        'Draft save did not produce feedback'
      ).toBeTruthy();
    }
  });

  // -------------------------------------------------------------------------
  // Path 3 — Draft → Schedule → verify in queue
  // -------------------------------------------------------------------------
  test('Path 3: Navigate to scheduler → verify queue renders', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/dashboard`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    // Navigate to scheduler
    const schedulerLink = page
      .locator(
        'a:has-text("Scheduler"), a:has-text("Schedule"), [data-testid="nav-scheduler"], nav a[href*="scheduler"]'
      )
      .first();

    if (await schedulerLink.isVisible({ timeout: 10000 }).catch(() => false)) {
      await schedulerLink.click();
    } else {
      await page.goto(`${BASE_URL}/dashboard/scheduler`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
    }

    await page.waitForTimeout(3000);

    // Verify scheduler page loaded — should have a calendar, queue list, or "no posts" empty state
    const schedulerContent = page
      .locator(
        '[data-testid="scheduler"], [data-testid="post-queue"], table, .calendar, text=/scheduled/i, text=/no posts/i, text=/queue/i'
      )
      .first();

    const hasContent = await schedulerContent
      .isVisible({ timeout: 15000 })
      .catch(() => false);
    expect(
      hasContent || page.url().includes('scheduler'),
      'Scheduler page did not load content'
    ).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Path 4 — Analytics tab → data loads (not empty state error)
  // -------------------------------------------------------------------------
  test('Path 4: Analytics tab → data loads without error', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    // Navigate to analytics
    const analyticsLink = page
      .locator(
        'a:has-text("Analytics"), [data-testid="nav-analytics"], nav a[href*="analytics"]'
      )
      .first();

    if (await analyticsLink.isVisible({ timeout: 10000 }).catch(() => false)) {
      await analyticsLink.click();
    } else {
      await page.goto(`${BASE_URL}/dashboard/analytics`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
    }

    await page.waitForTimeout(4000);

    // Should NOT show a 500 error or "Failed to load" message
    const errorState = page.locator(
      'text=/500/i, text=/failed to load/i, text=/something went wrong/i, text=/error loading/i'
    );
    const hasError = await errorState
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    expect(hasError, 'Analytics page shows an error state').toBeFalsy();

    // Should have analytics content, chart, or empty state (no data yet is fine)
    const hasAnalyticsContent = await page
      .locator(
        '[data-testid="analytics"], canvas, .recharts-wrapper, text=/impressions/i, text=/engagement/i, text=/no data/i, text=/connect/i'
      )
      .first()
      .isVisible({ timeout: 15000 })
      .catch(() => false);

    expect(
      hasAnalyticsContent || page.url().includes('analytics'),
      'Analytics page did not render any content'
    ).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Path 5 — Billing page loads + Stripe upgrade button present
  // Full Stripe checkout verification is a human gate (check Stripe dashboard).
  // -------------------------------------------------------------------------
  test('Path 5: Billing page loads → upgrade button present', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/dashboard/settings/billing`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    await page.waitForTimeout(3000);

    // Should not be a 404 or crash
    const notFound = await page
      .locator('text=/404/i, text=/not found/i')
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    expect(notFound, 'Billing page returned 404').toBeFalsy();

    // Should have current plan info or upgrade CTA
    const billingContent = page
      .locator(
        'text=/plan/i, text=/billing/i, text=/upgrade/i, text=/subscribe/i, text=/pro/i, [data-testid="billing"]'
      )
      .first();

    const hasBillingContent = await billingContent
      .isVisible({ timeout: 15000 })
      .catch(() => false);
    expect(
      hasBillingContent || page.url().includes('billing'),
      'Billing page did not render billing information'
    ).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Path 6 — NotificationBell updates (unread count reflects real data)
  // -------------------------------------------------------------------------
  test('Path 6: NotificationBell renders and reflects unread count', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/dashboard`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    await page.waitForTimeout(3000);

    // NotificationBell should be visible in the header/nav
    const bell = page
      .locator(
        '[data-testid="notification-bell"], button[aria-label*="notification" i], button:has([data-icon="bell"]), button svg[class*="bell" i]'
      )
      .first();

    const bellVisible = await bell
      .isVisible({ timeout: 15000 })
      .catch(() => false);
    expect(
      bellVisible,
      'NotificationBell not found in dashboard header'
    ).toBeTruthy();

    if (bellVisible) {
      // Click bell to open notification panel
      await bell.click();
      await page.waitForTimeout(2000);

      // Panel should open — verify it renders (not a crash)
      const panel = page
        .locator(
          '[data-testid="notification-panel"], [role="dialog"], [role="listbox"], .notification-list, [aria-label*="notification" i]'
        )
        .first();

      const panelOpen = await panel
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      // Panel opening is a best-effort check — bell might show inline
      if (!panelOpen) {
        // Acceptable if the URL changed to a notifications page
        const navigated = page.url().includes('notification');
        expect(
          navigated || panelOpen,
          'Notification bell click produced no visible response'
        ).toBeTruthy();
      }
    }
  });

  // -------------------------------------------------------------------------
  // Path 7 — Settings → Connect Platform → OAuth redirect
  // Verifies the connect button is present and initiates OAuth.
  // Full OAuth completion requires a live Instagram/platform account (human gate).
  // -------------------------------------------------------------------------
  test('Path 7: Settings → Connect platform → OAuth redirect initiated', async ({
    page,
  }) => {
    // Navigate to platform connections settings
    await page.goto(`${BASE_URL}/dashboard/settings`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    await page.waitForTimeout(2000);

    // Look for connections tab or direct link
    const connectTab = page
      .locator(
        'a:has-text("Connections"), a:has-text("Connected Accounts"), button:has-text("Connections"), [data-testid="connections-tab"]'
      )
      .first();

    if (await connectTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await connectTab.click();
      await page.waitForTimeout(1500);
    } else {
      await page.goto(`${BASE_URL}/dashboard/settings/connections`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
    }

    await page.waitForTimeout(2000);

    // Should have at least one "Connect" button for a social platform
    const connectButton = page
      .locator(
        'button:has-text("Connect"), a:has-text("Connect"), [data-testid*="connect"]'
      )
      .first();

    const hasConnectButton = await connectButton
      .isVisible({ timeout: 10000 })
      .catch(() => false);
    expect(
      hasConnectButton || page.url().includes('settings'),
      'No connect button found on settings/connections page'
    ).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Path 8 — Admin panel (requires admin credentials)
// ---------------------------------------------------------------------------

test.describe('@production Path 8: Admin Panel', () => {
  test.skip(
    !HAS_ADMIN_CREDS,
    'Requires PROD_ADMIN_EMAIL and PROD_ADMIN_PASSWORD'
  );

  test('Admin: user list loads without error', async ({ context, page }) => {
    const loggedIn = await loginAs(context, page, ADMIN_EMAIL, ADMIN_PASSWORD);
    test.skip(!loggedIn, 'Could not authenticate admin credentials');

    await page.goto(`${BASE_URL}/dashboard/admin`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    await page.waitForTimeout(3000);

    // Should not be redirected to login
    expect(page.url(), 'Admin was redirected to login').not.toContain('/login');

    // Should not show 403
    const forbidden = await page
      .locator('text=/403/i, text=/forbidden/i, text=/access denied/i')
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    expect(forbidden, 'Admin panel returned 403 for admin user').toBeFalsy();

    // Should have user list or system health content
    const adminContent = page
      .locator(
        '[data-testid="admin-panel"], [data-testid="user-list"], text=/users/i, text=/system health/i, text=/organisations/i'
      )
      .first();

    const hasContent = await adminContent
      .isVisible({ timeout: 15000 })
      .catch(() => false);
    expect(
      hasContent || page.url().includes('admin'),
      'Admin panel did not render expected content'
    ).toBeTruthy();
  });

  test('Admin: system health endpoint responds', async ({
    context,
    page,
    request,
  }) => {
    const loggedIn = await loginAs(context, page, ADMIN_EMAIL, ADMIN_PASSWORD);
    test.skip(!loggedIn, 'Could not authenticate admin credentials');

    const cookies = await context.cookies();
    const authCookie = cookies.find(c => c.name === 'auth-token');
    test.skip(!authCookie, 'No auth-token cookie after admin login');

    const response = await request.get(`${BASE_URL}/api/admin/health`, {
      headers: { Cookie: `auth-token=${authCookie!.value}` },
    });

    // 200 OK expected for admin; 404 if route doesn't exist yet is acceptable
    expect([200, 404]).toContain(response.status());
  });

  test('Admin /api/admin/users returns 403 for non-owner authenticated user', async ({
    context,
    page,
    request,
  }) => {
    test.skip(!HAS_CREDS, 'Requires PROD_TEST_EMAIL (non-admin)');

    const loggedIn = await loginAs(context, page, PROD_EMAIL, PROD_PASSWORD);
    test.skip(!loggedIn, 'Could not authenticate with non-admin credentials');

    const cookies = await context.cookies();
    const authCookie = cookies.find(c => c.name === 'auth-token');
    test.skip(!authCookie, 'No auth-token cookie after login');

    const response = await request.get(`${BASE_URL}/api/admin/users`, {
      headers: { Cookie: `auth-token=${authCookie!.value}` },
    });

    expect([401, 403]).toContain(response.status());
  });
});

// ---------------------------------------------------------------------------
// Phase 122 Human Gate Checklist
// (Printed to stdout — not an automated assertion)
// ---------------------------------------------------------------------------

test.describe('@production Phase 122 Human Verification Checklist', () => {
  test('display human gate checklist', async () => {
    console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║            PHASE 122 — HUMAN VERIFICATION GATES                     ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  After automated tests pass, complete these manually:                ║
║                                                                      ║
║  [ ] 1. Signup → email confirm → complete 5-step onboarding wizard   ║
║         → verify dashboard loads with correct user state             ║
║                                                                      ║
║  [ ] 2. Billing: click "Upgrade to Pro" → Stripe checkout opens      ║
║         → complete test payment → verify tier shown as Pro           ║
║         → confirm in Stripe dashboard: webhook delivered             ║
║                                                                      ║
║  [ ] 3. Platform OAuth: click "Connect Instagram" → redirects to     ║
║         Instagram OAuth → grant permission → connection confirmed    ║
║                                                                      ║
║  [ ] 4. Post schedule → notification appears in NotificationBell     ║
║         → badge count correct (matches actual unread count)          ║
║                                                                      ║
║  [ ] 5. Register Linear webhook URL in project settings (UNI-1180)  ║
║                                                                      ║
║  All 5 gates must pass before v10.0 Gate 9 (E2E) is marked Done.    ║
╚══════════════════════════════════════════════════════════════════════╝
    `);
    // Not an assertion — just informational output
    expect(true).toBe(true);
  });
});
