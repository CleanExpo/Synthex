/**
 * AT-015 — GBP locations honesty.
 *
 * GET reports connected (OAuth PlatformConnection) separately from synced
 * locations so the UI can show Connect vs Sync without fabricating listings.
 */
import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockPrisma = {
  gBPLocation: {
    findMany: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  },
  organization: { findUnique: jest.fn() },
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
    AUTHENTICATED_WRITE: 'AUTHENTICATED_WRITE',
  },
}));

const mockGetEffectiveOrg = jest.fn();
jest.mock('@/lib/multi-business', () => ({
  getEffectiveOrganizationId: (...args: unknown[]) =>
    mockGetEffectiveOrg(...args),
}));

const mockFindOAuthConnection = jest.fn();
jest.mock('@/lib/google/google-auth', () => ({
  findOAuthConnection: (...args: unknown[]) => mockFindOAuthConnection(...args),
}));

jest.mock('@/lib/google/business-profile', () => ({
  listLocations: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { GET, POST } from '@/app/api/google-business/locations/route';

function getReq() {
  return createMockNextRequest({
    url: 'http://localhost/api/google-business/locations',
  });
}

function postReq(body: object = {}) {
  return createMockNextRequest({
    method: 'POST',
    url: 'http://localhost/api/google-business/locations',
    body,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSecurityCheck.mockResolvedValue({
    allowed: true,
    context: { userId: 'u1' },
  });
  mockGetEffectiveOrg.mockResolvedValue('org-1');
  mockPrisma.gBPLocation.findMany.mockResolvedValue([]);
  mockFindOAuthConnection.mockResolvedValue(null);
});

describe('GET /api/google-business/locations — AT-015 honesty', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSecurityCheck.mockResolvedValue({
      allowed: false,
      error: 'Unauthorized',
    });
    const res = await GET(getReq());
    expect(res.status).toBe(401);
    expect(mockPrisma.gBPLocation.findMany).not.toHaveBeenCalled();
  });

  it('reports connected:false with empty locations when OAuth is missing', async () => {
    mockFindOAuthConnection.mockResolvedValue(null);
    mockPrisma.gBPLocation.findMany.mockResolvedValue([]);

    const res = await GET(getReq());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(mockFindOAuthConnection).toHaveBeenCalledWith(
      'org-1',
      'googlebusiness'
    );
    expect(json).toMatchObject({
      success: true,
      connected: false,
      locations: [],
    });
  });

  it('reports connected:true with empty locations when OAuth exists but nothing synced', async () => {
    mockFindOAuthConnection.mockResolvedValue('conn-gbp');
    mockPrisma.gBPLocation.findMany.mockResolvedValue([]);

    const res = await GET(getReq());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({
      success: true,
      connected: true,
      locations: [],
    });
  });

  it('returns org-scoped locations when synced', async () => {
    mockFindOAuthConnection.mockResolvedValue('conn-gbp');
    mockPrisma.gBPLocation.findMany.mockResolvedValue([
      {
        id: 'loc-1',
        organizationId: 'org-1',
        locationName: 'Disaster Recovery',
        isPrimary: true,
      },
    ]);

    const res = await GET(getReq());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(mockPrisma.gBPLocation.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1' },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });
    expect(json.connected).toBe(true);
    expect(json.locations).toHaveLength(1);
    expect(json.locations[0].locationName).toBe('Disaster Recovery');
  });
});

describe('POST /api/google-business/locations — no fabricated sync', () => {
  it('returns 400 when no Google Business OAuth connection exists', async () => {
    mockFindOAuthConnection.mockResolvedValue(null);

    const res = await POST(postReq({}));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/connect/i);
    expect(mockPrisma.gBPLocation.upsert).not.toHaveBeenCalled();
  });
});
