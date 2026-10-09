/** Pure offline contracts; package declarations are checked by its separate build. */
const base = require('./jest.worktree.cjs');

module.exports = {
  ...base,
  testEnvironment: 'node',
  transform: {
    ...base.transform,
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      { tsconfig: { jsx: 'react-jsx', isolatedModules: true } },
    ],
  },
  testRegex: [
    '__tests__[\\/]brand-config[\\/](visual-preflight|logo-paths|logo-packs)\\.test\\.ts$',
    '__tests__[\\/]remotion[\\/]brand-registry\\.test\\.ts$',
    'tests[\\/]unit[\\/]brand-video[\\/]preflight\\.test\\.ts$',
  ],
};
