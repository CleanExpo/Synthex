import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockPrisma = {
  platformConnection: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
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
jest.mock('@/lib/multi-business', () => ({
  getEffectiveOrganizationId: (...args: unknown[]) =>
    mockGetEffectiveOrganizationId(...args),
}));

jest.mock('@/lib/security/field-encryption', () => ({
  encryptField: (value: string | null | undefined) =>
    value == null ? value : `enc:${value}`,
}));

jest.mock('@/lib/platform-credentials', () => ({
  getPlatformOAuthCredentials: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { POST } from '@/app/api/integrations/route';

function postRequest() {
  return createMockNextRequest({
    method: 'POST',
    url: 'http://localhost/api/integrations?organizationId=org-1',
    body: {
      platform: 'linkedin',
      accessToken: 'manual-access-token',
      refreshToken: 'manual-refresh-token',
      profile: { name: 'CARSI LinkedIn' },
    },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserId.mockResolvedValue('owner-1');
  mockGetEffectiveOrganizationId.mockResolvedValue('org-1');
  mockPrisma.businessOwnership.findFirst.mockResolvedValue({ id: 'own-1' });
  mockPrisma.platformConnection.findFirst.mockResolvedValue(null);
  mockPrisma.platformConnection.create.mockResolvedValue({ id: 'conn-1' });
  mockPrisma.platformConnection.update.mockResolvedValue({ id: 'conn-1' });
  mockPrisma.platformConnection.updateMany.mockResolvedValue({ count: 0 });
});

describe('POST /api/integrations persistence hardening', () => {
  it('encrypts manual tokens and deactivates duplicate active rows in the organization scope', async () => {
    const res = await POST(postRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockPrisma.platformConnection.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'owner-1',
        organizationId: 'org-1',
        platform: 'linkedin',
        accessToken: 'enc:manual-access-token',
        refreshToken: 'enc:manual-refresh-token',
        profileId: 'manual',
        profileName: 'CARSI LinkedIn',
      }),
      select: { id: true },
    });
    expect(mockPrisma.platformConnection.updateMany).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1',
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

  it('updates the existing business-scoped row instead of creating another active row', async () => {
    mockPrisma.platformConnection.findFirst.mockResolvedValue({ id: 'conn-old' });

    const res = await POST(postRequest());

    expect(res.status).toBe(200);
    expect(mockPrisma.platformConnection.create).not.toHaveBeenCalled();
    expect(mockPrisma.platformConnection.update).toHaveBeenCalledWith({
      where: { id: 'conn-old' },
      data: expect.objectContaining({
        accessToken: 'enc:manual-access-token',
        refreshToken: 'enc:manual-refresh-token',
        deletedAt: null,
        isActive: true,
      }),
      select: { id: true },
    });
  });
});
