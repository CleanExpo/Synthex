/**
 * K2 — POST /api/integrations/ga4/provision (onboarding creates GA4 for the org).
 *
 * SEAM: the route handler through createMockNextRequest. Auth, org resolution,
 * Prisma and the token helper are boundary mocks; the GA4 Admin API is a fake
 * behind global fetch. Nothing reaches Google.
 * CATCHES: provisioning without the recorded analytics.edit grant; any Google
 * call before the grant check; a Google 403 reported as success; a duplicate
 * property / stream on a re-run; the measurement ID not stored on the org's
 * GA4 integration record.
 * MISSES: real Google behaviour; the onboarding UI.
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
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    platformConnection: { findFirst: (...a: unknown[]) => mockFindFirst(...a) },
    gA4Property: { upsert: (...a: unknown[]) => mockUpsert(...a) },
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
  mockGetUserId.mockResolvedValue('user-1');
  mockGetOrgId.mockResolvedValue('org-1');
  mockToken.mockResolvedValue('access-token');
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

  it('a re-run reuses the existing property and stream and creates nothing', async () => {
    const calls = installGoogle({ existing: true });
    const r = await post();
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.property.created).toBe(false);
    expect(body.dataStream).toMatchObject({
      measurementId: 'G-EXIST01',
      created: false,
    });
    expect(calls.filter(c => c.method === 'POST')).toHaveLength(0);
    expect(mockUpsert.mock.calls[0][0].create.measurementId).toBe('G-EXIST01');
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
