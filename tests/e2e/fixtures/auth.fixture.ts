/**
 * Auth E2E Test Fixtures
 *
 * Provides reusable test fixtures for authentication testing.
 * Includes page objects, test data, and helper functions.
 *
 * @module tests/e2e/fixtures/auth.fixture
 */

import { test as base, expect, Page, BrowserContext } from '@playwright/test';

// =============================================================================
// Test Data
// =============================================================================

export const TEST_USERS = {
  valid: {
    email: 'test@synthex.test',
    password: 'Test123!@#',
    name: 'Test User',
  },
  demo: {
    email: 'demo@synthex.com',
    password: 'demo123',
    name: 'Demo User',
  },
  invalid: {
    email: 'invalid@test.com',
    password: 'wrongpassword',
  },
  newUser: {
    email: `test-${Date.now()}@synthex.test`,
    password: 'NewUser123!@#',
    name: 'New Test User',
  },
};

// =============================================================================
// Page Object Models
// =============================================================================

export class LoginPage {
  constructor(private page: Page) {}

  // Locators
  get emailInput() {
    return this.page.locator('input[type="email"], input[name="email"]');
  }

  get passwordInput() {
    return this.page.locator('input[type="password"], input[name="password"]');
  }

  get submitButton() {
    return this.page.locator('button[type="submit"]');
  }

  get googleButton() {
    return this.page.locator('button:has-text("Google"), a:has-text("Google")');
  }

  get githubButton() {
    return this.page.locator('button:has-text("GitHub"), a:has-text("GitHub")');
  }

  get forgotPasswordLink() {
    return this.page.locator('a:has-text("Forgot"), a:has-text("Reset")');
  }

  get signupLink() {
    return this.page.locator('a:has-text("Sign up"), a:has-text("Register"), a:has-text("Create account")');
  }

  get errorMessage() {
    return this.page.locator('[role="alert"], .error-message, [data-error]');
  }

  // Actions
  async goto() {
    await this.page.goto('/login');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async waitForRedirect(expectedPath: string = '/dashboard') {
    await this.page.waitForURL(`**${expectedPath}**`, { timeout: 10000 });
  }

  async expectError(messagePattern?: string | RegExp) {
    await expect(this.errorMessage).toBeVisible();
    if (messagePattern) {
      await expect(this.errorMessage).toContainText(messagePattern);
    }
  }
}

export class SignupPage {
  constructor(private page: Page) {}

  // Locators
  get nameInput() {
    return this.page.locator('input[name="name"], input[placeholder*="name" i]');
  }

  get emailInput() {
    return this.page.locator('input[type="email"], input[name="email"]');
  }

  get passwordInput() {
    return this.page.locator('input[type="password"]:not([name*="confirm"]), input[name="password"]');
  }

  get confirmPasswordInput() {
    return this.page.locator('input[name*="confirm"], input[placeholder*="confirm" i]');
  }

  get submitButton() {
    return this.page.locator('button[type="submit"]');
  }

  get termsCheckbox() {
    return this.page.locator('input[type="checkbox"]');
  }

  get loginLink() {
    return this.page.locator('a:has-text("Login"), a:has-text("Sign in")');
  }

  get errorMessage() {
    return this.page.locator('[role="alert"], .error-message, [data-error]');
  }

  get successMessage() {
    return this.page.locator('[role="status"], .success-message, [data-success]');
  }

  // Actions
  async goto() {
    await this.page.goto('/signup');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async signup(data: { name: string; email: string; password: string }) {
    if (await this.nameInput.isVisible()) {
      await this.nameInput.fill(data.name);
    }
    await this.emailInput.fill(data.email);
    await this.passwordInput.fill(data.password);

    if (await this.confirmPasswordInput.isVisible()) {
      await this.confirmPasswordInput.fill(data.password);
    }

    if (await this.termsCheckbox.isVisible()) {
      await this.termsCheckbox.check();
    }

    await this.submitButton.click();
  }
}

export class ForgotPasswordPage {
  constructor(private page: Page) {}

  get emailInput() {
    return this.page.locator('input[type="email"], input[name="email"]');
  }

  get submitButton() {
    return this.page.locator('button[type="submit"]');
  }

  get successMessage() {
    return this.page.locator('[role="status"], .success-message, [data-success]');
  }

  get backToLoginLink() {
    return this.page.locator('a:has-text("Login"), a:has-text("Back")');
  }

  async goto() {
    await this.page.goto('/forgot-password');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async requestReset(email: string) {
    await this.emailInput.fill(email);
    await this.submitButton.click();
  }
}

// =============================================================================
// Auth Helpers
// =============================================================================

/**
 * Set auth cookie to bypass login for authenticated tests
 */
export async function setAuthCookie(context: BrowserContext, token: string) {
  const baseURL = process.env.BASE_URL || 'http://localhost:3001';
  await context.addCookies([
    {
      name: 'auth-token',
      value: token,
      url: baseURL,
    },
  ]);
}

/**
 * Get auth token via API login
 */
export async function getAuthToken(
  request: typeof base extends { request: infer R } ? R : never,
  email: string,
  password: string
): Promise<string | null> {
  const response = await request.post('/api/auth/login', {
    data: { email, password },
  });

  if (response.status() === 200) {
    const data = await response.json();
    return data.token || data.session?.access_token || null;
  }
  return null;
}

/**
 * Create authenticated context fixture
 */
export async function createAuthenticatedContext(
  context: BrowserContext,
  page: Page
): Promise<boolean> {
  // Try dev-login endpoint first
  const response = await page.request.post('/api/auth/dev-login', {
    data: TEST_USERS.demo,
  });

  if (response.status() === 200) {
    const data = await response.json();
    const token = data.token || data.session?.access_token;
    if (token) {
      await setAuthCookie(context, token);
      return true;
    }
  }

  // Fallback to regular login
  const loginResponse = await page.request.post('/api/auth/login', {
    data: TEST_USERS.demo,
  });

  if (loginResponse.status() === 200) {
    const data = await loginResponse.json();
    if (data.token) {
      await setAuthCookie(context, data.token);
      return true;
    }
  }

  return false;
}

// =============================================================================
// Extended Test Fixture
// =============================================================================

type AuthFixtures = {
  loginPage: LoginPage;
  signupPage: SignupPage;
  forgotPasswordPage: ForgotPasswordPage;
  authenticatedPage: Page;
};

export const test = base.extend<AuthFixtures>({
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await use(loginPage);
  },

  signupPage: async ({ page }, use) => {
    const signupPage = new SignupPage(page);
    await use(signupPage);
  },

  forgotPasswordPage: async ({ page }, use) => {
    const forgotPasswordPage = new ForgotPasswordPage(page);
    await use(forgotPasswordPage);
  },

  authenticatedPage: async ({ context, page }, use) => {
    const success = await createAuthenticatedContext(context, page);
    if (!success) {
      console.warn('Could not authenticate - tests may fail');
    }
    await use(page);
  },
});

export { expect } from '@playwright/test';
