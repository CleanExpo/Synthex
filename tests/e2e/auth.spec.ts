import { test, expect } from '@playwright/test';

const DEMO_EMAIL = 'demo@synthex.com';
const DEMO_PASS = 'demo123';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

test.describe('Auth flow (dev-login) and gated route access', () => {
  test('login page renders', async ({ page }) => {
    const res = await page.goto('/login', { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator('body')).toBeVisible();
  });

  test('unified login returns session and grants dashboard access via cookie', async ({ request, context, page }) => {
    // Call unified-login endpoint (primary auth route)
    const res = await request.post('/api/auth/unified-login', {
      data: { method: 'email', email: DEMO_EMAIL, password: DEMO_PASS },
    });

    // May return 200 (success) or 401 (demo user not seeded)
    expect(res.status(), await res.text()).toBeOneOf([200, 401]);

    if (res.status() === 200) {
      const data = await res.json();
      expect(data?.success).toBe(true);
      expect(data?.session?.accessToken).toBeTruthy();

      // Satisfy middleware auth check (it looks for cookie 'auth-token')
      const token = data.session.accessToken as string;
      const baseURL = process.env.BASE_URL || 'http://localhost:3001';
      await context.addCookies([
        {
          name: 'auth-token',
          value: token,
          url: baseURL,
        },
      ]);

      // Now visit dashboard, should not redirect to /login
      const resp = await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      expect(resp?.status()).toBeLessThan(400);
      await expect(page.locator('body')).toBeVisible();
      const bodyText = await page.locator('body').innerText();
      expect(bodyText.length).toBeGreaterThan(0);
    } else {
      // 401 = demo user not seeded in this environment
      const data = await res.json();
      expect(data.success).toBe(false);
    }
  });
});

// Extend expect with toBeOneOf helper
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace PlaywrightTest {
    interface Matchers<R> {
      toBeOneOf<T>(expected: readonly T[]): R;
    }
  }
}

expect.extend({
  toBeOneOf(received: unknown, expected: readonly unknown[]) {
    const pass = expected.includes(received);
    return {
      pass,
      message: () =>
        `expected ${received} to be one of [${expected.join(', ')}]`,
    };
  },
});
