import fs from 'node:fs';
import path from 'node:path';

import {
  SERVERS_REGISTRY_DIR,
  SERVER_REGISTRY_PROTOCOL_VERSION,
} from './constants.mjs';

/** True if a process with this PID is alive on THIS machine. */
export function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Every live pixel-agents server registered on this machine, newest first.
 *
 * This is the same directory claude-hook.js reads, and the same liveness rule
 * it applies -- a registry entry is only real while its owning PID is alive.
 * That rule is why a satellite cannot simply write the hub's port into its own
 * registry: the hub's PID means nothing here. The relay satisfies the rule
 * honestly by registering its OWN pid.
 */
export function readLiveServers() {
  let files;
  try {
    files = fs
      .readdirSync(SERVERS_REGISTRY_DIR)
      .filter(f => f.endsWith('.json'));
  } catch {
    return [];
  }
  const live = [];
  for (const file of files) {
    try {
      const entry = JSON.parse(
        fs.readFileSync(path.join(SERVERS_REGISTRY_DIR, file), 'utf8')
      );
      if (!isValidEntry(entry)) continue;
      if (!isProcessAlive(entry.pid)) continue;
      live.push({ ...entry, file });
    } catch {
      /* a malformed entry is not an error here -- pixel-agents skips it too */
    }
  }
  return live.sort((a, b) => b.startedAt - a.startedAt);
}

function isValidEntry(entry) {
  return (
    entry !== null &&
    typeof entry === 'object' &&
    Number.isSafeInteger(entry.port) &&
    Number.isSafeInteger(entry.pid) &&
    entry.pid > 0 &&
    typeof entry.token === 'string' &&
    entry.token.length > 0
  );
}

/** Write our relay's registry entry so the local claude-hook.js fans out to it. */
export function writeRelayEntry(filePath, { port, token }) {
  fs.mkdirSync(SERVERS_REGISTRY_DIR, { recursive: true });
  const entry = {
    port,
    pid: process.pid,
    token,
    startedAt: Date.now(),
    servesSpa: false,
    protocol: SERVER_REGISTRY_PROTOCOL_VERSION,
  };
  fs.writeFileSync(filePath, `${JSON.stringify(entry, null, 2)}\n`);
  return entry;
}

export function removeRelayEntry(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch {
    /* already gone */
  }
}
