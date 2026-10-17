/**
 * J11 harness — raw route calls, an outbound-request recorder and a network
 * kill-switch. Nothing here reaches a live service.
 *
 * Why not runner/route-harness invokeRoute(): it returns only status + parsed
 * JSON. J11 needs the Location header (open redirect), the raw body text
 * (secret scan of non-JSON bodies) and one module instance across two
 * deliveries (webhook replay). Requests still come from the shared
 * tests/helpers/mock-request.ts.
 */
import fs from 'fs';
import net from 'net';
import path from 'path';
import tls from 'tls';
import jwt from 'jsonwebtoken';
import { createMockNextRequest } from '../../../../helpers/mock-request';

export const ROOT = path.join(__dirname, '../../../../..');

// ── Independent internal-target classifier (not the code under test) ────────

const BLOCK = new net.BlockList();
for (const [a, p] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
] as const)
  BLOCK.addSubnet(a, p, 'ipv4');
BLOCK.addAddress('::1', 'ipv6');
BLOCK.addAddress('::', 'ipv6');
BLOCK.addSubnet('fc00::', 7, 'ipv6');
BLOCK.addSubnet('fe80::', 10, 'ipv6');

/** Synthetic DNS used by the dns boundary double in j11.jev.test.ts. */
export const DNS_TABLE: Record<string, string[]> = {
  'public.jev.test': ['93.184.216.34'],
  'fal.media': ['93.184.216.34'],
  'v3.fal.media': ['93.184.216.34'],
  'internal.jev.test': ['10.0.0.7'],
  'metadata.jev.test': ['169.254.169.254'],
  'rebind.jev.test': ['93.184.216.34', '127.0.0.1'],
};

function ipIsInternal(ip: string): boolean {
  const host = ip.replace(/^\[|\]$/g, '').toLowerCase();
  const kind = net.isIP(host);
  if (kind === 4) return BLOCK.check(host, 'ipv4');
  if (kind === 6) {
    const mapped = /^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/.exec(host);
    if (mapped) return BLOCK.check(mapped[1], 'ipv4');
    const hex = /^::(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(host);
    if (hex) {
      const hi = parseInt(hex[1], 16);
      const lo = parseInt(hex[2], 16);
      return BLOCK.check(
        `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`,
        'ipv4'
      );
    }
    return BLOCK.check(host, 'ipv6');
  }
  return false;
}

/** True when a URL targets a non-http(s) scheme, localhost or an internal address. */
export function isInternalTarget(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return true;
  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (net.isIP(host)) return ipIsInternal(host);
  return (DNS_TABLE[host] ?? []).some(ipIsInternal);
}

// ── Outbound fetch recorder with real redirect semantics ───────────────────

export interface Outbound {
  url: string;
  method: string;
  redirect: string;
  body?: string;
}

export interface Scripted {
  status: number;
  headers?: Record<string, string>;
  body?: string;
}

export const net$ = {
  calls: [] as Outbound[],
  socketAttempts: [] as string[],
  script: {} as Record<string, Scripted>,
};

function respond(s: Scripted): Response {
  return new Response(
    s.status >= 300 && s.status < 400 ? null : (s.body ?? ''),
    {
      status: s.status,
      headers: s.headers,
    }
  );
}

/**
 * Stand-in for global fetch. Records every request. A scripted 3xx is followed
 * exactly as WHATWG fetch would ('follow' default: the next hop is requested
 * and recorded; 'error': rejects; 'manual': returned as-is).
 */
export async function recordingFetch(
  input: unknown,
  init: { method?: string; redirect?: string; body?: unknown } = {}
): Promise<Response> {
  let url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : String((input as { url?: string }).url);
  const mode = init.redirect ?? 'follow';
  for (let hop = 0; hop < 5; hop++) {
    net$.calls.push({
      url,
      method: (init.method ?? 'GET').toUpperCase(),
      redirect: mode,
      body: typeof init.body === 'string' ? init.body : undefined,
    });
    const s = net$.script[url] ?? {
      status: 200,
      headers: { 'content-type': 'text/html' },
      body: '<html><head><title>ok</title></head><body>ok</body></html>',
    };
    const location = s.headers?.location;
    if (s.status >= 300 && s.status < 400 && location) {
      if (mode === 'error') throw new TypeError('fetch failed: redirect');
      if (mode === 'manual') return respond(s);
      url = new URL(location, url).href;
      continue;
    }
    return respond(s);
  }
  throw new TypeError('fetch failed: too many redirects');
}

const realConnect = net.Socket.prototype.connect;
const realTlsConnect = tls.connect;

/** Refuse every raw socket so an SDK that bypasses fetch cannot go live. */
export function installNetworkKillSwitch(): void {
  net.Socket.prototype.connect = function blocked(...args: unknown[]) {
    net$.socketAttempts.push(JSON.stringify(args[0]).slice(0, 120));
    throw new Error('J11 network kill-switch: outbound socket refused');
  } as typeof net.Socket.prototype.connect;
  (tls as { connect: unknown }).connect = (...args: unknown[]) => {
    net$.socketAttempts.push(JSON.stringify(args[0]).slice(0, 120));
    throw new Error('J11 network kill-switch: outbound TLS refused');
  };
}

export function removeNetworkKillSwitch(): void {
  net.Socket.prototype.connect = realConnect;
  (tls as { connect: unknown }).connect = realTlsConnect;
}

export function resetNet(): void {
  net$.calls = [];
  net$.socketAttempts = [];
  net$.script = {};
}

/** Outbound requests (including followed redirect hops) that hit an internal target. */
export function internalHits(): Outbound[] {
  return net$.calls.filter(c => isInternalTarget(c.url));
}

// ── Route loading and raw calls ─────────────────────────────────────────────

declare const jest: { isolateModules(fn: () => void): void };

export function loadModule(file: string): Record<string, unknown> {
  let mod: Record<string, unknown> = {};
  jest.isolateModules(() => {
    mod = require(path.resolve(ROOT, file));
  });
  return mod;
}

export function routeExists(file: string): boolean {
  return fs.existsSync(path.resolve(ROOT, file));
}

export interface CallOptions {
  headers?: Record<string, string>;
  body?: object | string;
  url?: string;
  params?: Record<string, string>;
}

export interface CallResult {
  status: number | null;
  text: string;
  headers: Record<string, string>;
  error?: string;
}

function errorText(err: unknown): string {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}

/** URL path for a route file with [param] segments filled. */
export function routeUrl(
  file: string,
  params: Record<string, string> = {}
): string {
  const rel = path.dirname(
    path.relative(path.join(ROOT, 'app'), path.resolve(ROOT, file))
  );
  const segs = rel
    .split(path.sep)
    .filter(s => !/^\(.*\)$/.test(s))
    .map(s => {
      const m = /^\[{1,2}(?:\.\.\.)?([^\]]+)\]{1,2}$/.exec(s);
      return m && params[m[1]] !== undefined
        ? encodeURIComponent(params[m[1]])
        : s;
    });
  return `http://localhost:3000/${segs.join('/')}`;
}

