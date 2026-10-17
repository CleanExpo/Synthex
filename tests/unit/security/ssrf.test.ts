/**
 * SSRF regression tests (J11-GAP-ssrf-redirect-follow, J11-GAP-webhook-sender-unguarded).
 *
 * Global fetch is a recorder with real redirect semantics: redirect 'follow' (the default)
 * follows scripted 3xx hops itself, 'manual' returns the 3xx. The property checked is that
 * no request — including a followed hop — reaches an internal address.
 */

import { createMockNextRequest } from '../../helpers/mock-request';

jest.mock('node:dns/promises', () => ({
  lookup: jest.fn(async (host: string) => {
    const table: Record<string, string> = {
      'public.example': '93.184.216.34',
      'internal.example': '10.0.0.7',
    };
    if (!table[host]) throw new Error(`ENOTFOUND ${host}`);
    return [{ address: table[host], family: 4 }];
  }),
}));
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: { auditLog: { create: jest.fn(async () => ({})) } },
}));
jest.mock('@/lib/ai/providers', () => ({
  getAIProvider: () => ({
    complete: jest.fn(async () => {
      throw new Error('no AI in tests');
    }),
  }),
}));
jest.mock('@/lib/rate-limit', () => ({
  aiGeneration: (_req: unknown, fn: () => unknown) => fn(),
}));
jest.mock('@/lib/security/api-security-checker', () => {
  const { NextResponse } = jest.requireActual('next/server');
  return {
    APISecurityChecker: {
      check: async () => ({ allowed: true }),
      createSecureResponse: (data: unknown, status = 200) =>
        NextResponse.json(data, { status }),
    },
    DEFAULT_POLICIES: { AUTHENTICATED_WRITE: {} },
  };
});

const PUBLIC = 'http://93.184.216.34/';
const METADATA = 'http://169.254.169.254/latest/meta-data/';

type Script = Record<string, { status: number; location?: string }>;
let script: Script;
let calls: Array<{ url: string; method: string; redirect: string }>;
const savedFetch = global.fetch;

function respond(status: number, location?: string) {
  return {
    status,
    ok: status >= 200 && status < 300,
    statusText: String(status),
    headers: {
      get: (n: string) =>
        n.toLowerCase() === 'location'
          ? (location ?? null)
          : n.toLowerCase() === 'content-type'
            ? 'text/html'
            : null,
    },
    body: null,
    text: async () => '<html><title>ok</title></html>',
    json: async () => ({}),
  };
}

async function recorder(input: string, init: RequestInit = {}) {
  let url = String(input);
  for (let hop = 0; hop < 20; hop++) {
    calls.push({
      url,
      method: init.method ?? 'GET',
      redirect: init.redirect ?? 'follow',
    });
    const s = script[url];
    if (!s || !s.location) return respond(s?.status ?? 200);
    if (init.redirect === 'manual') return respond(s.status, s.location);
    if (init.redirect === 'error') throw new TypeError('redirect');
    url = new URL(s.location, url).href;
  }
  throw new TypeError('redirect loop');
}

function isInternal(url: string): boolean {
  const host = new URL(url).hostname.replace(/^\[|\]$/g, '');
  return /^(10\.|127\.|169\.254\.|192\.168\.|0\.)/.test(host) || host === '::1';
}
const internalHits = () => calls.filter(c => isInternal(c.url));

beforeEach(() => {
  script = {};
  calls = [];
  delete process.env.FIRECRAWL_API_KEY;
  process.env.GEMINI_API_KEY = 'test';
  global.fetch = recorder as unknown as typeof fetch;
});
afterAll(() => {
  global.fetch = savedFetch;
});

