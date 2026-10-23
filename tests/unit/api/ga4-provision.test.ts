/**
 * K2 — POST /api/integrations/ga4/provision (onboarding creates GA4 for the org).
 *
 * SEAM: the route handler through createMockNextRequest. Auth, org resolution,
 * Prisma and the token helper are boundary mocks; the GA4 Admin API is a fake
 * behind global fetch. Nothing reaches Google.
 * CATCHES: provisioning without the recorded analytics.edit grant; any Google
 * call before the grant check; a Google 403 reported as success; a duplicate
 * property / stream on a re-run; duplicate property / stream / key events when
 * two runs for the same GA4 account overlap (the advisory lock is modelled by
 * a per-key promise chain behind tx.$executeRaw); the measurement ID not
 * stored on the org's GA4 integration record.
 * MISSES: real Google behaviour; real Postgres advisory-lock semantics; the
 * onboarding UI.
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';
import {
  GA4_ADMIN_SCOPE,
  GA4_ADMIN_CONSENT_VERSION,
} from '@/lib/google/ga4-admin-consent';

const mockGetUserId = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => mockGetUserId(...a),
}));

const mockGetOrgId = jest.fn();
jest.mock('@/lib/multi-business', () => ({
  getEffectiveOrganizationId: (...a: unknown[]) => mockGetOrgId(...a),
}));

const mockFindFirst = jest.fn();
const mockUpsert = jest.fn();
/** GA4Property rows the org already holds (tx.gA4Property.findMany). */
const mockOwned = jest.fn();
/** Keys passed to pg_advisory_xact_lock, in call order. */
const lockedKeys: string[] = [];
/**
 * Fake interactive transaction. tx.$executeRaw models a transaction-scoped
 * advisory lock: the key is the first bound value of the tagged template, a
 * second holder of the same key waits until the first transaction ends.
 */
const advisoryLocks = new Map<string, Promise<void>>();
async function fakeTransaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
  // Every key this transaction locked is released when it ends, as Postgres
  // releases all transaction-scoped advisory locks at COMMIT/ROLLBACK.
  const releases: Array<() => void> = [];
  const tx = {
    $executeRaw: async (
      _strings: TemplateStringsArray,
      ...values: unknown[]
    ) => {
      const key = String(values[0]);
      lockedKeys.push(key);
      const previous = advisoryLocks.get(key) ?? Promise.resolve();
      const mine = new Promise<void>(resolve => {
        releases.push(resolve);
      });
      advisoryLocks.set(
        key,
        previous.then(() => mine)
      );
      await previous;
      return 1;
    },
    gA4Property: {
      upsert: (...a: unknown[]) => mockUpsert(...a),
      findMany: (...a: unknown[]) => mockOwned(...a),
    },
  };
  try {
    return await fn(tx);
  } finally {
    releases.forEach(release => release());
  }
}
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    platformConnection: { findFirst: (...a: unknown[]) => mockFindFirst(...a) },
    gA4Property: { upsert: (...a: unknown[]) => mockUpsert(...a) },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) =>
      fakeTransaction(fn),
  },
}));

