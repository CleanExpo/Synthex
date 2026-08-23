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
    // Startup folder, not a scheduled task. `schtasks /Create /SC ONLOGON`
    // fails with "Access is denied" for a non-elevated user, and requiring
    // an Administrator prompt to keep a hobby office running is the wrong
    // trade. The Startup folder is per-user, needs no elevation, and fires at
    // the same moment an ONLOGON task would.
    const startup = path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'Microsoft',
      'Windows',
      'Start Menu',
      'Programs',
      'Startup',
    );
    return {
      kind: 'startup-folder',
      log: path.join(os.homedir(), 'pixel-office-tailscale.log'),
      launcher: path.join(os.homedir(), `${LABEL}.cmd`),
      // The .cmd is the restart loop; running it directly would leave a console
      // window open for as long as the service lives. wscript starts it hidden.
      shim: path.join(startup, `${LABEL}.vbs`),
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
  if (paths.kind === 'startup-folder') return installStartupItem({ command, nodeBin, cliPath, paths });
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
  if (paths.kind === 'startup-folder') {
    fs.rmSync(paths.shim, { force: true });
    fs.rmSync(paths.launcher, { force: true });
    return { removed: paths.shim };
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

function installStartupItem({ command, nodeBin, cliPath, paths }) {
  // The Startup folder gives "start at login" but not "restart if it dies", so
  // the .cmd is a loop. `ping` and not `timeout` for the delay: `timeout` reads
  // the console input handle and aborts with "Input redirection is not
  // supported" when there is no console, which would turn the loop into a spin.
  const launcher = [
    '@echo off',
    ':loop',
    `"${nodeBin}" "${cliPath}" ${command} >> "${paths.log}" 2>&1`,
    'ping -n 11 127.0.0.1 > nul',
    'goto loop',
    '',
  ].join('\r\n');
  fs.writeFileSync(paths.launcher, launcher);

  const shim = [
    "' Start the restart loop with no visible console window.",
    'Set sh = CreateObject("WScript.Shell")',
    `sh.Run """${paths.launcher}""", 0, False`,
    '',
  ].join('\r\n');
  fs.mkdirSync(path.dirname(paths.shim), { recursive: true });
  fs.writeFileSync(paths.shim, shim);

  return { installed: paths.shim, log: paths.log, launcher: paths.launcher };
}

/** Start the installed autostart item now, without waiting for a login. */
export function startServiceNow() {
  const paths = servicePaths();
  if (paths.kind === 'startup-folder') {
    execFileSync('wscript.exe', [paths.shim]);
    return { started: paths.shim };
  }
  if (paths.kind === 'launchd') {
    // `launchctl load` already started it; kickstart is the idempotent nudge.
    try {
      execFileSync('launchctl', ['kickstart', '-k', `gui/${process.getuid()}/${LABEL}`]);
    } catch {
      /* already running is fine */
    }
    return { started: LABEL };
  }
  execFileSync('systemctl', ['--user', 'restart', 'pixel-office-tailscale']);
  return { started: 'pixel-office-tailscale' };
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
