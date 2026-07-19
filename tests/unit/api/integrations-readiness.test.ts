import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockPrisma = {
  platformConnection: {
    findMany: jest.fn(),
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

const mockGetUserId = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserId(...args),
}));

const mockGetEffectiveOrganizationId = jest.fn();
const mockHasOrganizationAccess = jest.fn();
jest.mock('@/lib/multi-business', () => ({
  getEffectiveOrganizationId: (...args: unknown[]) =>
    mockGetEffectiveOrganizationId(...args),
  hasOrganizationAccess: (...args: unknown[]) =>
    mockHasOrganizationAccess(...args),
}));

const mockGetPlatformOAuthCredentials = jest.fn();
jest.mock('@/lib/platform-credentials', () => ({
  getPlatformOAuthCredentials: (...args: unknown[]) =>
    mockGetPlatformOAuthCredentials(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { GET } from '@/app/api/integrations/route';

const originalEnv = process.env;

function request() {
  return createMockNextRequest({
    url: 'http://localhost/api/integrations?organizationId=org-1',
  });
}

beforeEach(() => {
  process.env = { ...originalEnv };
  delete process.env.META_BUSINESS_LOGIN_CONFIG_ID;
  delete process.env.META_FACEBOOK_LOGIN_CONFIG_ID;
  delete process.env.META_INSTAGRAM_LOGIN_CONFIG_ID;
  delete process.env.FACEBOOK_LOGIN_CONFIG_ID;
  delete process.env.INSTAGRAM_LOGIN_CONFIG_ID;

  jest.clearAllMocks();
  mockGetUserId.mockResolvedValue('owner-1');
  mockGetEffectiveOrganizationId.mockResolvedValue('org-1');
  mockPrisma.businessOwnership.findFirst.mockResolvedValue({ id: 'own-1' });
  mockHasOrganizationAccess.mockResolvedValue(true);
  mockPrisma.platformConnection.findMany.mockResolvedValue([]);
  mockGetPlatformOAuthCredentials.mockResolvedValue({
    clientId: 'meta-client-id',
    clientSecret: 'meta-client-secret',
  });
});

afterAll(() => {
  process.env = originalEnv;
});

describe('GET /api/integrations Meta readiness', () => {
  it('reports missing Meta Login for Business config when credentials exist but raw scopes would be used', async () => {
    const res = await GET(request());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.readiness.facebook).toMatchObject({
      status: 'needs_configuration',
      title: 'Meta Login for Business config missing',
    });
    expect(body.readiness.instagram.issues).toContain(
      'instagram_content_publish Advanced Access'
    );
  });

  it('reports Meta verification/App Review as the remaining blocker when config id is present', async () => {
    process.env.META_BUSINESS_LOGIN_CONFIG_ID = 'business-login-config-1';

    const body = await (await GET(request())).json();

    expect(body.readiness.facebook).toMatchObject({
      status: 'blocked',
      title: 'Meta verification and App Review required',
    });
  });

  it('marks Meta readiness as active when a business-scoped connection exists', async () => {
    mockPrisma.platformConnection.findMany.mockResolvedValue([
      {
        platform: 'facebook',
        profileName: 'Disaster Recovery',
        profileId: 'page-1',
        accountType: 'page',
        isActive: true,
        organizationId: 'org-1',
      },
    ]);

    const body = await (await GET(request())).json();

    expect(body.integrations.facebook).toBe(true);
    expect(body.readiness.facebook).toMatchObject({
      status: 'ready',
      title: 'Meta connection active',
    });
  });
});
