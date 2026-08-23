#!/usr/bin/env node
/* eslint-disable no-console -- this file IS the command-line interface; stdout is its output. */
import { existsSync } from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  hubDefaults,
  readConfig,
  relayDefaults,
  writeConfig,
} from '../src/config.mjs';
import { HOOK_SCRIPT_PATH, RELAY_REGISTRY_FILE } from '../src/constants.mjs';
import { hooksInstalled, installHooks, uninstallHooks } from '../src/hooks.mjs';
import { startPairServer, superviseOffice } from '../src/hub.mjs';
import { readLiveServers } from '../src/registry.mjs';
import { startRelay } from '../src/relay.mjs';
import {
  installService,
  servicePaths,
  startServiceNow,
  uninstallService,
} from '../src/service.mjs';
import { tailnetNodes } from '../src/tailscale.mjs';

const USAGE = `pixel-office - one Pixel Agents office for every machine on a tailnet

  On the hub (the computer that shows the office):
    pixel-office init-hub [--office-port 4319] [--pair-port 4320]
    pixel-office hub [--no-spawn]

  On every other computer:
    pixel-office init-relay --hub <tailscale-host> --key <pair-key>
    pixel-office install-hooks [--script /path/to/claude-hook.js]
    pixel-office relay

  Keep it running across reboots (login item / scheduled task / user unit):
    pixel-office install-service
    pixel-office uninstall-service

  Anywhere:
    pixel-office status
    pixel-office uninstall-hooks
`;

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      flags[key] = true;
    } else {
      flags[key] = next;
      i++;
    }
  }
  return flags;
}

function stamp(message) {
  console.log(`${new Date().toISOString()} ${message}`);
}

function requireConfig(expectedRole) {
  const config = readConfig();
  if (!config) {
    console.error(
      `No config. Run "pixel-office init-${expectedRole}" on this machine first.`
    );
    process.exit(1);
  }
  if (config.role !== expectedRole) {
    console.error(
      `This machine is configured as "${config.role}", not "${expectedRole}".`
    );
    process.exit(1);
  }
  return config;
}

// -- init-hub --------------------------------------------------

function cmdInitHub(flags) {
  const existing = readConfig();
  const config = hubDefaults({
    ...(existing?.role === 'hub' ? existing : {}),
    ...(flags['office-port']
      ? { officePort: Number(flags['office-port']) }
      : {}),
    ...(flags['pair-port'] ? { pairPort: Number(flags['pair-port']) } : {}),
    ...(flags.machine ? { machine: String(flags.machine) } : {}),
  });
  // Keep an existing pair key: rotating it silently would break every satellite.
  if (existing?.role === 'hub' && existing.pairKey && !flags['new-key']) {
    config.pairKey = existing.pairKey;
  }
  const written = writeConfig(config);

  const nodes = tailnetNodes();
  const self = nodes.nodes.find(n => n.self);
  const address =
    self?.dnsName || self?.ip || '<this machine tailscale address>';

  console.log(`Hub config written to ${written}`);
  console.log(`  office port : ${config.officePort}`);
  console.log(`  pair port   : ${config.pairPort}`);
  console.log(`  machine     : ${config.machine}`);
  console.log('');
  console.log('Start the hub with:  pixel-office hub');
  console.log('');
  console.log('Then on every other computer, run these two commands:');
  console.log(
    `  pixel-office init-relay --hub ${address} --key ${config.pairKey}`
  );
  console.log('  pixel-office install-hooks && pixel-office relay');
  console.log('');
  console.log(
    'The pair key is a credential. Move it over the tailnet or a password manager.'
  );
}

// -- hub -------------------------------------------------------

function cmdHub(flags) {
  const config = requireConfig('hub');
  const nodes = tailnetNodes();
  const self = nodes.nodes.find(n => n.self);

  if (flags['no-spawn']) {
    stamp(
      'not spawning an office (--no-spawn); expecting one to be running already'
    );
  } else {
    stamp(`starting pixel-agents office on 0.0.0.0:${config.officePort}`);
    superviseOffice({ officePort: config.officePort, onLog: stamp });
  }

  startPairServer({
    pairKey: config.pairKey,
    pairPort: config.pairPort,
    officePort: config.officePort,
    machine: config.machine,
    onLog: stamp,
  });
  stamp(`pairing endpoint listening on 0.0.0.0:${config.pairPort}`);

  const address = self?.dnsName || self?.ip || '127.0.0.1';
  stamp(
    `office URL for other machines: http://${address}:${config.officePort}/`
  );
  stamp(
    'the office token is minted by pixel-agents on each start; satellites fetch it via /pair'
  );
}

// -- init-relay ------------------------------------------------

function cmdInitRelay(flags) {
  if (!flags.hub || !flags.key) {
    console.error(
      'init-relay needs --hub <tailscale-host> and --key <pair-key>'
    );
    process.exit(1);
  }
  const config = relayDefaults({
    hubHost: String(flags.hub),
    pairKey: String(flags.key),
    ...(flags['pair-port'] ? { pairPort: Number(flags['pair-port']) } : {}),
    ...(flags['relay-port'] ? { relayPort: Number(flags['relay-port']) } : {}),
    ...(flags.machine ? { machine: String(flags.machine) } : {}),
  });
  const written = writeConfig(config);
  console.log(`Relay config written to ${written}`);
  console.log(`  hub        : ${config.hubHost}:${config.pairPort}`);
  console.log(`  relay port : 127.0.0.1:${config.relayPort}`);
  console.log(`  machine    : ${config.machine}`);
  console.log('');
  console.log('Next:  pixel-office install-hooks && pixel-office relay');
}

// -- relay -----------------------------------------------------

