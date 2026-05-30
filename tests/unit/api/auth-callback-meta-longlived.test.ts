/**
 * Coverage for the Meta (Facebook/Instagram) long-lived token exchange in
 * /api/auth/callback/[platform] (SYN-1013).
 *
 * The callback used to store the short-lived (~1h) user token, so page tokens
 * derived from it died in ~1 hour. It now upgrades to a long-lived (~60-day)
 * token via fb_exchange_token before persisting — page tokens derived from a
 * long-lived user token never expire. Graceful: if the exchange fails, the
 * short-lived token is kept (no regression).
 */

import crypto from 'crypto';
import { createMockNextRequest } from '@/tests/helpers/mock-request';

const STATE_SECRET = 'test-state-secret-meta';

const mockPrisma = { platformConnection: { upsert: jest.fn() } };
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

jest.mock('@/lib/auth/pkce', () => ({
  retrievePKCEState: jest.fn().mockResolvedValue(null),
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

function signState(obj: Record<string, unknown>): string {
  const payload = Buffer.from(JSON.stringify(obj)).toString('base64url');
  const sig = crypto.createHmac('sha256', STATE_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function callbackRequest(qs: string) {
  return createMockNextRequest({ url: `http://localhost/api/auth/callback/facebook?${qs}` });
}
const fbParams = () => ({ params: Promise.resolve({ platform: 'facebook' }) });

const originalSecret = process.env.OAUTH_STATE_SECRET;
const originalFetch = global.fetch;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.OAUTH_STATE_SECRET = STATE_SECRET;
  mockGetCreds.mockResolvedValue({ clientId: 'cid', clientSecret: 'csecret' });
  mockPrisma.platformConnection.upsert.mockResolvedValue({ id: 'conn-1' });
});

afterAll(() => {
  process.env.OAUTH_STATE_SECRET = originalSecret;
  global.fetch = originalFetch;
});

/** Route fetches by URL. fb_exchange_token check MUST come first (it also contains oauth/access_token). */
function installFetch(opts: { exchangeOk: boolean }) {
  global.fetch = jest.fn(async (url: unknown) => {
    const u = String(url);
    if (u.includes('fb_exchange_token')) {
      return opts.exchangeOk
        ? { ok: true, status: 200, json: async () => ({ access_token: 'long-lived-token', expires_in: 5184000 }), text: async () => '' }
        : { ok: false, status: 400, json: async () => ({ error: 'bad' }), text: async () => 'bad' };
    }
    if (u.includes('oauth/access_token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 'short-token', expires_in: 3600, token_type: 'bearer' }), text: async () => '' };
    }
    if (u.includes('graph.facebook.com/me')) {
      return { ok: true, status: 200, json: async () => ({ id: 'fb-user-1', name: 'Test User' }), text: async () => '' };
    }
    return { ok: false, status: 404, json: async () => ({}), text: async () => 'not found' };
  }) as unknown as typeof global.fetch;
}

describe('Facebook callback — long-lived token exchange (SYN-1013)', () => {
  it('stores the long-lived token with a ~60-day expiry', async () => {
    installFetch({ exchangeOk: true });
    const state = signState({ flow: 'integration', userId: 'u1', organizationId: 'org-1', timestamp: Date.now() });

    await GET(callbackRequest(`code=auth-code&state=${encodeURIComponent(state)}`), fbParams());

    expect(mockPrisma.platformConnection.upsert).toHaveBeenCalledTimes(1);
    const arg = mockPrisma.platformConnection.upsert.mock.calls[0][0];
    // The persisted token is the LONG-LIVED one, not the short-lived token.
    expect(arg.create.accessToken).toBe('enc:long-lived-token');
    // Expiry is ~60 days out (long-lived), not ~1 hour.
    const daysOut = (new Date(arg.create.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(daysOut).toBeGreaterThan(50);
  });

  it('falls back to the short-lived token if the exchange fails (no regression)', async () => {
    installFetch({ exchangeOk: false });
    const state = signState({ flow: 'integration', userId: 'u1', organizationId: 'org-1', timestamp: Date.now() });

    await GET(callbackRequest(`code=auth-code&state=${encodeURIComponent(state)}`), fbParams());

    expect(mockPrisma.platformConnection.upsert).toHaveBeenCalledTimes(1);
    const arg = mockPrisma.platformConnection.upsert.mock.calls[0][0];
    expect(arg.create.accessToken).toBe('enc:short-token');
  });
});
