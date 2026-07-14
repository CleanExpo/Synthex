import { createMockNextRequest } from '@/tests/helpers/mock-request';
import { META_GRAPH_VERSION } from '@/lib/social/meta-graph-version';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
  businessOwnership: {
    findFirst: jest.fn(),
  },
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

const mockSecurityCheck = jest.fn();
jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: (...args: unknown[]) => mockSecurityCheck(...args),
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_READ: 'AUTHENTICATED_READ',
  },
}));

const mockGetEffectiveOrganizationId = jest.fn();
jest.mock('@/lib/multi-business', () => ({
  getEffectiveOrganizationId: (...args: unknown[]) =>
    mockGetEffectiveOrganizationId(...args),
}));

const mockGetPlatformOAuthCredentials = jest.fn();
jest.mock('@/lib/platform-credentials', () => ({
  getPlatformOAuthCredentials: (...args: unknown[]) =>
    mockGetPlatformOAuthCredentials(...args),
}));

const mockStorePKCEState = jest.fn();
jest.mock('@/lib/auth/pkce', () => ({
  generatePKCEChallenge: jest.fn(),
  generateState: jest.fn(),
  storePKCEState: (...args: unknown[]) => mockStorePKCEState(...args),
}));

jest.mock('@/lib/auth/oauth-base-url', () => ({
  getOAuthBaseUrl: () => 'https://synthex.social',
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { GET } from '@/app/api/auth/oauth/[platform]/route';

const originalEnv = process.env;

function request() {
  return createMockNextRequest({
    url: 'https://synthex.social/api/auth/oauth/facebook',
  });
}

function params(platform = 'facebook') {
  return { params: Promise.resolve({ platform }) };
}

async function getAuthorizationUrl(res: Response) {
  const body = await res.json();
  expect(res.status).toBe(200);
  return new URL(body.authorizationUrl);
}

beforeEach(() => {
  process.env = { ...originalEnv };
  delete process.env.META_BUSINESS_LOGIN_CONFIG_ID;
  delete process.env.META_FACEBOOK_LOGIN_CONFIG_ID;
  delete process.env.FACEBOOK_LOGIN_CONFIG_ID;
  process.env.OAUTH_STATE_SECRET = 'test-state-secret';

  jest.clearAllMocks();
  mockSecurityCheck.mockResolvedValue({
    allowed: true,
    context: { userId: 'user-1' },
  });
  mockGetPlatformOAuthCredentials.mockResolvedValue({
    clientId: 'meta-client-id',
    clientSecret: 'meta-client-secret',
  });
  mockGetEffectiveOrganizationId.mockResolvedValue('org-1');
  mockPrisma.user.findUnique.mockResolvedValue({
    id: 'user-1',
    email: 'owner@example.com',
  });
  mockStorePKCEState.mockResolvedValue(undefined);
});

afterAll(() => {
  process.env = originalEnv;
});

describe('/api/auth/oauth/[platform] Meta Login config mode', () => {
  it('uses config_id without sending raw scopes for Facebook Login for Business', async () => {
    process.env.META_BUSINESS_LOGIN_CONFIG_ID = 'business-login-config-1';

    const url = await getAuthorizationUrl(await GET(request(), params()));

    expect(url.origin + url.pathname).toBe(
      `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`
    );
    expect(url.searchParams.get('config_id')).toBe('business-login-config-1');
    expect(url.searchParams.has('scope')).toBe(false);
  });

  it('keeps the raw Facebook scope fallback when no Meta config id is present', async () => {
    const url = await getAuthorizationUrl(await GET(request(), params()));

    expect(url.searchParams.has('config_id')).toBe(false);
    expect(url.searchParams.get('scope')).toBe(
      'public_profile,email,pages_show_list,pages_read_engagement,pages_manage_posts'
    );
  });
});

describe('/api/auth/oauth/[platform] initiation guards (Connect flow)', () => {
  it('returns an actionable 400 when the platform has no credentials (missing FACEBOOK_APP_ID)', async () => {
    // getPlatformOAuthCredentials resolves null when neither the DB row nor the
    // env var (e.g. FACEBOOK_APP_ID) is set. The Connect button must surface a
    // fixable message, never a silent no-op.
    mockGetPlatformOAuthCredentials.mockResolvedValue(null);

    const res = await GET(request(), params('facebook'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Platform not configured');
    expect(body.message).toMatch(/facebook/i);
    expect(body.message).toMatch(/environment variables|Settings/i);
  });

  it('initiates Instagram to the Meta OAuth dialog when configured', async () => {
    const url = await getAuthorizationUrl(
      await GET(request(), params('instagram'))
    );

    expect(url.origin + url.pathname).toBe(
      `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`
    );
    expect(url.searchParams.get('client_id')).toBe('meta-client-id');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://synthex.social/api/auth/callback/instagram'
    );
    expect(url.searchParams.get('scope')).toBe(
      'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement'
    );
    expect(url.searchParams.get('state')).toBeTruthy();
  });

  it('rejects an unsupported platform with a 400 listing supported platforms', async () => {
    const res = await GET(request(), params('myspace'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid platform');
    expect(body.message).toMatch(/facebook/);
  });

  it('returns 401 when the caller is not authenticated', async () => {
    mockSecurityCheck.mockResolvedValue({ allowed: false, context: {} });

    const res = await GET(request(), params('facebook'));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });
});
