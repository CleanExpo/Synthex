const path = require('path');

const rootDir = path.join(__dirname, '../..');

/**
 * Worktree-specific Jest configuration.
 *
 * jest.config.cjs uses `testMatch` with `<rootDir>` glob patterns that break
 * on Windows when the worktree path contains a backslash segment
 * (e.g. D:\Synthex\.worktrees\...). The resolved pattern becomes
 * "D:/Synthex\.worktrees/..." which is not a valid glob on this host.
 *
 * This config uses `testRegex` instead, which is path-separator-agnostic.
 * Run with: npx jest --config config/jest/jest.worktree.cjs
 */
module.exports = {
  rootDir,
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  // Prisma 7 + jsdom: prevent Jest from activating the `browser` export condition.
  // jsdom sets customExportConditions = ['browser'] by default, causing module
  // resolution to pick index-browser.js for @prisma/client sub-paths (e.g. runtime/*),
  // which crash because objectEnumValues is undefined in the browser build.
  // The `require` condition only (no `browser`) restores standard Node behaviour.
  testEnvironmentOptions: {
    customExportConditions: ['require', 'default'],
  },
  setupFiles: ['<rootDir>/tests/jest.setup.js'],
  setupFilesAfterEnv: ['@testing-library/jest-dom'],

  // Scope discovery to known test roots only.
  // Prevents `.claude/worktrees/*/tests/` from being picked up when running
  // `npm test` from the main repo (was the source of 12+ duplicate suite failures).
  roots: ['<rootDir>/tests', '<rootDir>/__tests__'],

  // Use testRegex (path-separator-agnostic) instead of testMatch glob
  testRegex: [
    'tests[\\\\/]unit[\\\\/].+\\.test\\.(ts|tsx|js)$',
    'tests[\\\\/]unit[\\\\/].+\\.spec\\.(ts|tsx|js)$',
    'tests[\\\\/]integration[\\\\/].+\\.test\\.(ts|tsx|js)$',
    'tests[\\\\/]contract[\\\\/].+\\.test\\.(ts|tsx|js)$',
    'tests[\\\\/]strategic-marketing[\\\\/].+\\.test\\.(ts|tsx|js)$',
    'tests[\\\\/]auto-publish[\\\\/].+\\.test\\.(ts|tsx|js)$',
    'tests[\\\\/]pipelines[\\\\/].+\\.smoke\\.test\\.(ts|tsx|js)$',
    'tests[\\\\/]external-apis[\\\\/].+\\.test\\.(ts|tsx|js)$',
    'tests[\\\\/]auth[\\\\/].+\\.test\\.(ts|tsx|js)$',
    'tests[\\\\/]security[\\\\/].+\\.spec\\.(ts|tsx|js)$',
    '__tests__[\\\\/].+\\.test\\.(ts|tsx|js)$',
  ],

  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    '/tests/e2e/',
    '/tests/playwright/',
    '/templates/',
    // NOTE: the \.claude\/ pattern is intentionally omitted here.
    // This config runs from C:\Synthex\.claude\worktrees\infallible-pasteur\ so all
    // paths contain \.claude\ — that pattern would exclude every test in the worktree.
    // Claude's own files (skills, hooks, rules) don't match testRegex so they're safe.
    '[\\\\/]\\.claude[\\\\/](?!worktrees[\\\\/])',
    // *.integration.test.* requires the live Docker sandbox — runs ONLY under
    // jest.integration.cjs (SYN-MCP-000), never in the unit profile.
    '\\.integration\\.test\\.',
  ],

  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: { jsx: 'react-jsx' } }],
    '^.+\\.(js|jsx)$': 'babel-jest',
  },

  // Allow babel-jest to transform these ESM-only packages from node_modules.
  // Default `transformIgnorePatterns` ignores all of node_modules, which causes
  // SyntaxError on `export` keyword for: uncrypto (via @upstash/redis),
  // jose (auth tokens), @panva and oauth4webapi (Supabase auth).
  transformIgnorePatterns: [
    'node_modules/(?!(uncrypto|@upstash/redis|jose|@panva|oauth4webapi)/)',
  ],

  testTimeout: 30000,
  verbose: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  forceExit: true,
  detectOpenHandles: true,

  // -------------------------------------------------------------------------
  // Real coverage floors (WS1 — enforce the existing quality gates).
  //
  // History: CI previously ran `npm test -- --coverage
  // --coverageThreshold='{"global":{"statements":5}}'`. A 5% statement floor
  // is a no-op — it can never fail — so coverage was effectively unguarded at
  // the merge button. These floors replace that no-op with real numbers.
  //
  // Each floor is set AT or JUST BELOW the value measured on this branch
  // (2026-06-14) so CI stays green today. They are intended to RATCHET UP over
  // time: when a path's real coverage climbs, raise its floor toward it. Never
  // lower a floor to make a regression pass — fix the test instead.
  //
  // Jest applies per-path keys to EACH matching file individually (not the
  // directory aggregate). Floors below are therefore tuned to the weakest file
  // currently in scope, with a small margin. Measured values (stmt/br/fn/ln):
  //   global ................................. 64.4 / 47.1 / 57.4 / 65.1
  //   lib/external-apis/gbp-client.ts ........ 92.9 / 85.0 / 75.0 / 92.9
  //   lib/publish/publishQueue.ts (weakest) .. 83.8 / 56.6 / 100  / 85.0
  //   lib/publish/safetyChecks.ts ............ 100  / 80.4 / 100  / 100
  //   lib/auth/with-auth.ts .................. 100  / 100  / 100  / 100
  //   lib/auth/jwt-utils.ts .................. 93.3 / 76.9 / 93.3 / 93.2
  //   lib/auth/cron-auth.ts .................. 95.7 / 93.8 / 100  / 95.5
  //   lib/stripe/webhook-handlers.ts ......... 73.7 / 49.7 / 88.9 / 73.7
  //   lib/webhooks/signature-verifier.ts ..... 95.7 / 96.4 / 100  / 95.6
  // -------------------------------------------------------------------------
  coverageThreshold: {
    global: { statements: 60, branches: 40, functions: 50, lines: 60 },
    // External API clients (publish destinations)
    'lib/external-apis/**': {
      statements: 90,
      branches: 80,
      functions: 70,
      lines: 90,
    },
    // Publish pipeline (queue claim + safety checks)
    'lib/publish/**': {
      statements: 82,
      branches: 55,
      functions: 95,
      lines: 82,
    },
    // Auth gate wrapper — security-critical, keep at 100
    'lib/auth/with-auth.ts': {
      statements: 100,
      branches: 95,
      functions: 100,
      lines: 100,
    },
    // JWT issue/verify
    'lib/auth/jwt-utils.ts': {
      statements: 90,
      branches: 75,
      functions: 90,
      lines: 90,
    },
    // Cron endpoint auth
    'lib/auth/cron-auth.ts': {
      statements: 90,
      branches: 90,
      functions: 100,
      lines: 90,
    },
    // Stripe webhook handler
    'lib/stripe/webhook-handlers.ts': {
      statements: 70,
      branches: 45,
      functions: 85,
      lines: 70,
    },
    // Inbound webhook signature verification — security-critical
    'lib/webhooks/signature-verifier.ts': {
      statements: 90,
      branches: 90,
      functions: 100,
      lines: 90,
    },
  },

  moduleNameMapper: {
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
    '^@/hooks/(.*)$': '<rootDir>/hooks/$1',
    '^@/utils/(.*)$': '<rootDir>/utils/$1',
    '^@/types/(.*)$': '<rootDir>/types/$1',
    '^@/(.*)$': '<rootDir>/$1',
    '^bullmq$': '<rootDir>/tests/__mocks__/bullmq.js',
    // uuid v9+ is pure ESM — redirect to the CJS test shim.
    '^uuid$': '<rootDir>/tests/__mocks__/uuid.js',
    // Prisma 7 + jsdom: force the Node.js entrypoint for @prisma/client.
    // jsdom activates the `browser` export condition which resolves to index-browser.js
    // and crashes (objectEnumValues undefined). Pointing directly to default.js bypasses
    // the browser field while still allowing sub-path imports (e.g. @prisma/client/runtime/*)
    // to resolve through the package exports map via testEnvironmentOptions above.
    // Use require.resolve so this works in both repo root AND git worktrees (no local node_modules).
    '^@prisma/client$': require.resolve('@prisma/client/default.js'),
  },
};
