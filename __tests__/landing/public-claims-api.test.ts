/**
 * @jest-environment node
 */

/**
 * Claims this branch removed must not reach a visitor through an API
 * response — blocking regression tripwire, API layer (SYN-1226).
 *
 * The rendered suite judges what pages show; a page shows an API string only
 * in the UI state that displays it. This suite does not depend on UI state:
 * every same-origin API route that public code calls (publicApiRouteFiles)
 * is called directly, with every exported method, as a signed-in visitor,
 * twice — external services down, then up and answering a fixture page —
 * and every string field of the JSON it answers is judged by the tripwire
 * (exact seeds + high-precision patterns, nothing allow-listed).
 *
 * Data is populated mechanically from prisma/schema.prisma: every model
 * returns a row whose String fields carry a "Fixture <Model> <field>" marker.
 * A route that reads data and answers 2xx must echo a marker, or it is
 * reported as unpopulated — so an empty answer cannot pass as a judged one.
 *
 * Residual limit: copy written at runtime into the database or fetched from
 * external services is only as good as its content review; this suite judges
 * the strings the code itself returns over fixture rows.
 */

import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import { generateToken } from '@/lib/auth/jwt-utils';
import {
  ROOT,
  apiRoutes,
  publicApiRouteFiles,
  rel,
  tripwireHits,
} from './helpers/public-claims';

// ── Populated Prisma, built from the schema ─────────────────────────────────

declare global {
  var __apiPrisma: unknown;
  var __apiReads: number;
}

jest.mock('@/lib/prisma', () => {
  const client = new Proxy(
    {},
    {
      get: (_t, key: string) => {
        if (key === '__esModule') return false;
        if (key === 'then') return undefined;
        return (globalThis.__apiPrisma as Record<string, unknown>)[key];
      },
    }
  );
  return { __esModule: true, default: client, prisma: client };
});

jest.mock('next/headers', () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: () => undefined,
    getAll: () => [],
    has: () => false,
    set: () => undefined,
    delete: () => undefined,
  }),
  draftMode: async () => ({ isEnabled: false }),
}));

jest.mock('server-only', () => ({}), { virtual: true });

// DNS is not resolvable here; a fixture URL is treated as a public site so
// the services-up call reaches the fixture page instead of the blocked branch.
jest.mock('@/lib/security/validate-url', () => ({
  ...jest.requireActual('@/lib/security/validate-url'),
  assertExternalUrlSafe: async () => undefined,
}));

const NOW = new Date('2026-10-14T00:00:00.000Z');
const LATER = new Date('2026-10-21T00:00:00.000Z');
const MARKER = 'Fixture ';

interface Field {
  name: string;
  type: string;
  list: boolean;
  optional: boolean;
}

function parseSchema(): {
  models: Map<string, Field[]>;
  enums: Map<string, string[]>;
} {
  const schema = readFileSync(path.join(ROOT, 'prisma/schema.prisma'), 'utf8');
  const models = new Map<string, Field[]>();
  const enums = new Map<string, string[]>();
  for (const m of schema.matchAll(
    /^(model|enum)\s+(\w+)\s*\{([\s\S]*?)^\}/gm
  )) {
    const lines = m[3]
      .split('\n')
      .map(l => l.replace(/\/\/.*$/, '').trim())
      .filter(l => l && !l.startsWith('@@'));
    if (m[1] === 'enum') {
      enums.set(
        m[2],
        lines.map(l => l.split(/\s+/)[0])
      );
      continue;
    }
    models.set(
      m[2],
      lines.flatMap(l => {
        const f = l.match(/^(\w+)\s+(\w+)(\[\])?(\?)?/);
        return f
          ? [{ name: f[1], type: f[2], list: !!f[3], optional: !!f[4] }]
          : [];
      })
    );
  }
  return { models, enums };
}

const { models, enums } = parseSchema();
const modelOf = (key: string) =>
  [...models.keys()].find(
    name => name.charAt(0).toLowerCase() + name.slice(1) === key
  );

function row(model: string, depth = 0): Record<string, unknown> {
  // Relation counts (include: { _count }) — every relation counts 3.
  const out: Record<string, unknown> = {
    _count: new Proxy({}, { get: (_t, k) => (k === 'toJSON' ? undefined : 3) }),
  };
  for (const f of models.get(model) ?? []) {
    out[f.name] = value(model, f, depth);
  }
  return out;
}

function value(model: string, f: Field, depth: number): unknown {
  if (models.has(f.type)) {
    if (depth >= 1) return f.list ? [] : null;
    return f.list ? [row(f.type, depth + 1)] : row(f.type, depth + 1);
  }
  const one = (): unknown => {
    switch (f.type) {
      case 'String':
        if (f.name === 'id' || /Id$/.test(f.name)) return `fixture-${f.name}`;
        if (/email/i.test(f.name)) return 'fixture@example.com';
        if (/url|image|avatar|logo/i.test(f.name)) {
          return 'https://example.com/fixture';
        }
        return `${MARKER}${model} ${f.name}`;
      case 'Int':
      case 'Float':
      case 'Decimal':
      case 'BigInt':
        return 3;
      case 'Boolean':
        return !/deleted|archived|revoked|disabled|blocked/i.test(f.name);
      case 'DateTime':
        if (/deleted|archived|revoked|cancel/i.test(f.name)) return null;
        return /expire|until|end/i.test(f.name) ? LATER : NOW;
      case 'Json':
        return {};
      default:
        return enums.get(f.type)?.[0] ?? null;
    }
  };
  return f.list ? [one()] : one();
}

