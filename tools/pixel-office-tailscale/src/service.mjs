import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Autostart, per platform.
 *
 * A relay that stops at logout is worse than no relay: the office keeps showing
 * the machine's last known agents and nothing says the feed went quiet. So the
 * relay (and the hub) want to be a real background service, not a terminal a
 * human remembers to open.
 *
 * These functions GENERATE and INSTALL that service, but nothing calls them
 * automatically -- a login item / scheduled task is standing configuration on
 * someone's computer, so it is always an explicit `pixel-office install-service`.
 */

const LABEL = 'com.pixel-office.tailscale';

export function servicePaths() {
  if (process.platform === 'darwin') {
    return {
      kind: 'launchd',
      plist: path.join(os.homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`),
      log: path.join(os.homedir(), 'Library', 'Logs', 'pixel-office-tailscale.log'),
    };
  }
  if (process.platform === 'win32') {
    return {
      kind: 'schtasks',
      taskName: LABEL,
      log: path.join(os.homedir(), 'pixel-office-tailscale.log'),
      launcher: path.join(os.homedir(), `${LABEL}.cmd`),
    };
  }
  return {
    kind: 'systemd',
    unit: path.join(os.homedir(), '.config', 'systemd', 'user', 'pixel-office-tailscale.service'),
    log: null,
  };
}

/** Install autostart for `pixel-office <command>` (normally 'relay' or 'hub'). */
export function installService({ command, nodeBin = process.execPath, cliPath }) {
  const paths = servicePaths();
  if (paths.kind === 'launchd') return installLaunchAgent({ command, nodeBin, cliPath, paths });
  if (paths.kind === 'schtasks') return installScheduledTask({ command, nodeBin, cliPath, paths });
  return installSystemdUnit({ command, nodeBin, cliPath, paths });
}

export function uninstallService() {
  const paths = servicePaths();
  if (paths.kind === 'launchd') {
    try {
      execFileSync('launchctl', ['unload', paths.plist], { stdio: 'ignore' });
    } catch {
      /* not loaded */
    }
    fs.rmSync(paths.plist, { force: true });
    return { removed: paths.plist };
  }
  if (paths.kind === 'schtasks') {
    try {
      execFileSync('schtasks', ['/Delete', '/TN', paths.taskName, '/F'], { stdio: 'ignore' });
    } catch {
      /* not registered */
    }
    fs.rmSync(paths.launcher, { force: true });
    return { removed: paths.taskName };
  }
  try {
    execFileSync('systemctl', ['--user', 'disable', '--now', 'pixel-office-tailscale'], {
      stdio: 'ignore',
    });
  } catch {
    /* not enabled */
  }
  fs.rmSync(paths.unit, { force: true });
  return { removed: paths.unit };
}

// -- macOS -----------------------------------------------------

function installLaunchAgent({ command, nodeBin, cliPath, paths }) {
  // KeepAlive restarts the relay if it dies; RunAtLoad starts it at login.
  // PATH is set explicitly because a LaunchAgent inherits almost none of the
  // login shell's environment, and `npx` (used by the hub) needs to be findable.
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${nodeBin}</string>
    <string>${cliPath}</string>
    <string>${command}</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>${path.dirname(nodeBin)}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
  <key>StandardOutPath</key><string>${paths.log}</string>
  <key>StandardErrorPath</key><string>${paths.log}</string>
</dict>
</plist>
`;
  fs.mkdirSync(path.dirname(paths.plist), { recursive: true });
  fs.writeFileSync(paths.plist, plist);
  try {
    execFileSync('launchctl', ['unload', paths.plist], { stdio: 'ignore' });
  } catch {
    /* first install */
  }
  execFileSync('launchctl', ['load', paths.plist]);
  return { installed: paths.plist, log: paths.log };
}

// -- Windows ---------------------------------------------------

function installScheduledTask({ command, nodeBin, cliPath, paths }) {
  // schtasks cannot express "restart if it exits", so a .cmd wrapper loops.
  // The wrapper also owns the redirect, which keeps the schtasks argument free
  // of the quoting that Task Scheduler mangles.
  const launcher = [
    '@echo off',
    ':loop',
    `"${nodeBin}" "${cliPath}" ${command} >> "${paths.log}" 2>&1`,
    'timeout /t 10 /nobreak > nul',
    'goto loop',
    '',
  ].join('\r\n');
  fs.writeFileSync(paths.launcher, launcher);
  execFileSync('schtasks', [
    '/Create',
    '/TN',
    paths.taskName,
    '/TR',
    `"${paths.launcher}"`,
    '/SC',
    'ONLOGON',
    '/RL',
    'LIMITED',
    '/F',
  ]);
  return { installed: paths.taskName, log: paths.log, launcher: paths.launcher };
}

// -- Linux -----------------------------------------------------

function installSystemdUnit({ command, nodeBin, cliPath, paths }) {
  const unit = `[Unit]
Description=Pixel Office Tailscale ${command}
After=network-online.target

[Service]
ExecStart=${nodeBin} ${cliPath} ${command}
Restart=always
RestartSec=10

[Install]
WantedBy=default.target
`;
  fs.mkdirSync(path.dirname(paths.unit), { recursive: true });
  fs.writeFileSync(paths.unit, unit);
  execFileSync('systemctl', ['--user', 'daemon-reload']);
  execFileSync('systemctl', ['--user', 'enable', '--now', 'pixel-office-tailscale']);
  return { installed: paths.unit, log: 'journalctl --user -u pixel-office-tailscale' };
}