async function cmdRelay() {
  const config = requireConfig('relay');
  const installed = hooksInstalled();
  if (installed.length === 0) {
    stamp(
      'WARNING: no pixel-agents hooks are installed here, so nothing will ever be relayed.'
    );
    stamp('         Run "pixel-office install-hooks" first.');
  }

  const relay = startRelay({
    hubHost: config.hubHost,
    pairPort: config.pairPort,
    pairKey: config.pairKey,
    relayPort: config.relayPort,
    machine: config.machine,
    onLog: stamp,
  });
  stamp(
    `relay listening on 127.0.0.1:${config.relayPort} -> ${config.hubHost}`
  );
  stamp(`registry entry: ${RELAY_REGISTRY_FILE}`);

  try {
    await relay.ensurePaired(true);
  } catch (err) {
    stamp(`initial pairing failed: ${err.message}`);
    stamp('the relay stays up and retries on the next hook event');
  }
}

// -- hooks -----------------------------------------------------

function cmdInstallHooks(flags) {
  try {
    const result = installHooks(
      flags.script ? { sourceScript: String(flags.script) } : {}
    );
    console.log(`Hooks installed in ${result.settingsPath}`);
    console.log(`  command        : ${result.command}`);
    console.log(`  events added   : ${result.added}`);
    console.log(`  already present: ${result.alreadyPresent}`);
    if (result.backup) console.log(`  backup         : ${result.backup}`);
  } catch (err) {
    console.error(`Hook install failed: ${err.message}`);
    process.exit(1);
  }
}

function cmdUninstallHooks() {
  const result = uninstallHooks();
  console.log(
    `Removed ${result.removed} Pixel Agents hook entries from ${result.settingsPath}`
  );
}

// -- service ---------------------------------------------------

function cmdInstallService() {
  const config = readConfig();
  if (!config) {
    console.error(
      'Configure this machine first: pixel-office init-hub OR pixel-office init-relay.'
    );
    process.exit(1);
  }
  const cliPath = fileURLToPath(import.meta.url);
  try {
    const result = installService({
      command: config.role,
      nodeBin: process.execPath,
      cliPath,
    });
    console.log(`Autostart installed for "pixel-office ${config.role}"`);
    console.log(`  service : ${result.installed}`);
    if (result.log) console.log(`  log     : ${result.log}`);
    // Install alone only takes effect at the next login. Starting it now is
    // the difference between "configured" and "running".
    const started = startServiceNow();
    console.log(`  started : ${started.started}`);
  } catch (err) {
    console.error(`Could not install autostart: ${err.message}`);
    process.exit(1);
  }
}

function cmdUninstallService() {
  const result = uninstallService();
  console.log(`Autostart removed: ${result.removed}`);
}

// -- status ----------------------------------------------------

function cmdStatus() {
  const config = readConfig();
  console.log(`role          : ${config?.role ?? 'not configured'}`);
  if (config?.role === 'hub') {
    console.log(`office port   : ${config.officePort}`);
    console.log(`pair port     : ${config.pairPort}`);
  }
  if (config?.role === 'relay') {
    console.log(`hub           : ${config.hubHost}:${config.pairPort}`);
    console.log(`relay port    : 127.0.0.1:${config.relayPort}`);
  }
  console.log(`machine label : ${config?.machine ?? '-'}`);

  const installed = hooksInstalled();
  console.log(
    `claude hooks  : ${installed.length}/12 installed (${HOOK_SCRIPT_PATH})`
  );

  const svc = servicePaths();
  // The Startup-folder shim, not the .cmd it launches: the .cmd lives in the
  // home directory and would still be there after the Startup entry was
  // deleted, which would report an autostart that no longer autostarts.
  const svcTarget = svc.plist ?? svc.unit ?? svc.shim ?? null;
  console.log(
    `autostart     : ${svcTarget && existsSync(svcTarget) ? `yes (${svcTarget})` : 'no'}`
  );

  const servers = readLiveServers();
  console.log(`live servers  : ${servers.length}`);
  for (const s of servers) {
    console.log(
      `  ${s.file.padEnd(26)} port ${String(s.port).padEnd(6)} pid ${s.pid}`
    );
  }

  const { ok, tailnet, nodes, error } = tailnetNodes();
  if (!ok) {
    console.log(`tailnet       : unavailable (${error})`);
    return;
  }
  const online = nodes.filter(n => n.online);
  console.log(
    `tailnet       : ${tailnet} - ${online.length}/${nodes.length} online`
  );
  for (const n of nodes) {
    const state = n.online ? 'ONLINE ' : 'offline';
    const seen = n.lastSeen ? ` last seen ${n.lastSeen.slice(0, 10)}` : '';
    console.log(
      `  ${state} ${n.name.padEnd(22)} ${n.ip.padEnd(16)} ${n.os}${seen}`
    );
  }
}

// -- dispatch --------------------------------------------------

const [command, ...rest] = process.argv.slice(2);
const flags = parseFlags(rest);

switch (command) {
  case 'init-hub':
    cmdInitHub(flags);
    break;
  case 'hub':
    cmdHub(flags);
    break;
  case 'init-relay':
    cmdInitRelay(flags);
    break;
  case 'relay':
    await cmdRelay();
    break;
  case 'install-hooks':
    cmdInstallHooks(flags);
    break;
  case 'uninstall-hooks':
    cmdUninstallHooks();
    break;
  case 'install-service':
    cmdInstallService();
    break;
  case 'uninstall-service':
    cmdUninstallService();
    break;
  case 'status':
    cmdStatus();
    break;
  default:
    console.log(USAGE);
    process.exit(command === undefined || command === '--help' ? 0 : 1);
}
