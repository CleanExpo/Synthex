/**
 * Unit tests for POST/GET /api/monitoring/errors.
 *
 * The reporter is resolved from the session via the real JWT helper and the
 * email via a Prisma lookup scoped to that user id (no platform stub).
 */

import { createMockNextRequest } from '../../helpers/mock-request';

const getUserIdMock = jest.fn();
const mockPrisma = { user: { findUnique: jest.fn() } };

jest.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => getUserIdMock(...a),
}));
jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { GET, POST } from '@/app/api/monitoring/errors/route';

const URL_BASE = 'http://localhost:3000/api/monitoring/errors';

describe('/api/monitoring/errors', () => {
  beforeEach(() => jest.clearAllMocks());

  it('attaches the session user with a user-scoped Prisma email lookup', async () => {
    getUserIdMock.mockResolvedValue('user-123');
    mockPrisma.user.findUnique.mockResolvedValue({ email: 'a@example.com' });

    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: URL_BASE,
        body: {
          message: 'boom',
          level: 'info',
          id: 'e1',
          timestamp: new Date().toISOString(),
        },
      })
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      select: { email: true },
    });

    const list = await GET(
      createMockNextRequest({ method: 'GET', url: `${URL_BASE}?limit=1` })
    );
    const body = await list.json();
    expect(body.errors[0]).toEqual(
      expect.objectContaining({
        id: 'e1',
        userId: 'user-123',
        userEmail: 'a@example.com',
      })
    );
  });

  it('records anonymous errors without a user lookup', async () => {
    getUserIdMock.mockResolvedValue(null);

    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: URL_BASE,
        body: { message: 'anon', id: 'e2' },
      })
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('requires authentication to read the error log', async () => {
    getUserIdMock.mockResolvedValue(null);
    const res = await GET(
      createMockNextRequest({ method: 'GET', url: URL_BASE })
    );
    expect(res.status).toBe(401);
  });
});
