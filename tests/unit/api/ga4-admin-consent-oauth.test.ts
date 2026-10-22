/**
 * K2 — analytics.edit is requested only after the explicit onboarding consent.
 *
 * SEAM: GET /api/auth/oauth/[platform] (the Google authorisation URL it
 * returns) and POST /api/integrations/ga4/connect (the consent step), called
 * through createMockNextRequest. Auth, Prisma, credentials and PKCE storage are
 * boundary mocks; consent tokens are real HMAC tokens from the lib.
 * CATCHES: analytics.edit in the authorisation URL without a valid consent
 * token (including via the GOOGLEANALYTICS_OAUTH_SCOPE env override); a forged
 * or other-user token accepted; a consent step that accepts a paraphrased
 * statement; loss of include_granted_scopes (existing grants must survive).
 * MISSES: Google's consent screen itself and the callback's grant write
 * (buildGa4AdminGrant is covered in ga4-admin-consent.test.ts).
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockPrisma = {
  user: { findUnique: jest.fn() },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

const mockSecurityCheck = jest.fn();
jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: { check: (...a: unknown[]) => mockSecurityCheck(...a) },
  DEFAULT_POLICIES: { AUTHENTICATED_READ: 'AUTHENTICATED_READ' },
}));

jest.mock('@/lib/multi-business', () => ({
  getEffectiveOrganizationId: async () => 'org-1',
  hasOrganizationAccess: async () => true,
}));

jest.mock('@/lib/platform-credentials', () => ({
  getPlatformOAuthCredentials: async () => ({
    clientId: 'google-client',
    clientSecret: 'x',
  }),
}));

jest.mock('@/lib/auth/pkce', () => ({
  generatePKCEChallenge: () => ({ codeVerifier: 'v', codeChallenge: 'c' }),
  generateState: () => 'state',
  storePKCEState: async () => undefined,
}));

jest.mock('@/lib/auth/oauth-base-url', () => ({
  getOAuthBaseUrl: () => 'https://synthex.social',
}));

const mockGetUserId = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => mockGetUserId(...a),
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { GET as startOAuth } from '@/app/api/auth/oauth/[platform]/route';
import { POST as connectGa4 } from '@/app/api/integrations/ga4/connect/route';
import {
  GA4_ADMIN_SCOPE,
  GA4_ADMIN_CONSENT_STATEMENT,
  GA4_ADMIN_CONSENT_VERSION,
  signGa4AdminConsent,
  verifyGa4AdminConsent,
} from '@/lib/google/ga4-admin-consent';

const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv, OAUTH_STATE_SECRET: 'test-state-secret' };
  delete process.env.GOOGLEANALYTICS_OAUTH_SCOPE;
  mockSecurityCheck.mockResolvedValue({
    allowed: true,
    context: { userId: 'user-1' },
  });
  mockPrisma.user.findUnique.mockResolvedValue({
    id: 'user-1',
    email: 'owner@example.com',
  });
  mockGetUserId.mockResolvedValue('user-1');
});

afterAll(() => {
  process.env = originalEnv;
});

async function starterUrl(query = '') {
  const res = await startOAuth(
    createMockNextRequest({
      url: `https://synthex.social/api/auth/oauth/googleanalytics${query}`,
    }),
    { params: Promise.resolve({ platform: 'googleanalytics' }) }
  );
  const body = await res.json();
  return {
    res,
    body,
    url: body.authorizationUrl ? new URL(body.authorizationUrl) : null,
  };
}

function scopesOf(url: URL | null) {
  return (url?.searchParams.get('scope') ?? '').split(' ');
}

function decodeState(url: URL | null) {
  const state = url?.searchParams.get('state') ?? '';
  return JSON.parse(
    Buffer.from(state.split('.')[0], 'base64url').toString('utf8')
  );
}

/** True when the starter, with no consent token, asks Google for analytics.edit. */
async function requestsEditWithoutConsent() {
  const { res, url } = await starterUrl();
  if (res.status !== 200 || !url)
    throw new Error(`starter returned ${res.status}`);
  return scopesOf(url).includes(GA4_ADMIN_SCOPE);
}

