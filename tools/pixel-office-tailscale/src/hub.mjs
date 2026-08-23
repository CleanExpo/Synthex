import crypto from 'node:crypto';
import http from 'node:http';
import { spawn } from 'node:child_process';

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
export function startPairServer({ pairKey, pairPort, officePort, machine, onLog }) {
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
    const office = readLiveServers().find((s) => s.file !== RELAY_REGISTRY_FILENAME);
    if (!office) {
      log(`pair from ${req.socket.remoteAddress} -> no live office server`);
      res.writeHead(503, { 'content-type': 'application/json' });
      res.end('{"error":"no live pixel-agents server on the hub"}');
      return;
    }

    log(`pair OK from ${req.socket.remoteAddress} -> office port ${office.port}`);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        officePort: office.port,
        token: office.token,
        machine,
        protocol: office.protocol ?? SERVER_REGISTRY_PROTOCOL_VERSION,
        expectedProtocol: SERVER_REGISTRY_PROTOCOL_VERSION,
      }),
    );
  });

  // 0.0.0.0 because a satellite reaches this over the Tailscale interface. The
  // gate is the pair key plus the tailnet itself, not the bind address.
  server.listen(pairPort, '0.0.0.0');
  return server;
}

/**
 * Keep a `npx pixel-agents` office alive on a fixed port bound to every
 * interface. Fixed and not ephemeral because a satellite has to find the hub
 * again after a reboot without a human reading a port off a terminal.
 */
export function superviseOffice({ officePort, onLog }) {
  const log = onLog ?? (() => {});
  let child = null;
  let stopping = false;
  let restarts = 0;

  function start() {
    if (stopping) return;
    const args = ['--yes', 'pixel-agents', '--host', '0.0.0.0', '--port', String(officePort)];
    child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });
    child.stdout.on('data', (d) => log(`[office] ${String(d).trimEnd()}`));
    child.stderr.on('data', (d) => log(`[office] ${String(d).trimEnd()}`));
    child.on('exit', (code) => {
      if (stopping) return;
      restarts += 1;
      const delay = Math.min(30_000, 1_000 * 2 ** Math.min(restarts, 5));
      log(`[office] exited (code ${code}); restarting in ${delay / 1000}s`);
      setTimeout(start, delay);
    });
  }

  start();
  return {
    stop() {
      stopping = true;
      child?.kill();
    },
  };
}

/** Current hub state, for `pixel-office status`. */
export function hubStatus() {
  const config = readConfig();
  const servers = readLiveServers().filter((s) => s.file !== RELAY_REGISTRY_FILENAME);
  return { config, servers, relayFile: RELAY_REGISTRY_FILE };
}
