/**
 * Unit tests for RedditService.refreshToken — OAuth app-credential resolution.
 *
 * RedditService.refreshToken() historically read process.env.REDDIT_CLIENT_ID /
 * REDDIT_CLIENT_SECRET directly. When the Reddit app credentials are configured
 * in the DB (platform_oauth_credentials, admin panel) and REDDIT_CLIENT_ID is
 * unset in the environment — the production configuration confirmed in
 * platform_oauth_credentials — the refresh threw "Reddit app credentials not
 * configured". That message is NOT a permanent-failure pattern, so the
 * refresh-tokens cron treated it as transient: the connection was never
 * refreshed (expires_at frozen) and never disabled. Matches the DR Reddit row.
 *
 * The fix resolves credentials via getPlatformOAuthCredentials('reddit') — the
 * SAME source the connect/callback path mints from. These tests pin that:
 *   - refresh uses the resolver's clientId/secret for Basic auth (not env),
 *   - expiresAt advances by the returned expires_in,
 *   - a missing resolver result still throws "not configured".
 */

import { getPlatformOAuthCredentials } from '@/lib/platform-credentials';
import { RedditService } from '@/lib/social/reddit-service';

jest.mock('@/lib/platform-credentials', () => ({
  getPlatformOAuthCredentials: jest.fn(),
}));

const mockGetCreds = getPlatformOAuthCredentials as jest.MockedFunction<
  typeof getPlatformOAuthCredentials
>;

describe('RedditService.refreshToken — credential resolution', () => {
  const REAL_FETCH = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reproduce production: no Reddit creds in the environment — they live in the DB.
    delete process.env.REDDIT_CLIENT_ID;
    delete process.env.REDDIT_CLIENT_SECRET;
  });

  afterEach(() => {
    global.fetch = REAL_FETCH;
  });

  function makeService(): RedditService {
    const service = new RedditService();
    service.initialize({
      accessToken: 'old-access',
      refreshToken: 'stored-refresh-token',
      expiresAt: new Date('2026-06-13T02:46:12.000Z'), // the frozen prod expiry
    });
    return service;
  }

  it('resolves the Reddit app credentials from getPlatformOAuthCredentials and advances expiresAt', async () => {
    mockGetCreds.mockResolvedValue({
      clientId: 'db-client-id',
      clientSecret: 'db-client-secret',
    });

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'fresh-access',
        refresh_token: 'stored-refresh-token',
        expires_in: 3600,
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const before = Date.now();
    const result = await service_refresh(makeService());
    const after = Date.now();

    // Credentials came from the resolver, not the (unset) environment.
    expect(mockGetCreds).toHaveBeenCalledWith('reddit');

    // Basic auth header is built from the resolver's client id/secret.
    const expectedBasic = Buffer.from('db-client-id:db-client-secret').toString(
      'base64'
    );
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe(`Basic ${expectedBasic}`);

    // expires_at advances into the future (was frozen at 2026-06-13).
    expect(result.accessToken).toBe('fresh-access');
    const newExpiry = new Date(result.expiresAt as Date).getTime();
    expect(newExpiry).toBeGreaterThanOrEqual(before + 3600 * 1000);
    expect(newExpiry).toBeLessThanOrEqual(after + 3600 * 1000);
    expect(newExpiry).toBeGreaterThan(
      new Date('2026-06-13T02:46:12.000Z').getTime()
    );
  });

  it('throws "not configured" when the resolver returns no credentials', async () => {
    mockGetCreds.mockResolvedValue(null);

    await expect(service_refresh(makeService())).rejects.toThrow(
      /not configured/i
    );
  });
});

// refreshToken is a public method on the service; thin wrapper for readability.
function service_refresh(service: RedditService) {
  return service.refreshToken();
}
