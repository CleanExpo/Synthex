/**
 * Unauthenticated-read regression tests (JEV J1 security hotfix).
 *
 * Each GET below used to read the database for an anonymous caller:
 * - /api/activity returned recent posts of every tenant
 * - /api/quotes and /api/quotes/[id] had no auth on GET
 * - /api/platforms/[platform]/metrics used PUBLIC_READ and aggregated
 *   every tenant's posts
 *
 * Asserts: anonymous GET -> 401 with { error } and no Prisma call;
 * authenticated GET -> 200 with every query scoped to the caller.
 * REAL handlers, mocked Prisma + security checker. No network, no DB.
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

// ── Prisma mock ───────────────────────────────────────────────────────────────

const mockPostFindMany = jest.fn();
const mockPostCount = jest.fn();
const mockAuditFindMany = jest.fn();
const mockAuditCount = jest.fn();
const mockQuoteFindMany = jest.fn();
const mockQuoteCount = jest.fn();
const mockQuoteFindFirst = jest.fn();
const mockQuoteUpdateMany = jest.fn();
const mockConnectionFindFirst = jest.fn();

const mockPrisma = {
  post: {
    findMany: (...a: unknown[]) => mockPostFindMany(...a),
    count: (...a: unknown[]) => mockPostCount(...a),
  },
  auditLog: {
    findMany: (...a: unknown[]) => mockAuditFindMany(...a),
    count: (...a: unknown[]) => mockAuditCount(...a),
  },
  quote: {
    findMany: (...a: unknown[]) => mockQuoteFindMany(...a),
    count: (...a: unknown[]) => mockQuoteCount(...a),
    findFirst: (...a: unknown[]) => mockQuoteFindFirst(...a),
    updateMany: (...a: unknown[]) => mockQuoteUpdateMany(...a),
  },
  platformConnection: {
    findFirst: (...a: unknown[]) => mockConnectionFindFirst(...a),
  },
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: mockPrisma,
  default: mockPrisma,
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

// ── Security checker mock ─────────────────────────────────────────────────────

const mockCheck = jest.fn();
jest.mock('@/lib/security/api-security-checker', () => {
  const { NextResponse } = jest.requireActual('next/server');
  return {
    APISecurityChecker: {
      check: (...a: unknown[]) => mockCheck(...a),
      createSecureResponse: (data: unknown, status = 200) =>
        NextResponse.json(data, { status }),
    },
    DEFAULT_POLICIES: {
      PUBLIC_READ: { name: 'PUBLIC_READ' },
      AUTHENTICATED_READ: { name: 'AUTHENTICATED_READ', requireAuth: true },
      AUTHENTICATED_WRITE: { name: 'AUTHENTICATED_WRITE', requireAuth: true },
    },
  };
});

jest.mock('@/lib/middleware/withAuth', () => ({
  extractUserId: async (request: unknown) => {
    const result = await mockCheck(request);
    return result.allowed ? result.context.userId || null : null;
  },
}));

import { GET as getActivity } from '@/app/api/activity/route';
import { GET as getQuotes } from '@/app/api/quotes/route';
import { GET as getQuote } from '@/app/api/quotes/[id]/route';
import { GET as getPlatformMetrics } from '@/app/api/platforms/[platform]/metrics/route';

const CALLER = 'user-caller';

function req(path: string): any {
  return createMockNextRequest({
    method: 'GET',
    url: `http://localhost${path}`,
  });
}

function anonymous() {
  mockCheck.mockResolvedValue({
    allowed: false,
    error: 'Authentication required',
    context: { isAuthenticated: false },
  });
}

function authenticated() {
  mockCheck.mockResolvedValue({
    allowed: true,
    context: { userId: CALLER, isAuthenticated: true },
  });
}

const prismaFns = [
  mockPostFindMany,
  mockPostCount,
  mockAuditFindMany,
  mockAuditCount,
  mockQuoteFindMany,
  mockQuoteCount,
  mockQuoteFindFirst,
  mockQuoteUpdateMany,
  mockConnectionFindFirst,
];

function expectNoPrismaCall() {
  for (const fn of prismaFns) expect(fn).not.toHaveBeenCalled();
}

async function expect401(res: any) {
  expect(res.status).toBe(401);
  const body = await res.json();
  expect(typeof body.error).toBe('string');
  expect(body.error.length).toBeGreaterThan(0);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPostFindMany.mockResolvedValue([]);
  mockPostCount.mockResolvedValue(0);
  mockAuditFindMany.mockResolvedValue([]);
  mockAuditCount.mockResolvedValue(0);
  mockQuoteFindMany.mockResolvedValue([]);
  mockQuoteCount.mockResolvedValue(0);
  mockQuoteFindFirst.mockResolvedValue(null);
  mockQuoteUpdateMany.mockResolvedValue({ count: 1 });
  mockConnectionFindFirst.mockResolvedValue(null);
});

describe('GET /api/activity', () => {
  it('401s an anonymous caller before any DB read', async () => {
    anonymous();
    await expect401(await getActivity(req('/api/activity')));
    expectNoPrismaCall();
  });

  it('scopes every query to the authenticated user', async () => {
    authenticated();
    mockPostFindMany.mockResolvedValue([
      {
        id: 'p1',
        platform: 'twitter',
        status: 'published',
        content: 'hi',
        analytics: null,
        createdAt: new Date('2026-01-01'),
        publishedAt: null,
        campaign: { name: 'Mine' },
      },
    ]);
    mockPostCount.mockResolvedValue(1);

    const res = await getActivity(req('/api/activity'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.activities).toHaveLength(1);

    expect(mockPostFindMany.mock.calls[0][0].where).toEqual({
      campaign: { userId: CALLER },
    });
    expect(mockPostCount.mock.calls[0][0].where).toEqual({
      campaign: { userId: CALLER },
    });
    expect(mockAuditFindMany.mock.calls[0][0].where.userId).toBe(CALLER);
    expect(mockAuditCount.mock.calls[0][0].where.userId).toBe(CALLER);
  });
});

describe('GET /api/quotes', () => {
  it('401s an anonymous caller before any DB read', async () => {
    anonymous();
    await expect401(await getQuotes(req('/api/quotes')));
    expectNoPrismaCall();
  });

  it("returns only the caller's quotes", async () => {
    authenticated();
    mockQuoteFindMany.mockResolvedValue([{ id: 'q1', userId: CALLER }]);
    mockQuoteCount.mockResolvedValue(1);

    const res = await getQuotes(req('/api/quotes?category=business'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([{ id: 'q1', userId: CALLER }]);

    expect(mockQuoteFindMany.mock.calls[0][0].where.userId).toBe(CALLER);
    expect(mockQuoteCount.mock.calls[0][0].where.userId).toBe(CALLER);
  });
});

describe('GET /api/quotes/[id]', () => {
  const ctx = { params: Promise.resolve({ id: 'q1' }) };

  it('401s an anonymous caller before any DB read', async () => {
    anonymous();
    await expect401(await getQuote(req('/api/quotes/q1'), ctx));
    expectNoPrismaCall();
  });

  it("returns the caller's own private quote", async () => {
    authenticated();
    mockQuoteFindFirst.mockResolvedValue({
      id: 'q1',
      userId: CALLER,
      isPublic: false,
      expiresAt: null,
    });

    const res = await getQuote(req('/api/quotes/q1'), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).data.id).toBe('q1');
    const scopedWhere = {
      id: 'q1',
      OR: [{ isPublic: true }, { userId: CALLER }],
    };
    expect(mockQuoteFindFirst.mock.calls[0][0].where).toEqual(scopedWhere);
    expect(mockQuoteUpdateMany.mock.calls[0][0].where).toEqual(scopedWhere);
  });

  it("404s another user's private quote", async () => {
    authenticated();
    mockQuoteFindFirst.mockResolvedValue({
      id: 'q1',
      userId: 'someone-else',
      isPublic: false,
      expiresAt: null,
    });

    const res = await getQuote(req('/api/quotes/q1'), ctx);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/platforms/[platform]/metrics', () => {
  const ctx = { params: Promise.resolve({ platform: 'twitter' }) };

  it('401s an anonymous caller before any DB read', async () => {
    anonymous();
    await expect401(
      await getPlatformMetrics(req('/api/platforms/twitter/metrics'), ctx)
    );
    expectNoPrismaCall();
  });

  it("aggregates only the caller's posts and connection", async () => {
    authenticated();
    mockPostFindMany.mockResolvedValue([
      { analytics: { likes: 3 }, status: 'published', createdAt: new Date() },
    ]);

    const res = await getPlatformMetrics(
      req('/api/platforms/twitter/metrics'),
      ctx
    );
    expect(res.status).toBe(200);
    expect((await res.json()).breakdown.likes).toBe(3);

    expect(mockCheck.mock.calls[0][1]).toEqual({
      name: 'AUTHENTICATED_READ',
      requireAuth: true,
    });
    expect(mockPostFindMany.mock.calls[0][0].where.campaign).toEqual({
      userId: CALLER,
    });
    expect(mockConnectionFindFirst.mock.calls[0][0].where.userId).toBe(CALLER);
  });
});
