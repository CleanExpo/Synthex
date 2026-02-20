import { defineConfig, devices } from '@playwright/test';

const SKIP_WS = !!process.env.PW_SKIP_WEBSERVER;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : 2,
  timeout: 60000,
  reporter: 'html',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3002',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'deployment-tests',
      testMatch: 'deployment.spec.ts',
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: 'deployment.spec.ts',
    },
  ],

  webServer: SKIP_WS
    ? undefined
    : {
        command: 'npm run dev:next -- -p 3002',
        url: 'http://localhost:3002',
        reuseExistingServer: true,
        timeout: 300 * 1000,
      },
});
