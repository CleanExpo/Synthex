import crypto from 'node:crypto';
import http from 'node:http';
import { execFileSync, spawn } from 'node:child_process';

import { readConfig } from './config.mjs';
import {
  RELAY_REGISTRY_FILE,
  RELAY_REGISTRY_FILENAME,
  SERVER_REGISTRY_PROTOCOL_VERSION,
} from './constants.mjs';
import { readLiveServers } from './registry.mjs';

/** Constant-time compare that also survives a length mismatch. */
function secretsMatch(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/**
 * The office token is minted fresh (crypto.randomUUID) every time pixel-agents
 * starts, so it cannot be baked into a satellite's config. The pairing endpoint
 * is the indirection that fixes that: satellites hold a STABLE pre-shared pair
 * key, and trade it for whatever the CURRENT office token happens to be. A hub
 * restart therefore costs a satellite one failed POST, not a manual re-pair.
 */
export function startPairServer({
  pairKey,
  pairPort,
  officePort,
  machine,
  onLog,
}) {
  const log = onLog ?? (() => {});

  const server = http.createServer((req, res) => {
    if (req.method !== 'GET' || !req.url.startsWith('/pair')) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end('{"error":"not found"}');
      return;
    }
    const auth = req.headers.authorization ?? '';
    if (!auth.startsWith('Bearer ') || !secretsMatch(auth.slice(7), pairKey)) {
      log(`pair DENIED from ${req.socket.remoteAddress} (bad key)`);
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end('{"error":"unauthorized"}');
      return;
    }

    // Never hand back the relay's own entry: on a machine that is both hub and
    // satellite that would point a satellite at a loop.
    const office = readLiveServers().find(
      s => s.file !== RELAY_REGISTRY_FILENAME
    );
    if (!office) {
      log(`pair from ${req.socket.remoteAddress} -> no live office server`);
      res.writeHead(503, { 'content-type': 'application/json' });
      res.end('{"error":"no live pixel-agents server on the hub"}');
      return;
    }

    log(
      `pair OK from ${req.socket.remoteAddress} -> office port ${office.port}`
    );
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        officePort: office.port,
        token: office.token,
        machine,
        protocol: office.protocol ?? SERVER_REGISTRY_PROTOCOL_VERSION,
        expectedProtocol: SERVER_REGISTRY_PROTOCOL_VERSION,
      })
    );
  });

  // 0.0.0.0 because a satellite reaches this over the Tailscale interface. The
  // gate is the pair key plus the tailnet itself, not the bind address.
  server.listen(pairPort, '0.0.0.0');
  return server;
}

const HEALTH_INTERVAL_MS = 15_000;
/** Consecutive health misses before a restart. Two, not one: a single miss is
 *  indistinguishable from an office still coming up. */
const HEALTH_MISSES_BEFORE_RESTART = 2;

/**
 * Keep a `npx pixel-agents` office SERVING on a fixed port bound to every
 * interface. Fixed and not ephemeral because a satellite has to find the hub
 * again after a reboot without a human reading a port off a terminal.
 *
 * Supervision is by HEALTH, not by process liveness. Watching the child was
 * tried and silently failed: the direct child is `npx`, which stays alive after
 * the pixel-agents process it launched stops serving, so the exit handler never
 * fired and the office sat dead with nothing listening on its port and no
 * restart logged. Polling /api/health measures the only thing that matters --
 * whether the office answers -- and is immune to however many process levels
 * npx adds.
 */
export function superviseOffice({ officePort, onLog }) {
  const log = onLog ?? (() => {});
  let child = null;
  let stopping = false;
  let misses = 0;

  async function healthy() {
    try {
      const res = await fetch(`http://127.0.0.1:${officePort}/api/health`, {
        signal: AbortSignal.timeout(3_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Kill the whole tree. `child` is npx; pixel-agents is its child, and killing
   *  only npx leaves the office holding the port against its own replacement. */
  function killTree() {
    const target = child;
    child = null;
    if (!target?.pid) return;
    try {
      if (process.platform === 'win32') {
        execFileSync('taskkill', ['/PID', String(target.pid), '/T', '/F'], {
          stdio: 'ignore',
        });
      } else {
        process.kill(-target.pid, 'SIGKILL');
      }
    } catch {
      /* already gone */
    }
  }

  function spawnOffice() {
    if (stopping) return;
    const args = [
      '--yes',
      'pixel-agents',
      '--host',
      '0.0.0.0',
      '--port',
      String(officePort),
    ];
    child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      // Own process group on POSIX so killTree can signal the whole tree.
      detached: process.platform !== 'win32',
    });
    child.stdout.on('data', d => log(`[office] ${String(d).trimEnd()}`));
    child.stderr.on('data', d => log(`[office] ${String(d).trimEnd()}`));
  }

  async function tick() {
    if (stopping) return;
    if (await healthy()) {
      misses = 0;
      return;
    }
    misses += 1;
    if (misses < HEALTH_MISSES_BEFORE_RESTART) return;
    log(`[office] no answer on /api/health (x${misses}) - restarting`);
    misses = 0;
    killTree();
    setTimeout(spawnOffice, 2_000);
  }

  const timer = setInterval(() => void tick(), HEALTH_INTERVAL_MS);

  // Adopt rather than fight: an office already serving this port (a manual
  // `npx pixel-agents`, or the VS Code extension) is the office. Spawning a
  // second one would only lose a race for the port.
  void healthy().then(up => {
    if (up) log(`[office] already serving on ${officePort} - adopting it`);
    else spawnOffice();
  });

  return {
    stop() {
      stopping = true;
      clearInterval(timer);
      killTree();
    },
  };
}

/** Current hub state, for `pixel-office status`. */
export function hubStatus() {
  const config = readConfig();
  const servers = readLiveServers().filter(
    s => s.file !== RELAY_REGISTRY_FILENAME
  );
  return { config, servers, relayFile: RELAY_REGISTRY_FILE };
}
