/**
 * POST /api/analytics/post-performance-sync — idempotency guard ported to Prisma.
 * first_win_detected lives on organizations (SYN-525); the guard reads it via the
 * caller's own user row, never another user's or organisation's.
 */
import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockPrisma = {
  user: { findUnique: jest.fn() },
  post: { findMany: jest.fn() },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

const mockGetUserId = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => mockGetUserId(...a),
}));

const mockCreateNotification = jest.fn();
jest.mock('@/lib/notifications/create-first-win-notification', () => ({
  createFirstWinNotification: (...a: unknown[]) => mockCreateNotification(...a),
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { POST } from '@/app/api/analytics/post-performance-sync/route';

const body = {
  postId: 'post-1',
  postedAt: new Date().toISOString(),
  metric: 'reach',
  value: 500,
};

function req(b: object = body) {
  return createMockNextRequest({
    method: 'POST',
    url: 'http://localhost/api/analytics/post-performance-sync',
    body: b,
  });
}

beforeEach(() => {
  mockGetUserId.mockResolvedValue('user-1');
  mockPrisma.post.findMany.mockResolvedValue([]);
  mockCreateNotification.mockResolvedValue(undefined);
});

describe('POST /api/analytics/post-performance-sync', () => {
  it('401 when unauthenticated — no DB read', async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await POST(req());
    expect(res.status).toBe(401);
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("already_won when the caller's organisation has its first win (scoped read)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      organization: { firstWinDetected: true },
    });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'already_won' });
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { organization: { select: { firstWinDetected: true } } },
    });
    expect(mockPrisma.post.findMany).not.toHaveBeenCalled();
  });

  it("computes the baseline from the caller's own posts when no first win yet", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      organization: { firstWinDetected: false },
    });
    mockPrisma.post.findMany.mockResolvedValue([
      { analytics: { reach: 100 } },
      { analytics: { reach: 100 } },
    ]);
    const res = await POST(req());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.status).toBe('first_win_detected');
    expect(mockPrisma.post.findMany.mock.calls[0][0].where.campaign).toEqual({
      userId: 'user-1',
    });
    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
  });

  it('500 (not a fake success) when the DB read fails', async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error('db down'));
    const res = await POST(req());
    expect(res.status).toBe(500);
  });
});