export async function callHandler(
  mod: Record<string, unknown>,
  file: string,
  method: string,
  opts: CallOptions = {}
): Promise<CallResult> {
  const handler = mod[method];
  if (typeof handler !== 'function')
    return {
      status: null,
      text: '',
      headers: {},
      error: `no ${method} export in ${file}`,
    };
  const request = createMockNextRequest({
    method,
    headers: opts.headers,
    body: opts.body,
    url: opts.url ?? routeUrl(file, opts.params),
  });
  let res: unknown;
  try {
    res = await (handler as (r: unknown, c: unknown) => Promise<unknown>)(
      request,
      {
        params: Promise.resolve(opts.params ?? {}),
      }
    );
  } catch (err) {
    return {
      status: null,
      text: '',
      headers: {},
      error: `handler threw: ${errorText(err)}`,
    };
  }
  const r = res as {
    status?: unknown;
    text?: () => Promise<string>;
    headers?: Headers;
  } | null;
  if (!r || typeof r.status !== 'number')
    return {
      status: null,
      text: '',
      headers: {},
      error: 'handler did not return a Response',
    };
  const headers: Record<string, string> = {};
  r.headers?.forEach?.((v: string, k: string) => {
    headers[k.toLowerCase()] = v;
  });
  let text = '';
  try {
    text = typeof r.text === 'function' ? await r.text() : '';
  } catch (err) {
    return {
      status: r.status,
      text: '',
      headers,
      error: `body read failed: ${errorText(err)}`,
    };
  }
  return { status: r.status, text, headers };
}

/** Load the route file fresh and call one method once. */
export async function callRoute(
  file: string,
  method: string,
  opts: CallOptions = {}
): Promise<CallResult> {
  let mod: Record<string, unknown>;
  try {
    mod = loadModule(file);
  } catch (err) {
    return {
      status: null,
      text: '',
      headers: {},
      error: `import failed: ${errorText(err)}`,
    };
  }
  return callHandler(mod, file, method, opts);
}

/** Bearer header for a synthetic user, signed with the test JWT_SECRET. */
export function bearer(userId: string, email: string): Record<string, string> {
  const token = jwt.sign(
    { userId, email, organizationId: userId === 'user-a' ? 'org-A' : 'org-B' },
    process.env.JWT_SECRET as string,
    { expiresIn: '1h' }
  );
  return { authorization: `Bearer ${token}` };
}
