module.exports = {
  // Use the base Jest configuration
  ...require('./jest.config.js'),
  
  // Coverage specific settings
  collectCoverage: true,
  
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    'public/js/**/*.js',
    '!src/**/*.test.{js,ts}',
    '!src/**/*.spec.{js,ts}',
    '!src/**/index.{js,ts}',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
    '!src/testing/**',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/coverage/**',
    '!**/build/**'
  ],
  
  coverageDirectory: 'coverage',
  
  coverageReporters: [
    'json',
    'lcov',
    'text',
    'text-summary',
    'html',
    'cobertura'
  ],
  
  coverageThresholds: {
    global: {
      branches: 70,
      functions: 75,
      lines: 80,
      statements: 80
    },
    './src/services/': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    },
    './src/routes/': {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './public/js/': {
      branches: 60,
      functions: 70,
      lines: 75,
      statements: 75
    }
  },
  
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    '/.github/',
    '/scripts/',
    '/tests/fixtures/',
    '/tests/helpers/',
    '\\.config\\.js$',
    '\\.setup\\.js$'
  ],
  
  testMatch: [
    '**/__tests__/**/*.{js,ts}',
    '**/*.test.{js,ts}',
    '**/*.spec.{js,ts}'
  ],
  
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/.git/',
    '/coverage/'
  ],
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // Transform files
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.jsx?$': 'babel-jest'
  },
  
  // Module name mapper for aliases
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@public/(.*)$': '<rootDir>/public/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@routes/(.*)$': '<rootDir>/src/routes/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
  },
  
  // Test environment
  testEnvironment: 'jsdom',
  
  // Globals
  globals: {
    'ts-jest': {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    }
  },
  
  // Verbose output
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks after each test
  restoreMocks: true,
  
  // Coverage provider
  coverageProvider: 'v8',
  
  // Max workers for parallel execution
  maxWorkers: '50%'
};