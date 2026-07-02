/**
 * tests/security/bulk-content-idor.spec.ts
 *
 * Regression test for the cross-tenant IDOR fix in
 * `app/api/content/bulk/route.ts` (branch nexus/security-fixes-20260609, PR #346).
 *
 * The vulnerability
 * -----------------
 * The `schedule` and `status` bulk operations wrote to posts addressed purely
 * by id, without verifying the caller owned them. A user (userA) could schedule
 * or re-status another tenant's (userB's) posts by passing their ids.
 *
 * The fix
 * -------
 * Both operations now fetch the posts with
 *   include: { campaign: { select: { userId: true } } }
 * and return 403 BEFORE any write if ANY post belongs to a campaign whose
 * `campaign.userId !== callerUserId`.
 *
 * This test locks that in: with the caller mocked as userA and
 * prisma.post.findMany returning foreign posts (campaign.userId === 'userB'),
 * the handler must respond 403 and must NOT call prisma.post.update /
 * prisma.post.updateMany. The positive case (posts owned by userA) must NOT
 * 403 and must proceed to write.
 *
 * Mirrors the mocking style of tests/unit/api/content.test.ts (mock the
 * default prisma export + getUserIdFromRequestOrCookies) and drives the real
 * POST handler with createMockNextRequest, like tests/unit/api/posts.test.ts.
 */

import { createMockNextRequest } from '../helpers/mock-request';

// --- Mocked prisma (default export, matching the route's `import prisma from '@/lib/prisma'`) ---
const mockPrisma = {
  post: {
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  campaign: {
    findMany: jest.fn(),
  },
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: mockPrisma,
  default: mockPrisma,
}));

// --- Mocked auth ---
const mockGetUserIdFromRequestOrCookies = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) =>
    mockGetUserIdFromRequestOrCookies(...args),
}));

// --- Silence the route's logger ---
jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { POST } from '@/app/api/content/bulk/route';

// Valid UUIDs — the route's Zod schemas require z.string().uuid().
const POST_ID_1 = '11111111-1111-4111-8111-111111111111';
const POST_ID_2 = '22222222-2222-4222-8222-222222222222';
const SCHEDULED_AT = '2026-07-01T10:00:00.000Z';

const CALLER = 'userA';
const FOREIGN = 'userB';

function bulkRequest(body: object) {
  return createMockNextRequest({
    method: 'POST',
    body,
    url: 'http://localhost:3000/api/content/bulk',
  }) as any;
}

describe('Bulk content cross-tenant IDOR (app/api/content/bulk)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: caller is userA.
    mockGetUserIdFromRequestOrCookies.mockResolvedValue(CALLER);
    mockPrisma.post.update.mockResolvedValue({});
    mockPrisma.post.updateMany.mockResolvedValue({ count: 2 });
  });

  describe('schedule operation', () => {
    it('returns 403 and does NOT write when posts belong to another tenant (userB)', async () => {
      // findMany returns posts whose campaign is owned by userB (foreign).
      mockPrisma.post.findMany.mockResolvedValue([
        { id: POST_ID_1, campaign: { userId: FOREIGN } },
        { id: POST_ID_2, campaign: { userId: FOREIGN } },
      ]);

      const res = await POST(
        bulkRequest({
          operation: 'schedule',
          posts: [
            { id: POST_ID_1, scheduledAt: SCHEDULED_AT },
            { id: POST_ID_2, scheduledAt: SCHEDULED_AT },
          ],
        })
      );

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe('Forbidden');

      // The write must never happen.
      expect(mockPrisma.post.update).not.toHaveBeenCalled();
    });

    it('does NOT return 403 and proceeds to write when posts are owned by the caller (userA)', async () => {
      mockPrisma.post.findMany.mockResolvedValue([
        { id: POST_ID_1, campaign: { userId: CALLER } },
        { id: POST_ID_2, campaign: { userId: CALLER } },
      ]);

      const res = await POST(
        bulkRequest({
          operation: 'schedule',
          posts: [
            { id: POST_ID_1, scheduledAt: SCHEDULED_AT },
            { id: POST_ID_2, scheduledAt: SCHEDULED_AT },
          ],
        })
      );

      expect(res.status).not.toBe(403);
      expect(res.status).toBe(200);
      // The write proceeds for owned posts.
      expect(mockPrisma.post.update).toHaveBeenCalled();
    });
  });

  describe('status operation', () => {
    it('returns 403 and does NOT write when posts belong to another tenant (userB)', async () => {
      mockPrisma.post.findMany.mockResolvedValue([
        { id: POST_ID_1, campaign: { userId: FOREIGN } },
        { id: POST_ID_2, campaign: { userId: FOREIGN } },
      ]);

      const res = await POST(
        bulkRequest({
          operation: 'status',
          ids: [POST_ID_1, POST_ID_2],
          status: 'archived',
        })
      );

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe('Forbidden');

      // The write must never happen.
      expect(mockPrisma.post.updateMany).not.toHaveBeenCalled();
    });

    it('does NOT return 403 and proceeds to write when posts are owned by the caller (userA)', async () => {
      mockPrisma.post.findMany.mockResolvedValue([
        { id: POST_ID_1, campaign: { userId: CALLER } },
        { id: POST_ID_2, campaign: { userId: CALLER } },
      ]);

      const res = await POST(
        bulkRequest({
          operation: 'status',
          ids: [POST_ID_1, POST_ID_2],
          status: 'archived',
        })
      );

      expect(res.status).not.toBe(403);
      expect(res.status).toBe(200);
      expect(mockPrisma.post.updateMany).toHaveBeenCalled();
    });
  });
});
