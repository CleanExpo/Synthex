/**
 * Behavioural coverage for the A/B-testing brand-isolation fix.
 *
 * BUG: every ab-testing route scoped ABTest queries/mutations by `userId`
 * ALONE, even though ABTest carries an `organizationId` column. A
 * multi-business owner who switched their active brand therefore saw and
 * mutated the SAME user's AB tests across ALL their brands — no brand
 * isolation.
 *
 * FIX: each ownership guard now resolves the active brand via
 * getEffectiveOrganizationId(userId) and scopes the test lookup by BOTH the
 * owning user AND the active brand (organizationId), while preserving legacy
 * tests created before brand-scoping (organizationId === null) and the no-org
 * fallback (effective org null -> userId only).
 *
 * These tests drive the REAL handlers (GET/POST list, GET/PUT/DELETE single,
 * GET/POST results) and assert the where-clause the route hands to Prisma.
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

const HOME_ORG = 'org-home';
const ACTIVE_BRAND = 'org-brand-b';
const USER_ID = 'u1';
const TEST_ID = 'test-1';
const VARIANT_A = 'var-a';
const VARIANT_B = 'var-b';

// ── Prisma mock ───────────────────────────────────────────────────────────────
const mockPrisma = {
  aBTest: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  aBTestVariant: {
    update: jest.fn(),
    findMany: jest.fn(),
  },
  aBTestResult: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

// ── Auth mock ─────────────────────────────────────────────────────────────────
const mockGetUserId = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserId(...args),
  unauthorizedResponse: () => ({ status: 401, json: async () => ({ error: 'Authentication required' }) }),
}));

// ── Effective-org mock (the active brand) ──────────────────────────────────────
const mockGetEffectiveOrganizationId = jest.fn();
jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveOrganizationId: (...args: unknown[]) =>
    mockGetEffectiveOrganizationId(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { GET as LIST_GET, POST as LIST_POST } from '@/app/api/ab-testing/tests/route';
import {
  GET as ONE_GET,
  PUT as ONE_PUT,
  DELETE as ONE_DELETE,
} from '@/app/api/ab-testing/tests/[testId]/route';
import {
  GET as RESULTS_GET,
  POST as RESULTS_POST,
} from '@/app/api/ab-testing/tests/[testId]/results/route';

function req(opts: { method?: string; body?: object; url?: string } = {}) {
  return createMockNextRequest({
    url: opts.url ?? 'http://localhost/api/ab-testing/tests',
    method: opts.method ?? 'GET',
    body: opts.body,
  }) as never;
}

function params() {
  return { params: Promise.resolve({ testId: TEST_ID }) } as never;
}

function ownedTest(extra: Record<string, unknown> = {}) {
  return {
    id: TEST_ID,
    userId: USER_ID,
    organizationId: ACTIVE_BRAND,
    status: 'running',
    startDate: new Date('2026-01-01'),
    variants: [
      { id: VARIANT_A, name: 'A', impressions: 0, engagement: 0, clicks: 0, conversions: 0 },
      { id: VARIANT_B, name: 'B', impressions: 0, engagement: 0, clicks: 0, conversions: 0 },
    ],
    results: [],
    ...extra,
  };
}

/**
 * The expected brand-scoped ownership filter when an active brand is set:
 * owned by the user AND (belongs to the active brand OR legacy null-org).
 */
const BRAND_OWNERSHIP = {
  userId: USER_ID,
  OR: [{ organizationId: ACTIVE_BRAND }, { organizationId: null }],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserId.mockResolvedValue(USER_ID);
  // Default: multi-business owner whose ACTIVE brand differs from their home org.
  mockGetEffectiveOrganizationId.mockResolvedValue(ACTIVE_BRAND);
  mockPrisma.aBTest.findMany.mockResolvedValue([]);
  mockPrisma.aBTest.count.mockResolvedValue(0);
  mockPrisma.aBTest.findFirst.mockResolvedValue(ownedTest());
  mockPrisma.aBTest.create.mockResolvedValue(ownedTest());
  mockPrisma.aBTest.update.mockResolvedValue(ownedTest());
  mockPrisma.aBTest.delete.mockResolvedValue(ownedTest());
  mockPrisma.aBTestResult.findMany.mockResolvedValue([]);
  mockPrisma.aBTestResult.create.mockResolvedValue({ id: 'res-1' });
  mockPrisma.aBTestVariant.findMany.mockResolvedValue([]);
});

