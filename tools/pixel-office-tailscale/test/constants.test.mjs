import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

/**
 * The relay's registry filename and its full path must never be two independent
 * literals.
 *
 * They were, and only the path honoured PIXEL_OFFICE_RELAY_FILE. Setting that
 * override moved the file the relay WRITES while leaving the name the hub
 * EXCLUDES pointing at the old one, so `startPairServer` could hand a satellite
 * the local relay's own registry entry instead of the office's — pairing a
 * machine back to a relay, with a token that is not the office's. Found by
 * independent review as PIXEL-OFFICE-TAILSCALE-01/02.
 */

const CUSTOM = 'a-deliberately-different-name.json';

test('the relay filename and path stay in agreement under the default name', async () => {
  delete process.env.PIXEL_OFFICE_RELAY_FILE;
  const mod = await import(`../src/constants.mjs?default-${Date.now()}`);
  assert.equal(mod.RELAY_REGISTRY_FILENAME, 'tailscale-relay.json');
  assert.equal(
    path.basename(mod.RELAY_REGISTRY_FILE),
    mod.RELAY_REGISTRY_FILENAME,
    'the path the relay writes must end in the name the hub excludes'
  );
});

test('the relay filename and path stay in agreement under PIXEL_OFFICE_RELAY_FILE', async () => {
  process.env.PIXEL_OFFICE_RELAY_FILE = CUSTOM;
  try {
    // Cache-busting query so the module re-evaluates with the env var set;
    // constants are resolved once at import time.
    const mod = await import(`../src/constants.mjs?custom-${Date.now()}`);
    assert.equal(
      mod.RELAY_REGISTRY_FILENAME,
      CUSTOM,
      'the name must honour the override'
    );
    assert.equal(
      path.basename(mod.RELAY_REGISTRY_FILE),
      mod.RELAY_REGISTRY_FILENAME,
      'this is the assertion that fails if the two ever become separate literals again'
    );
  } finally {
    delete process.env.PIXEL_OFFICE_RELAY_FILE;
  }
});
