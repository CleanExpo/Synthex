/**
 * PATCH /api/bio/[pageId]/links reorder — link ids are page-scoped.
 *
 * Regression: reorder updated each link by id only (no pageId), so a caller
 * who owns page A could set the order of links on another user's page B by
 * passing their ids. The update is now updateMany scoped to { id, pageId }.
 */
import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockGetUserId = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => mockGetUserId(...a),
}));

const mockPrisma = {
  linkBioPage: { findFirst: jest.fn() },
  linkBioLink: { updateMany: jest.fn(), findMany: jest.fn() },
  $transaction: jest.fn(),
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: mockPrisma,
  default: mockPrisma,
}));
jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { PATCH } from '@/app/api/bio/[pageId]/links/route';

const params = Promise.resolve({ pageId: 'page-A' });
function req(body: object) {
  return createMockNextRequest({
    method: 'PATCH',
    url: 'http://localhost/api/bio/page-A/links',
    body,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserId.mockResolvedValue('user-1');
  mockPrisma.linkBioPage.findFirst.mockResolvedValue({ id: 'page-A' }); // owns A
  mockPrisma.linkBioLink.findMany.mockResolvedValue([]);
  // Execute the queued update ops so we can inspect their where clauses.
  mockPrisma.$transaction.mockImplementation((ops: unknown[]) =>
    Promise.all(ops)
  );
  mockPrisma.linkBioLink.updateMany.mockResolvedValue({ count: 1 });
});

describe('PATCH bio links reorder — page scope', () => {
  it('scopes every reorder update to the owned page id', async () => {
    const res = await PATCH(req({ linkIds: ['l-1', 'foreign-link'] }), {
      params,
    });

    expect(res.status).toBe(200);
    for (const call of mockPrisma.linkBioLink.updateMany.mock.calls) {
      expect(call[0].where).toEqual(
        expect.objectContaining({ pageId: 'page-A' })
      );
    }
  });
});
