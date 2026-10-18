/**
 * J1 — Route security matrix (hard gate, 640 cases).
 *
 * (a) One unauthenticated probe per non-exempt route in the auth-ratchet
 *     inventory, frozen in tests/eval/jev/cases/J1/routes.json (./j1/inventory.ts).
 *     A frozen route whose file is gone is INCONCLUSIVE until tombstoned. The route's first exported method (GET, POST, PUT, PATCH, DELETE) is
 *     called with no auth header or cookie. Property: 401 (403 only where the
 *     route source documents a 403).
 * (b) The remainder: cross-organisation probes (org-A session on an org-B id
 *     must get 403 or 404 and leak no org-B data) and malformed-JSON probes
 *     (must get 400) on high-risk mutating routes, listed in
 *     tests/eval/jev/cases/J1/probes.json.
 *
 * Boundaries mocked as tests/contract/*.contract.test.ts do: @/lib/prisma (a
 * synthetic two-tenant world, ./j1/world.ts), @/lib/auth/jwt-utils cookie
 * lookup and @/lib/logger. next/headers has no request scope outside Next, so
 * cookies()/headers() are served from the probe's session (none for (a)).
 * The org-A session is a real JWT signed with the test JWT_SECRET. Outbound
 * network is blocked so no live service can be reached. Route code is real.
 *
 * A 503 whose body says the service is not configured is INCONCLUSIVE (missing
 * env in the harness), never PASS.
 */
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  it,
  jest,
} from '@jest/globals';
import fs from 'fs';
import net from 'net';
import path from 'path';
import {
  classify,
  inconclusive,
  recordResults,
  type JevResult,
} from '../runner/record';
import { invokeRoute } from '../runner/route-harness';
import { inventory as frozenInventory } from './j1/inventory';
import jwt from 'jsonwebtoken';
import { B_MARKER, USER_A, resetWorld, worldState } from './j1/world';
import probesDoc from '../cases/J1/probes.json';

jest.mock('next/headers', () => {
  const g = globalThis as Record<string, unknown>;
  const token = () =>
    g.__J1_SESSION__ ? (g.__J1_TOKEN__ as string | undefined) : undefined;
  const cookieStore = () => ({
    get: (name: string) =>
      name === 'auth-token' && token()
        ? { name, value: token() as string }
        : undefined,
    getAll: () =>
      token() ? [{ name: 'auth-token', value: token() as string }] : [],
    has: (name: string) => name === 'auth-token' && !!token(),
    set: () => undefined,
    delete: () => undefined,
  });
  const headerStore = () => {
    const h = new Map<string, string>();
    if (token()) h.set('authorization', `Bearer ${token()}`);
    return {
      get: (n: string) => h.get(n.toLowerCase()) ?? null,
      has: (n: string) => h.has(n.toLowerCase()),
      forEach: (cb: (v: string, k: string) => void) => h.forEach(cb),
      entries: () => h.entries(),
    };
  };
  return {
    __esModule: true,
    cookies: async () => cookieStore(),
    headers: async () => headerStore(),
    draftMode: async () => ({ isEnabled: false }),
  };
});

jest.mock('@/lib/prisma', () => {
  const { fakePrisma } =
    jest.requireActual<typeof import('./j1/world')>('./j1/world');
  const client = fakePrisma();
  return {
    __esModule: true,
    prisma: client,
    default: client,
    checkDatabaseHealth: async () => ({ healthy: false }),
    executeWithRetry: async (fn: () => unknown) => fn(),
    withTransaction: async (fn: (tx: unknown) => unknown) => fn(client),
    disconnectPrisma: async () => undefined,
    reconnectPrisma: async () => false,
    getPoolMetrics: () => ({}),
  };
});

