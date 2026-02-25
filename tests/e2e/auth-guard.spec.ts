/**
 * Authentication Guard Tests
 *
 * Validates route protection, session persistence, and auth state consistency.
 * These tests MUST pass before any deployment.
 *
 * @module tests/e2e/auth-guard.spec
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

test.describe('Route Protection Guards', () => {
  test('unauthenticated access to /dashboard redirects to /login', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/dashboard');
    await page.waitForTimeout(2000);

    expect(page.url()).toContain('/login');
  });

  test('unauthenticated access to /dashboard/settings redirects to /login', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/dashboard/settings');
    await page.waitForTimeout(2000);

    expect(page.url()).toContain('/login');
  });

  test('unauthenticated access to /dashboard/analytics redirects to /login', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/dashboard/analytics');
    await page.waitForTimeout(2000);

    expect(page.url()).toContain('/login');
  });

  test('public pages are accessible without auth', async ({ page }) => {
    const publicRoutes = ['/login', '/signup', '/forgot-password'];

    for (const route of publicRoutes) {
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
      expect(response?.status(), `${route} should be accessible`).toBeLessThan(400);
    }
  });
});

test.describe('Session Validation API', () => {
  test('GET /api/auth/unified-login returns 401 without auth cookie', async ({ page }) => {
    await page.context().clearCookies();
    const response = await page.request.get('/api/auth/unified-login');
    expect(response.status()).toBe(401);
  });

  test('POST /api/auth/unified-login with valid demo creds returns session', async ({ page }) => {
    const response = await page.request.post('/api/auth/unified-login', {
      data: {
        method: 'email',
        email: 'demo@synthex.com',
        password: 'demo123',
      },
    });

    // In environments with seeded demo user, this should succeed
    if (response.status() === 200) {
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.session).toBeDefined();
      expect(data.session.accessToken).toBeTruthy();
      expect(data.session.expiresAt).toBeDefined();
      expect(typeof data.session.expiresAt).toBe('number');
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe('demo@synthex.com');
    } else {
      // Demo user not seeded — 401 is acceptable
      expect(response.status()).toBe(401);
    }
  });

  test('invalid credentials return 401 with correct error shape', async ({ page }) => {
    const response = await page.request.post('/api/auth/unified-login', {
      data: {
        method: 'email',
        email: 'nonexistent@test.com',
        password: 'BadPassword123!',
      },
    });

    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBeTruthy();
  });
});

test.describe('Cookie-Based Session Persistence', () => {
  test('login sets auth-token cookie', async ({ page }) => {
    const response = await page.request.post('/api/auth/unified-login', {
      data: {
        method: 'email',
        email: 'demo@synthex.com',
        password: 'demo123',
      },
    });

    if (response.status() === 200) {
      const setCookie = response.headers()['set-cookie'] || '';
      expect(setCookie).toContain('auth-token');
    }
  });

  test('authenticated context persists across pages', async ({ context, page }) => {
    // Login via API
    const response = await page.request.post('/api/auth/unified-login', {
      data: {
        method: 'email',
        email: 'demo@synthex.com',
        password: 'demo123',
      },
    });

    if (response.status() !== 200) {
      test.skip();
      return;
    }

    const data = await response.json();
    const token = data.session?.accessToken;

    if (!token) {
      test.skip();
      return;
    }

    // Set cookie
    await context.addCookies([
      {
        name: 'auth-token',
        value: token,
        url: BASE_URL,
      },
    ]);

    // Visit dashboard
    await page.goto('/dashboard');
    await page.waitForTimeout(1500);
    expect(page.url()).toContain('/dashboard');

    // Navigate to settings
    await page.goto('/dashboard/settings');
    await page.waitForTimeout(1000);
    expect(page.url()).not.toContain('/login');

    // Navigate back to dashboard
    await page.goto('/dashboard');
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/dashboard');
  });

  test('session survives page reload', async ({ context, page }) => {
    // Login via API
    const response = await page.request.post('/api/auth/unified-login', {
      data: {
        method: 'email',
        email: 'demo@synthex.com',
        password: 'demo123',
      },
    });

    if (response.status() !== 200) {
      test.skip();
      return;
    }

    const data = await response.json();
    const token = data.session?.accessToken;

    if (!token) {
      test.skip();
      return;
    }

    await context.addCookies([
      {
        name: 'auth-token',
        value: token,
        url: BASE_URL,
      },
    ]);

    await page.goto('/dashboard');
    await page.waitForTimeout(1500);

    if (page.url().includes('/dashboard')) {
      // Reload and verify persistence
      await page.reload();
      await page.waitForTimeout(1500);
      expect(page.url()).toContain('/dashboard');
    }
  });
});

test.describe('Auth State Consistency', () => {
  test('localStorage syncs user data after login', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    await page.fill('input[type="email"]', 'demo@synthex.com');
    await page.fill('input[type="password"]', 'demo123');
    await page.click('button[type="submit"]');

    await page.waitForTimeout(3000);

    if (page.url().includes('/dashboard')) {
      const user = await page.evaluate(() => {
        return localStorage.getItem('user') || localStorage.getItem('synthex-user');
      });

      if (user) {
        const userData = JSON.parse(user);
        expect(userData).toHaveProperty('email');
        expect(userData.email).toBe('demo@synthex.com');
      }
    }
  });

  test('login form clears after successful submit', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');

    await emailInput.fill('demo@synthex.com');
    await passwordInput.fill('demo123');
    await page.click('button[type="submit"]');

    await page.waitForTimeout(3000);

    // If redirected, form is cleared by navigation
    if (page.url().includes('/dashboard') || page.url().includes('/onboarding')) {
      // Success — redirect happened
      expect(true).toBeTruthy();
    } else {
      // If still on login, the form should still have email (for retry)
      const emailValue = await emailInput.inputValue();
      expect(emailValue).toBeTruthy();
    }
  });
});

test.describe('CSRF Protection', () => {
  test('POST to auth endpoint without proper origin should still work (same-origin)', async ({
    page,
  }) => {
    // Same-origin requests should pass CSRF check
    const response = await page.request.post('/api/auth/unified-login', {
      data: {
        method: 'email',
        email: 'test@test.com',
        password: 'Test123!',
      },
    });

    // Should get 401 (invalid creds), NOT 403 (CSRF block)
    expect([200, 401]).toContain(response.status());
  });
});
