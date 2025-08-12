/**
 * Authentication Guard Tests
 * These tests MUST pass before any deployment
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@synthex.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'testpass123';

test.describe('Authentication Flow Guards', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto(BASE_URL);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('Email/Password login flow', async () => {
    // Navigate to login
    await page.goto(`${BASE_URL}/login`);
    
    // Fill in credentials
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Wait for navigation to dashboard
    await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 10000 });
    
    // Verify user is logged in
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    
    // Verify session persistence
    await page.reload();
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    
    // Test logout
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-button"]');
    await page.waitForURL(`${BASE_URL}/login`);
  });

  test('Demo mode login', async () => {
    await page.goto(`${BASE_URL}/login`);
    
    // Use demo credentials
    await page.fill('input[type="email"]', 'demo@synthex.com');
    await page.fill('input[type="password"]', 'demo123');
    
    await page.click('button[type="submit"]');
    
    // Should redirect to dashboard
    await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 10000 });
    
    // Verify demo user badge
    await expect(page.locator('text=/Demo Mode/i')).toBeVisible();
  });

  test('Protected routes redirect to login', async () => {
    // Try to access protected route
    await page.goto(`${BASE_URL}/dashboard`);
    
    // Should redirect to login
    await page.waitForURL(`${BASE_URL}/login`);
    
    // Verify login form is visible
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('Session validation API', async () => {
    // Test session validation endpoint
    const response = await page.request.get(`${BASE_URL}/api/auth/unified-login`);
    
    // Should return 401 when not authenticated
    expect(response.status()).toBe(401);
    
    // Login first
    const loginResponse = await page.request.post(`${BASE_URL}/api/auth/unified-login`, {
      data: {
        method: 'demo',
        email: 'demo@synthex.com',
        password: 'demo123'
      }
    });
    
    expect(loginResponse.status()).toBe(200);
    const loginData = await loginResponse.json();
    expect(loginData.success).toBe(true);
    
    // Now validation should work with the cookie
    const cookies = await loginResponse.headers()['set-cookie'];
    const validationResponse = await page.request.get(`${BASE_URL}/api/auth/unified-login`, {
      headers: {
        'Cookie': cookies
      }
    });
    
    expect(validationResponse.status()).toBe(200);
    const validationData = await validationResponse.json();
    expect(validationData.authenticated).toBe(true);
  });

  test('OAuth error handling', async () => {
    await page.goto(`${BASE_URL}/login`);
    
    // Click Google login
    await page.click('button:has-text("Google")');
    
    // Should show error message if OAuth not configured
    await expect(page.locator('text=/OAuth login is not configured/i')).toBeVisible({ timeout: 5000 });
  });

  test('Invalid credentials handling', async () => {
    await page.goto(`${BASE_URL}/login`);
    
    await page.fill('input[type="email"]', 'invalid@test.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    
    await page.click('button[type="submit"]');
    
    // Should show error message
    await expect(page.locator('text=/Invalid credentials/i')).toBeVisible({ timeout: 5000 });
    
    // Should not redirect
    expect(page.url()).toContain('/login');
  });

  test('Session expiry handling', async () => {
    // This would test session expiry
    // For now, just verify the structure exists
    const response = await page.request.post(`${BASE_URL}/api/auth/unified-login`, {
      data: {
        method: 'demo',
        email: 'demo@synthex.com',
        password: 'demo123'
      }
    });
    
    const data = await response.json();
    expect(data.session).toHaveProperty('expiresAt');
    expect(typeof data.session.expiresAt).toBe('number');
  });
});

test.describe('Authentication State Consistency', () => {
  test('Local storage sync with session', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    // Login
    await page.fill('input[type="email"]', 'demo@synthex.com');
    await page.fill('input[type="password"]', 'demo123');
    await page.click('button[type="submit"]');
    
    await page.waitForURL(`${BASE_URL}/dashboard`);
    
    // Check localStorage
    const user = await page.evaluate(() => {
      return localStorage.getItem('user');
    });
    
    expect(user).not.toBeNull();
    const userData = JSON.parse(user!);
    expect(userData.email).toBe('demo@synthex.com');
  });

  test('Cookie-based session persistence', async ({ context }) => {
    const page = await context.newPage();
    
    // Login
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', 'demo@synthex.com');
    await page.fill('input[type="password"]', 'demo123');
    await page.click('button[type="submit"]');
    
    await page.waitForURL(`${BASE_URL}/dashboard`);
    
    // Get cookies
    const cookies = await context.cookies();
    const authCookie = cookies.find(c => c.name === 'auth-token');
    
    expect(authCookie).toBeDefined();
    expect(authCookie?.httpOnly).toBe(true);
    expect(authCookie?.sameSite).toBe('Lax');
    
    // Open new page in same context
    const newPage = await context.newPage();
    await newPage.goto(`${BASE_URL}/dashboard`);
    
    // Should still be logged in
    await expect(newPage.locator('[data-testid="user-menu"]')).toBeVisible();
    
    await page.close();
    await newPage.close();
  });
});