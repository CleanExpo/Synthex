import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

// Point the registry entry at a throwaway filename before the module that
// resolves it is imported, so these tests never touch a real relay's entry.
process.env.PIXEL_OFFICE_RELAY_FILE = 'tailscale-relay-test.json';

const { RELAY_REGISTRY_FILE } = await import('../src/constants.mjs');
const { startRelay } = await import('../src/relay.mjs');

/** A port nothing is listening on, so every hub call fails like a down hub. */
const DEAD_HUB_PORT = 9;

function withRelay(relayPort, fn) {
  fs.rmSync(RELAY_REGISTRY_FILE, { force: true });
  const relay = startRelay({
    hubHost: '127.0.0.1',
    pairPort: DEAD_HUB_PORT,
    pairKey: 'irrelevant-the-hub-is-down',
    relayPort,
    machine: 'test-machine',
    onLog: () => {},
  });
  return Promise.resolve()
    .then(() => fn(relay))
    .finally(() => {
      relay.shutdown();
      fs.rmSync(RELAY_REGISTRY_FILE, { force: true });
    });
}

test('relay registers before pairing, so a satellite that boots first is still reachable', () =>
  withRelay(45311, () => {
    // The deadlock this guards: register-after-pair means a hub that is down at
    // boot leaves no registry entry, claude-hook.js has no target, no event
    // ever arrives, and the pairing that would have written the entry is never
    // attempted. The machine stays invisible forever.
    assert.ok(fs.existsSync(RELAY_REGISTRY_FILE), 'registry entry exists with the hub unreachable');
    const entry = JSON.parse(fs.readFileSync(RELAY_REGISTRY_FILE, 'utf8'));
    assert.equal(entry.port, 45311);
    assert.equal(entry.pid, process.pid, 'entry claims OUR pid, satisfying the liveness rule');
    assert.ok(entry.token.length > 0, 'token is non-empty or the registry validator rejects it');
  }));

test('a hook posted while the hub is down is dropped, not fatal', () =>
  withRelay(45312, async (relay) => {
    // Drop this relay's registry entry before posting. Leaving it in place lets
    // the REAL claude-hook.js on the developer's machine discover the test
    // relay and post live events into it, which makes an exact drop count
    // flaky. (It also demonstrates the discovery mechanism works.)
    fs.rmSync(RELAY_REGISTRY_FILE, { force: true });
    let unhandled = null;
    const onUnhandled = (err) => {
      unhandled = err;
    };
    process.on('unhandledRejection', onUnhandled);
    try {
      const res = await fetch('http://127.0.0.1:45312/api/hooks/claude', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ hook_event_name: 'Stop', session_id: 's', cwd: '/tmp/p' }),
      });
      // The hook is answered immediately and forwarded in the background, so
      // an unreachable hub must never make Claude Code see a failing hook.
      assert.equal(res.status, 200);
      await new Promise((r) => setTimeout(r, 1500));
      assert.equal(unhandled, null, 'no unhandled rejection (this used to kill the relay)');
      assert.equal(relay.stats.dropped, 1, 'the drop is counted');
      assert.equal(relay.stats.forwarded, 0);
      assert.ok(relay.stats.lastError, 'the reason is recorded for /__relay/health');
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  }));

test('health endpoint answers while the hub is down', () =>
  withRelay(45313, async () => {
    const res = await fetch('http://127.0.0.1:45313/__relay/health');
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.machine, 'test-machine');
    assert.equal(body.status, 'ok');
  }));
