/**
 * Unit Tests for PATCH /api/notifications/read-all
 *
 * Verifies the bulk mark-all-read endpoint: 401 when unauthenticated, marks
 * every unread notification for the authenticated user, and degrades to 500 on
 * a DB error. Mirrors the mocking pattern in notifications-crud.test.ts.
 */

import { createMockNextRequest } from '../../helpers/mock-request';

const mockPrisma = {
  notification: {
    updateMany: jest.fn(),
  },
};

jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

const mockSecurityCheck = jest.fn();
const mockCreateSecureResponse = jest.fn((body: unknown, status: number) => {
  return new Response(JSON.stringify(body), { status });
});

jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: (...args: unknown[]) => mockSecurityCheck(...args),
    createSecureResponse: (...args: unknown[]) =>
      mockCreateSecureResponse(...args),
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_WRITE: { requireAuth: true, allowWrite: true },
  },
}));

jest.mock('@/lib/redis-client', () => ({
  getRedisClient: () => ({
    keys: jest.fn().mockResolvedValue([]),
    del: jest.fn().mockResolvedValue(0),
  }),
}));

// No Supabase env in test → first-win branch is skipped, prisma path only.
import { PATCH } from '@/app/api/notifications/read-all/route';

function createRequest() {
  return createMockNextRequest({
    method: 'PATCH',
    url: 'http://localhost:3000/api/notifications/read-all',
  });
}

describe('PATCH /api/notifications/read-all', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockSecurityCheck.mockResolvedValue({
      allowed: false,
      error: 'Unauthorized',
      context: {},
    });

    await PATCH(createRequest());

    expect(mockCreateSecureResponse).toHaveBeenCalledWith(
      { error: 'Unauthorized' },
      401,
      {}
    );
    expect(mockPrisma.notification.updateMany).not.toHaveBeenCalled();
  });

  it('marks all unread notifications read for the authenticated user', async () => {
    mockSecurityCheck.mockResolvedValue({
      allowed: true,
      context: { userId: 'user-123' },
    });
    mockPrisma.notification.updateMany.mockResolvedValue({ count: 49 });

    await PATCH(createRequest());

    expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-123', read: false },
      data: { read: true },
    });
    expect(mockCreateSecureResponse).toHaveBeenCalledWith(
      { success: true, markedRead: 49 },
      200,
      expect.any(Object)
    );
  });

  it('returns 500 on database error', async () => {
    mockSecurityCheck.mockResolvedValue({
      allowed: true,
      context: { userId: 'user-123' },
    });
    mockPrisma.notification.updateMany.mockRejectedValue(new Error('DB down'));

    await PATCH(createRequest());

    expect(mockCreateSecureResponse).toHaveBeenCalledWith(
      { error: 'Failed to mark notifications as read' },
      500,
      expect.any(Object)
    );
  });
});
