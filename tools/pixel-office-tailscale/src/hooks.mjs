import fs from 'node:fs';
import path from 'node:path';

import {
  CLAUDE_HOOK_EVENTS,
  CLAUDE_SETTINGS_PATH,
  HOOK_SCRIPT_PATH,
} from './constants.mjs';

/**
 * Install the pixel-agents Claude Code hooks on a satellite machine.
 *
 * The entry shape below is byte-identical to the one pixel-agents 1.4.1 writes
 * itself (claudeHookInstaller.ts makeHookEntry): matcher '', a single
 * `node "<path>"` command, timeout 5. Matching it exactly means pixel-agents'
 * own uninstall recognises and removes what we wrote, and a later `npx
 * pixel-agents` run sees hooks already installed instead of duplicating them.
 *
 * Merge-safe: a pre-existing entry for an event is kept and ours is appended,
 * never replaced. That matters on machines that already run other Stop or
 * SessionStart hooks.
 */
export function installHooks({
  settingsPath = CLAUDE_SETTINGS_PATH,
  scriptPath = HOOK_SCRIPT_PATH,
  sourceScript = null,
} = {}) {
  // A satellite has never run pixel-agents, so nothing has put claude-hook.js
  // in place. Copying a known-good one from the hub is the whole install on
  // that machine -- the alternative is starting an office there just to make it
  // drop the file, which then also has to be consented to and torn down.
  if (sourceScript) {
    if (!fs.existsSync(sourceScript))
      throw new Error(`no hook script at ${sourceScript}`);
    fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
    fs.copyFileSync(sourceScript, scriptPath);
  }
  if (!fs.existsSync(scriptPath)) {
    throw new Error(
      `hook script missing at ${scriptPath}. Claude Code would spawn a dead node process for every event, which is worse than no hooks. Copy claude-hook.js there first.`
    );
  }

  const settings = readSettings(settingsPath);
  const backup = backupOnce(settingsPath);
  const command = `node "${scriptPath}"`;
  const hooks = settings.hooks ?? (settings.hooks = {});

  let added = 0;
  let alreadyPresent = 0;
  for (const event of CLAUDE_HOOK_EVENTS) {
    const entries = hooks[event] ?? (hooks[event] = []);
    if (entries.some(e => (e.hooks ?? []).some(h => h.command === command))) {
      alreadyPresent += 1;
      continue;
    }
    entries.push({
      matcher: '',
      hooks: [{ type: 'command', command, timeout: 5 }],
    });
    added += 1;
  }

  writeSettings(settingsPath, settings);
  return { added, alreadyPresent, backup, command, settingsPath };
}

/** Remove only our own commands, leaving every third-party hook untouched. */
export function uninstallHooks({
  settingsPath = CLAUDE_SETTINGS_PATH,
  scriptPath = HOOK_SCRIPT_PATH,
} = {}) {
  const settings = readSettings(settingsPath);
  const command = `node "${scriptPath}"`;
  const hooks = settings.hooks ?? {};
  let removed = 0;

  for (const event of Object.keys(hooks)) {
    const entries = hooks[event];
    if (!Array.isArray(entries)) continue;
    const kept = [];
    for (const entry of entries) {
      const inner = (entry.hooks ?? []).filter(h => h.command !== command);
      if (inner.length !== (entry.hooks ?? []).length) removed += 1;
      if (inner.length > 0) kept.push({ ...entry, hooks: inner });
    }
    if (kept.length > 0) hooks[event] = kept;
    else delete hooks[event];
  }

  writeSettings(settingsPath, settings);
  return { removed, settingsPath };
}

export function hooksInstalled({
  settingsPath = CLAUDE_SETTINGS_PATH,
  scriptPath = HOOK_SCRIPT_PATH,
} = {}) {
  const settings = readSettings(settingsPath);
  const command = `node "${scriptPath}"`;
  const hooks = settings.hooks ?? {};
  return CLAUDE_HOOK_EVENTS.filter(event =>
    (hooks[event] ?? []).some(e =>
      (e.hooks ?? []).some(h => h.command === command)
    )
  );
}

function readSettings(settingsPath) {
  if (!fs.existsSync(settingsPath)) return {};
  const raw = fs.readFileSync(settingsPath, 'utf8');
  if (raw.trim() === '') return {};
  try {
    return JSON.parse(raw);
  } catch (err) {
    // Refuse rather than overwrite: this file is the user's, and a parse
    // failure here means we do not understand what we would be destroying.
    throw new Error(`could not parse ${settingsPath}: ${err.message}`);
  }
}

function writeSettings(settingsPath, settings) {
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
}

/** One-time pre-modification copy, never overwritten on later runs. */
function backupOnce(settingsPath) {
  const backupPath = `${settingsPath}.pixel-office-backup`;
  if (fs.existsSync(settingsPath) && !fs.existsSync(backupPath)) {
    fs.copyFileSync(settingsPath, backupPath);
    return backupPath;
  }
  return fs.existsSync(backupPath) ? backupPath : null;
}
