import { test, expect } from '@playwright/test';

// Ensure auth before any navigation
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify({
      name: 'Test User',
      email: 'test@example.com',
      preferences: { onboardingCompleted: true }
    }));
  });
});

test.describe('Team Invite Flow', () => {
  test('opens invite modal, submits, and gets success from API', async ({ page }) => {
    await page.goto('/team.html');

    // Open invite modal
    await page.getByRole('button', { name: /invite member/i }).click();

    // Fill form
    await page.fill('#inviteEmail', 'new.member@example.com');
    await page.selectOption('#inviteRole', 'editor');
    await page.fill('#inviteMessage', 'Welcome to the team!');

    // Submit and wait for API response
    const respPromise = page.waitForResponse((res) => {
      const url = res.url();
      return url.includes('/api/teams/invite') && res.request().method() === 'POST';
    });

    await page.getByRole('button', { name: /send invitation/i }).click();

    const resp = await respPromise;
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    expect(data?.success).toBeTruthy();

    // Modal should close on success
    const display = await page.locator('#inviteModal').evaluate((el) => getComputedStyle(el).display);
    expect(display).toBe('none');
  });
});
