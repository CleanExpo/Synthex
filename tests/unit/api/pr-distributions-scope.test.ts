/**
 * PATCH /api/pr/press-releases/[id]/distributions — cross-release write scope.
 *
 * Regression for the P0 IDOR: the ownership gate verified the URL's release,
 * but the update targeted only body.distributionId — so a caller could mutate
 * a distribution belonging to a DIFFERENT release. The update is now scoped to
 * { id, releaseId }; a distribution outside this release yields count 0 → 404.
 */
import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockGetUserId = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => mockGetUserId(...a),
}));

const mockPrisma = {
  pressRelease: { findFirst: jest.fn() },
  pRDistribution: { updateMany: jest.fn(), findUnique: jest.fn() },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

import { PATCH } from '@/app/api/pr/press-releases/[id]/distributions/route';

function req(body: object) {
  return createMockNextRequest({
    method: 'PATCH',
    url: 'http://localhost/api/pr/press-releases/rel-1/distributions',
    body,
  });
}
const params = Promise.resolve({ id: 'rel-1' });

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserId.mockResolvedValue('user-1');
  mockPrisma.pressRelease.findFirst.mockResolvedValue({ id: 'rel-1' });
});

describe('PATCH distributions — release-scoped update', () => {
  it('scopes updateMany to the verified release id', async () => {
    mockPrisma.pRDistribution.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.pRDistribution.findUnique.mockResolvedValue({ id: 'd-1' });

    const res = await PATCH(
      req({ distributionId: 'd-1', status: 'published' }),
      { params }
    );

    expect(res.status).toBe(200);
    expect(mockPrisma.pRDistribution.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'd-1', releaseId: 'rel-1' },
      })
    );
  });

  it('returns 404 when the distribution is not part of this release', async () => {
    // count 0 = the id belongs to another release (or does not exist).
    mockPrisma.pRDistribution.updateMany.mockResolvedValue({ count: 0 });

    const res = await PATCH(
      req({ distributionId: 'other-release-dist', status: 'published' }),
      { params }
    );

    expect(res.status).toBe(404);
    expect(mockPrisma.pRDistribution.findUnique).not.toHaveBeenCalled();
  });

  it('401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await PATCH(
      req({ distributionId: 'd-1', status: 'published' }),
      { params }
    );
    expect(res.status).toBe(401);
    expect(mockPrisma.pRDistribution.updateMany).not.toHaveBeenCalled();
  });
});
