import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';

import {
  CONFIG_PATH,
  DEFAULT_OFFICE_PORT,
  DEFAULT_PAIR_PORT,
  DEFAULT_RELAY_PORT,
} from './constants.mjs';

/**
 * Config shape (~/.pixel-office-tailscale.json):
 *   role       'hub' | 'relay'
 *   machine    label shown in the office for agents from this computer
 *   pairKey    pre-shared key. The hub mints it once; every satellite holds the
 *              same value. It is NOT the office token -- the office token is a
 *              fresh crypto.randomUUID() on every pixel-agents start, so a
 *              satellite that pinned it would break on the hub's next restart.
 *              The pair key is stable, and buys the CURRENT office token.
 *   officePort port pixel-agents listens on (hub) -- fixed, not ephemeral
 *   pairPort   port the hub's pairing endpoint listens on
 *   hubHost    relay only: Tailscale address or MagicDNS name of the hub
 *   relayPort  relay only: loopback port the local claude-hook.js posts to
 */

export function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return null;
  }
}

export function writeConfig(config) {
  // 0600: the pair key is a credential. On Windows the mode is advisory, but
  // setting it costs nothing and is correct everywhere else.
  fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, {
    mode: 0o600,
  });
  return CONFIG_PATH;
}

/** Machine label used to tag agents in the office. Tailscale's own node name
 *  when we can get it, else the OS hostname. */
export function defaultMachineName() {
  return os.hostname().replace(/\.local$/, '');
}

export function newPairKey() {
  return crypto.randomBytes(32).toString('hex');
}

export function hubDefaults(overrides = {}) {
  return {
    role: 'hub',
    machine: defaultMachineName(),
    pairKey: newPairKey(),
    officePort: DEFAULT_OFFICE_PORT,
    pairPort: DEFAULT_PAIR_PORT,
    ...overrides,
  };
}

export function relayDefaults(overrides = {}) {
  return {
    role: 'relay',
    machine: defaultMachineName(),
    hubHost: '',
    pairKey: '',
    pairPort: DEFAULT_PAIR_PORT,
    relayPort: DEFAULT_RELAY_PORT,
    ...overrides,
  };
}
