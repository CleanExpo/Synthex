/**
 * Credential-resolution observability for lib/platform-credentials.ts.
 *
 * The resolver picks DB-first then env-fallback. Nothing used to surface WHICH
 * source won, so a stale DB row could silently shadow a Vercel env var. These
 * tests lock the observability contract:
 *   - every resolution logs source + non-secret shape verdict + length
 *   - a DB row used while the same-platform env var is also set logs a shadow warn
 *   - the shape verdict/length NEVER include the raw secret value
 */

const mockFindUnique = jest.fn();
const mockPrisma = {
  platformOAuthCredential: {
    findUnique: (...a: unknown[]) => mockFindUnique(...a),
  },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

// Identity decrypt — the "encrypted" value we feed in IS the plaintext, so tests
// control the exact clientId length/shape the resolver sees.
jest.mock('@/lib/encryption/api-key-encryption', () => ({
  decryptApiKey: (v: string) => v,
}));

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
jest.mock('@/lib/logger', () => ({ logger: mockLogger }));

import {
  classifyClientIdShape,
  isPlatformEnvClientIdSet,
} from '@/lib/platform-credentials';

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV };
  delete process.env.TWITTER_CLIENT_ID;
  delete process.env.X_CLIENT_ID;
  delete process.env.TWITTER_CLIENT_SECRET;
  delete process.env.X_CLIENT_SECRET;
  delete process.env.LINKEDIN_CLIENT_ID;
  delete process.env.LINKEDIN_CLIENT_SECRET;
  mockFindUnique.mockResolvedValue(null);
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

function activeRow(clientId: string, clientSecret: string) {
  return {
    isActive: true,
    encryptedClientId: clientId,
    encryptedClientSecret: clientSecret,
  };
}

describe('classifyClientIdShape', () => {
  it('classifies by length only, never inspecting characters', () => {
    expect(classifyClientIdShape(25)).toBe('oauth1-shaped'); // X OAuth 1.0a API key
    expect(classifyClientIdShape(15)).toBe('oauth1-shaped');
    expect(classifyClientIdShape(29)).toBe('oauth1-shaped');
    expect(classifyClientIdShape(34)).toBe('oauth2-shaped'); // X OAuth 2.0 client id
    expect(classifyClientIdShape(30)).toBe('oauth2-shaped');
    expect(classifyClientIdShape(8)).toBe('unknown');
    expect(classifyClientIdShape(0)).toBe('unknown');
  });
});

describe('isPlatformEnvClientIdSet', () => {
  it('reports env presence without returning the value', () => {
    expect(isPlatformEnvClientIdSet('linkedin')).toBe(false);
    process.env.LINKEDIN_CLIENT_ID = 'some-linkedin-client-id-value';
    expect(isPlatformEnvClientIdSet('linkedin')).toBe(true);
  });
});

describe('getPlatformOAuthCredentials observability', () => {
  it('logs source=db + shape + length and warns when a DB row shadows env', async () => {
    // OAuth 2.0-shaped id (34 chars), env ALSO set for twitter.
    const dbClientId = 'A'.repeat(34);
    mockFindUnique.mockResolvedValue(activeRow(dbClientId, 'db-secret-value'));
    process.env.TWITTER_CLIENT_ID = 'env-side-client-id-value';
    process.env.TWITTER_CLIENT_SECRET = 'env-side-secret-value';

    const { getPlatformOAuthCredentials } =
      await import('@/lib/platform-credentials');
    const creds = await getPlatformOAuthCredentials('twitter');

    expect(creds).toEqual({
      clientId: dbClientId,
      clientSecret: 'db-secret-value',
    });

    const infoCall = mockLogger.info.mock.calls.find(
      c => c[0] === 'Platform OAuth credential resolved'
    );
    expect(infoCall?.[1]).toMatchObject({
      platform: 'twitter',
      source: 'db',
      clientIdShape: 'oauth2-shaped',
      clientIdLen: 34,
      shadowsEnv: true,
    });

    const shadowWarn = mockLogger.warn.mock.calls.find(
      c => c[0] === 'DB platform credential is shadowing a set env var'
    );
    expect(shadowWarn).toBeDefined();
    expect(shadowWarn?.[1].envClientIdVars).toContain('TWITTER_CLIENT_ID');

    // No log payload may contain the raw secret material.
    const serialized = JSON.stringify([
      ...mockLogger.info.mock.calls,
      ...mockLogger.warn.mock.calls,
    ]);
    expect(serialized).not.toContain(dbClientId);
    expect(serialized).not.toContain('db-secret-value');
  });

  it('warns on an OAuth1-shaped twitter client id from the DB', async () => {
    // Low-entropy constructed fixture (25-char alnum, OAuth1-shaped) — built from
    // a repeated token so it can't be mistaken for a real key by secret scanners.
    const oauth1Shaped = 'fake0'.repeat(5);
    mockFindUnique.mockResolvedValue(activeRow(oauth1Shaped, 'db-secret'));

    const { getPlatformOAuthCredentials } =
      await import('@/lib/platform-credentials');
    await getPlatformOAuthCredentials('twitter');

    const oauth1Warn = mockLogger.warn.mock.calls.find(c =>
      String(c[0]).includes('OAuth 1.0a API Key')
    );
    expect(oauth1Warn).toBeDefined();
    // Only the leading 4 chars + length are logged, never the full value.
    expect(oauth1Warn?.[0]).not.toContain(oauth1Shaped);
    expect(oauth1Warn?.[0]).toContain('fake');
  });

  it('clearPlatformCredentialCache forces a fresh read of a changed credential', async () => {
    // First resolve caches the DB value.
    mockFindUnique.mockResolvedValue(activeRow('A'.repeat(34), 'secret-old'));
    const { getPlatformOAuthCredentials, clearPlatformCredentialCache } =
      await import('@/lib/platform-credentials');

    const first = await getPlatformOAuthCredentials('twitter');
    expect(first?.clientSecret).toBe('secret-old');

    // The row changes, but the cached value must still be served (proves cache).
    mockFindUnique.mockResolvedValue(activeRow('B'.repeat(34), 'secret-new'));
    const cached = await getPlatformOAuthCredentials('twitter');
    expect(cached?.clientSecret).toBe('secret-old');

    // After invalidation the next resolve re-reads the freshly written row.
    clearPlatformCredentialCache('twitter');
    const fresh = await getPlatformOAuthCredentials('twitter');
    expect(fresh?.clientSecret).toBe('secret-new');
  });

  it('logs source=env with shadowsEnv=false when only env is set', async () => {
    mockFindUnique.mockResolvedValue(null);
    process.env.LINKEDIN_CLIENT_ID = 'A'.repeat(34);
    process.env.LINKEDIN_CLIENT_SECRET = 'linkedin-secret-value';

    const { getPlatformOAuthCredentials } =
      await import('@/lib/platform-credentials');
    const creds = await getPlatformOAuthCredentials('linkedin');
    expect(creds).not.toBeNull();

    const infoCall = mockLogger.info.mock.calls.find(
      c => c[0] === 'Platform OAuth credential resolved'
    );
    expect(infoCall?.[1]).toMatchObject({
      platform: 'linkedin',
      source: 'env',
      clientIdShape: 'oauth2-shaped',
      clientIdLen: 34,
      shadowsEnv: false,
    });
    expect(
      mockLogger.warn.mock.calls.find(
        c => c[0] === 'DB platform credential is shadowing a set env var'
      )
    ).toBeUndefined();
  });
});
