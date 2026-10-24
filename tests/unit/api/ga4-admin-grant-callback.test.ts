/**
 * K2 — the OAuth callback records the GA4 edit grant only when it is real.
 *
 * SEAM: GET /api/auth/callback/googleanalytics through createMockNextRequest.
 * Prisma, PKCE store, credentials and encryption are boundary mocks; Google's
 * token and userinfo endpoints are faked via global fetch.
 * CATCHES: a grant recorded without the signed consent in state; a grant
 * recorded when Google returned only the read-only scope (user unticked edit);
 * a missing grant record after a real consent + grant.
 * MISSES: Google's consent screen; token refresh (metadata is not rewritten by
 * lib/google/google-auth.ts).
 */

import crypto from 'crypto';
import { createMockNextRequest } from '@/tests/helpers/mock-request';
import {
  GA4_ADMIN_SCOPE,
  GA4_ADMIN_CONSENT_VERSION,
  readGa4AdminGrant,
} from '@/lib/google/ga4-admin-consent';

const STATE_SECRET = 'test-state-secret-k2';

const mockPrisma = {
  platformConnection: {
    findFirst: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
  },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

const mockRetrievePKCEState = jest.fn();
jest.mock('@/lib/auth/pkce', () => ({
  retrievePKCEState: (...args: unknown[]) => mockRetrievePKCEState(...args),
}));

const mockGetCreds = jest.fn();
jest.mock('@/lib/platform-credentials', () => ({
  getPlatformOAuthCredentials: (...args: unknown[]) => mockGetCreds(...args),
}));

jest.mock('@/lib/security/field-encryption', () => ({
  encryptField: (v: string | null | undefined) => (v == null ? v : `enc:${v}`),
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { GET } from '@/app/api/auth/callback/[platform]/route';

const READONLY = 'https://www.googleapis.com/auth/analytics.readonly';
const originalStateSecret = process.env.OAUTH_STATE_SECRET;
const originalFetch = global.fetch;

function signState(obj: Record<string, unknown>): string {
  const payload = Buffer.from(JSON.stringify(obj)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', STATE_SECRET)
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

function stateFor(withConsent: boolean) {
  return signState({
    flow: 'integration',
    platform: 'googleanalytics',
    userId: 'user-42',
    email: 'owner@example.com',
    organizationId: 'org-7',
    timestamp: Date.now(),
    ...(withConsent
      ? {
          ga4AdminConsent: {
            version: GA4_ADMIN_CONSENT_VERSION,
            acceptedAt: new Date().toISOString(),
          },
        }
      : {}),
  });
}

function googleReturns(scope: string, opts: { refreshToken?: boolean } = {}) {
  const withRefresh = opts.refreshToken ?? true;
  global.fetch = jest.fn(async (url: unknown) => {
    const u = String(url);
    if (u.includes('oauth2.googleapis.com/token')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'access-token',
          ...(withRefresh ? { refresh_token: 'refresh-token' } : {}),
          expires_in: 3600,
          token_type: 'Bearer',
          scope,
        }),
        text: async () => '',
      };
    }
    if (u.includes('googleapis.com/oauth2/v2/userinfo')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'g-1',
          name: 'Owner',
          email: 'owner@example.com',
        }),
        text: async () => '',
      };
    }
    return {
      ok: false,
      status: 404,
      json: async () => ({}),
      text: async () => 'not found',
    };
  }) as unknown as typeof global.fetch;
}

