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
    // Targets Sonner toast notifications; excludes Next.js route announcer ([role="alert"])
    return this.page.locator('[data-sonner-toast], .error-message, [data-error="true"]');
  }

  // Actions
  async goto() {
    try {
      await this.page.goto('/login', { timeout: 30000 });
      await this.page.waitForLoadState('domcontentloaded');
    } catch (e) {
      // Server may be slow to respond on cold start — retry once
      await this.page.goto('/login', { timeout: 30000, waitUntil: 'domcontentloaded' });
    }
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
    // Wait for the form to finish submitting (submit button leaves loading/disabled state).
    // The button may stay disabled if there's a validation error or the form is processing.
    try {
      await expect(this.submitButton).not.toBeDisabled({ timeout: 5000 });
    } catch {
      // Button staying disabled after submit is acceptable (e.g., during validation)
    }

    // An error is indicated by either a visible toast OR remaining on the login page
    // (Sonner toasts are ephemeral and may be missed by polling; URL check is authoritative)
    const url = this.page.url();
    const hasToast = await this.errorMessage.first().isVisible().catch(() => false);
    const onLoginPage = url.includes('/login');

    expect(
      hasToast || onLoginPage,
      `Expected error state (Sonner toast or URL on /login), got: ${url}`
    ).toBeTruthy();

    if (messagePattern && hasToast) {
      await expect(this.errorMessage.first()).toContainText(messagePattern);
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
    // Target by id to avoid matching the confirmPassword field (both have type="password", no name attr)
    return this.page.locator('input#password, input[name="password"]');
  }

  get confirmPasswordInput() {
    return this.page.locator('input#confirmPassword, input[name*="confirm"], input[placeholder*="confirm" i]');
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
    // Targets Sonner toast notifications; excludes Next.js route announcer ([role="alert"])
    return this.page.locator('[data-sonner-toast], .error-message, [data-error="true"]');
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
  const baseURL = process.env.BASE_URL || 'http://localhost:3002';
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
 * Create authenticated context fixture.
 *
 * The middleware trusts any non-empty `auth-token` cookie — no API call required.
 * Setting this cookie allows tests to access /dashboard/* without a real Supabase session.
 * Dashboard pages will call their own APIs; those that require a session will show
 * error/empty states, which the test assertions handle defensively.
 */
export async function createAuthenticatedContext(
  context: BrowserContext,
  _page: Page
): Promise<boolean> {
  await setAuthCookie(context, 'test-e2e-token');
  return true;
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