function populatedClient(): Record<string, unknown> {
  const delegate = (model: string) =>
    new Proxy(
      {},
      {
        get: (_t, method: string) => async (args?: { data?: object }) => {
          globalThis.__apiReads++;
          const r = row(model);
          const n = 3;
          if (/^find(First|Unique)(OrThrow)?$/.test(method)) return r;
          if (method === 'findMany') return [r];
          if (method === 'count') return n;
          if (method === 'aggregate') return { _count: n, _sum: {}, _avg: {} };
          if (method === 'groupBy') return [];
          if (/^(create|update|delete)Many$/.test(method)) return { count: 1 };
          return { ...r, ...(args?.data ?? {}) };
        },
      }
    );
  const client: Record<string, unknown> = new Proxy(
    {},
    {
      get: (_t, key: string) => {
        if (key === '$transaction') {
          return async (arg: unknown) =>
            typeof arg === 'function'
              ? (arg as (c: unknown) => unknown)(client)
              : Promise.all(arg as Promise<unknown>[]);
        }
        if (key.startsWith('$')) return async () => [];
        const model = modelOf(key);
        return model ? delegate(model) : undefined;
      },
    }
  );
  return client;
}

// ── Requests ────────────────────────────────────────────────────────────────

const SITE = 'https://synthex.social';
const FIXTURE_PAGE = `<html><head><title>Fixture Page</title><meta name="description" content="Fixture page description"></head><body><h1>Fixture heading</h1><p>${'Fixture page words for the scan. '.repeat(12)}</p></body></html>`;
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

/**
 * Bodies the public UI sends, so success branches are judged as well as
 * validation errors. A route without one is called with an empty object.
 */
const BRIEF = `# Fixture brief\n\n${'Fixture brief line for review. '.repeat(5)}`;
const BODIES: Record<string, unknown> = {
  'app/api/contact/route.ts': {
    name: 'Fixture Visitor',
    email: 'fixture@example.com',
    subject: 'Fixture subject',
    message: 'Fixture message from a visitor.',
  },
  'app/api/waitlist/route.ts': { email: 'fixture@example.com' },
  'app/api/demo/caption/route.ts': { businessName: 'Fixture Cafe' },
  'app/api/intentscape/public/expand/route.ts': {
    originSignal: 'A bakery wants more weekday orders.',
  },
  'app/api/opportunity-map/route.ts': {
    businessName: 'Fixture Bakery',
    context: 'https://example.com — a bakery that wants more weekday orders.',
  },
  'app/api/opportunity-map/feedback/route.ts': {
    scanId: 'fixture-scan-0001',
    useful: true,
  },
  'app/api/opportunity-map/handoff/route.ts': {
    scanId: 'fixture-scan-0001',
    name: 'Fixture Visitor',
    email: 'fixture@example.com',
    consent: true,
  },
  'app/api/internal/sign-lead/route.ts': {
    contactMethod: 'form_submission',
    occurredAt: NOW.toISOString(),
    capturedFrom: 'intentscape',
    rawPayload: {
      email: 'fixture@example.com',
      businessName: 'Fixture Bakery',
      intentscape: {
        briefVersion: 'marketing-extender-v1',
        workspaceId: 'public-product-tour',
        originSignal: 'A bakery wants more weekday orders.',
        goal: 'Grow weekday orders for the bakery.',
        selectedHypothesisId: 'demo-trust',
        contextVersion: 1,
        briefMarkdown: BRIEF,
        consentToNexusReview: true,
      },
    },
  },
  'app/api/bio/[pageId]/track/route.ts': { type: 'view' },
};

function paramsOf(file: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [, name] of file.matchAll(/\[(?:\.\.\.)?([^\]]+)\]/g)) {
    params[name] = 'fixture';
  }
  return params;
}

function urlOf(file: string): string {
  const route = rel(file)
    .replace(/^app/, '')
    .replace(/\/route\.(ts|js)$/, '')
    .replace(/\/\([^/)]+\)/g, '')
    .replace(/\[(?:\.\.\.)?([^\]]+)\]/g, 'fixture');
  return `${SITE}${route}`;
}

function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach(x => strings(x, out));
  else if (v && typeof v === 'object')
    Object.values(v).forEach(x => strings(x, out));
  return out;
}

// ── Suite ───────────────────────────────────────────────────────────────────

const files = publicApiRouteFiles();

