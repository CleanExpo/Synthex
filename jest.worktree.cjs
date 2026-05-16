/**
 * Worktree-specific Jest configuration.
 *
 * jest.config.cjs uses `testMatch` with `<rootDir>` glob patterns that break
 * on Windows when the worktree path contains a backslash segment
 * (e.g. D:\Synthex\.worktrees\...). The resolved pattern becomes
 * "D:/Synthex\.worktrees/..." which is not a valid glob on this host.
 *
 * This config uses `testRegex` instead, which is path-separator-agnostic.
 * Run with: npx jest --config jest.worktree.cjs
 */
module.exports = {
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
