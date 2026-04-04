/**
 * CJS shim for the `uuid` package.
 *
 * uuid v9+ ships as pure ESM which Jest cannot transform without a Babel config.
 * This mock provides a deterministic CJS v4 implementation for tests.
 *
 * Wired via moduleNameMapper in jest.worktree.cjs and jest.config.cjs.
 */

let counter = 0;

function v4() {
  counter++;
  return `test-uuid-${String(counter).padStart(8, '0')}-0000-0000-0000-000000000000`;
}

function v1() {
  return v4();
}

module.exports = { v4, v1 };
module.exports.default = module.exports;
