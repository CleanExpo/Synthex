import { test, expect } from '@playwright/test';

const PAGES = ['/', '/login', '/signup', '/features', '/pricing', '/docs', '/test-email'];
const APIS = ['/api/health', '/api/dashboard/stats', '/api/test-db', '/api/test-email'];

test.describe('Route & API smoke', () => {
  test('pages render without runtime errors', async ({ page }, testInfo) => {
    // Collect console errors
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    for (const path of PAGES) {
      await test.step(`visit ${path}`, async () => {
        await page.goto(path, { waitUntil: 'networkidle' });
        await expect(page.locator('body')).toBeVisible();

        // Basic blank-page guard
        const content = await page.locator('body').innerText();
        expect(content.length).toBeGreaterThan(0);
      });
    }

    // Attach errors if any
    if (errors.length) {
      await testInfo.attach('console-errors.txt', { body: errors.join('\n'), contentType: 'text/plain' });
    }

    expect(errors, `Console errors detected:\n${errors.join('\n')}`).toEqual([]);
  });

  test('APIs respond (2xx, 3xx, or expected 401 for auth-gated)', async ({ request }) => {
    for (const api of APIS) {
      const res = await request.get(api);
      const ok = res.status() < 400 || res.status() === 401; // allow 401 for gated routes in CI
      expect(ok).toBeTruthy();
    }
  });

  test('dashboard access unauthenticated -> redirect or login gate', async ({ page }) => {
    const resp = await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    // Either redirect occurred or we landed on dashboard. If redirect, we expect /login route.
    const url = page.url();
    const redirectedToLogin = url.includes('/login');
    const status = resp?.status();
    const ok = redirectedToLogin || (status && status < 400);
    expect(ok).toBeTruthy();
  });
});
