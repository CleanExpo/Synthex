const path = require('path');
const worktree = require('./jest.worktree.cjs');

const rootDir = path.join(__dirname, '../..');

/**
 * JEV deterministic families (tests/eval/jev/families/*.jev.test.ts).
 *
 * Shares transforms, setupFiles and moduleNameMapper with jest.worktree.cjs.
 * Node environment: route handlers run in-process and need Node's native
 * Request/Response, not jsdom's. No coverage floors — the verdict is
 * tests/eval/jev/runner/aggregate.mjs, not the Jest exit code.
 * Run with: npm run jev:det [-- --family J3]
 */
module.exports = {
  rootDir,
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: worktree.setupFiles,
  roots: ['<rootDir>/tests/eval/jev'],
  testRegex: [
    'tests[\\\\/]eval[\\\\/]jev[\\\\/]families[\\\\/][^\\\\/]+\\.jev\\.test\\.ts$',
  ],
  testPathIgnorePatterns: ['/node_modules/'],
  moduleFileExtensions: worktree.moduleFileExtensions,
  transform: worktree.transform,
  transformIgnorePatterns: worktree.transformIgnorePatterns,
  moduleNameMapper: worktree.moduleNameMapper,
  testTimeout: 30000,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  forceExit: true,
};
