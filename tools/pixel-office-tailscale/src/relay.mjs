import http from 'node:http';
import { HOOK_API_PREFIX, RELAY_REGISTRY_FILE } from './constants.mjs';
import { removeRelayEntry, writeRelayEntry } from './registry.mjs';

/** Placeholder written into the registry before the first successful pair.
 *  Non-empty because the registry validator rejects an empty token, and
 *  deliberately not a real one -- the hub answers 401 and that is the signal
 *  the relay already knows how to act on. */
const UNPAIRED_TOKEN = 'unpaired';

/** How often an unpaired relay retries the hub on its own. */
const REPAIR_INTERVAL_MS = 30_000;

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

/**
 * Hostnames, IPv4 literals, and bracketed IPv6 literals. Deliberately strict:
 * anything containing `@`, `/`, or whitespace is refused, because those are the
 * characters that let a value escape the host position of a URL.
 */
const SAFE_HOST = /^(?:\[[0-9a-fA-F:.]+\]|[A-Za-z0-9._-]+)$/;

/**
 * Refuse a host that could smuggle a different destination into a URL.
 *
 * `http://${host}:${port}/...` is not safe string concatenation. Given a host or
 * port carrying `@`, everything before it becomes URL userinfo and everything
 * after becomes the real host: `http://hub:0@evil.example.com/x` requests
 * evil.example.com, not hub. Every hook event and the office Bearer token would
 * go there. Reported by CodeQL as js/request-forgery (critical) on PR #908.
 */
export function assertSafeHost(host) {
  if (typeof host !== 'string' || !SAFE_HOST.test(host)) {
    throw new Error(`refusing unsafe hub host: ${JSON.stringify(host)}`);
  }
  return host;
}

/** Refuse anything that is not a real TCP port. */
export function assertSafePort(port, label) {
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error(`refusing unsafe ${label}: ${JSON.stringify(port)}`);
  }
  return port;
}

/**
 * Build a hub URL from validated parts.
 *
 * Assigning `.port` and `.pathname` on a URL object rather than interpolating
 * into a template means the host is fixed before the attacker-influenced values
 * are applied, and an invalid port is rejected by the URL API instead of
 * silently re-parsing the authority.
 */
export function hubUrl(hubHost, port, pathname) {
  const url = new URL(`http://${assertSafeHost(hubHost)}`);
  url.port = String(assertSafePort(port, 'port'));
  url.pathname = pathname;
  return url;
}

/** Fetch the current office token from the hub's pairing endpoint. */
export async function pair({ hubHost, pairPort, pairKey }) {
  const res = await fetch(hubUrl(hubHost, pairPort, '/pair'), {
    headers: { authorization: `Bearer ${pairKey}` },
    signal: AbortSignal.timeout(8_000),
  });
  if (res.status === 401) throw new Error('hub rejected the pair key (401)');
  if (!res.ok)
    throw new Error(
      `hub pairing failed: HTTP ${res.status} ${await res.text()}`
    );
  const info = await res.json();
  if (info.protocol !== info.expectedProtocol) {
    throw new Error(
      `hub registry protocol ${info.protocol} != expected ${info.expectedProtocol}; upgrade both ends`
    );
  }
  // The hub is remote and its response is untrusted input. officePort lands in
  // a URL, so it is validated here, at the boundary, rather than at the call
  // site that happens to use it.
  assertSafePort(info.officePort, 'office port from hub');
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
export function startRelay({
  hubHost,
  pairPort,
  pairKey,
  relayPort,
  machine,
  onLog,
}) {
  const log = onLog ?? (() => {});
  const stats = { forwarded: 0, dropped: 0, repairs: 0, lastError: null };
  let office = null; // { officePort, token }

  async function ensurePaired(force = false) {
    if (office && !force) return office;
    office = await pair({ hubHost, pairPort, pairKey });
    stats.repairs += 1;
    writeRelayEntry(RELAY_REGISTRY_FILE, {
      port: relayPort,
      token: office.token,
    });
    log(`paired with hub ${hubHost}: office port ${office.officePort}`);
    return office;
  }

  async function forward(providerId, event) {
    const body = JSON.stringify(tagEvent(event, machine));
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        // Inside the try on purpose. ensurePaired throws whenever the hub is
        // unreachable, and forward() is invoked as a floating promise, so a
        // throw out here is an unhandled rejection -- which killed the whole
        // relay process every time the hub was down.
        const target = await ensurePaired(attempt > 0);
        // providerId is already constrained to /^[a-z0-9-]+$/ by the request
        // handler; hubUrl re-validates the host and the hub-supplied port.
        const res = await fetch(
          hubUrl(
            hubHost,
            target.officePort,
            `${HOOK_API_PREFIX}/${providerId}`
          ),
          {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              authorization: `Bearer ${target.token}`,
            },
            body,
            signal: AbortSignal.timeout(4_000),
          }
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
    const providerId = req.url
      .slice(`${HOOK_API_PREFIX}/`.length)
      .split('?')[0];
    if (!/^[a-z0-9-]+$/.test(providerId)) {
      res.writeHead(400);
      res.end();
      return;
    }

    let raw = '';
    req.on('data', c => {
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

  // Register BEFORE pairing, with a placeholder token.
  //
  // Registering only after a successful pair deadlocks a satellite that boots
  // before its hub: no registry entry means claude-hook.js has no target, so no
  // event ever arrives, so the pairing that would have written the entry is
  // never attempted, and the machine stays invisible forever. A wrong token
  // costs one 401, which is already the re-pair trigger.
  writeRelayEntry(RELAY_REGISTRY_FILE, {
    port: relayPort,
    token: UNPAIRED_TOKEN,
  });

  // Keep trying in the background too, so a satellite that came up first stops
  // being stale on its own rather than waiting for the next hook event.
  const repairTimer = setInterval(() => {
    if (office) return;
    void ensurePaired(true).catch(err => {
      stats.lastError = err.message;
    });
  }, REPAIR_INTERVAL_MS);
  repairTimer.unref();

  function shutdown() {
    clearInterval(repairTimer);
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
