/**
 * validateExternalUrl — SSRF prevention utility
 *
 * Blocks requests to private / loopback / link-local / cloud-metadata addresses.
 * Call this before any server-side fetch() of a user-supplied URL.
 *
 * Two entry points:
 *   - validateExternalUrl(url)        — synchronous. Protocol + IP-literal classification.
 *                                       Decodes IPv4-mapped IPv6 (e.g. [::ffff:a9fe:a9fe] →
 *                                       169.254.169.254) so the literal cannot be smuggled past
 *                                       the guard. Throws on unsafe input.
 *   - assertExternalUrlSafe(url)      — async. Everything the sync check does PLUS DNS resolution
 *                                       of the hostname, re-checking every resolved address. Use
 *                                       this on any public/untrusted fetch path (defends against a
 *                                       hostname whose A/AAAA record points at a blocked range).
 *
 * SYN-995 (P0): the sync guard previously regex-matched the raw hostname, which the runtime
 * compresses for IPv6, letting `http://[::ffff:169.254.169.254]/` (hostname → `[::ffff:a9fe:a9fe]`)
 * reach cloud metadata. We now parse and classify the actual IP.
 *
 * Residual risk: a full DNS-rebind defence (pinning the resolved IP for the subsequent fetch) is
 * out of scope here — assertExternalUrlSafe blocks hostnames that resolve to a blocked range at
 * validation time, which covers the static "A record → 169.254.169.254" case (SEC-SSRF tracking).
 */

import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';

const BLOCKED_ERROR = 'URL resolves to a blocked address';

/** Strip the URL.hostname IPv6 brackets and lower-case for classification. */
function normalizeHost(hostname: string): string {
  return hostname.replace(/^\[/, '').replace(/\]$/, '').toLowerCase();
}

/** True if an IPv4 string falls in a private / loopback / link-local / metadata range. */
function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  const octets = parts.map(p => Number(p));
  if (octets.some(o => !Number.isInteger(o) || o < 0 || o > 255)) return false;
  const [a, b] = octets;
  if (a === 0) return true; // 0.0.0.0/8 "this host"
  if (a === 10) return true; // 10.0.0.0/8 private
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  return false;
}

/** Extract an embedded IPv4 from an IPv4-mapped/compatible IPv6 address, dotted or hex form. */
function embeddedIpv4(host: string): string | null {
  // Only reached for valid IPv6 literals (isIP === 6).
  // dotted tail: ::ffff:169.254.169.254  or  ::169.254.169.254
  const dotted = host.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (dotted) return dotted[1];
  // hex mapped/compat tail the runtime produces, e.g. ::ffff:a9fe:a9fe or ::a9fe:a9fe
  const hex = host.match(/^::(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const hi = parseInt(hex[1], 16);
    const lo = parseInt(hex[2], 16);
    return `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
  }
  return null;
}

/** True if an IPv6 string is loopback / unspecified / ULA / link-local / maps to a blocked IPv4. */
function isBlockedIpv6(ip: string): boolean {
  const h = ip.toLowerCase();
  const v4 = embeddedIpv4(h);
  if (v4 && isBlockedIpv4(v4)) return true;
  if (h === '::1' || h === '::') return true; // loopback / unspecified
  if (/^f[cd][0-9a-f]{2}:/.test(h)) return true; // fc00::/7 unique-local
  if (/^fe[89ab][0-9a-f]:/.test(h)) return true; // fe80::/10 link-local
  return false;
}

type HostClass = 'blocked' | 'ip-ok' | 'hostname';

function classifyHost(hostname: string): HostClass {
  const host = normalizeHost(hostname);
  if (host === '' || /(^|\.)localhost$/.test(host) || host === 'localhost') return 'blocked';
  const kind = isIP(host);
  if (kind === 4) return isBlockedIpv4(host) ? 'blocked' : 'ip-ok';
  if (kind === 6) return isBlockedIpv6(host) ? 'blocked' : 'ip-ok';
  return 'hostname'; // a name we cannot classify without DNS
}

function parseHttpUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('URL must use http or https protocol');
  }
  return parsed;
}

/**
 * Synchronous SSRF guard. Validates protocol and blocks unsafe IP literals
 * (including IPv4-mapped IPv6). Throws on unsafe input; returns void if safe.
 */
export function validateExternalUrl(url: string): void {
  const parsed = parseHttpUrl(url);
  if (classifyHost(parsed.hostname) === 'blocked') {
    throw new Error(BLOCKED_ERROR);
  }
}

/**
 * Async SSRF guard for public/untrusted fetch paths. Runs the synchronous checks, then —
 * for non-literal hostnames — resolves DNS and re-checks every returned address. Fails closed:
 * a host that cannot be resolved is treated as unsafe.
 */
export async function assertExternalUrlSafe(url: string): Promise<void> {
  validateExternalUrl(url);
  const parsed = parseHttpUrl(url);
  const host = normalizeHost(parsed.hostname);
  if (isIP(host) !== 0) return; // already classified as a safe literal

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new Error(BLOCKED_ERROR);
  }
  if (addresses.length === 0) throw new Error(BLOCKED_ERROR);
  for (const { address, family } of addresses) {
    const blocked = family === 4 ? isBlockedIpv4(address) : isBlockedIpv6(address);
    if (blocked) throw new Error(BLOCKED_ERROR);
  }
}