jest.mock('@/lib/auth/jwt-utils', () => {
  const actual = jest.requireActual<typeof import('@/lib/auth/jwt-utils')>(
    '@/lib/auth/jwt-utils'
  );
  const sessionUser = () =>
    ((globalThis as Record<string, unknown>).__J1_SESSION__ as
      | string
      | null
      | undefined) ?? null;
  return {
    __esModule: true,
    ...actual,
    getUserIdFromCookies: async () => sessionUser(),
    getUserIdFromRequestOrCookies: async (
      req: Parameters<typeof actual.getUserIdFromRequest>[0]
    ) => sessionUser() ?? actual.getUserIdFromRequest(req),
  };
});

jest.mock('@/lib/logger', () => {
  const noop = () => undefined;
  const logger = {
    info: noop,
    warn: noop,
    error: noop,
    debug: noop,
    log: noop,
    child: () => logger,
  };
  return { __esModule: true, logger, default: logger, log: logger };
});

const FAMILY = 'J1';
const ROOT = path.join(__dirname, '../../../..');
const METHOD_ORDER = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const results: JevResult[] = [];

afterAll(() => recordResults(FAMILY, results));

// ── Outbound network guard ────────────────────────────────────────────────────
const realConnect = net.Socket.prototype.connect;
const realFetch = globalThis.fetch;
beforeAll(() => {
  net.Socket.prototype.connect = function blocked(): never {
    throw new Error('JEV J1: outbound network blocked');
  } as typeof net.Socket.prototype.connect;
  globalThis.fetch = (async () => {
    throw new Error('JEV J1: outbound network blocked');
  }) as typeof fetch;
});
afterAll(() => {
  net.Socket.prototype.connect = realConnect;
  globalThis.fetch = realFetch;
});

/**
 * Present (or clear) the org-A session: a real JWT signed with the test
 * JWT_SECRET. `role: 'admin'` is the org-A administrator, used for the
 * malformed-body probes so role gates do not stop the probe before the body
 * is read; cross-org probes use a plain member.
 */
function setSession(userId: string | null, role = 'user'): void {
  const g = globalThis as Record<string, unknown>;
  g.__J1_SESSION__ = userId;
  g.__J1_TOKEN__ = userId
    ? jwt.sign(
        { userId, email: 'user-a@org-a.test', role },
        process.env.JWT_SECRET as string,
        { expiresIn: '1h' }
      )
    : undefined;
}

/**
 * The route answered "not configured" (a 503, or a 200 error envelope) before
 * reaching its auth or body handling: missing env in the harness, not a verdict.
 */
function notConfigured(status: number, body: unknown): boolean {
  const text = JSON.stringify(body ?? '');
  const says = /not (configured|set up|available)/i.test(text);
  if (status === 503) return says;
  return status === 200 && says && /"error":/.test(text);
}

/** Stable id slug: path segments joined by '.', dynamic segments as their name. */
function slug(file: string): string {
  return file
    .replace(/^app\/api\//, '')
    .replace(/\/route\.ts$/, '')
    .split('/')
    .map(seg =>
      seg
        .replace(/\[+\.{0,3}([^\]]+)\]+/g, '$1')
        .replace(/[^A-Za-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase()
    )
    .join('.');
}

/** Dynamic segment names of a route file, filled with a neutral probe id. */
function probeParams(file: string, value: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const m of file.matchAll(/\[+(?:\.\.\.)?([^\]]+)\]+/g))
    params[m[1]] = value;
  return params;
}

// ── Detector (a): unauthenticated probe ───────────────────────────────────────
export interface UnauthVerdict {
  passed: boolean;
  detail: string;
}

/** 401 passes; 403 passes only if the route source documents a 403. */
export function judgeUnauth(
  status: number,
  documents403: boolean
): UnauthVerdict {
  if (status === 401) return { passed: true, detail: 'status 401' };
  if (status === 403 && documents403)
    return { passed: true, detail: 'status 403 (documented)' };
  return { passed: false, detail: `status ${status}` };
}

function documents403(source: string): boolean {
  return /\b403\b|forbiddenResponse|'FORBIDDEN'/.test(source);
}

