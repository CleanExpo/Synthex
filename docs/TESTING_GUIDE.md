# SYNTHEX Testing Guide

> **Task:** UNI-417 - Testing & Quality Assurance Epic

This guide covers testing practices, utilities, and best practices for SYNTHEX.

## Table of Contents

1. [Test Structure](#test-structure)
2. [Unit Testing](#unit-testing)
3. [Integration Testing](#integration-testing)
4. [E2E Testing](#e2e-testing)
5. [Test Utilities](#test-utilities)
6. [Running Tests](#running-tests)
7. [Best Practices](#best-practices)

---

## Test Structure

```
tests/
├── unit/                    # Unit tests
│   └── services/
├── integration/             # API integration tests
│   ├── health-check.test.ts
│   └── quotes-api.test.ts
├── e2e/                     # Playwright E2E tests
│   ├── auth.spec.ts
│   ├── dashboard.spec.ts
│   └── navigation.spec.ts
└── setup.ts                 # Global test setup
```

---

## Unit Testing

### Basic Unit Test

```typescript
import { describe, it, expect } from '@jest/globals';
import { validateUser } from '@/lib/data';

describe('validateUser', () => {
  it('validates correct user data', () => {
    const result = validateUser({
      email: 'test@example.com',
      name: 'Test User',
      authProvider: 'local',
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects invalid email', () => {
    const result = validateUser({
      email: 'invalid-email',
      name: 'Test User',
    });

    expect(result.valid).toBe(false);
    expect(result.errors[0].path).toContain('email');
  });
});
```

### Using Mock Factories

```typescript
import { createMockUser, createMockCampaign } from '@/lib/testing';

describe('Campaign Service', () => {
  it('creates campaign for user', () => {
    const user = createMockUser();
    const campaign = createMockCampaign(user.id, {
      name: 'My Campaign',
      status: 'active',
    });

    expect(campaign.userId).toBe(user.id);
    expect(campaign.status).toBe('active');
  });
});
```

---

## Integration Testing

### API Route Testing

```typescript
import { describe, it, expect } from '@jest/globals';
import {
  createTestRequest,
  createAuthenticatedRequest,
  expectStatus,
  expectSuccess,
  expectError,
} from '@/lib/testing';
import { GET, POST } from '@/app/api/users/route';

describe('GET /api/users', () => {
  it('returns users for authenticated request', async () => {
    const request = createAuthenticatedRequest('GET', '/api/users', 'user-123');
    const response = await GET(request);

    const data = await expectSuccess(response);
    expect(data.users).toBeDefined();
  });

  it('returns 401 for unauthenticated request', async () => {
    const request = createTestRequest('GET', '/api/users');
    const response = await GET(request);

    await expectError(response, 401, 'Unauthorized');
  });
});

describe('POST /api/users', () => {
  it('creates new user', async () => {
    const request = createTestRequest('POST', '/api/users', {
      body: {
        email: 'new@example.com',
        name: 'New User',
        password: 'password123',
      },
    });

    const response = await POST(request);
    const data = await expectStatus(response, 201);

    expect(data.user.email).toBe('new@example.com');
  });
});
```

### Database Integration Testing

```typescript
import {
  TestDatabase,
  TestDataFactory,
  createTestDatabase,
  createTestDataFactory,
} from '@/lib/testing';

describe('User Repository', () => {
  let testDb: TestDatabase;
  let factory: TestDataFactory;

  beforeAll(async () => {
    testDb = createTestDatabase();
    await testDb.connect();
    factory = createTestDataFactory(testDb);
  });

  afterAll(async () => {
    await testDb.disconnect();
  });

  beforeEach(async () => {
    await testDb.reset();
  });

  it('creates user in database', async () => {
    const user = await factory.createUser({
      email: 'test@example.com',
      name: 'Test User',
    });

    expect(user.id).toBeDefined();
    expect(user.email).toBe('test@example.com');
  });

  it('creates full scenario', async () => {
    const scenario = await factory.createFullScenario();

    expect(scenario.user).toBeDefined();
    expect(scenario.campaign.userId).toBe(scenario.user.id);
    expect(scenario.posts).toHaveLength(2);
  });
});
```

---

## E2E Testing

### Playwright Setup

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
});
```

### E2E Test Example

```typescript
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('user can login', async ({ page }) => {
    await page.goto('/login');

    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('[type="submit"]');

    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('[name="email"]', 'wrong@example.com');
    await page.fill('[name="password"]', 'wrongpassword');
    await page.click('[type="submit"]');

    await expect(page.locator('[role="alert"]')).toContainText('Invalid credentials');
  });
});
```

### E2E Page Objects

```typescript
// tests/e2e/pages/login.page.ts
import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('[name="email"]');
    this.passwordInput = page.locator('[name="password"]');
    this.submitButton = page.locator('[type="submit"]');
    this.errorMessage = page.locator('[role="alert"]');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
```

---

## Test Utilities

### API Test Helpers

```typescript
import {
  createTestRequest,
  createAuthenticatedRequest,
  createTestContext,
  expectStatus,
  expectSuccess,
  expectError,
  expectHeaders,
  expectJsonResponse,
  expectRateLimitHeaders,
  measureResponseTime,
  expectResponseTime,
} from '@/lib/testing';

// Create requests
const request = createTestRequest('GET', '/api/test');
const authRequest = createAuthenticatedRequest('POST', '/api/data', 'user-123');

// Assert responses
await expectStatus(response, 200);
await expectSuccess(response);
await expectError(response, 404, 'Not found');

// Check headers
expectHeaders(response, { 'Content-Type': /application\/json/ });
expectRateLimitHeaders(response);

// Measure performance
const response = await expectResponseTime(() => handler(), 1000);
```

### Database Test Helpers

```typescript
import {
  TestDatabase,
  TestDataFactory,
  waitForDatabase,
} from '@/lib/testing';

// Setup
const testDb = new TestDatabase();
await testDb.connect();

// Create test data
const factory = new TestDataFactory(testDb);
const user = await factory.createUser();
const campaign = await factory.createCampaign(user.id);
const posts = await factory.createPosts(campaign.id, 5);

// Cleanup
await testDb.reset();
await testDb.disconnect();
```

### Mock Factories

```typescript
import {
  createMockUser,
  createMockCampaign,
  createMockPost,
  createMockQuote,
} from '@/lib/testing';

const user = createMockUser({ name: 'Custom Name' });
const campaign = createMockCampaign(user.id, { status: 'active' });
const post = createMockPost(campaign.id, { platform: 'instagram' });
const quote = createMockQuote({ aiGenerated: true });
```

---

## Running Tests

### Commands

```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run integration tests
npm run test:integration

# Run E2E tests
npm run e2e

# Run E2E tests with UI
npm run e2e:ui

# Run specific test file
npm test -- tests/unit/services/user.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="creates user"
```

### Coverage Thresholds

```javascript
// jest.config.js
module.exports = {
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
```

---

## Best Practices

### 1. Test Organization

```typescript
describe('ComponentName or FunctionName', () => {
  describe('methodName', () => {
    it('should do X when Y', () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

### 2. Avoid Test Pollution

```typescript
// ✅ DO: Reset state between tests
beforeEach(async () => {
  await testDb.reset();
});

// ❌ DON'T: Share state between tests
let sharedUser; // This can cause flaky tests
```

### 3. Test Behavior, Not Implementation

```typescript
// ✅ DO: Test observable behavior
it('returns user by email', async () => {
  const user = await userService.findByEmail('test@example.com');
  expect(user.email).toBe('test@example.com');
});

// ❌ DON'T: Test implementation details
it('calls prisma.user.findUnique', async () => {
  // This test is brittle and not meaningful
});
```

### 4. Use Descriptive Test Names

```typescript
// ✅ DO: Describe the scenario clearly
it('returns 404 when user does not exist', async () => {});
it('sends welcome email after registration', async () => {});

// ❌ DON'T: Use vague names
it('works', async () => {});
it('test 1', async () => {});
```

### 5. Mock External Dependencies

```typescript
// Mock external APIs
jest.mock('@/lib/email', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true }),
}));

// Mock time
jest.useFakeTimers();
jest.setSystemTime(new Date('2026-02-02'));
```

### 6. Test Edge Cases

```typescript
describe('validateEmail', () => {
  it('handles empty string', () => {});
  it('handles null', () => {});
  it('handles very long email', () => {});
  it('handles unicode characters', () => {});
  it('handles email with subdomain', () => {});
});
```

### 7. Use Test Data Factories

```typescript
// ✅ DO: Use factories for test data
const user = await factory.createUser();

// ❌ DON'T: Hardcode test data everywhere
const user = {
  id: 'user-123',
  email: 'test@example.com',
  // ... 20 more fields
};
```

---

## CI Integration

### GitHub Actions

```yaml
# .github/workflows/tests.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm ci
      - run: npm test -- --coverage
      - run: npm run test:integration
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx playwright install
      - run: npm run e2e
```

---

## Related Documentation

- [Developer Onboarding](./DEVELOPER_ONBOARDING.md)
- [API Documentation](./API_DOCUMENTATION.md)
- [Scalability Guide](./SCALABILITY_GUIDE.md)

---

*Last updated: 2026-02-02*
