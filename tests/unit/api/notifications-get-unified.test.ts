/**
 * Unit tests for the unified GET /api/notifications handler.
 *
 * Regression guard for the notifications-bell-disconnect fix: the bell + the
 * Notification Centre must surface the prisma.notification writer stream
 * (publish failures, token re-auth, etc.) in a single response shape that every
 * consumer reads. The Supabase `client_notifications` first-win source has no
 * Prisma model, so it must be reported as unavailable, never read.
 */

import { createMockNextRequest } from '../../helpers/mock-request';

const getUserIdMock = jest.fn();

const mockPrisma = {
  notification: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

jest.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => getUserIdMock(...a),
}));
jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { GET } from '@/app/api/notifications/route';

describe('GET /api/notifications (unified)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function req(url = 'http://localhost:3000/api/notifications') {
    return createMockNextRequest({ method: 'GET', url });
  }

  it('returns 401 when unauthenticated', async () => {
    getUserIdMock.mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('surfaces prisma.notification rows (the real writer stream) in the response', async () => {
    getUserIdMock.mockResolvedValue('user-123');
    mockPrisma.notification.findMany.mockResolvedValue([
      {
        id: 'n1',
        type: 'platform_reauth_required',
        title: 'Reconnect required',
        message: 'Your X token expired',
        read: false,
        data: { platform: 'x' },
        createdAt: new Date('2026-06-10T10:00:00Z'),
      },
    ]);
    mockPrisma.notification.count.mockResolvedValue(1);

    const res = await GET(req());
    const body = await res.json();

    // Bell reads `notifications`; Notification Centre + hook read `data`.
    expect(body.notifications).toHaveLength(1);
    expect(body.data).toHaveLength(1);
    const item = body.notifications[0];
    expect(item.id).toBe('n1');
    expect(item.message).toBe('Your X token expired'); // bell field
    expect(item.timestamp).toBeDefined(); // bell field
    expect(item.createdAt).toBeDefined(); // centre/hook field
    expect(body.unreadCount).toBe(1);

    // User-scoped query.
    expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-123' } })
    );
  });

  it('reports the first-win source as not provisioned instead of reading it', async () => {
    getUserIdMock.mockResolvedValue('user-123');
    mockPrisma.notification.findMany.mockResolvedValue([]);
    mockPrisma.notification.count.mockResolvedValue(0);

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.sources.notifications).toEqual({ available: true });
    expect(body.sources.firstWin.available).toBe(false);
    expect(body.sources.firstWin.reason).toContain('client_notifications');
  });

  it('surfaces a database failure as a 500, not an empty success', async () => {
    getUserIdMock.mockResolvedValue('user-123');
    mockPrisma.notification.findMany.mockRejectedValue(new Error('DB down'));

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Failed to fetch notifications');
  });

  it('applies unreadOnly filter to the prisma query', async () => {
    getUserIdMock.mockResolvedValue('user-123');
    mockPrisma.notification.findMany.mockResolvedValue([]);
    mockPrisma.notification.count.mockResolvedValue(0);

    await GET(req('http://localhost:3000/api/notifications?unreadOnly=true'));

    expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-123', read: false },
      })
    );
  });
});
