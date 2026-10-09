import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const proxyaddr = require('proxy-addr');

test('private mapped-IPv6 trust does not admit a public IPv4 peer or its spoofed client', () => {
  const trust = proxyaddr.compile(['::ffff:172.16.0.0/8']);
  assert.equal(trust('203.0.113.9'), false);
  assert.equal(
    proxyaddr(
      {
        socket: { remoteAddress: '203.0.113.9' },
        headers: { 'x-forwarded-for': '9.9.9.9' },
      },
      trust
    ),
    '203.0.113.9'
  );
});

test('mapped trust preserves legitimate private IPv4 proxies and client selection', () => {
  const trust = proxyaddr.compile(['::ffff:172.16.0.0/108']);
  assert.equal(trust('172.16.0.5'), true);
  assert.equal(trust('::ffff:172.16.0.5'), true);
  assert.equal(trust('172.32.0.5'), false);
  assert.equal(
    proxyaddr(
      {
        socket: { remoteAddress: '::ffff:172.16.0.5' },
        headers: { 'x-forwarded-for': '203.0.113.9' },
      },
      trust
    ),
    '203.0.113.9'
  );
});

test('native IPv6 subnet trust remains bounded', () => {
  const trust = proxyaddr.compile(['2001:db8::/32']);
  assert.equal(trust('2001:db8::5'), true);
  assert.equal(trust('2001:db9::5'), false);
  assert.equal(trust('203.0.113.9'), false);
});
