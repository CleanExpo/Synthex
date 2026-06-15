/**
 * Unit tests for the unified GET /api/notifications handler.
 *
 * Regression guard for the notifications-bell-disconnect fix: the bell + the
 * Notification Centre must surface BOTH the prisma.notification writer stream
 * (publish failures, token re-auth, etc.) AND the Supabase `client_notifications`
 * first-win rows, in a single response shape that every consumer reads.
 */

import { createMockNextRequest } from '../../helpers/mock-request';

const getUserIdMock = jest.fn();

const mockPrisma = {
  notification: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

// Supabase query-builder mock: chainable, resolves to { data, error }.
const supabaseResult: { data: unknown; error: { message: string } | null } = {
  data: [],
  error: null,
};
function makeQuery() {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order', 'limit']) {
    q[m] = jest.fn(() => q);
  }
  // Awaiting the builder resolves to the configured result.
  (q as { then: unknown }).then = (resolve: (v: unknown) => void) =>
    resolve(supabaseResult);
  return q;
}
const fromMock = jest.fn();

jest.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => getUserIdMock(...a),
}));
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: fromMock }),
}));
jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { GET } from '@/app/api/notifications/route';

const ORIGINAL_ENV = process.env;

describe('GET /api/notifications (unified)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fromMock.mockImplementation(() => makeQuery());
    process.env = {
      ...ORIGINAL_ENV,
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    };
    supabaseResult.data = [];
    supabaseResult.error = null;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
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

  it('merges first-win (client_notifications) rows with prisma rows, newest first', async () => {
    getUserIdMock.mockResolvedValue('user-123');
    mockPrisma.notification.findMany.mockResolvedValue([
      {
        id: 'n1',
        type: 'warning',
        title: 'Publish failed',
        message: 'Could not publish',
        read: false,
        data: null,
        createdAt: new Date('2026-06-10T08:00:00Z'),
      },
    ]);
    mockPrisma.notification.count.mockResolvedValue(1);
    supabaseResult.data = [
      {
        id: 'fw1',
        type: 'first_win',
        title: 'First win!',
        body: 'Your post outperformed baseline',
        payload: { improvementPct: 42 },
        read: false,
        created_at: '2026-06-11T09:00:00Z',
      },
    ];

    const res = await GET(req());
    const body = await res.json();

    expect(body.notifications).toHaveLength(2);
    // Newest first → first-win row (2026-06-11) before prisma row (2026-06-10).
    expect(body.notifications[0].id).toBe('fw1');
    expect(body.notifications[0].type).toBe('first_win'); // banner match preserved
    expect(body.notifications[0].data).toEqual({ improvementPct: 42 });
    expect(body.notifications[0].message).toBe(
      'Your post outperformed baseline'
    );
    expect(body.unreadCount).toBe(2); // 1 prisma unread + 1 first-win unread
  });

  it('still returns prisma rows when Supabase env is missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    getUserIdMock.mockResolvedValue('user-123');
    mockPrisma.notification.findMany.mockResolvedValue([
      {
        id: 'n1',
        type: 'info',
        title: 'Hi',
        message: 'msg',
        read: true,
        data: null,
        createdAt: new Date('2026-06-10T10:00:00Z'),
      },
    ]);
    mockPrisma.notification.count.mockResolvedValue(0);

    const res = await GET(req());
    const body = await res.json();

    expect(fromMock).not.toHaveBeenCalled();
    expect(body.notifications).toHaveLength(1);
    expect(body.unreadCount).toBe(0);
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
