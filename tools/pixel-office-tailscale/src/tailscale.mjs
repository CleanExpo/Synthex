import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

/** Places the CLI actually lives, in probe order. `tailscale` on PATH is last
 *  because on macOS the App Store build ships the binary inside the bundle and
 *  never puts it on PATH. */
const CANDIDATES = [
  // Forward slashes on purpose: Node accepts them on Windows and they keep
  // this literal free of escape sequences.
  'C:/Program Files/Tailscale/tailscale.exe',
  '/Applications/Tailscale.app/Contents/MacOS/Tailscale',
  '/usr/bin/tailscale',
  '/usr/local/bin/tailscale',
  '/opt/homebrew/bin/tailscale',
];

export function findTailscale() {
  for (const candidate of CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  try {
    execFileSync('tailscale', ['version'], { stdio: 'ignore' });
    return 'tailscale';
  } catch {
    return null;
  }
}

/**
 * Every node in the tailnet with its live online state.
 *
 * Reported straight from `tailscale status --json`, including the offline
 * nodes: "three computers in operation" is a claim about the tailnet, and a
 * machine that has been dark for months should show as dark rather than be
 * quietly dropped from a count.
 */
export function tailnetNodes() {
  const bin = findTailscale();
  if (!bin) return { ok: false, error: 'tailscale CLI not found', nodes: [] };
  let raw;
  try {
    raw = execFileSync(bin, ['status', '--json'], {
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch (err) {
    return { ok: false, error: err.message, nodes: [] };
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    return {
      ok: false,
      error: `unparseable tailscale status: ${err.message}`,
      nodes: [],
    };
  }

  const nodes = [];
  const self = data.Self;
  if (self) nodes.push(toNode(self, true));
  for (const peer of Object.values(data.Peer ?? {})) {
    const node = toNode(peer, false);
    if (isInfrastructure(peer, node)) continue;
    nodes.push(node);
  }
  return { ok: true, tailnet: data.CurrentTailnet?.Name ?? '', nodes };
}

/**
 * Tailscale's own shared relay/Funnel nodes, not the user's computers.
 *
 * They appear in `status --json` on some nodes and not others depending on what
 * the tailnet has enabled, which made the same command report 6 machines here
 * and 29 on the Mac. A count of "computers in operation" has to mean the same
 * thing on every machine, so these are excluded.
 */
function isInfrastructure(peer, node) {
  if (peer.ShareeNode) return true;
  if (node.name === 'funnel-ingress-node') return true;
  return node.ip === '';
}

function toNode(entry, isSelf) {
  return {
    name: entry.HostName ?? '',
    dnsName: (entry.DNSName ?? '').replace(/\.$/, ''),
    ip: (entry.TailscaleIPs ?? []).find(a => a.includes('.')) ?? '',
    os: entry.OS ?? '',
    online: isSelf ? true : Boolean(entry.Online),
    lastSeen:
      entry.LastSeen && !entry.LastSeen.startsWith('0001')
        ? entry.LastSeen
        : null,
    self: isSelf,
  };
}
