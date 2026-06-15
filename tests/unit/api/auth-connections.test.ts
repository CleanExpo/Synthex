import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockPrisma = {
  platformConnection: {
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  notification: {
    create: jest.fn(),
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
    profileName: 'Acme LinkedIn',
    metadata: null,
  });
  mockPrisma.platformConnection.update.mockResolvedValue({ id: 'conn-1' });
  mockPrisma.platformConnection.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.notification.create.mockResolvedValue({ id: 'notif-1' });
  // Default: caller owns any organisation they explicitly request.
  mockPrisma.businessOwnership.findFirst.mockResolvedValue({ id: 'own-1' });
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

  it('clears a stale requires_reauth flag when a manual refresh recovers a connection', async () => {
    mockPrisma.platformConnection.findFirst.mockResolvedValue({
      id: 'conn-1',
      refreshToken: 'enc:refresh-token',
      profileName: 'Acme LinkedIn',
      metadata: {
        tokenType: 'bearer',
        authStatus: 'requires_reauth',
        authFailedAt: '2026-06-10T00:00:00.000Z',
        authFailureReason: 'invalid_grant',
      },
    });

    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: 'http://localhost/api/auth/connections',
        body: { platform: 'linkedin' },
      })
    );

    expect(res.status).toBe(200);
    const updateArgs = mockPrisma.platformConnection.update.mock.calls[0][0];
    // requires_reauth fields are stripped; unrelated metadata is preserved.
    expect(updateArgs.data.metadata).toEqual({ tokenType: 'bearer' });
    expect(updateArgs.data.metadata).not.toHaveProperty('authStatus');
    expect(updateArgs.data.metadata).not.toHaveProperty('authFailureReason');
  });

  it('disables the connection and notifies the user when the refresh token is permanently dead', async () => {
    mockRefreshAccessToken.mockRejectedValue(
      new Error('Failed to refresh access token: invalid_grant')
    );

    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: 'http://localhost/api/auth/connections',
        body: { platform: 'linkedin' },
      })
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.needsReconnect).toBe(true);

    // Connection is disabled and flagged requires_reauth (not left active+dead).
    expect(mockPrisma.platformConnection.update).toHaveBeenCalledWith({
      where: { id: 'conn-1' },
      data: expect.objectContaining({
        isActive: false,
        metadata: expect.objectContaining({
          authStatus: 'requires_reauth',
          authFailureReason: 'Failed to refresh access token: invalid_grant',
        }),
      }),
    });

    // User is notified to reconnect.
    expect(mockPrisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'platform_reauth_required',
          userId: 'owner-1',
        }),
      })
    );
  });

  it('leaves the connection active and surfaces a 500 on a transient refresh failure', async () => {
    mockRefreshAccessToken.mockRejectedValue(
      new Error('429 Too Many Requests')
    );

    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: 'http://localhost/api/auth/connections',
        body: { platform: 'linkedin' },
      })
    );

    expect(res.status).toBe(500);
    // A transient failure must NOT disable the connection.
    expect(mockPrisma.platformConnection.update).not.toHaveBeenCalled();
    expect(mockPrisma.notification.create).not.toHaveBeenCalled();
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

  // Brand-switch correctness: a multi-business owner viewing brand B's
  // connections sends `?organizationId=org-B`. DELETE/POST must act on org-B,
  // not the caller's active org (org-1). Previously these handlers ignored the
  // override and fell back to getEffectiveOrganizationId — disconnecting/
  // refreshing the WRONG brand (#420/#60/#417 class).
  it('disconnects the brand named in the ownership-verified organizationId override, not the active org', async () => {
    const res = await DELETE(
      createMockNextRequest({
        method: 'DELETE',
        url: 'http://localhost/api/auth/connections?platform=linkedin&organizationId=org-B',
      })
    );

    expect(res.status).toBe(200);
    // Ownership of the requested org is verified.
    expect(mockPrisma.businessOwnership.findFirst).toHaveBeenCalledWith({
      where: { ownerId: 'owner-1', organizationId: 'org-B' },
    });
    // The disconnect targets org-B (the viewed brand), NOT org-1 (active org).
    expect(mockPrisma.platformConnection.findFirst).toHaveBeenCalledWith({
      where: { organizationId: 'org-B', platform: 'linkedin', isActive: true },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
    expect(mockPrisma.platformConnection.updateMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-B', platform: 'linkedin' },
      data: expect.objectContaining({ isActive: false, accessToken: '' }),
    });
    // The active-org fallback must NOT have been used for scoping.
    expect(mockGetEffectiveOrg).not.toHaveBeenCalled();
  });

  it('refreshes the connection for the ownership-verified organizationId override', async () => {
    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: 'http://localhost/api/auth/connections?organizationId=org-B',
        body: { platform: 'linkedin' },
      })
    );

    expect(res.status).toBe(200);
    expect(mockPrisma.platformConnection.findFirst).toHaveBeenCalledWith({
      where: { organizationId: 'org-B', platform: 'linkedin', isActive: true },
      orderBy: { updatedAt: 'desc' },
    });
    expect(mockGetEffectiveOrg).not.toHaveBeenCalled();
  });

  it('rejects a disconnect for an organizationId the caller does not own (403)', async () => {
    mockPrisma.businessOwnership.findFirst.mockResolvedValue(null);

    const res = await DELETE(
      createMockNextRequest({
        method: 'DELETE',
        url: 'http://localhost/api/auth/connections?platform=linkedin&organizationId=org-not-mine',
      })
    );

    expect(res.status).toBe(403);
    // No connection is touched when ownership fails.
    expect(mockPrisma.platformConnection.updateMany).not.toHaveBeenCalled();
  });
});
