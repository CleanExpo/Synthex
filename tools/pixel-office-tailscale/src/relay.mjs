import http from 'node:http';
import { HOOK_API_PREFIX, RELAY_REGISTRY_FILE } from './constants.mjs';
import { removeRelayEntry, writeRelayEntry } from './registry.mjs';

/**
 * Rewrite one hook event so the hub can use it.
 *
 * Two changes, both load-bearing:
 *
 * 1. `transcript_path` is REMOVED. pixel-agents branches on it in
 *    adoptExternalSessionFromHook: with a path it adopts the session by opening
 *    that JSONL file and watching it for changes; without one it takes the
 *    "hooks-only" branch and builds the agent purely from hook events. A path
 *    from a satellite names a file the hub cannot see, so the file-watching
 *    branch would adopt an agent that never moves. Dropping the field selects
 *    the branch that works over a network.
 *
 * 2. `cwd`'s last segment gets `@<machine>` appended. The hub derives the label
 *    under each character from path.basename(cwd), so this is what makes an
 *    agent on the Mac read `synthex@unite-mac-mini` instead of an anonymous
 *    `synthex` indistinguishable from the local one. It also gives each machine
 *    a distinct projectDir, so office Areas can be mapped per machine.
 */
export function tagEvent(event, machine) {
  const tagged = { ...event };
  delete tagged.transcript_path;
  tagged.cwd = tagCwd(typeof event.cwd === 'string' ? event.cwd : '', machine);
  return tagged;
}

export function tagCwd(cwd, machine) {
  if (!cwd) return machine;
  // Deliberately NOT node:path. A relay on macOS receives POSIX paths and a
  // relay on Windows receives Windows ones, but path.join would rewrite the
  // separators of whichever style is not native and the hub then parses a path
  // shape neither machine produced. Splicing on the last separator leaves the
  // original string byte-identical apart from the appended tag.
  const trimmed = cwd.replace(/[\\/]+$/, '');
  if (!trimmed) return machine;
  const idx = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  const base = idx === -1 ? trimmed : trimmed.slice(idx + 1);
  if (!base) return machine;
  const prefix = idx === -1 ? '' : trimmed.slice(0, idx + 1);
  return `${prefix}${base}@${machine}`;
}

/** Fetch the current office token from the hub's pairing endpoint. */
export async function pair({ hubHost, pairPort, pairKey }) {
  const res = await fetch(`http://${hubHost}:${pairPort}/pair`, {
    headers: { authorization: `Bearer ${pairKey}` },
    signal: AbortSignal.timeout(8_000),
  });
  if (res.status === 401) throw new Error('hub rejected the pair key (401)');
  if (!res.ok) throw new Error(`hub pairing failed: HTTP ${res.status} ${await res.text()}`);
  const info = await res.json();
  if (info.protocol !== info.expectedProtocol) {
    throw new Error(
      `hub registry protocol ${info.protocol} != expected ${info.expectedProtocol}; upgrade both ends`,
    );
  }
  return info;
}

/**
 * Loopback listener that the LOCAL claude-hook.js posts to, forwarding every
 * event to the hub over Tailscale.
 *
 * Why a listener and not a direct post: claude-hook.js hardcodes
 * `hostname: '127.0.0.1'` and gates each registry entry on its PID being alive
 * locally. Both are true of this process and neither can be true of the hub, so
 * loopback is the only address the hook will ever dial. This process is the
 * thing on the other end of it.
 */
export function startRelay({ hubHost, pairPort, pairKey, relayPort, machine, onLog }) {
  const log = onLog ?? (() => {});
  const stats = { forwarded: 0, dropped: 0, repairs: 0, lastError: null };
  let office = null; // { officePort, token }

  async function ensurePaired(force = false) {
    if (office && !force) return office;
    office = await pair({ hubHost, pairPort, pairKey });
    stats.repairs += 1;
    writeRelayEntry(RELAY_REGISTRY_FILE, { port: relayPort, token: office.token });
    log(`paired with hub ${hubHost}: office port ${office.officePort}`);
    return office;
  }

  async function forward(providerId, event) {
    const body = JSON.stringify(tagEvent(event, machine));
    for (let attempt = 0; attempt < 2; attempt++) {
      const target = await ensurePaired(attempt > 0);
      try {
        const res = await fetch(
          `http://${hubHost}:${target.officePort}${HOOK_API_PREFIX}/${providerId}`,
          {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              authorization: `Bearer ${target.token}`,
            },
            body,
            signal: AbortSignal.timeout(4_000),
          },
        );
        if (res.status === 401) {
          // The hub restarted and minted a new token. Re-pair and retry once.
          log('hub returned 401 - office token rotated, re-pairing');
          office = null;
          continue;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        stats.forwarded += 1;
        return;
      } catch (err) {
        office = null;
        stats.lastError = err.message;
        if (attempt === 1) {
          stats.dropped += 1;
          log(`drop ${event.hook_event_name ?? '?'}: ${err.message}`);
        }
      }
    }
  }

  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url.startsWith('/__relay/health')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', machine, hubHost, ...stats }));
      return;
    }
    if (req.method !== 'POST' || !req.url.startsWith(`${HOOK_API_PREFIX}/`)) {
      res.writeHead(404);
      res.end();
      return;
    }
    const providerId = req.url.slice(`${HOOK_API_PREFIX}/`.length).split('?')[0];
    if (!/^[a-z0-9-]+$/.test(providerId)) {
      res.writeHead(400);
      res.end();
      return;
    }

    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 1_000_000) req.destroy();
    });
    req.on('end', () => {
      // Answer the hook immediately and forward in the background. Claude Code
      // kills a hook at 5s; a slow or unreachable hub must cost the agent
      // nothing. Delivery is best-effort by design here, exactly as it is in
      // upstream's own hook script -- drops are counted, not raised.
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('ok');
      let event;
      try {
        event = JSON.parse(raw);
      } catch {
        return;
      }
      void forward(providerId, event);
    });
  });

  // 127.0.0.1 only. Nothing off this machine should be able to inject events
  // into the tailnet through the relay.
  server.listen(relayPort, '127.0.0.1');

  function shutdown() {
    removeRelayEntry(RELAY_REGISTRY_FILE);
    server.close();
  }
  process.on('SIGINT', () => {
    shutdown();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    shutdown();
    process.exit(0);
  });
  process.on('exit', () => removeRelayEntry(RELAY_REGISTRY_FILE));

  return { server, stats, ensurePaired, forward, shutdown };
}