// ── GET /api/ab-testing/tests (list) ────────────────────────────────────────
describe('GET /api/ab-testing/tests — list scoped to active brand', () => {
  it('filters the list by the ACTIVE brand, not just userId', async () => {
    await LIST_GET(req());

    expect(mockGetEffectiveOrganizationId).toHaveBeenCalledWith(USER_ID);
    const findArg = mockPrisma.aBTest.findMany.mock.calls[0][0];
    expect(findArg.where).toMatchObject(BRAND_OWNERSHIP);
    // The count uses the same brand-scoped filter.
    const countArg = mockPrisma.aBTest.count.mock.calls[0][0];
    expect(countArg.where).toMatchObject(BRAND_OWNERSHIP);
  });

  it('does not leak across brands: active brand != home org changes the filter', async () => {
    await LIST_GET(req());
    const findArg = mockPrisma.aBTest.findMany.mock.calls[0][0];
    // The home org must NOT appear; only the active brand (or legacy null).
    expect(JSON.stringify(findArg.where)).not.toContain(HOME_ORG);
    expect(JSON.stringify(findArg.where)).toContain(ACTIVE_BRAND);
  });

  it('no-org fallback: effective org null -> userId-only filter preserved', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValue(null);
    await LIST_GET(req());
    const findArg = mockPrisma.aBTest.findMany.mock.calls[0][0];
    expect(findArg.where).toEqual({ userId: USER_ID });
  });

  it('returns 401 and never queries when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await LIST_GET(req());
    expect(res.status).toBe(401);
    expect(mockPrisma.aBTest.findMany).not.toHaveBeenCalled();
  });
});

// ── POST /api/ab-testing/tests (create) ─────────────────────────────────────
describe('POST /api/ab-testing/tests — stamps the active brand', () => {
  const validBody = {
    name: 'Headline test',
    variants: [
      { name: 'A', content: 'Variant A copy' },
      { name: 'B', content: 'Variant B copy' },
    ],
  };

  it('stamps the new test with the active brand organizationId', async () => {
    const res = await LIST_POST(req({ method: 'POST', body: validBody }));
    expect(res.status).toBe(201);
    expect(mockGetEffectiveOrganizationId).toHaveBeenCalledWith(USER_ID);
    const createArg = mockPrisma.aBTest.create.mock.calls[0][0];
    expect(createArg.data.userId).toBe(USER_ID);
    expect(createArg.data.organizationId).toBe(ACTIVE_BRAND);
  });

  it('no-org fallback: organizationId stamped as null when no active brand', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValue(null);
    await LIST_POST(req({ method: 'POST', body: validBody }));
    const createArg = mockPrisma.aBTest.create.mock.calls[0][0];
    expect(createArg.data.organizationId).toBeNull();
  });
});

