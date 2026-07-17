/**
 * GET /api/quotes/[id] — a private quote with a null owner is denied.
 *
 * Regression: the owner gate was `quote.userId && quote.userId !== caller`, so
 * a private quote whose userId is null skipped the check and was readable by
 * any authenticated caller. Null owner is now treated as deny.
 */
import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockFindUnique = jest.fn();
const mockPrisma = {
  quote: {
    findUnique: (...a: unknown[]) => mockFindUnique(...a),
    // Plain fn (not jest.fn) so resetMocks can't strip the .catch()-able return
    // used by the fire-and-forget usage-count update on the success path.
    update: () => Promise.resolve({}),
  },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: mockPrisma,
  default: mockPrisma,
}));
jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));
const mockCheck = jest.fn();
jest.mock('@/lib/security/api-security-checker', () => ({
  DEFAULT_POLICIES: { AUTHENTICATED_READ: {} },
  APISecurityChecker: {
    check: (...a: unknown[]) => mockCheck(...a),
  },
}));

import { GET } from '@/app/api/quotes/[id]/route';

const params = Promise.resolve({ id: 'q-1' });
function req() {
  return createMockNextRequest({
    method: 'GET',
    url: 'http://localhost/api/quotes/q-1',
  });
}

// resetMocks:true wipes implementations before each test — (re)wire here.
beforeEach(() => {
  jest.clearAllMocks();
  mockCheck.mockResolvedValue({
    allowed: true,
    context: { userId: 'someone' },
  });
});

describe('GET /api/quotes/[id] — null owner deny', () => {
  it('404s a private quote with a null owner', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'q-1',
      isPublic: false,
      userId: null,
    });
    const res = await GET(req(), { params });
    expect(res.status).toBe(404);
  });

  it('still serves a public quote to anyone', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'q-1',
      isPublic: true,
      userId: null,
    });
    const res = await GET(req(), { params });
    expect(res.status).toBe(200);
  });
});
