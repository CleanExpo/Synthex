/**
 * Control for tests/rtl.setup.js.
 *
 * The fix is a setup file, and a setup file that is not wired in fails SILENTLY: the suite
 * still runs, RTL keeps its 1000ms default, and the flakes continue while the repo looks
 * fixed. This asserts the configured value directly, so the guard cannot become unarmed
 * without a test going red.
 *
 * Falsification: delete '<rootDir>/tests/rtl.setup.js' from setupFilesAfterEnv in
 * config/jest/jest.worktree.cjs and this fails with `Expected: 5000, Received: 1000`.
 */
import { getConfig } from '@testing-library/react';

describe('RTL async utility timeout', () => {
  it('is raised above the 1000ms default, so parallel-worker load cannot fake a failure', () => {
    expect(getConfig().asyncUtilTimeout).toBe(5000);
  });

  it('still sits well inside the jest testTimeout, so a hung test fails rather than hangs', () => {
    const jestConfig = require('../../config/jest/jest.worktree.cjs');
    expect(getConfig().asyncUtilTimeout).toBeLessThan(jestConfig.testTimeout);
  });
});
