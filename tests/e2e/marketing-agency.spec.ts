import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3002';

async function setMarketingAgencyAuth(page: Page) {
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
}

test('marketing agency RestoreAssist package renders', async ({ page }) => {
  await setMarketingAgencyAuth(page);

  await page.goto('/dashboard/marketing-agency/restoreassist-launch', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { name: 'RestoreAssist Launch Package' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Media Size Guide' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Human Review & AV Testing' })).toBeVisible();
  await expect(page.getByLabel('LinkedIn logo').first()).toBeVisible();
  await expect(page.getByLabel('Facebook logo').first()).toBeVisible();
  await expect(page.getByText('1920 x 1080px').first()).toBeVisible();
  await expect(page.getByText('720 x 1280px').first()).toBeVisible();
  await expect(page.getByText('Voiceover pacing').first()).toBeVisible();
  await expect(page.getByText('Can the video still be understood when muted?').first()).toBeVisible();
  await expect(page.getByText('LinkedIn Owner Thumbstop 15').first()).toBeVisible();
  await expect(page.getByText('Facebook Retargeting 15').first()).toBeVisible();
  await expect(page.getByText('Client-first strategy').first()).toBeVisible();
  await expect(page.getByText('Ranking rationale').first()).toBeVisible();
  await expect(page.getByText('Publishing and ad spend are blocked by default.').first()).toBeVisible();
});
