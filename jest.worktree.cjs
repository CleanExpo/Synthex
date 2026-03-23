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
    '\\.claude',
  ],

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
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
    '^@/hooks/(.*)$': '<rootDir>/hooks/$1',
    '^@/utils/(.*)$': '<rootDir>/utils/$1',
    '^@/types/(.*)$': '<rootDir>/types/$1',
    '^@/(.*)$': '<rootDir>/$1',
    '^bullmq$': '<rootDir>/tests/__mocks__/bullmq.js',
  },
};
