/**
 * PATCH /api/comments/[id] — owner check covers the isResolved branch.
 *
 * Regression: the author check previously guarded only the content edit; an
 * isResolved-only body reached update() unscoped, letting any authenticated
 * user resolve/unresolve another user's comment. The owner check now gates the
 * whole mutation.
 */
import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockGetUserId = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => mockGetUserId(...a),
}));

const mockPrisma = {
  contentComment: { findUnique: jest.fn(), update: jest.fn() },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));
jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { PATCH } from '@/app/api/comments/[id]/route';

function req(body: object) {
  return createMockNextRequest({
    method: 'PATCH',
    url: 'http://localhost/api/comments/c-1',
    body,
  });
}
const params = Promise.resolve({ id: 'c-1' });

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserId.mockResolvedValue('attacker');
});

describe('PATCH comment — isResolved is author-gated', () => {
  it('403s an isResolved-only body from a non-author and never updates', async () => {
    mockPrisma.contentComment.findUnique.mockResolvedValue({
      id: 'c-1',
      authorId: 'owner',
    });

    const res = await PATCH(req({ isResolved: true }), { params });

    expect(res.status).toBe(403);
    expect(mockPrisma.contentComment.update).not.toHaveBeenCalled();
  });

  it('allows the author to resolve their own comment', async () => {
    mockGetUserId.mockResolvedValue('owner');
    mockPrisma.contentComment.findUnique.mockResolvedValue({
      id: 'c-1',
      authorId: 'owner',
    });
    mockPrisma.contentComment.update.mockResolvedValue({
      id: 'c-1',
      contentType: 'post',
      contentId: 'p-1',
      content: 'hi',
      parentId: null,
      authorId: 'owner',
      sentiment: null,
      sentimentScore: null,
      emotions: null,
      isResolved: true,
      resolvedAt: new Date(),
      resolvedBy: 'owner',
      mentions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await PATCH(req({ isResolved: true }), { params });

    expect(res.status).toBe(200);
    expect(mockPrisma.contentComment.update).toHaveBeenCalled();
  });
});