const mockToken = jest.fn();
jest.mock('@/lib/google/google-auth', () => ({
  getOAuthAccessToken: (...a: unknown[]) => mockToken(...a),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { POST } from '@/app/api/integrations/ga4/provision/route';

const READONLY = 'https://www.googleapis.com/auth/analytics.readonly';
const GRANT = {
  scopes: [READONLY, GA4_ADMIN_SCOPE],
  grantedByUserId: 'user-1',
  grantedByEmail: 'owner@example.com',
  grantedAt: '2026-10-22T05:00:00.000Z',
  consentAcceptedAt: '2026-10-22T04:59:00.000Z',
  consentVersion: GA4_ADMIN_CONSENT_VERSION,
  consentStatement: 'Synthex may create Analytics for me.',
};

const BODY = {
  accountId: '123',
  displayName: 'CARSI',
  defaultUri: 'https://carsi.com.au',
};

interface GoogleCall {
  method: string;
  url: string;
}

function res(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

/** Fake GA4 Admin API. `existing` pre-seeds a property + stream. */
function installGoogle(opts: { existing?: boolean; forbid?: boolean } = {}) {
  const calls: GoogleCall[] = [];
  global.fetch = jest.fn(async (u: string, init?: RequestInit) => {
    const url = String(u);
    const method = (init?.method ?? 'GET').toUpperCase();
    calls.push({ method, url });
    if (method === 'POST' && opts.forbid) {
      return res(403, {
        error: {
          code: 403,
          message: 'Request had insufficient authentication scopes.',
          status: 'PERMISSION_DENIED',
          details: [{ reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' }],
        },
      });
    }
    const path = new URL(url).pathname.replace('/v1beta/', '');
    if (path === 'properties') {
      return method === 'GET'
        ? res(200, {
            properties: opts.existing
              ? [
                  {
                    name: 'properties/555',
                    displayName: 'CARSI',
                    parent: 'accounts/123',
                  },
                ]
              : [],
          })
        : res(200, { name: 'properties/777', displayName: 'CARSI' });
    }
    if (path.endsWith('/dataStreams')) {
      return method === 'GET'
        ? res(200, {
            dataStreams: opts.existing
              ? [
                  {
                    name: 'properties/555/dataStreams/9',
                    type: 'WEB_DATA_STREAM',
                    webStreamData: {
                      defaultUri: 'https://carsi.com.au',
                      measurementId: 'G-EXIST01',
                    },
                  },
                ]
              : [],
          })
        : res(200, {
            name: 'properties/777/dataStreams/1',
            type: 'WEB_DATA_STREAM',
            webStreamData: {
              defaultUri: 'https://carsi.com.au',
              measurementId: 'G-NEW0001',
            },
          });
    }
    if (path.endsWith('/keyEvents')) {
      if (method === 'GET') {
        return res(200, {
          keyEvents: opts.existing
            ? [{ eventName: 'generate_lead' }, { eventName: 'sign_up' }]
            : [],
        });
      }
      const body = JSON.parse(String(init?.body));
      return res(200, { name: 'properties/777/keyEvents/1', ...body });
    }
    return res(404, { error: { code: 404, message: 'nope' } });
  }) as unknown as typeof fetch;
  return calls;
}

/**
 * Stateful fake GA4 Admin API: what a POST creates, the next GET lists. Every
 * response yields to the event loop first, so two unserialised runs both list
 * before either creates.
 */
function installStatefulGoogle() {
  const calls: GoogleCall[] = [];
  const properties: Array<{
    name: string;
    displayName: string;
    parent: string;
  }> = [];
  const streams: Array<{
    name: string;
    type: string;
    webStreamData: { defaultUri: string; measurementId: string };
  }> = [];
  const keyEvents: Array<{ eventName: string }> = [];
  global.fetch = jest.fn(async (u: string, init?: RequestInit) => {
    await new Promise(resolve => setTimeout(resolve, 5));
    const url = String(u);
    const method = (init?.method ?? 'GET').toUpperCase();
    calls.push({ method, url });
    const path = new URL(url).pathname.replace('/v1beta/', '');
    if (path === 'properties') {
      if (method === 'GET') return res(200, { properties: [...properties] });
      const created = {
        name: `properties/${700 + properties.length}`,
        displayName: 'CARSI',
        parent: 'accounts/123',
      };
      properties.push(created);
      return res(200, created);
    }
    if (path.endsWith('/dataStreams')) {
      if (method === 'GET') return res(200, { dataStreams: [...streams] });
      const created = {
        name: `${path}/${streams.length + 1}`,
        type: 'WEB_DATA_STREAM',
        webStreamData: {
          defaultUri: 'https://carsi.com.au',
          measurementId: `G-NEW000${streams.length + 1}`,
        },
      };
      streams.push(created);
      return res(200, created);
    }
    if (path.endsWith('/keyEvents')) {
      if (method === 'GET') return res(200, { keyEvents: [...keyEvents] });
      const body = JSON.parse(String(init?.body));
      keyEvents.push({ eventName: body.eventName });
      return res(200, { name: `${path}/${keyEvents.length}`, ...body });
    }
    return res(404, { error: { code: 404, message: 'nope' } });
  }) as unknown as typeof fetch;
  return { calls, properties, streams, keyEvents };
}

function post(body: object = BODY) {
  return POST(
    createMockNextRequest({
      method: 'POST',
      url: 'https://synthex.social/api/integrations/ga4/provision',
      body,
    })
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  lockedKeys.length = 0;
  advisoryLocks.clear();
  mockGetUserId.mockResolvedValue('user-1');
  mockGetOrgId.mockResolvedValue('org-1');
  mockToken.mockResolvedValue('access-token');
  mockOwned.mockResolvedValue([]);
  mockUpsert.mockImplementation(async (args: { create: object }) => ({
    id: 'ga4-row',
    ...args.create,
  }));
  mockFindFirst.mockResolvedValue({
    id: 'conn-1',
    scope: `${READONLY} ${GA4_ADMIN_SCOPE}`,
    metadata: { ga4AdminGrant: GRANT },
  });
});

/** True when the route refuses a read-only connection without calling Google. */
async function refusesWithoutGrant(handler: typeof POST) {
  mockFindFirst.mockResolvedValue({
    id: 'conn-1',
    scope: READONLY,
    metadata: {},
  });
  const calls = installGoogle();
  const r = await handler(
    createMockNextRequest({
      method: 'POST',
      url: 'https://synthex.social/api/integrations/ga4/provision',
      body: BODY,
    })
  );
  return (
    r.status === 403 && calls.length === 0 && mockUpsert.mock.calls.length === 0
  );
}

describe('POST /api/integrations/ga4/provision', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    expect((await post()).status).toBe(401);
  });

  it('returns 403 without an active organisation', async () => {
    mockGetOrgId.mockResolvedValue(null);
    expect((await post()).status).toBe(403);
  });

  it('refuses without the analytics.edit grant and never calls Google', async () => {
    expect(await refusesWithoutGrant(POST)).toBe(true);
  });

  it('refuses when the scope is present but no grant was recorded', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'conn-1',
      scope: GA4_ADMIN_SCOPE,
      metadata: {},
    });
    const calls = installGoogle();
    const r = await post();
    expect(r.status).toBe(403);
    expect((await r.json()).code).toBe('GA4_EDIT_CONSENT_REQUIRED');
    expect(calls).toHaveLength(0);
  });

  it('creates property, web stream and key events and stores the measurement ID on the org', async () => {
    const calls = installGoogle();
    const r = await post();
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.property).toEqual({
      propertyId: '777',
      displayName: 'CARSI',
      created: true,
    });
    expect(body.dataStream.measurementId).toBe('G-NEW0001');
    expect(body.keyEvents.created).toEqual(['generate_lead', 'sign_up']);
    expect(calls.filter(c => c.method === 'POST')).toHaveLength(4);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId_propertyId: {
            organizationId: 'org-1',
            propertyId: '777',
          },
        },
        create: expect.objectContaining({
          organizationId: 'org-1',
          propertyId: '777',
          measurementId: 'G-NEW0001',
          displayName: 'CARSI',
        }),
      })
    );
  });

  it('never adopts a same-name property already in the account: 409 GA4_PROPERTY_NAME_TAKEN, no write to it, nothing stored', async () => {
    // Property 555 "CARSI" exists in account 123 (it could be another
    // business's, or set to another time zone and currency).
    const calls = installGoogle({ existing: true });
    const r = await post();
    expect(r.status).toBe(409);
    expect((await r.json()).code).toBe('GA4_PROPERTY_NAME_TAKEN');
    expect(calls.filter(c => c.method === 'POST')).toHaveLength(0);
    expect(
      calls.filter(c => new URL(c.url).pathname.includes('/properties/555/'))
    ).toHaveLength(0);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('two overlapping runs for the same GA4 account create one property, one stream and one set of key events', async () => {
    const google = installStatefulGoogle();
    const [first, second] = await Promise.all([post(), post()]);
    // The run that waited for the lock finds the first run's property by
    // name and is refused rather than adopting or duplicating it.
    expect([first.status, second.status].sort()).toEqual([200, 409]);
    expect(lockedKeys.filter(k => k === 'ga4-provision:123')).toHaveLength(2);
    expect(google.properties).toHaveLength(1);
    expect(google.streams).toHaveLength(1);
    expect(google.keyEvents.map(e => e.eventName)).toEqual([
      'generate_lead',
      'sign_up',
    ]);
    expect(
      google.calls.filter(
        c =>
          c.method === 'POST' &&
          new URL(c.url).pathname === '/v1beta/properties'
      )
    ).toHaveLength(1);
    const [ok, refused] =
      first.status === 200 ? [first, second] : [second, first];
    expect((await ok.json()).property.created).toBe(true);
    expect((await refused.json()).code).toBe('GA4_PROPERTY_NAME_TAKEN');
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it('locks on the GA4 account whether or not the request uses the accounts/ prefix', async () => {
    installStatefulGoogle();
    await post({ ...BODY, accountId: 'accounts/123' });
    await post();
    expect(lockedKeys).toEqual([
      'ga4-provision-org:org-1',
      'ga4-provision:123',
      'ga4-provision-org:org-1',
      'ga4-provision:123',
    ]);
  });

  it.each([
    ['a non-Australian time zone', { timeZone: 'America/New_York' }],
    ['a currency other than AUD', { currencyCode: 'USD' }],
    ['a key event outside the statement', { keyEvents: ['purchase'] }],
    [
      'a consented event plus one outside it',
      { keyEvents: ['generate_lead', 'purchase'] },
    ],
  ])(
    'refuses %s (beyond the signed statement) before any Google call',
    async (_label, extra) => {
      const calls = installGoogle();
      const r = await post({ ...BODY, ...extra });
      expect(r.status).toBe(400);
      expect(calls).toHaveLength(0);
      expect(mockUpsert).not.toHaveBeenCalled();
    }
  );

  it('accepts another Australian time zone within the statement', async () => {
    const calls = installGoogle();
    const r = await post({ ...BODY, timeZone: 'Australia/Sydney' });
    expect(r.status).toBe(200);
    const propertyPost = calls.find(
      c =>
        c.method === 'POST' && new URL(c.url).pathname === '/v1beta/properties'
    );
    expect(propertyPost).toBeDefined();
  });

  it('an org that already holds its GA4 property is told so, and Synthex makes no Google call (no second property, no write to the old one)', async () => {
    mockOwned.mockResolvedValue([
      { propertyId: '555', displayName: 'CARSI', measurementId: 'G-EXIST01' },
    ]);
    const calls = installGoogle({ existing: true });
    const r = await post({ ...BODY, displayName: 'A different name' });
    expect(r.status).toBe(409);
    const body = await r.json();
    expect(body.code).toBe('GA4_ALREADY_PROVISIONED');
    expect(body.propertyId).toBe('555');
    expect(body.measurementId).toBe('G-EXIST01');
    expect(calls).toHaveLength(0);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('(Codex r4) an owned property under another account is not written to when the user chose account 123', async () => {
    mockOwned.mockResolvedValue([
      { propertyId: '555', displayName: 'CARSI', measurementId: null },
    ]);
    const calls = installGoogle({ existing: true });
    const r = await post({ ...BODY, accountId: '123' });
    expect(r.status).toBe(409);
    expect(calls.filter(c => c.method === 'POST')).toHaveLength(0);
    expect(
      calls.filter(c => new URL(c.url).pathname.includes('/properties/555/'))
    ).toHaveLength(0);
  });

  it('(Codex r4) an owned property also linked to another org gets no Google write', async () => {
    mockOwned.mockResolvedValue([
      { propertyId: '555', displayName: 'CARSI', measurementId: null },
    ]);
    const calls = installGoogle({ existing: true });
    const r = await post();
    expect(r.status).toBe(409);
    expect(calls).toHaveLength(0);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('(Codex r4) a member who did not sign the grant cannot use another member’s grant', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockFindFirst.mockResolvedValue({
      id: 'conn-1',
      scope: `${READONLY} ${GA4_ADMIN_SCOPE}`,
      metadata: { ga4AdminGrant: { ...GRANT, grantedByUserId: 'user-2' } },
    });
    const calls = installGoogle();
    const r = await post();
    expect(r.status).toBe(403);
    expect((await r.json()).code).toBe('GA4_EDIT_CONSENT_REQUIRED');
    expect(calls).toHaveLength(0);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('refuses with 409 when the org already holds more than one GA4 property', async () => {
    mockOwned.mockResolvedValue([
      { propertyId: '555', displayName: 'CARSI' },
      { propertyId: '556', displayName: 'CARSI old' },
    ]);
    const calls = installGoogle();
    const r = await post();
    expect(r.status).toBe(409);
    expect((await r.json()).code).toBe('GA4_PROPERTY_AMBIGUOUS');
    expect(calls).toHaveLength(0);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('reports a Google 403 as "needs Analytics edit consent", not success, and stores nothing', async () => {
    installGoogle({ forbid: true });
    const r = await post();
    expect(r.status).toBe(403);
    const body = await r.json();
    expect(body.code).toBe('GA4_EDIT_CONSENT_REQUIRED');
    expect(body.message).toMatch(/needs Analytics edit consent/);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('rejects an invalid body', async () => {
    installGoogle();
    expect(
      (await post({ accountId: 'abc', displayName: '', defaultUri: 'nope' }))
        .status
    ).toBe(400);
  });

  it('(control: planted failure is caught) a route whose grant check is bypassed fails the refusal check', async () => {
    let planted: typeof POST | undefined;
    jest.isolateModules(() => {
      jest.doMock('@/lib/google/ga4-admin-consent', () => ({
        ...jest.requireActual('@/lib/google/ga4-admin-consent'),
        readGa4AdminGrant: () => GRANT,
      }));
      planted = require('@/app/api/integrations/ga4/provision/route').POST;
    });
    expect(await refusesWithoutGrant(planted!)).toBe(false);
  });
});