describe('public copy — unsupported claims (API responses)', () => {
  const originalFetch = global.fetch;
  const originalError = console.error;
  const originalWarn = console.warn;
  const unpopulated: string[] = [];

  beforeAll(() => {
    jest.useFakeTimers({
      now: NOW,
      doNotFake: [
        'hrtime',
        'nextTick',
        'performance',
        'queueMicrotask',
        'setImmediate',
        'clearImmediate',
        'setInterval',
        'clearInterval',
        'setTimeout',
        'clearTimeout',
      ],
    });
    // Service clients are configured with inert keys; external services are
    // unreachable on the first call and answer a fixture page on the second.
    process.env.RESEND_API_KEY ||= 're_fixture';
    process.env.CORS_ALLOWED_ORIGINS ||= SITE;
    console.error = () => undefined;
    console.warn = () => undefined;
  });

  afterAll(() => {
    jest.useRealTimers();
    global.fetch = originalFetch;
    console.error = originalError;
    console.warn = originalWarn;
  });

  it('finds the API routes public code calls', () => {
    expect(files.map(rel)).toEqual(
      expect.arrayContaining([
        'app/api/analytics/route.ts',
        'app/api/blog/route.ts',
        'app/api/public/testimonials/[token]/route.ts',
      ])
    );
    expect(files.every(f => apiRoutes().some(r => r.file === f))).toBe(true);
  });

  it.each(Object.keys(BODIES))(
    'has a request body only for a real route: %s',
    f => {
      expect(existsSync(path.join(ROOT, f))).toBe(true);
    }
  );

  const cases = files.flatMap(file => {
    const mod = readFileSync(file, 'utf8');
    return METHODS.filter(m =>
      new RegExp(`export\\s+(?:async\\s+)?(?:function|const)\\s+${m}\\b`).test(
        mod
      )
    ).map(m => [rel(file), m, file] as [string, string, string]);
  });

  it('calls at least one handler per route', () => {
    const called = new Set(cases.map(c => c[0]));
    expect(files.map(rel).filter(f => !called.has(f))).toEqual([]);
  });

  it.each(cases)(
    '%s %s',
    async (relative, method, file) => {
      const handler = (require(file) as Record<string, unknown>)[method] as (
        r: NextRequest,
        c: unknown
      ) => Promise<Response>;
      // Two states: external services down, then up with a fixture page.
      const first = await call(handler, relative, method, file, false);
      const second = await call(handler, relative, method, file, true);
      const values = first.values;
      if (
        first.status >= 200 &&
        first.status < 300 &&
        first.reads > 0 &&
        !values.some(v => v.includes(MARKER))
      ) {
        unpopulated.push(`${relative} ${method}`);
      }

      const findings = [...values, ...second.values].flatMap(v =>
        tripwireHits(v).map(hit => `${hit.rule} — "${hit.sentence}"`)
      );
      expect([...new Set(findings)]).toEqual([]);
    },
    30_000
  );

  async function call(
    handler: (r: NextRequest, c: unknown) => Promise<Response>,
    relative: string,
    method: string,
    file: string,
    servicesUp: boolean
  ): Promise<{ status: number; reads: number; values: string[] }> {
    globalThis.__apiPrisma = populatedClient();
    globalThis.__apiReads = 0;
    global.fetch = (async () =>
      servicesUp
        ? new Response(FIXTURE_PAGE, {
            status: 200,
            headers: { 'content-type': 'text/html' },
          })
        : new Response('{}', { status: 503 })) as unknown as typeof fetch;
    const withBody = method !== 'GET' && method !== 'DELETE';
    const request = new NextRequest(urlOf(file), {
      method,
      // A plain object: the Jest Request polyfill reads headers with
      // Object.entries, which sees nothing on a Headers instance.
      headers: {
        'content-type': 'application/json',
        origin: SITE,
        authorization: `Bearer ${generateToken({ userId: 'fixture-userId', email: 'fixture@example.com' } as never)}`,
      } as unknown as HeadersInit,
      body: withBody ? JSON.stringify(BODIES[relative] ?? {}) : undefined,
    });
    const response = await handler(request, {
      params: Promise.resolve(paramsOf(relative)),
    });
    const text = await response.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      // Not JSON: the raw body is judged as one string.
    }
    return {
      status: response.status,
      reads: globalThis.__apiReads,
      values: strings(body),
    };
  }

  // A 2xx answer after reading data that carries no fixture string means the
  // populated state was never judged. Known cases are listed with the reason.
  it('judges a populated answer wherever a route reads data', () => {
    expect(unpopulated.filter(c => !UNPOPULATED_EXPECTED[c])).toEqual([]);
  });
});

/** Routes that read data but return none of its strings, and why. */
const UNPOPULATED_EXPECTED: Record<string, string> = {
  'app/api/auth/logout/route.ts POST': 'ends sessions; answers a status only',
  'app/api/auth/logout/route.ts DELETE': 'ends sessions; answers a status only',
  'app/api/bio/[pageId]/track/route.ts POST':
    'records a view; answers { success }',
  'app/api/demo/caption/route.ts POST':
    'reads only a rate limit; the caption comes from AI or built-in samples',
  'app/api/opportunity-map/feedback/route.ts POST':
    'stores feedback; answers { ok }',
  'app/api/waitlist/route.ts POST': 'stores the address; answers { success }',
};