// ── Detector (b): cross-org and malformed body ────────────────────────────────
export function judgeCrossOrg(
  status: number,
  body: unknown
): UnauthVerdict & { inconclusive?: boolean } {
  const leaked = JSON.stringify(body ?? null).includes(B_MARKER);
  if ((status === 403 || status === 404) && !leaked)
    return { passed: true, detail: `status ${status}` };
  if (status === 400 && !leaked)
    return {
      passed: false,
      inconclusive: true,
      detail: 'status 400: probe body rejected before the ownership check',
    };
  return {
    passed: false,
    detail: `status ${status}${leaked ? ', org-B data in response' : ''}`,
  };
}

export function judgeMalformed(status: number): UnauthVerdict {
  return { passed: status === 400, detail: `status ${status}` };
}

// ── (a) cases ─────────────────────────────────────────────────────────────────
const inventory = frozenInventory();

function caseRow(
  id: string,
  route: string,
  fields: Pick<JevResult, 'state' | 'gap_id' | 'detail'>
): JevResult {
  return { id, family: FAMILY, kind: 'case', route, ...fields };
}

function bodyText(json: unknown): string {
  return json ? `; body ${JSON.stringify(json).slice(0, 160)}` : '';
}

describe('J1 (a) unauthenticated probe per non-exempt route', () => {
  beforeEach(() => {
    setSession(null);
    resetWorld();
  });

  it.each(inventory.map(r => [r.file, r] as const))('%s', async (_f, r) => {
    const id = `J1-unauth-${slug(r.file)}`;
    // Not inconclusive(): a known gap on the route must not mask a vanished file.
    if (!r.present) {
      results.push(
        caseRow(id, r.route, {
          state: 'INCONCLUSIVE',
          detail: `frozen route ${r.file} is gone; remove it from cases/J1/routes.json with a tests/eval/jev/tombstones.json entry`,
        })
      );
      return;
    }
    const method = METHOD_ORDER.find(m => r.methods.includes(m));
    if (!method) {
      results.push(
        caseRow(
          id,
          r.route,
          inconclusive(
            id,
            `no GET/POST/PUT/PATCH/DELETE export (${r.methods.join(',') || 'none'})`
          )
        )
      );
      return;
    }
    const route = `${method} ${r.route}`;
    const source = fs.readFileSync(path.join(ROOT, r.file), 'utf8');
    const res = await invokeRoute(r.file, method, {
      params: probeParams(r.file, 'jev-probe-id'),
      body: method === 'GET' || method === 'DELETE' ? undefined : {},
    });
    if (res.status === null) {
      results.push(caseRow(id, route, inconclusive(id, res.error)));
      return;
    }
    if (notConfigured(res.status, res.json)) {
      results.push(
        caseRow(
          id,
          route,
          inconclusive(
            id,
            `status ${res.status} service not configured (missing env)${bodyText(res.json)}`
          )
        )
      );
      return;
    }
    const v = judgeUnauth(res.status, documents403(source));
    const db = worldState().calls.length;
    results.push(
      caseRow(
        id,
        route,
        classify(
          id,
          v.passed,
          `${v.detail}${db ? `; db calls ${db}` : ''}${v.passed ? '' : bodyText(res.json)}`
        )
      )
    );
  });
});

// ── (b) cases ─────────────────────────────────────────────────────────────────
interface Probe {
  kind: 'cross-org' | 'malformed-body';
  file: string;
  method: string;
  params: Record<string, string>;
  body?: object | null;
}

const MALFORMED_JSON = '{"name": "JEV probe", ';
const probes = (probesDoc as unknown as { probes: Probe[] }).probes;

