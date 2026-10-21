const jev = require('./jest.jev.cjs');

/**
 * JEV goal sweep (tests/eval/jev/sweep/*.sweep.test.ts).
 *
 * Same transforms, setupFiles and module mapping as the JEV families
 * (jest.jev.cjs), but a separate test pattern so the sweep never runs inside
 * `npm run jev:det` and never touches the hard-gate family table.
 * Run with: npm run jev:sweep (tests/eval/jev/sweep/run.mjs).
 */
module.exports = {
  ...jev,
  testRegex: [
    'tests[\\\\/]eval[\\\\/]jev[\\\\/]sweep[\\\\/][^\\\\/]+\\.sweep\\.test\\.ts$',
  ],
  testTimeout: 1_200_000,
};
