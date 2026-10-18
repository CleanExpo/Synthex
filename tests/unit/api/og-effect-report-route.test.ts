/**
 * Unit tests for GET /api/og/effect-report.
 *
 * The `effect_reports` table has no Prisma model, so after auth and tenant
 * resolution the route must return 503 FEATURE_NOT_PROVISIONED rather than a
 * placeholder card that looks like a real report.
 */

import { createMockNextRequest } from '../../helpers/mock-request';

const getUserIdMock = jest.fn();
const mockPrisma = { user: { findUnique: jest.fn() } };

jest.mock('@/lib/prisma', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => getUserIdMock(...a),
}));

import { GET } from '@/app/api/og/effect-report/route';

function req() {
  return createMockNextRequest({
    method: 'GET',
    url: 'http://localhost:3000/api/og/effect-report?period=Q1+2026&client_id=other-org',
  });
}

describe('GET /api/og/effect-report', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    getUserIdMock.mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it('returns 403 when the user has no organisation', async () => {
    getUserIdMock.mockResolvedValue('user-123');
    mockPrisma.user.findUnique.mockResolvedValue({ organizationId: null });
    const res = await GET(req());
    expect(res.status).toBe(403);
  });

  it('returns 503 FEATURE_NOT_PROVISIONED after auth', async () => {
    getUserIdMock.mockResolvedValue('user-123');
    mockPrisma.user.findUnique.mockResolvedValue({ organizationId: 'org-1' });

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.error).toBe('FEATURE_NOT_PROVISIONED');
    expect(body.message).toContain('effect_reports');
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      select: { organizationId: true },
    });
  });
});
