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

  // Use testRegex (path-separator-agnostic) instead of testMatch glob
  testRegex: [
    'tests[\\\\/]unit[\\\\/].+\\.test\\.(ts|tsx|js)$',
    'tests[\\\\/]unit[\\\\/].+\\.spec\\.(ts|tsx|js)$',
    'tests[\\\\/]integration[\\\\/].+\\.test\\.(ts|tsx|js)$',
    'tests[\\\\/]contract[\\\\/].+\\.test\\.(ts|tsx|js)$',
    'tests[\\\\/]strategic-marketing[\\\\/].+\\.test\\.(ts|tsx|js)$',
    '__tests__[\\\\/].+\\.test\\.(ts|tsx|js)$',
  ],

  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    '/tests/e2e/',
    '/tests/playwright/',
    // Ignore .claude config dirs but NOT .claude/worktrees (this config runs from inside a worktree)
    '[\\\\/]\\.claude[\\\\/](?!worktrees)',
  ],

  // Allow Jest to transform ESM-only packages that are transitive deps
  // (e.g. isomorphic-dompurify → jsdom → @exodus/bytes uses ESM export syntax)
  transformIgnorePatterns: ['/node_modules/(?!(@exodus/bytes)/)'],

  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: { jsx: 'react-jsx' } }],
    '^.+\\.(js|jsx)$': 'babel-jest',
  },

  testTimeout: 30000,
  verbose: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  forceExit: true,
  detectOpenHandles: true,

  moduleNameMapper: {
    // Force CJS build of isomorphic-dompurify — Jest 30 resolves the .mjs version
    // via exports map conditions even with customExportConditions:['require'],
    // causing "Unexpected token 'export'" for the jsdom→@exodus/bytes chain.
    '^isomorphic-dompurify$':
      require.resolve('isomorphic-dompurify/dist/index.js'),
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
    '^@/hooks/(.*)$': '<rootDir>/hooks/$1',
    '^@/utils/(.*)$': '<rootDir>/utils/$1',
    '^@/types/(.*)$': '<rootDir>/types/$1',
    '^@/(.*)$': '<rootDir>/$1',
    '^bullmq$': '<rootDir>/tests/__mocks__/bullmq.js',
    // Prisma 7 + jsdom: force the Node.js entrypoint for @prisma/client.
    // jsdom activates the `browser` export condition which resolves to index-browser.js
    // and crashes (objectEnumValues undefined). Pointing directly to default.js bypasses
    // the browser field while still allowing sub-path imports (e.g. @prisma/client/runtime/*)
    // to resolve through the package exports map via testEnvironmentOptions above.
    // Use require.resolve so this works in both repo root AND git worktrees (no local node_modules).
    '^@prisma/client$': require.resolve('@prisma/client/default.js'),
  },
};
