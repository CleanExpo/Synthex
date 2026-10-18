/**
 * Unit tests for GET /api/monitoring/metrics.
 *
 * The `profiles` and `content_posts` tables have no Prisma model, so the user
 * and post counts must be reported as unavailable, never as a fabricated 0.
 */

import { createMockNextRequest } from '../../helpers/mock-request';

const verifyAdminMock = jest.fn();

jest.mock('@/lib/admin/verify-admin', () => ({
  verifyAdmin: (...a: unknown[]) => verifyAdminMock(...a),
}));
jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { GET } from '@/app/api/monitoring/metrics/route';

function req() {
  return createMockNextRequest({
    method: 'GET',
    url: 'http://localhost:3000/api/monitoring/metrics',
  });
}

describe('GET /api/monitoring/metrics', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 403 for non-admins', async () => {
    verifyAdminMock.mockResolvedValue({ isAdmin: false, error: 'nope' });
    const res = await GET(req());
    expect(res.status).toBe(403);
  });

  it('reports the user and post counts as not provisioned', async () => {
    verifyAdminMock.mockResolvedValue({ isAdmin: true });
    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.system.activeUsers).toBeNull();
    expect(body.system.requestCount).toBeNull();
    expect(body.database.status).toBeNull();
    expect(body.unavailable.activeUsers).toEqual({
      available: false,
      reason: expect.stringContaining('profiles'),
    });
    expect(body.unavailable.requestCount).toEqual({
      available: false,
      reason: expect.stringContaining('content_posts'),
    });
  });
});
