/**
 * Behavioral coverage for /api/auth/callback/[platform] — the platform-connection
 * OAuth callback (SYN-1000).
 *
 * This callback writes encrypted OAuth tokens to platform_connections so Synthex
 * can post on a client's behalf. The HMAC-signed `state` parameter is the only
 * thing binding the callback to a real, recent connect request — so the security
 * contract is:
 *   - missing / tampered / expired state  → redirect, NEVER write a connection
 *   - valid signed state                  → persist using the userId +
 *                                            organizationId carried IN the signed
 *                                            state (update existing, else create,
 *                                            with duplicate active rows disabled)
 */

import crypto from 'crypto';
import { createMockNextRequest } from '@/tests/helpers/mock-request';

// NOTE: jest's Response polyfill doesn't populate the Location header on
// NextResponse.redirect() (see __tests__/unit/proxy/proxy.test.ts), so we assert
// the security contract — a redirect (3xx) with NO connection written — rather
// than the redirect target string. Each test is differentiated by its distinct
// bad input (missing / tampered / expired state, missing code).

const STATE_SECRET = 'test-state-secret-syn1000';

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

/** Sign a state object exactly as the OAuth starter does (HMAC-SHA256, base64url). */
function signState(obj: Record<string, unknown>): string {
  const payload = Buffer.from(JSON.stringify(obj)).toString('base64url');
  const sig = crypto.createHmac('sha256', STATE_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function callbackRequest(queryString: string) {
  return createMockNextRequest({
    url: `http://localhost/api/auth/callback/linkedin?${queryString}`,
  });
}

function platformParams() {
  return { params: Promise.resolve({ platform: 'linkedin' }) };
}

const originalStateSecret = process.env.OAUTH_STATE_SECRET;
const originalFetch = global.fetch;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.OAUTH_STATE_SECRET = STATE_SECRET;
  mockRetrievePKCEState.mockResolvedValue(null);
});

afterAll(() => {
  process.env.OAUTH_STATE_SECRET = originalStateSecret;
  global.fetch = originalFetch;
});

function isRedirect(res: { status: number }) {
  return res.status >= 300 && res.status < 400;
}

describe('GET /api/auth/callback/[platform] — state gate (SYN-1000)', () => {
  it('redirects and writes no connection when state is missing', async () => {
    const res = await GET(callbackRequest('code=auth-code'), platformParams());
    expect(isRedirect(res)).toBe(true);
    expect(mockPrisma.platformConnection.create).not.toHaveBeenCalled();
    expect(mockPrisma.platformConnection.update).not.toHaveBeenCalled();
  });

  it('redirects and writes no connection when state is tampered (bad HMAC)', async () => {
    const res = await GET(
      callbackRequest('code=auth-code&state=tampered.signature'),
      platformParams()
    );
    expect(isRedirect(res)).toBe(true);
    expect(mockPrisma.platformConnection.create).not.toHaveBeenCalled();
    expect(mockPrisma.platformConnection.update).not.toHaveBeenCalled();
  });

  it('redirects and writes no connection when the authorization code is missing', async () => {
    const state = signState({ flow: 'integration', userId: 'u1', timestamp: Date.now() });
    const res = await GET(
      callbackRequest(`state=${encodeURIComponent(state)}`),
      platformParams()
    );
    expect(isRedirect(res)).toBe(true);
    expect(mockPrisma.platformConnection.create).not.toHaveBeenCalled();
    expect(mockPrisma.platformConnection.update).not.toHaveBeenCalled();
  });

  it('rejects an integration state missing from the one-time server store', async () => {
    const expiredState = signState({
      flow: 'integration',
      userId: 'u1',
      organizationId: 'org-1',
      timestamp: Date.now() - 5 * 60 * 1000,
    });
    const res = await GET(
      callbackRequest(`code=auth-code&state=${encodeURIComponent(expiredState)}`),
      platformParams()
    );
    // integration flow returns an HTML postMessage error (status 200), not a redirect —
    // the security-critical assertion is that no connection was written.
    expect(mockPrisma.platformConnection.create).not.toHaveBeenCalled();
    expect(mockPrisma.platformConnection.update).not.toHaveBeenCalled();
  });
});

