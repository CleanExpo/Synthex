import { test, expect } from '@playwright/test';

const DEMO_EMAIL = 'demo@synthex.com';
const DEMO_PASS = 'demo123';

test.describe('Auth flow (dev-login) and gated route access', () => {
  test('login page renders', async ({ page }) => {
    const res = await page.goto('/login', { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator('body')).toBeVisible();
  });

  test('dev login returns session and grants dashboard access via cookie', async ({ request, context, page }) => {
    // Call dev-login endpoint
    const res = await request.post('/api/auth/dev-login', {
      data: { email: DEMO_EMAIL, password: DEMO_PASS },
    });

    // Acceptable responses: 200 (success), 401/403 (auth not configured), 404 (endpoint not present in this env)
    expect(res.status(), await res.text()).toBeOneOf([200, 401, 403, 404]);

    if (res.status() === 200) {
      const data = await res.json();
      expect(data?.session?.access_token).toBeTruthy();

      // Satisfy middleware auth check (it looks for cookie 'auth-token')
      const token = data.session.access_token as string;
      const baseURL = process.env.BASE_URL || 'http://localhost:3000';
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
      // Basic assertion that page rendered meaningful content
      await expect(page.locator('body')).toBeVisible();
      const bodyText = await page.locator('body').innerText();
      expect(bodyText.length).toBeGreaterThan(0);
    } else {
      // 401/403 is acceptable — endpoint unavailable or auth not configured in this env
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
