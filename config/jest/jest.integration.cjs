const path = require('path');

const rootDir = path.join(__dirname, '../..');

/**
 * Integration-profile Jest configuration (SYN-MCP-000).
 *
 * Runs *.integration.test.{ts,js} under tests/integration/ against the LIVE
 * Docker verification sandbox (deployment/docker-compose.test.yml):
 *   - Postgres (pgvector/pgvector:pg16) on host port 5499
 *   - Redis (redis:7-alpine) on host port 6399
 *
 * Differences from jest.config.cjs / jest.worktree.cjs (the unit profiles):
 *   - testEnvironment 'node' (no jsdom; these tests exercise server code).
 *   - NO `^bullmq$` mock mapping — real bullmq talks to the sandbox Redis.
 *   - globalSetup guards the env (hard-fails off-sandbox), runs
 *     `prisma db push` and seeds deterministic fixtures.
 *   - No coverage thresholds — this profile proves behaviour, not coverage.
 *
 * Usage:
 *   npm run sandbox:up
 *   npm run test:integration      # jest --config config/jest/jest.integration.cjs --runInBand
 *   npm run sandbox:down
 *
 * Uses testRegex (path-separator-agnostic) like jest.worktree.cjs so it works
 * from Windows git worktrees as well as POSIX CI runners.
 */
module.exports = {
  rootDir,
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Discovery: ONLY the integration suite, ONLY the *.integration.test.* suffix.
  // (The unit profiles exclude that suffix, so each file runs in exactly one profile.)
  roots: ['<rootDir>/tests/integration'],
  testRegex: [
    'tests[\\\\/]integration[\\\\/].+\\.integration\\.test\\.(ts|tsx|js)$',
  ],

  // Env guard + prisma db push + seed. Runs once before the suite.
  globalSetup: '<rootDir>/tests/integration/setup/global-setup.ts',

  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: { jsx: 'react-jsx' } }],
    '^.+\\.(js|jsx)$': 'babel-jest',
  },

  // Same ESM-only allowlist as the unit profiles.
  transformIgnorePatterns: [
    'node_modules/(?!(uncrypto|@upstash/redis|jose|@panva|oauth4webapi)/)',
  ],

  moduleNameMapper: {
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
    '^@/hooks/(.*)$': '<rootDir>/hooks/$1',
    '^@/utils/(.*)$': '<rootDir>/utils/$1',
    '^@/types/(.*)$': '<rootDir>/types/$1',
    '^@/(.*)$': '<rootDir>/$1',
    // NOTE: deliberately NO '^bullmq$' mock here — the whole point of this
    // profile is real bullmq against the sandbox Redis.
    // Prisma 7: pin the Node entrypoint via require.resolve so resolution
    // works from git worktrees (junctioned node_modules) — same convention
    // as jest.worktree.cjs.
    '^@prisma/client$': require.resolve('@prisma/client/default.js'),
  },

  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/coverage/'],

  // Container round-trips + a full `prisma db push` warrant a generous budget.
  testTimeout: 60000,
  verbose: true,
  clearMocks: true,
  restoreMocks: true,
  forceExit: true,
  detectOpenHandles: true,
};