// ── GET/PUT/DELETE /api/ab-testing/tests/[testId] ───────────────────────────
describe('GET/PUT/DELETE /api/ab-testing/tests/[testId] — brand-scoped guard', () => {
  it('GET scopes the ownership guard to the active brand', async () => {
    await ONE_GET(req({ url: `http://localhost/api/ab-testing/tests/${TEST_ID}` }), params());
    const findArg = mockPrisma.aBTest.findFirst.mock.calls[0][0];
    expect(findArg.where).toMatchObject({ id: TEST_ID, ...BRAND_OWNERSHIP });
  });

  it('PUT scopes the ownership guard to the active brand', async () => {
    await ONE_PUT(
      req({ method: 'PUT', url: `http://localhost/api/ab-testing/tests/${TEST_ID}`, body: { status: 'paused' } }),
      params()
    );
    const findArg = mockPrisma.aBTest.findFirst.mock.calls[0][0];
    expect(findArg.where).toMatchObject({ id: TEST_ID, ...BRAND_OWNERSHIP });
  });

  it('DELETE scopes the ownership guard to the active brand', async () => {
    await ONE_DELETE(
      req({ method: 'DELETE', url: `http://localhost/api/ab-testing/tests/${TEST_ID}` }),
      params()
    );
    const findArg = mockPrisma.aBTest.findFirst.mock.calls[0][0];
    expect(findArg.where).toMatchObject({ id: TEST_ID, ...BRAND_OWNERSHIP });
  });

  it('cross-brand guard: a test owned under another brand is Not Found (404)', async () => {
    // The brand-scoped findFirst returns nothing because the test lives under a
    // different brand than the active one.
    mockPrisma.aBTest.findFirst.mockResolvedValue(null);
    const res = await ONE_GET(
      req({ url: `http://localhost/api/ab-testing/tests/${TEST_ID}` }),
      params()
    );
    expect(res.status).toBe(404);
  });

  it('no-org fallback: guard uses userId-only when no active brand', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValue(null);
    await ONE_GET(req({ url: `http://localhost/api/ab-testing/tests/${TEST_ID}` }), params());
    const findArg = mockPrisma.aBTest.findFirst.mock.calls[0][0];
    expect(findArg.where).toEqual({ id: TEST_ID, userId: USER_ID });
  });
});

// ── GET/POST /api/ab-testing/tests/[testId]/results ─────────────────────────
describe('GET/POST results — brand-scoped guard', () => {
  it('GET results scopes the test guard to the active brand', async () => {
    await RESULTS_GET(
      req({ url: `http://localhost/api/ab-testing/tests/${TEST_ID}/results` }),
      params()
    );
    const findArg = mockPrisma.aBTest.findFirst.mock.calls[0][0];
    expect(findArg.where).toMatchObject({ id: TEST_ID, ...BRAND_OWNERSHIP });
  });

  it('POST results scopes the test guard to the active brand', async () => {
    mockPrisma.aBTestVariant.update.mockResolvedValue({
      id: VARIANT_B, impressions: 10, engagement: 1, clicks: 1, conversions: 1,
    });
    mockPrisma.aBTestVariant.findMany.mockResolvedValue([
      { id: VARIANT_A, impressions: 10, conversions: 1 },
      { id: VARIANT_B, impressions: 10, conversions: 1 },
    ]);

    await RESULTS_POST(
      req({
        method: 'POST',
        url: `http://localhost/api/ab-testing/tests/${TEST_ID}/results`,
        body: { variantId: VARIANT_B, conversions: 1 },
      }),
      params()
    );
    const findArg = mockPrisma.aBTest.findFirst.mock.calls[0][0];
    expect(findArg.where).toMatchObject({ id: TEST_ID, ...BRAND_OWNERSHIP });
  });

  it('cross-brand: recording a result against another brand’s test is 404', async () => {
    mockPrisma.aBTest.findFirst.mockResolvedValue(null);
    const res = await RESULTS_POST(
      req({
        method: 'POST',
        url: `http://localhost/api/ab-testing/tests/${TEST_ID}/results`,
        body: { variantId: VARIANT_B, conversions: 1 },
      }),
      params()
    );
    expect(res.status).toBe(404);
    expect(mockPrisma.aBTestVariant.update).not.toHaveBeenCalled();
  });

  it('no-org fallback: results guard uses userId-only when no active brand', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValue(null);
    await RESULTS_GET(
      req({ url: `http://localhost/api/ab-testing/tests/${TEST_ID}/results` }),
      params()
    );
    const findArg = mockPrisma.aBTest.findFirst.mock.calls[0][0];
    expect(findArg.where).toEqual({ id: TEST_ID, userId: USER_ID });
  });
});
