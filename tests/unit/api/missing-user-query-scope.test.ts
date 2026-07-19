/**
 * Consumer regressions for stale/deleted authenticated users (SYN-1112 F3).
 *
 * These tests exercise the real query-filter resolver through the tasks and
 * research GET handlers. A valid JWT userId with no Prisma user row must still
 * produce a restrictive userId WHERE clause, never an unscoped query.
 */
jest.mock('next/server', () => {
  class MockNextResponse {
    status: number;
    private _body: string;

    constructor(body: string, init: { status?: number } = {}) {
      this._body = body;
      this.status = init.status ?? 200;
    }

    json() {
      return Promise.resolve(JSON.parse(this._body));
    }

    static json(data: unknown, init: { status?: number } = {}) {
      return new MockNextResponse(JSON.stringify(data), init);
    }
  }

  return {
    NextResponse: MockNextResponse,
    NextRequest: class extends Request {},
  };
});

const mockPrisma = {
  user: { findUnique: jest.fn() },
  businessOwnership: { findUnique: jest.fn() },
  task: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  gEOResearchReport: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

const mockGetUserId = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserId(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock('@/lib/rate-limit', () => ({
  writeDefault: (_request: unknown, handler: () => Promise<unknown>) =>
    handler(),
}));

import { GET as getTasks } from '@/app/api/tasks/route';
import { GET as getResearch } from '@/app/api/research/route';
import { createMockNextRequest } from '../../helpers/mock-request';

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserId.mockResolvedValue('ghost-user');
  mockPrisma.user.findUnique.mockResolvedValue(null);
  mockPrisma.task.count.mockResolvedValue(0);
  mockPrisma.task.findMany.mockResolvedValue([]);
  mockPrisma.gEOResearchReport.count.mockResolvedValue(0);
  mockPrisma.gEOResearchReport.findMany.mockResolvedValue([]);
});

describe('missing-user query scoping', () => {
  it('keeps GET /api/tasks scoped to the authenticated user', async () => {
    const response = await getTasks(
      createMockNextRequest({ url: 'http://localhost/api/tasks' }) as never
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.task.count).toHaveBeenCalledWith({
      where: { userId: 'ghost-user' },
    });
    expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'ghost-user' } })
    );
  });

  it('keeps GET /api/research scoped to the authenticated user', async () => {
    const response = await getResearch(
      createMockNextRequest({ url: 'http://localhost/api/research' }) as never
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.gEOResearchReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'ghost-user' } })
    );
    expect(mockPrisma.gEOResearchReport.count).toHaveBeenCalledWith({
      where: { userId: 'ghost-user' },
    });
  });
});
