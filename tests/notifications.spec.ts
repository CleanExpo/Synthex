import { test, expect } from '@playwright/test';

// Ensure auth before any navigation so pages that require it load
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

test.describe('Notification Bell Dropdown', () => {
  test('bell toggles the dropdown open/close reliably', async ({ page }) => {
    await page.goto('/team.html');

    // Wait until header renders
    await page.waitForSelector('.notification-bell', { state: 'visible' });
    const bell = page.locator('.notification-bell');
    await expect(bell).toHaveCount(1);

    // Initially should be hidden (created but display none)
    const dropdown = page.locator('.notification-dropdown');

    // Click bell to open
    await bell.click();
    await expect(dropdown).toHaveCount(1);
    const displayOpen = await dropdown.evaluate(el => getComputedStyle(el).display);
    expect(displayOpen).toBe('block');

    // Click outside to close
    await page.mouse.click(5, 5);
    const displayClosed = await dropdown.evaluate(el => getComputedStyle(el).display);
    expect(displayClosed === 'none' || displayClosed === '').toBeTruthy();
  });
});