describe('GET /api/auth/callback/[platform] — valid connect (SYN-1000)', () => {
  beforeEach(() => {
    mockGetCreds.mockResolvedValue({ clientId: 'client-id', clientSecret: 'client-secret' });
    mockRetrievePKCEState.mockResolvedValue({
      state: 'stored-state',
      codeVerifier: '',
      provider: 'linkedin',
      redirectUri: 'http://localhost/api/auth/callback/linkedin',
      createdAt: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000,
    });
    mockPrisma.platformConnection.findFirst.mockResolvedValue(null);
    mockPrisma.platformConnection.create.mockResolvedValue({ id: 'conn-1' });
    mockPrisma.platformConnection.update.mockResolvedValue({ id: 'conn-1' });
    mockPrisma.platformConnection.updateMany.mockResolvedValue({ count: 0 });
    global.fetch = jest.fn(async (url: unknown) => {
      const u = String(url);
      if (u.includes('linkedin.com/oauth')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'access-token',
            refresh_token: 'refresh-token',
            expires_in: 3600,
            token_type: 'Bearer',
            scope: 'r_liteprofile',
          }),
          text: async () => '',
        };
      }
      if (u.includes('api.linkedin.com/v2/userinfo')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ sub: 'li-123', name: 'Test User', email: 't@example.com' }),
          text: async () => '',
        };
      }
      return { ok: false, status: 404, json: async () => ({}), text: async () => 'not found' };
    }) as unknown as typeof global.fetch;
  });

  it('accepts a five-minute integration consent round-trip when the one-time state exists', async () => {
    const goodState = signState({
      flow: 'integration',
      userId: 'user-42',
      organizationId: 'org-7',
      timestamp: Date.now() - 5 * 60 * 1000,
    });

    await GET(
      callbackRequest(`code=auth-code&state=${encodeURIComponent(goodState)}`),
      platformParams()
    );

    expect(mockPrisma.platformConnection.create).toHaveBeenCalledTimes(1);
  });

  it('creates the connection keyed by the userId + organizationId from the signed state', async () => {
    const goodState = signState({
      flow: 'integration',
      userId: 'user-42',
      organizationId: 'org-7',
      timestamp: Date.now(),
    });

    await GET(
      callbackRequest(`code=auth-code&state=${encodeURIComponent(goodState)}`),
      platformParams()
    );

    expect(mockPrisma.platformConnection.findFirst).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-7',
        platform: 'linkedin',
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
    expect(mockPrisma.platformConnection.create).toHaveBeenCalledTimes(1);
    const arg = mockPrisma.platformConnection.create.mock.calls[0][0];
    expect(arg.data).toMatchObject({
      userId: 'user-42',
      organizationId: 'org-7',
      platform: 'linkedin',
    });
    // Tokens are encrypted at rest (never the raw token).
    expect(arg.data.accessToken).toBe('enc:access-token');
    expect(mockPrisma.platformConnection.updateMany).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-7',
        platform: 'linkedin',
        id: { not: 'conn-1' },
        isActive: true,
      },
      data: expect.objectContaining({
        isActive: false,
        accessToken: '',
        refreshToken: null,
      }),
    });
  });

  it('updates an existing organisation connection instead of creating a duplicate', async () => {
    mockPrisma.platformConnection.findFirst.mockResolvedValue({ id: 'existing-1' });
    const goodState = signState({
      flow: 'integration',
      userId: 'user-42',
      organizationId: 'org-7',
      timestamp: Date.now(),
    });

    await GET(
      callbackRequest(`code=auth-code&state=${encodeURIComponent(goodState)}`),
      platformParams()
    );

    expect(mockPrisma.platformConnection.create).not.toHaveBeenCalled();
    expect(mockPrisma.platformConnection.update).toHaveBeenCalledWith({
      where: { id: 'existing-1' },
      data: expect.objectContaining({
        accessToken: 'enc:access-token',
        isActive: true,
        deletedAt: null,
        profileId: 'li-123',
      }),
      select: { id: true },
    });
  });
});
