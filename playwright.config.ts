import { defineConfig, devices } from '@playwright/test';

const SKIP_WS = !!process.env.PW_SKIP_WEBSERVER;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3001',
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
        command: 'npm run dev:next -- -p 3001',
        url: 'http://localhost:3001',
        reuseExistingServer: true,
        timeout: 300 * 1000,
      },
});
