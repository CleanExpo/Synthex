module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFiles: ['<rootDir>/tests/jest.setup.js'],
  setupFilesAfterEnv: ['@testing-library/jest-dom'],

  // Scope discovery to known test roots only.
  // Prevents `.claude/worktrees/*/tests/` pollution (12+ duplicate suites).
  roots: ['<rootDir>/tests', '<rootDir>/__tests__'],

  // Test file patterns
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.{ts,tsx,js}',
    '<rootDir>/tests/unit/**/*.spec.{ts,tsx,js}',
    '<rootDir>/tests/integration/**/*.test.{ts,tsx,js}',
    '<rootDir>/tests/integration/**/*.spec.{ts,tsx,js}',
    '<rootDir>/tests/contract/**/*.test.{ts,tsx,js}',
    '<rootDir>/tests/contract/**/*.spec.{ts,tsx,js}',
    '<rootDir>/tests/strategic-marketing/**/*.test.{ts,tsx,js}',
    '<rootDir>/tests/strategic-marketing/**/*.spec.{ts,tsx,js}',
    '<rootDir>/tests/auto-publish/**/*.test.{ts,tsx,js}',
    '<rootDir>/tests/auto-publish/**/*.spec.{ts,tsx,js}',
    '<rootDir>/tests/external-apis/**/*.test.{ts,tsx,js}',
    '<rootDir>/tests/external-apis/**/*.spec.{ts,tsx,js}',
    '<rootDir>/tests/auth/**/*.test.{ts,tsx,js}',
    '<rootDir>/tests/auth/**/*.spec.{ts,tsx,js}',
    '<rootDir>/__tests__/**/*.test.{ts,tsx,js}',
    '<rootDir>/__tests__/**/*.spec.{ts,tsx,js}',
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'lib/**/*.{ts,js}',
    '!lib/**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
  ],

  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],

  // Coverage thresholds
  // Current: ~57% statements (post SYN-446 sprint, 2026-03-24)
  // Set slightly below actual to absorb new untested code added each sprint
  coverageThreshold: {
    global: {
      branches: 35,
      functions: 48,
      lines: 53,
      statements: 53,
    },
  },

  // Module resolution
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: { jsx: 'react-jsx' } }],
    '^.+\\.(js|jsx)$': 'babel-jest',
  },

  // Allow babel-jest to transform these ESM-only packages from node_modules.
  // uncrypto (via @upstash/redis), jose, @panva, oauth4webapi all use bare
  // `export` keyword which jest's default transformIgnorePatterns rejects.
  transformIgnorePatterns: [
    'node_modules/(?!(uncrypto|@upstash/redis|jose|@panva|oauth4webapi)/)',
  ],

  // Test timeout
  testTimeout: 30000,

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Module path mapping (must match tsconfig.json paths)
  moduleNameMapper: {
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
    '^@/hooks/(.*)$': '<rootDir>/hooks/$1',
    '^@/utils/(.*)$': '<rootDir>/utils/$1',
    '^@/types/(.*)$': '<rootDir>/types/$1',
    '^@/(.*)$': '<rootDir>/$1',
    // Mock ESM modules that Jest can't transform
    '^bullmq$': '<rootDir>/tests/__mocks__/bullmq.js',
  },

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    '/tests/e2e/',
    '/tests/playwright/',
    '/templates/',
    '\\.claude/(?!worktrees)', // Exclude .claude/ config files but allow worktrees
  ],

  // Reporter configuration
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: 'test-results',
        outputName: 'junit.xml',
        ancestorSeparator: ' › ',
        uniqueOutputName: 'false',
        suiteNameTemplate: '{filepath}',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
      },
    ],
  ],

  // Watch plugins
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname',
  ],

  // Force exit after tests complete
  forceExit: true,

  // Detect open handles
  detectOpenHandles: true,
};
