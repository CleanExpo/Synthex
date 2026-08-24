import assert from 'node:assert/strict';
import test from 'node:test';

import { assertSafeHost, assertSafePort, hubUrl } from '../src/relay.mjs';

/**
 * SSRF guard — CodeQL js/request-forgery, critical, on PR #908.
 *
 * The relay built its request URL by interpolation:
 *   `http://${hubHost}:${target.officePort}${HOOK_API_PREFIX}/${providerId}`
 * `officePort` comes from the hub's /pair JSON, which is remote and was
 * unvalidated. A value containing `@` splits the authority: everything before
 * it becomes userinfo and everything after becomes the real host. Every hook
 * event AND the office Bearer token would then be POSTed to the attacker.
 *
 * These cases assert the escape is refused. If any starts passing, the guard
 * has been loosened back into the vulnerability.
 */

test('the exact exfiltration payload is refused', () => {
  // http://hub.ts.net:0@evil.example.com/... — host becomes evil.example.com.
  assert.throws(
    () => hubUrl('hub.ts.net', '0@evil.example.com', '/api/hooks/claude'),
    /refusing unsafe port/
  );
});

test('a hub-supplied port must be a real TCP port', () => {
  for (const bad of [
    '4319/../x',
    '0@evil.example.com',
    -1,
    0,
    65536,
    1.5,
    '4319',
    null,
    undefined,
  ]) {
    assert.throws(
      () => assertSafePort(bad, 'office port'),
      /refusing unsafe office port/,
      `accepted ${JSON.stringify(bad)}`
    );
  }
  assert.equal(assertSafePort(4319, 'office port'), 4319);
  assert.equal(assertSafePort(1, 'office port'), 1);
  assert.equal(assertSafePort(65535, 'office port'), 65535);
});

test('a host carrying userinfo, a path, or whitespace is refused', () => {
  for (const bad of [
    'hub@evil.example.com',
    'hub.ts.net/../evil',
    'hub.ts.net:9999',
    'hub .ts.net',
    'http://hub.ts.net',
    '',
    null,
  ]) {
    assert.throws(
      () => assertSafeHost(bad),
      /refusing unsafe hub host/,
      `accepted ${JSON.stringify(bad)}`
    );
  }
});

test('legitimate hosts still work', () => {
  assert.equal(assertSafeHost('100.94.139.34'), '100.94.139.34');
  assert.equal(
    assertSafeHost('phill-desktop.tail5ef339.ts.net'),
    'phill-desktop.tail5ef339.ts.net'
  );
  assert.equal(
    assertSafeHost('[fd7a:115c:a1e0::c83a:8b23]'),
    '[fd7a:115c:a1e0::c83a:8b23]'
  );
});

test('a built URL keeps the intended host, port and path', () => {
  const url = hubUrl('100.94.139.34', 4319, '/api/hooks/claude');
  assert.equal(url.hostname, '100.94.139.34');
  assert.equal(url.port, '4319');
  assert.equal(url.pathname, '/api/hooks/claude');
  assert.equal(url.username, '', 'no userinfo may appear');
  assert.equal(url.href, 'http://100.94.139.34:4319/api/hooks/claude');
});