describe('GET /api/auth/oauth/googleanalytics', () => {
  it('without consent requests read-only scope and keeps existing grants (include_granted_scopes)', async () => {
    const { res, url } = await starterUrl();
    expect(res.status).toBe(200);
    expect(scopesOf(url)).toContain(
      'https://www.googleapis.com/auth/analytics.readonly'
    );
    expect(await requestsEditWithoutConsent()).toBe(false);
    expect(url?.searchParams.get('include_granted_scopes')).toBe('true');
    expect(decodeState(url).ga4AdminConsent).toBeUndefined();
  });

  it('never smuggles analytics.edit through the env scope override without consent', async () => {
    process.env.GOOGLEANALYTICS_OAUTH_SCOPE = `https://www.googleapis.com/auth/analytics.readonly ${GA4_ADMIN_SCOPE}`;
    expect(await requestsEditWithoutConsent()).toBe(false);
  });

  it('with a valid consent token requests analytics.edit and carries the consent in state', async () => {
    const token = signGa4AdminConsent('user-1');
    const { res, url } = await starterUrl(
      `?ga4AdminConsent=${encodeURIComponent(token)}`
    );
    expect(res.status).toBe(200);
    expect(scopesOf(url)).toContain(GA4_ADMIN_SCOPE);
    expect(decodeState(url).ga4AdminConsent.version).toBe(
      GA4_ADMIN_CONSENT_VERSION
    );
  });

  it("refuses another user's consent token instead of silently downgrading", async () => {
    const token = signGa4AdminConsent('user-2');
    const { res, url } = await starterUrl(
      `?ga4AdminConsent=${encodeURIComponent(token)}`
    );
    expect(res.status).toBe(403);
    expect(url).toBeNull();
  });

  it('(control: planted failure is caught) with the scope guard bypassed, the detector sees analytics.edit', async () => {
    // Planted defect: the route's strip-without-consent guard is a no-op and the
    // env override asks for edit. The same detector must now report true.
    process.env.GOOGLEANALYTICS_OAUTH_SCOPE = `https://www.googleapis.com/auth/analytics.readonly ${GA4_ADMIN_SCOPE}`;
    let plantedStart: typeof startOAuth | undefined;
    jest.isolateModules(() => {
      jest.doMock('@/lib/google/ga4-admin-consent', () => ({
        ...jest.requireActual('@/lib/google/ga4-admin-consent'),
        withoutGa4AdminScope: (scope: string) => scope,
      }));
      plantedStart = require('@/app/api/auth/oauth/[platform]/route').GET;
    });
    const res = await plantedStart!(
      createMockNextRequest({
        url: 'https://synthex.social/api/auth/oauth/googleanalytics',
      }),
      { params: Promise.resolve({ platform: 'googleanalytics' }) }
    );
    const body = await res.json();
    expect(
      scopesOf(new URL(body.authorizationUrl)).includes(GA4_ADMIN_SCOPE)
    ).toBe(true);
  });
});

describe('POST /api/integrations/ga4/connect (consent step)', () => {
  let fetched: string[];
  beforeEach(() => {
    fetched = [];
    global.fetch = jest.fn(async (u: string) => {
      fetched.push(String(u));
      return {
        ok: true,
        json: async () => ({
          authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?x=1',
          platform: 'googleanalytics',
        }),
      } as unknown as Response;
    }) as unknown as typeof fetch;
  });

  function post(body?: object) {
    return connectGa4(
      createMockNextRequest({
        method: 'POST',
        url: 'https://synthex.social/api/integrations/ga4/connect',
        ...(body ? { body } : {}),
      })
    );
  }

  it('without the consent step passes no consent token (read-only connect unchanged)', async () => {
    const res = await post();
    expect(res.status).toBe(200);
    expect(new URL(fetched[0]).searchParams.has('ga4AdminConsent')).toBe(false);
  });

  it('with the accepted statement passes a consent token bound to the user', async () => {
    const res = await post({
      createAnalytics: {
        accepted: true,
        consentVersion: GA4_ADMIN_CONSENT_VERSION,
        statement: GA4_ADMIN_CONSENT_STATEMENT,
      },
    });
    expect(res.status).toBe(200);
    const token = new URL(fetched[0]).searchParams.get('ga4AdminConsent');
    expect(verifyGa4AdminConsent(token, 'user-1')).not.toBeNull();
  });

  it('rejects a paraphrased statement or an unticked box without starting OAuth', async () => {
    const paraphrased = await post({
      createAnalytics: {
        accepted: true,
        consentVersion: GA4_ADMIN_CONSENT_VERSION,
        statement: 'Synthex may do analytics things',
      },
    });
    const unticked = await post({
      createAnalytics: {
        accepted: false,
        consentVersion: GA4_ADMIN_CONSENT_VERSION,
        statement: GA4_ADMIN_CONSENT_STATEMENT,
      },
    });
    expect(paraphrased.status).toBe(400);
    expect(unticked.status).toBe(400);
    expect(fetched).toHaveLength(0);
  });
});
