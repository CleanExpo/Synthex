/**
 * Onboarding E2E Test Fixtures
 *
 * Provides reusable test fixtures for onboarding flow testing.
 * Includes page objects, test data, and helper functions.
 *
 * @module tests/e2e/fixtures/onboarding.fixture
 */

import { test as base, expect, Page } from '@playwright/test';

// =============================================================================
// Test Data
// =============================================================================

export const ONBOARDING_DATA = {
  organization: {
    name: 'Test Company',
    industry: 'technology',
    teamSize: 'small',
  },
  persona: {
    name: 'Brand Voice',
    tone: 'professional',
  },
  platforms: ['twitter', 'linkedin'],
};

export const INDUSTRIES = [
  'technology',
  'ecommerce',
  'healthcare',
  'finance',
  'education',
  'entertainment',
  'food',
  'travel',
  'realestate',
  'nonprofit',
  'agency',
  'other',
];

export const TEAM_SIZES = ['solo', 'small', 'medium', 'large', 'enterprise'];

// =============================================================================
// Page Object Models
// =============================================================================

export class OnboardingWelcomePage {
  constructor(private page: Page) {}

  // Locators
  get heading() {
    return this.page.locator('h1');
  }

  get getStartedButton() {
    return this.page.locator('button:has-text("Get Started")');
  }

  get featureCards() {
    return this.page.locator('[class*="rounded-xl"]');
  }

  // Actions
  async goto() {
    await this.page.goto('/onboarding');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async startOnboarding() {
    await this.getStartedButton.click();
    await this.page.waitForURL('**/onboarding/step-1');
  }
}

export class OnboardingStep1Page {
  constructor(private page: Page) {}

  // Locators
  get heading() {
    return this.page.locator('h1');
  }

  get orgNameInput() {
    return this.page.locator('#org-name, input[placeholder*="organization"]');
  }

  get industrySelect() {
    return this.page.locator('#industry, [id*="industry"]').first();
  }

  get teamSizeSelect() {
    return this.page.locator('#team-size, [id*="team-size"]').first();
  }

  get continueButton() {
    return this.page.locator('button:has-text("Continue")');
  }

  get backButton() {
    return this.page.locator('button:has-text("Back")');
  }

  get progressIndicator() {
    return this.page.locator('[class*="progress"], [class*="step"]').first();
  }

  // Actions
  async goto() {
    await this.page.goto('/onboarding/step-1');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async fillOrganization(data: { name: string; industry: string; teamSize: string }) {
    await this.orgNameInput.fill(data.name);

    // Click industry select trigger
    await this.industrySelect.click();
    await this.page.waitForTimeout(100);

    // Select industry option
    const industryOption = this.page.locator(`[role="option"]:has-text("${data.industry}")`).first();
    if (await industryOption.isVisible()) {
      await industryOption.click();
    } else {
      // Fallback: try direct value selection
      await this.page.locator(`[data-value="${data.industry}"]`).first().click();
    }

    // Click team size select trigger
    await this.teamSizeSelect.click();
    await this.page.waitForTimeout(100);

    // Select team size option
    const teamSizeOption = this.page.locator(`[role="option"]:has-text("${data.teamSize}")`).first();
    if (await teamSizeOption.isVisible()) {
      await teamSizeOption.click();
    } else {
      await this.page.locator(`[data-value="${data.teamSize}"]`).first().click();
    }
  }

  async continue() {
    await this.continueButton.click();
    await this.page.waitForURL('**/onboarding/step-2');
  }
}

export class OnboardingStep2Page {
  constructor(private page: Page) {}

  // Locators
  get heading() {
    return this.page.locator('h1');
  }

  get platformConnector() {
    return this.page.locator('[class*="platform"], [data-testid*="platform"]');
  }

  get continueButton() {
    return this.page.locator('button:has-text("Continue")');
  }

  get skipButton() {
    return this.page.locator('button:has-text("Skip")');
  }

  get backButton() {
    return this.page.locator('button:has-text("Back")');
  }

  get platformButtons() {
    return this.page.locator('button[data-platform], [class*="platform"] button');
  }

  // Actions
  async goto() {
    await this.page.goto('/onboarding/step-2');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async skip() {
    await this.skipButton.click();
    await this.page.waitForURL('**/onboarding/step-3');
  }

  async continue() {
    await this.continueButton.click();
    await this.page.waitForURL('**/onboarding/step-3');
  }
}

export class OnboardingStep3Page {
  constructor(private page: Page) {}

  // Locators
  get heading() {
    return this.page.locator('h1');
  }

  get personaSetup() {
    return this.page.locator('[class*="persona"], [data-testid*="persona"]');
  }

  get continueButton() {
    return this.page.locator('button:has-text("Continue")');
  }

  get skipButton() {
    return this.page.locator('button:has-text("Skip")');
  }

  get backButton() {
    return this.page.locator('button:has-text("Back")');
  }

  // Actions
  async goto() {
    await this.page.goto('/onboarding/step-3');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async continue() {
    // Try skip/continue button
    const skipBtn = this.skipButton;
    const continueBtn = this.continueButton;

    if (await skipBtn.isVisible()) {
      await skipBtn.click();
    } else {
      await continueBtn.click();
    }

    await this.page.waitForURL('**/onboarding/complete');
  }
}

export class OnboardingCompletePage {
  constructor(private page: Page) {}

  // Locators
  get heading() {
    return this.page.locator('h1');
  }

  get dashboardButton() {
    return this.page.locator('button:has-text("Dashboard"), a:has-text("Dashboard")');
  }

  get successMessage() {
    return this.page.locator('[class*="success"], [data-success]');
  }

  // Actions
  async goto() {
    await this.page.goto('/onboarding/complete');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async goToDashboard() {
    await this.dashboardButton.click();
    await this.page.waitForURL('**/dashboard**');
  }
}

// =============================================================================
// Extended Test Fixture
// =============================================================================

type OnboardingFixtures = {
  welcomePage: OnboardingWelcomePage;
  step1Page: OnboardingStep1Page;
  step2Page: OnboardingStep2Page;
  step3Page: OnboardingStep3Page;
  completePage: OnboardingCompletePage;
};

export const test = base.extend<OnboardingFixtures>({
  welcomePage: async ({ page }, use) => {
    const welcomePage = new OnboardingWelcomePage(page);
    await use(welcomePage);
  },

  step1Page: async ({ page }, use) => {
    const step1Page = new OnboardingStep1Page(page);
    await use(step1Page);
  },

  step2Page: async ({ page }, use) => {
    const step2Page = new OnboardingStep2Page(page);
    await use(step2Page);
  },

  step3Page: async ({ page }, use) => {
    const step3Page = new OnboardingStep3Page(page);
    await use(step3Page);
  },

  completePage: async ({ page }, use) => {
    const completePage = new OnboardingCompletePage(page);
    await use(completePage);
  },
});

export { expect } from '@playwright/test';
