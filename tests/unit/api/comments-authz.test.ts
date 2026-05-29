/**
 * Cross-tenant authorisation tests for /api/comments (SYN-996 / SYN-997).
 *
 * Proves the IDOR fix holds: a caller who does not own the parent content gets
 * 404 on both read and write, and the privileged DB op (findMany / create) never
 * runs. The ownership query is EXERCISED (not stubbed) — the mock controls only
 * the DB result, and we assert the query was issued scoped to the caller.
 */

import { createMockNextRequest } from '../../helpers/mock-request';

const mockPrisma = {
  campaign: { findFirst: jest.fn() },
  post: { findFirst: jest.fn() },
  calendarPost: { findFirst: jest.fn() },
  project: { findFirst: jest.fn() },
  contentComment: {
    findMany: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
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

const mockGetOrg = jest.fn();
jest.mock('@/lib/multi-business', () => ({
  getEffectiveOrganizationId: (...args: unknown[]) => mockGetOrg(...args),
}));

// Rate-limit wrapper just runs the handler in tests.
jest.mock('@/lib/rate-limit', () => ({
  writeDefault: (_req: unknown, fn: () => unknown) => fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import { GET, POST } from '@/app/api/comments/route';

const BASE = 'http://localhost:3000/api/comments';

beforeEach(() => {
  jest.clearAllMocks();
  mockGetOrg.mockResolvedValue('org-A');
});

describe('GET /api/comments — cross-tenant authz (SYN-996)', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await GET(
      createMockNextRequest({ url: `${BASE}?contentType=campaign&contentId=c1` })
    );
    expect(res.status).toBe(401);
  });

  it('returns 404 for a different-tenant caller and never lists comments', async () => {
    mockGetUserId.mockResolvedValue('user-B');
    mockPrisma.campaign.findFirst.mockResolvedValue(null); // user-B owns nothing

    const res = await GET(
      createMockNextRequest({ url: `${BASE}?contentType=campaign&contentId=c1` })
    );

    expect(res.status).toBe(404);
    // ownership query actually ran, scoped to the caller — not mocked away
    expect(mockPrisma.campaign.findFirst).toHaveBeenCalledTimes(1);
    const arg = mockPrisma.campaign.findFirst.mock.calls[0][0];
    expect(arg.where.id).toBe('c1');
    expect(arg.where.OR).toEqual(
      expect.arrayContaining([{ userId: 'user-B' }, { organizationId: 'org-A' }])
    );
    expect(mockPrisma.contentComment.findMany).not.toHaveBeenCalled();
  });

  it('returns 200 and lists comments for the owner', async () => {
    mockGetUserId.mockResolvedValue('user-A');
    mockPrisma.campaign.findFirst.mockResolvedValue({ id: 'c1' });
    mockPrisma.contentComment.findMany.mockResolvedValue([]);

    const res = await GET(
      createMockNextRequest({ url: `${BASE}?contentType=campaign&contentId=c1` })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(mockPrisma.contentComment.findMany).toHaveBeenCalledTimes(1);
  });

  it('checks post ownership via the parent campaign', async () => {
    mockGetUserId.mockResolvedValue('user-B');
    mockPrisma.post.findFirst.mockResolvedValue(null);

    const res = await GET(
      createMockNextRequest({ url: `${BASE}?contentType=post&contentId=p1` })
    );

    expect(res.status).toBe(404);
    const arg = mockPrisma.post.findFirst.mock.calls[0][0];
    expect(arg.where.campaign.OR).toEqual(
      expect.arrayContaining([{ userId: 'user-B' }])
    );
  });
});

describe('POST /api/comments — cross-tenant authz (SYN-996)', () => {
  it('returns 404 for a different-tenant caller and never creates a comment', async () => {
    mockGetUserId.mockResolvedValue('user-B');
    mockPrisma.campaign.findFirst.mockResolvedValue(null);

    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: BASE,
        body: { contentType: 'campaign', contentId: 'c1', content: 'hostile' },
      })
    );

    expect(res.status).toBe(404);
    expect(mockPrisma.contentComment.create).not.toHaveBeenCalled();
  });

  it('creates a comment for the owner', async () => {
    mockGetUserId.mockResolvedValue('user-A');
    mockPrisma.campaign.findFirst.mockResolvedValue({ id: 'c1' });
    mockPrisma.contentComment.create.mockResolvedValue({
      id: 'cm1',
      contentType: 'campaign',
      contentId: 'c1',
      content: 'hi',
      parentId: null,
      authorId: 'user-A',
      sentiment: null,
      sentimentScore: null,
      emotions: null,
      isResolved: false,
      resolvedAt: null,
      resolvedBy: null,
      mentions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: BASE,
        body: { contentType: 'campaign', contentId: 'c1', content: 'hi' },
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(mockPrisma.contentComment.create).toHaveBeenCalledTimes(1);
  });
});