describe('J1 (b) cross-organisation and malformed-body probes', () => {
  beforeEach(() => resetWorld());
  afterAll(() => setSession(null));

  it.each(probes.map(p => [`${p.kind} ${p.method} ${p.file}`, p] as const))(
    '%s',
    async (_n, p) => {
      const id = `J1-${p.kind === 'cross-org' ? 'xorg' : 'malformed'}-${p.method.toLowerCase()}-${slug(p.file)}`;
      setSession(USER_A, p.kind === 'cross-org' ? 'user' : 'admin');
      const route = `${p.method} ${p.file.replace(/^app/, '').replace(/\/route\.ts$/, '')}`;
      const res = await invokeRoute(p.file, p.method, {
        params: p.params,
        body: p.kind === 'cross-org' ? (p.body ?? undefined) : MALFORMED_JSON,
        headers: {
          authorization: `Bearer ${(globalThis as Record<string, unknown>).__J1_TOKEN__}`,
          'content-type': 'application/json',
        },
      });
      if (res.status === null) {
        results.push(caseRow(id, route, inconclusive(id, res.error)));
        return;
      }
      if (notConfigured(res.status, res.json)) {
        results.push(
          caseRow(
            id,
            route,
            inconclusive(
              id,
              `status ${res.status} service not configured (missing env)${bodyText(res.json)}`
            )
          )
        );
        return;
      }
      const db = worldState().calls.join(',');
      if (p.kind === 'cross-org') {
        const v = judgeCrossOrg(res.status, res.json);
        if (v.inconclusive) {
          results.push(caseRow(id, route, inconclusive(id, v.detail)));
          return;
        }
        results.push(
          caseRow(
            id,
            route,
            classify(
              id,
              v.passed,
              `${v.detail}; db ${db || 'none'}${v.passed ? '' : bodyText(res.json)}`
            )
          )
        );
      } else {
        const v = judgeMalformed(res.status);
        results.push(
          caseRow(
            id,
            route,
            classify(
              id,
              v.passed,
              `${v.detail}${v.passed ? '' : bodyText(res.json)}`
            )
          )
        );
      }
    }
  );
});

// ── Positive controls: planted defects through the same detectors ─────────────
const PLANT = 'tests/eval/jev/families/j1/planted-route.ts';
const PLANT_URL = 'http://localhost:3000/api/jev-planted';

function controlRow(
  id: string,
  detail: string,
  caught: boolean | null
): JevResult {
  return {
    id,
    family: FAMILY,
    kind: 'control',
    state: caught === null ? 'INCONCLUSIVE' : caught ? 'FAIL' : 'PASS',
    route: PLANT,
    detail,
  };
}

describe('J1 positive controls', () => {
  beforeEach(() => resetWorld());
  afterAll(() => setSession(null));

  it('planted handler returning 200 with no auth', async () => {
    setSession(null);
    const res = await invokeRoute(PLANT, 'GET', { url: PLANT_URL });
    if (res.status === null) {
      results.push(
        controlRow('J1-control-unauth-200', String(res.error), null)
      );
      return;
    }
    const v = judgeUnauth(
      res.status,
      documents403(fs.readFileSync(path.join(ROOT, PLANT), 'utf8'))
    );
    results.push(controlRow('J1-control-unauth-200', v.detail, !v.passed));
  });

  it('planted handler leaking org-B data to org-A', async () => {
    setSession(USER_A);
    const res = await invokeRoute(PLANT, 'PATCH', {
      url: PLANT_URL,
      params: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0001' },
      body: { title: 'JEV probe' },
    });
    if (res.status === null) {
      results.push(controlRow('J1-control-xorg-leak', String(res.error), null));
      return;
    }
    const v = judgeCrossOrg(res.status, res.json);
    results.push(
      controlRow('J1-control-xorg-leak', v.detail, !v.passed && !v.inconclusive)
    );
  });

  it('planted handler returning 500 on a malformed body', async () => {
    setSession(USER_A);
    const res = await invokeRoute(PLANT, 'POST', {
      url: PLANT_URL,
      body: MALFORMED_JSON,
      headers: { 'content-type': 'application/json' },
    });
    if (res.status === null) {
      results.push(
        controlRow('J1-control-malformed-500', String(res.error), null)
      );
      return;
    }
    const v = judgeMalformed(res.status);
    results.push(controlRow('J1-control-malformed-500', v.detail, !v.passed));
  });
});
