import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockPrisma = {
  platformConnection: {
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
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
    createSecureResponse: (body: unknown, status: number) =>
      Response.json(body, { status }),
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_WRITE: 'AUTHENTICATED_WRITE',
    AUTHENTICATED_READ: 'AUTHENTICATED_READ',
  },
}));

const mockGetUserId = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserId(...args),
}));

const mockGetEffectiveOrg = jest.fn();
jest.mock('@/lib/multi-business', () => ({
  getEffectiveOrganizationId: (...args: unknown[]) => mockGetEffectiveOrg(...args),
}));

const mockRefreshAccessToken = jest.fn();
jest.mock('@/lib/oauth', () => ({
  isSupportedPlatform: (platform: string) => platform === 'linkedin',
  getSupportedPlatforms: () => ['linkedin'],
  getOAuthProvider: () => ({
    refreshAccessToken: (...args: unknown[]) => mockRefreshAccessToken(...args),
    isTokenExpired: () => false,
  }),
}));

jest.mock('@/lib/security/field-encryption', () => ({
  decryptField: (value: string | null | undefined) =>
    value ? value.replace(/^enc:/, '') : null,
  encryptField: (value: string | null | undefined) =>
    value == null ? value : `enc:${value}`,
}));

jest.mock('@/lib/security/audit-logger', () => ({
  auditLogger: { log: jest.fn() },
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import { DELETE, POST } from '@/app/api/auth/connections/route';

beforeEach(() => {
  jest.clearAllMocks();
  mockSecurityCheck.mockResolvedValue({
    allowed: true,
    context: { userId: 'owner-1' },
  });
  mockGetUserId.mockResolvedValue('owner-1');
  mockGetEffectiveOrg.mockResolvedValue('org-1');
  mockPrisma.platformConnection.findFirst.mockResolvedValue({
    id: 'conn-1',
    refreshToken: 'enc:refresh-token',
  });
  mockPrisma.platformConnection.update.mockResolvedValue({ id: 'conn-1' });
  mockPrisma.platformConnection.updateMany.mockResolvedValue({ count: 1 });
  mockRefreshAccessToken.mockResolvedValue({
    accessToken: 'new-access-token',
    refreshToken: 'new-refresh-token',
    expiresAt: new Date(Date.now() + 3600_000),
  });
});

describe('/api/auth/connections business-scoped actions', () => {
  it('refreshes the newest active organisation connection without scoping to the original owner', async () => {
    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: 'http://localhost/api/auth/connections',
        body: { platform: 'linkedin' },
      })
    );

    expect(res.status).toBe(200);
    expect(mockPrisma.platformConnection.findFirst).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', platform: 'linkedin', isActive: true },
      orderBy: { updatedAt: 'desc' },
    });
    expect(mockPrisma.platformConnection.update).toHaveBeenCalledWith({
      where: { id: 'conn-1' },
      data: expect.objectContaining({
        accessToken: 'enc:new-access-token',
        refreshToken: 'enc:new-refresh-token',
      }),
    });
  });

  it('disconnects all active organisation rows for a platform without requiring the original owner', async () => {
    const res = await DELETE(
      createMockNextRequest({
        method: 'DELETE',
        url: 'http://localhost/api/auth/connections?platform=linkedin',
      })
    );

    expect(res.status).toBe(200);
    expect(mockPrisma.platformConnection.findFirst).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', platform: 'linkedin', isActive: true },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
    expect(mockPrisma.platformConnection.updateMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', platform: 'linkedin' },
      data: expect.objectContaining({
        isActive: false,
        accessToken: '',
        refreshToken: null,
      }),
    });
  });

  it('falls back to personal user scope when there is no organisation context', async () => {
    mockGetEffectiveOrg.mockResolvedValue(null);

    await POST(
      createMockNextRequest({
        method: 'POST',
        url: 'http://localhost/api/auth/connections',
        body: { platform: 'linkedin' },
      })
    );

    expect(mockPrisma.platformConnection.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'owner-1',
        platform: 'linkedin',
        organizationId: null,
        isActive: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  });
});
