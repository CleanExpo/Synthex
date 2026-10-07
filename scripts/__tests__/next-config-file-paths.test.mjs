import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import nextConfig from '../../next.config.mjs';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const emptyModulePath = path.join(repoRoot, 'lib', 'empty-module.cjs');

for (const dev of [false, true]) {
  test(`browser webpack alias uses a native file path (dev=${dev})`, () => {
    const config = nextConfig.webpack(
      { resolve: { alias: { existing: 'preserved' }, fallback: {} } },
      { dev, isServer: false }
    );

    assert.equal(config.resolve.alias.canvg, emptyModulePath);
    assert.ok(existsSync(config.resolve.alias.canvg));
    assert.equal(config.resolve.alias.existing, 'preserved');
  });
}

test('server webpack configuration leaves canvg resolution intact', () => {
  const config = nextConfig.webpack(
    { resolve: { alias: { canvg: 'server-canvg' }, fallback: {} } },
    { dev: false, isServer: true, nextRuntime: 'nodejs' }
  );

  assert.equal(config.resolve.alias.canvg, 'server-canvg');
});
