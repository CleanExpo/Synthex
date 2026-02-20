import { chromium } from '@playwright/test';

/**
 * Global setup for E2E tests
 *
 * This script warms up the Next.js dev server by hitting critical routes
 * before tests run. This forces JIT compilation and prevents timeout
 * failures caused by cold server compilation during parallel test execution.
 */
export default async function globalSetup() {
  const baseURL = process.env.BASE_URL || 'http://localhost:3002';

  // Skip warmup if server is external (CI with pre-built server)
  if (process.env.PW_SKIP_WEBSERVER) {
    console.log('[global-setup] Skipping warmup - external server');
    return;
  }

  console.log('[global-setup] Warming up dev server...');
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Critical routes that need JIT compilation before tests run
  const routes = [
    '/',           // Landing page
    '/login',      // Auth flow entry
    '/signup',     // Registration
    '/dashboard',  // Main app shell
    '/onboarding', // Onboarding flow
  ];

  for (const route of routes) {
    const url = `${baseURL}${route}`;
    try {
      console.log(`[global-setup] Warming: ${route}`);
      await page.goto(url, { timeout: 90000, waitUntil: 'domcontentloaded' });
    } catch (error) {
      // Don't fail setup on warmup errors - tests will retry anyway
      console.log(`[global-setup] Warmup failed for ${route} (non-fatal)`);
    }
  }

  await browser.close();
  console.log('[global-setup] Warmup complete');
}
