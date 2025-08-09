import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display login page', async ({ page }) => {
    await page.goto('/login.html');
    
    // Check for login form elements
    await expect(page.locator('h1')).toContainText('Sign In');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should display signup page', async ({ page }) => {
    await page.goto('/signup.html');
    
    // Check for signup form elements
    await expect(page.locator('h1')).toContainText('Create Account');
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('should show validation errors for invalid input', async ({ page }) => {
    await page.goto('/login.html');
    
    // Try to submit empty form
    await page.locator('button[type="submit"]').click();
    
    // Check for validation messages
    await expect(page.locator('.error-message')).toBeVisible();
  });

  test('should redirect to dashboard after successful login', async ({ page }) => {
    await page.goto('/login.html');
    
    // Fill in valid credentials
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'Test123!@#');
    
    // Submit form
    await page.locator('button[type="submit"]').click();
    
    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard.html', { timeout: 10000 });
    await expect(page).toHaveURL(/.*dashboard\.html/);
  });

  test('should handle OAuth login', async ({ page }) => {
    await page.goto('/login.html');
    
    // Check for OAuth buttons
    await expect(page.locator('button:has-text("Continue with Google")')).toBeVisible();
  });

  test('should toggle between login and signup', async ({ page }) => {
    await page.goto('/login.html');
    
    // Click on signup link
    await page.locator('a[href*="signup"]').click();
    await expect(page).toHaveURL(/.*signup\.html/);
    
    // Go back to login
    await page.locator('a[href*="login"]').click();
    await expect(page).toHaveURL(/.*login\.html/);
  });
});