async function persistedConnection(withConsent: boolean) {
  await GET(
    createMockNextRequest({
      url: `http://localhost/api/auth/callback/googleanalytics?code=c&state=${encodeURIComponent(stateFor(withConsent))}`,
    }),
    { params: Promise.resolve({ platform: 'googleanalytics' }) }
  );
  expect(mockPrisma.platformConnection.create).toHaveBeenCalledTimes(1);
  const data = mockPrisma.platformConnection.create.mock.calls[0][0].data;
  return { scope: data.scope as string, metadata: data.metadata };
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.OAUTH_STATE_SECRET = STATE_SECRET;
  mockGetCreds.mockResolvedValue({
    clientId: 'client-id',
    clientSecret: 'client-secret',
  });
  mockRetrievePKCEState.mockResolvedValue({
    state: 'stored-state',
    codeVerifier: '',
    provider: 'googleanalytics',
    redirectUri: 'http://localhost/api/auth/callback/googleanalytics',
    createdAt: Date.now(),
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
  mockPrisma.platformConnection.findFirst.mockResolvedValue(null);
  mockPrisma.platformConnection.create.mockResolvedValue({ id: 'conn-1' });
  mockPrisma.platformConnection.updateMany.mockResolvedValue({ count: 0 });
});

afterAll(() => {
  process.env.OAUTH_STATE_SECRET = originalStateSecret;
  global.fetch = originalFetch;
});

describe('GET /api/auth/callback/googleanalytics — GA4 edit grant record', () => {
  it('records who granted analytics.edit and when after consent + grant', async () => {
    googleReturns(`${READONLY} ${GA4_ADMIN_SCOPE}`);
    const conn = await persistedConnection(true);
    const grant = readGa4AdminGrant(conn);
    expect(grant).toMatchObject({
      grantedByUserId: 'user-42',
      grantedByEmail: 'owner@example.com',
      consentVersion: GA4_ADMIN_CONSENT_VERSION,
      scopes: [READONLY, GA4_ADMIN_SCOPE],
    });
  });

  it('records no grant when Google granted only read-only', async () => {
    googleReturns(READONLY);
    const conn = await persistedConnection(true);
    expect(conn.metadata.ga4AdminGrant).toBeUndefined();
    expect(readGa4AdminGrant(conn)).toBeNull();
  });

  it('(Codex r6) records no grant when Google returns no refresh token, so a grant never runs on an earlier user’s retained refresh token', async () => {
    // The org already has a GA4 connection (user A's refresh token on it).
    // User B consents; Google grants the edit scope but sends no refresh token.
    mockPrisma.platformConnection.findFirst.mockResolvedValue({ id: 'conn-a' });
    mockPrisma.platformConnection.update.mockResolvedValue({ id: 'conn-a' });
    googleReturns(`${READONLY} ${GA4_ADMIN_SCOPE}`, { refreshToken: false });
    await GET(
      createMockNextRequest({
        url: `http://localhost/api/auth/callback/googleanalytics?code=c&state=${encodeURIComponent(stateFor(true))}`,
      }),
      { params: Promise.resolve({ platform: 'googleanalytics' }) }
    );
    expect(mockPrisma.platformConnection.update).toHaveBeenCalledTimes(1);
    const data = mockPrisma.platformConnection.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('refreshToken');
    expect(data.metadata.ga4AdminGrant).toBeUndefined();
    expect(
      readGa4AdminGrant({ scope: data.scope, metadata: data.metadata })
    ).toBeNull();
  });

  it('records no grant without the signed consent, even if Google returns the edit scope', async () => {
    googleReturns(`${READONLY} ${GA4_ADMIN_SCOPE}`);
    const conn = await persistedConnection(false);
    expect(conn.metadata.ga4AdminGrant).toBeUndefined();
    expect(readGa4AdminGrant(conn)).toBeNull();
  });

  describe('reconnect without a new consent keeps the recorded grant', () => {
    const existingGrant = {
      scopes: [READONLY, GA4_ADMIN_SCOPE],
      grantedByUserId: 'user-42',
      grantedByEmail: 'owner@example.com',
      grantedAt: '2026-10-01T00:00:00.000Z',
      consentAcceptedAt: '2026-10-01T00:00:00.000Z',
      consentVersion: GA4_ADMIN_CONSENT_VERSION,
      consentStatement: 'statement',
    };

    async function reconnect(opts: {
      refreshToken: boolean;
      scope: string;
      grantedBy?: string;
    }) {
      mockPrisma.platformConnection.findFirst.mockResolvedValue({
        id: 'conn-a',
        metadata: {
          ga4AdminGrant: {
            ...existingGrant,
            grantedByUserId: opts.grantedBy ?? 'user-42',
          },
        },
      });
      mockPrisma.platformConnection.update.mockResolvedValue({ id: 'conn-a' });
      googleReturns(opts.scope, { refreshToken: opts.refreshToken });
      await GET(
        createMockNextRequest({
          url: `http://localhost/api/auth/callback/googleanalytics?code=c&state=${encodeURIComponent(stateFor(false))}`,
        }),
        { params: Promise.resolve({ platform: 'googleanalytics' }) }
      );
      expect(mockPrisma.platformConnection.update).toHaveBeenCalledTimes(1);
      return mockPrisma.platformConnection.update.mock.calls[0][0].data;
    }

    it('carries the grant forward when the same user reconnects, the credential is unchanged and analytics.edit is still granted', async () => {
      const data = await reconnect({
        refreshToken: false,
        scope: `${READONLY} ${GA4_ADMIN_SCOPE}`,
      });
      expect(data.metadata.ga4AdminGrant).toMatchObject({
        grantedByUserId: 'user-42',
        grantedAt: existingGrant.grantedAt,
      });
    });

    it('drops the grant when a new refresh token replaces the credential', async () => {
      const data = await reconnect({
        refreshToken: true,
        scope: `${READONLY} ${GA4_ADMIN_SCOPE}`,
      });
      expect(data.metadata.ga4AdminGrant).toBeUndefined();
    });

    it('drops the grant when a different user reconnects', async () => {
      const data = await reconnect({
        refreshToken: false,
        scope: `${READONLY} ${GA4_ADMIN_SCOPE}`,
        grantedBy: 'someone-else',
      });
      expect(data.metadata.ga4AdminGrant).toBeUndefined();
    });

    it('drops the grant when Google no longer reports analytics.edit', async () => {
      const data = await reconnect({ refreshToken: false, scope: READONLY });
      expect(data.metadata.ga4AdminGrant).toBeUndefined();
    });
  });
});