describe('fetchExternalUrl', () => {
  it('re-validates each redirect hop and refuses an internal one', async () => {
    const { fetchExternalUrl } = await import('@/lib/security/validate-url');
    script[PUBLIC] = { status: 302, location: METADATA };
    await expect(fetchExternalUrl(PUBLIC)).rejects.toThrow();
    expect(internalHits()).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it('follows public redirects (relative too) and caps the hop count', async () => {
    const { fetchExternalUrl } = await import('@/lib/security/validate-url');
    script[PUBLIC] = { status: 301, location: '/next' };
    const res = await fetchExternalUrl(PUBLIC);
    expect(res.status).toBe(200);
    expect(calls.map(c => c.url)).toEqual([PUBLIC, `${PUBLIC}next`]);

    calls = [];
    script = { [PUBLIC]: { status: 302, location: PUBLIC } };
    await expect(fetchExternalUrl(PUBLIC, {}, 3)).rejects.toThrow(
      'Too many redirects'
    );
    expect(calls).toHaveLength(4);
  });

  it('refuses a hop to a hostname that resolves internally', async () => {
    const { fetchExternalUrl } = await import('@/lib/security/validate-url');
    script[PUBLIC] = { status: 302, location: 'http://internal.example/' };
    await expect(fetchExternalUrl(PUBLIC)).rejects.toThrow();
    expect(calls).toHaveLength(1);
  });
});

describe('services do not follow a redirect to an internal address', () => {
  it('analyzeWebsite', async () => {
    const { analyzeWebsite } = await import('@/lib/ai/website-analyzer');
    await analyzeWebsite({ url: PUBLIC, businessName: 'Org A' });
    expect(calls.length).toBeGreaterThan(0); // reachability
    calls = [];
    script[PUBLIC] = { status: 302, location: METADATA };
    await analyzeWebsite({ url: PUBLIC, businessName: 'Org A' }).catch(
      () => undefined
    );
    expect(internalHits()).toEqual([]);
  });

  it('performBusinessVetting', async () => {
    const { performBusinessVetting } =
      await import('@/lib/vetting/business-vetting');
    script[PUBLIC] = { status: 302, location: METADATA };
    script[`${PUBLIC}robots.txt`] = { status: 302, location: METADATA };
    await performBusinessVetting({ businessName: 'Org A', website: PUBLIC });
    expect(calls.some(c => c.url === PUBLIC)).toBe(true); // reachability
    expect(internalHits()).toEqual([]);
  });
});

describe('webhook sender guards at delivery time', () => {
  const send = async (url: string) => {
    const { sendWebhook } = await import('@/lib/webhooks/sender');
    return sendWebhook({
      url,
      event: 'webhook.test',
      data: {},
      secret: 's',
      maxRetries: 1,
      timeout: 1000,
    });
  };

  it('delivers to a public URL', async () => {
    const r = await send(`${PUBLIC}hook`);
    expect(r.success).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it('refuses an internal URL', async () => {
    const r = await send('http://10.0.0.7/hook');
    expect(r.success).toBe(false);
    expect(calls).toEqual([]);
  });

  it('refuses a hostname that now resolves internally', async () => {
    const r = await send('http://internal.example/hook');
    expect(r.success).toBe(false);
    expect(calls).toEqual([]);
  });

  it('does not follow a redirect to an internal address', async () => {
    script[`${PUBLIC}hook`] = {
      status: 302,
      location: 'http://127.0.0.1:8080/admin',
    };
    const r = await send(`${PUBLIC}hook`);
    expect(r.success).toBe(false);
    expect(internalHits()).toEqual([]);
  });

  it('pingWebhook refuses the metadata address and internal redirects', async () => {
    const { pingWebhook } = await import('@/lib/webhooks/sender');
    expect(await pingWebhook('http://169.254.169.254/')).toBe(false);
    script[PUBLIC] = { status: 302, location: METADATA };
    expect(await pingWebhook(PUBLIC)).toBe(false);
    expect(internalHits()).toEqual([]);
    expect(calls).toHaveLength(1);
  });
});

describe('routes do not follow a redirect to an internal address', () => {
  const cases: Array<[string, () => Promise<unknown>, string]> = [
    ['demo/analyze', () => import('@/app/api/demo/analyze/route'), PUBLIC],
    [
      'seo/page-analysis',
      () => import('@/app/api/seo/page-analysis/route'),
      PUBLIC,
    ],
    [
      'seo/sitemap',
      () => import('@/app/api/seo/sitemap/route'),
      `${PUBLIC}sitemap.xml`,
    ],
  ];
  it.each(cases)('%s', async (_name, load, url) => {
    const { POST } = (await load()) as {
      POST: (req: unknown) => Promise<Response>;
    };
    script[url] = { status: 302, location: 'http://10.0.0.7/x' };
    await POST(createMockNextRequest({ method: 'POST', body: { url } }));
    expect(calls.some(c => c.url === url)).toBe(true); // reachability
    expect(internalHits()).toEqual([]);
  });
});
