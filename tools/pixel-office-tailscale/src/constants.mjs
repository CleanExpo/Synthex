// Values copied from pixel-agents v1.4.1. Each one is a wire/disk contract with
// the upstream project, so it is pinned here rather than guessed:
//   core/src/constants.ts                      -> HOOK_API_PREFIX, SERVER_JSON_DIR, HOOK_SCRIPTS_DIR
//   server/src/constants.ts                    -> SERVERS_DIR, SERVER_REGISTRY_PROTOCOL_VERSION
//   server/src/providers/hook/claude/constants -> CLAUDE_HOOK_EVENTS, CLAUDE_HOOK_SCRIPT_NAME
// If a future pixel-agents release bumps the registry protocol, `pixel-office
// status` reports the mismatch instead of silently posting into the void.

import os from 'node:os';
import path from 'node:path';

export const HOOK_API_PREFIX = '/api/hooks';
export const PIXEL_AGENTS_DIR = path.join(os.homedir(), '.pixel-agents');
export const SERVERS_REGISTRY_DIR = path.join(PIXEL_AGENTS_DIR, 'servers');
export const HOOK_SCRIPT_PATH = path.join(PIXEL_AGENTS_DIR, 'hooks', 'claude-hook.js');
export const SERVER_REGISTRY_PROTOCOL_VERSION = 1;

/** Registry file this tool owns. Named so it is obvious in `ls` that a relay,
 *  not a local pixel-agents server, put it there. */
export const RELAY_REGISTRY_FILE = path.join(
  SERVERS_REGISTRY_DIR,
  process.env.PIXEL_OFFICE_RELAY_FILE ?? 'tailscale-relay.json',
);

/** Our own config, separate from anything pixel-agents owns so an upstream
 *  upgrade can never clobber it. PIXEL_OFFICE_CONFIG overrides the location so
 *  one machine can run a hub and a relay side by side -- which is how the
 *  end-to-end test drives both halves without a second computer. */
export const CONFIG_PATH =
  process.env.PIXEL_OFFICE_CONFIG ?? path.join(os.homedir(), '.pixel-office-tailscale.json');

/** Registry filename the relay owns, without the directory. The hub's pairing
 *  endpoint skips this name so a machine that is both hub and relay never pairs
 *  a satellite to its own relay. */
export const RELAY_REGISTRY_FILENAME = 'tailscale-relay.json';

/** The 12 events pixel-agents 1.4.1 installs. Kept in this order so a settings
 *  file we write is byte-comparable with one pixel-agents wrote itself. */
export const CLAUDE_HOOK_EVENTS = [
  'SessionStart',
  'SessionEnd',
  'Stop',
  'PermissionRequest',
  'Notification',
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'SubagentStart',
  'SubagentStop',
  'TeammateIdle',
  'TaskCompleted',
];

export const CLAUDE_SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');

/** Default ports. Fixed, not ephemeral: a satellite has to be able to find the
 *  hub again after a reboot without a human re-reading a port number. */
export const DEFAULT_OFFICE_PORT = 4319;
export const DEFAULT_PAIR_PORT = 4320;
export const DEFAULT_RELAY_PORT = 4321;
