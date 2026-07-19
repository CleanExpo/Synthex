/**
 * Regression: cross-tenant access via ?organizationId= override (SYN-1112 F2).
 *
 * The integrations route honours an explicit ?organizationId= override. Before
 * the fix it authorised that override with a raw `businessOwnership.findFirst`
 * that ignored `isActive`, so a REVOKED owner (row present, isActive:false)
 * still passed. The route now authorises through `hasOrganizationAccess`, which
 * is isActive-gated — a denied caller must get 403 and never reach the query.
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockGetUserId = jest.fn();
const mockHasOrganizationAccess = jest.fn();
const mockGetEffectiveOrganizationId = jest.fn();
const mockPlatformConnectionFindMany = jest.fn();

jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserId(...args),
}));

jest.mock('@/lib/multi-business', () => ({
  getEffectiveOrganizationId: (...args: unknown[]) =>
    mockGetEffectiveOrganizationId(...args),
  hasOrganizationAccess: (...args: unknown[]) =>
    mockHasOrganizationAccess(...args),
}));

const prismaMock = {
  platformConnection: {
    findMany: (...args: unknown[]) => mockPlatformConnectionFindMany(...args),
  },
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: prismaMock, // route imports prisma as a default export
  prisma: prismaMock,
}));

// Rate limiter wraps handlers as withRateLimit(request, callback).
jest.mock('@/lib/middleware/rate-limiter', () => ({
  withRateLimit: (_req: unknown, cb: () => unknown) => cb(),
}));

// Downstream readiness lookups — not under test; keep them inert.
jest.mock('@/lib/platform-credentials', () => ({
  getPlatformOAuthCredentials: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

import { GET } from '@/app/api/integrations/route';

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserId.mockResolvedValue('user-1');
  mockGetEffectiveOrganizationId.mockResolvedValue('own-org');
  mockPlatformConnectionFindMany.mockResolvedValue([]);
});

describe('GET /api/integrations — org override access control (SYN-1112 F2)', () => {
  it('returns 403 when the caller lacks access to the overridden org', async () => {
    mockHasOrganizationAccess.mockResolvedValue(false);

    const req = createMockNextRequest({
      url: 'http://localhost:3000/api/integrations?organizationId=victim-org',
    });
    const res = await GET(req as never);

    expect(res.status).toBe(403);
    expect(mockHasOrganizationAccess).toHaveBeenCalledWith(
      'user-1',
      'victim-org'
    );
    // Denied before any tenant data is read.
    expect(mockPlatformConnectionFindMany).not.toHaveBeenCalled();
  });

  it('proceeds when the caller has access to the overridden org', async () => {
    mockHasOrganizationAccess.mockResolvedValue(true);

    const req = createMockNextRequest({
      url: 'http://localhost:3000/api/integrations?organizationId=my-brand',
    });
    const res = await GET(req as never);

    expect(res.status).not.toBe(403);
    expect(mockHasOrganizationAccess).toHaveBeenCalledWith(
      'user-1',
      'my-brand'
    );
    // Proceeded past the guard: connections queried scoped to the granted org.
    expect(mockPlatformConnectionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'my-brand' }),
      })
    );
  });

  it('does not gate the default (no-override) path on hasOrganizationAccess', async () => {
    const req = createMockNextRequest({
      url: 'http://localhost:3000/api/integrations',
    });
    const res = await GET(req as never);

    expect(res.status).toBe(200);
    expect(mockHasOrganizationAccess).not.toHaveBeenCalled();
  });
});
