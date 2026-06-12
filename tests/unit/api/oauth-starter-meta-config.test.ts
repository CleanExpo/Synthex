import { createMockNextRequest } from '@/tests/helpers/mock-request';

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
      'https://www.facebook.com/v18.0/dialog/oauth'
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
