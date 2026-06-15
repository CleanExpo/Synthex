/**
 * Behavioural coverage for the scheduled-reports brand-isolation fix (audit #7).
 *
 * BUG: the scheduled-report CRUD route (app/api/analytics/reports/scheduled)
 * scoped Report queries/mutations by `userId` ALONE, even though Report carries
 * an `organizationId` column (prisma/schema.prisma ~line 1103). A multi-business
 * owner who switched their active brand therefore saw and cancelled the SAME
 * user's scheduled reports across ALL their brands — no brand isolation. (This
 * is a different file from the report-GENERATOR query path org-scoped in #432.)
 *
 * FIX (mirrors #442): each ownership guard resolves the active brand via
 * getEffectiveOrganizationId(userId) and scopes the report lookup by BOTH the
 * owning user AND the active brand (organizationId), while preserving legacy
 * reports created before brand-scoping (organizationId === null) and the no-org
 * fallback (effective org null -> userId only). Create stamps the active brand.
 *
 * These tests drive the REAL handlers (POST create, GET list, DELETE cancel)
 * and assert the where-clause / data the route hands to Prisma.
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

const HOME_ORG = 'org-home';
const ACTIVE_BRAND = 'org-brand-b';
const USER_ID = 'u1';
const REPORT_ID = 'report-1';

// ── Prisma mock ───────────────────────────────────────────────────────────────
const mockPrisma = {
  report: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
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
}));

// ── Effective-org mock (the active brand) ──────────────────────────────────────
const mockGetEffectiveOrganizationId = jest.fn();
jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveOrganizationId: (...args: unknown[]) =>
    mockGetEffectiveOrganizationId(...args),
}));

// ── Security checker — allow by default ────────────────────────────────────────
// NOTE: jest config sets resetMocks:true, which wipes any implementation set on
// a jest.fn() inside a jest.mock factory. So we use plain (non-jest.fn) arrow
// functions that delegate to an outer mock whose result is (re)set in beforeEach.
const mockSecurityCheck = jest.fn();
jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: (...args: unknown[]) => mockSecurityCheck(...args),
    createSecureResponse: (body: unknown, status: number) => ({
      status,
      json: async () => body,
    }),
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_READ: {},
    AUTHENTICATED_WRITE: {},
  },
}));

// ── Audit logger — no-op ───────────────────────────────────────────────────────
jest.mock('@/lib/security/audit-logger', () => ({
  auditLogger: { log: async () => undefined },
}));

// ── Response optimizer — pass-through with status ──────────────────────────────
jest.mock('@/lib/api/response-optimizer', () => ({
  ResponseOptimizer: {
    createResponse: (body: unknown, opts?: { status?: number }) => ({
      status: opts?.status ?? 200,
      json: async () => body,
    }),
    createErrorResponse: (error: string, status: number) => ({
      status,
      json: async () => ({ error }),
    }),
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
}));

import {
  GET as LIST_GET,
  POST as LIST_POST,
  DELETE as CANCEL_DELETE,
} from '@/app/api/analytics/reports/scheduled/route';

function req(opts: { method?: string; body?: object; url?: string } = {}) {
  return createMockNextRequest({
    url: opts.url ?? 'http://localhost/api/analytics/reports/scheduled',
    method: opts.method ?? 'GET',
    body: opts.body,
  }) as never;
}

const validCreateBody = {
  config: { name: 'Weekly overview' },
  schedule: { frequency: 'weekly', time: '09:00', dayOfWeek: 1 },
  recipients: ['owner@example.com'],
  format: 'csv',
};

function ownedReport(extra: Record<string, unknown> = {}) {
  return {
    id: REPORT_ID,
    userId: USER_ID,
    organizationId: ACTIVE_BRAND,
    name: 'Weekly overview',
    type: 'scheduled',
    status: 'pending',
    format: 'csv',
    filters: { isActive: true, schedule: { frequency: 'weekly' } },
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
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
  mockSecurityCheck.mockResolvedValue({ allowed: true });
  mockGetUserId.mockResolvedValue(USER_ID);
  // Default: multi-business owner whose ACTIVE brand differs from their home org.
  mockGetEffectiveOrganizationId.mockResolvedValue(ACTIVE_BRAND);
  mockPrisma.report.findMany.mockResolvedValue([]);
  mockPrisma.report.count.mockResolvedValue(0);
  mockPrisma.report.findFirst.mockResolvedValue(ownedReport());
  mockPrisma.report.create.mockResolvedValue(ownedReport());
  mockPrisma.report.update.mockResolvedValue(ownedReport());
});

// ── GET /api/analytics/reports/scheduled (list) ─────────────────────────────
describe('GET /api/analytics/reports/scheduled — list scoped to active brand', () => {
  it('filters the list by the ACTIVE brand, not just userId', async () => {
    await LIST_GET(req());

    expect(mockGetEffectiveOrganizationId).toHaveBeenCalledWith(USER_ID);
    const findArg = mockPrisma.report.findMany.mock.calls[0][0];
    expect(findArg.where).toMatchObject({ ...BRAND_OWNERSHIP, type: 'scheduled' });
    // The count uses the same brand-scoped filter.
    const countArg = mockPrisma.report.count.mock.calls[0][0];
    expect(countArg.where).toMatchObject({ ...BRAND_OWNERSHIP, type: 'scheduled' });
  });

  it('does not leak across brands: active brand != home org changes the filter', async () => {
    await LIST_GET(req());
    const findArg = mockPrisma.report.findMany.mock.calls[0][0];
    // The home org must NOT appear; only the active brand (or legacy null).
    expect(JSON.stringify(findArg.where)).not.toContain(HOME_ORG);
    expect(JSON.stringify(findArg.where)).toContain(ACTIVE_BRAND);
  });

  it('legacy null-org reports remain visible via the OR carve-out', async () => {
    await LIST_GET(req());
    const findArg = mockPrisma.report.findMany.mock.calls[0][0];
    expect(findArg.where.OR).toContainEqual({ organizationId: null });
  });

  it('no-org fallback: effective org null -> userId-only filter preserved', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValue(null);
    await LIST_GET(req());
    const findArg = mockPrisma.report.findMany.mock.calls[0][0];
    expect(findArg.where).toEqual({ userId: USER_ID, type: 'scheduled' });
  });

  it('returns 401 and never queries when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await LIST_GET(req());
    expect(res.status).toBe(401);
    expect(mockPrisma.report.findMany).not.toHaveBeenCalled();
  });
});

// ── POST /api/analytics/reports/scheduled (create) ──────────────────────────
describe('POST /api/analytics/reports/scheduled — stamps the active brand', () => {
  it('stamps the new scheduled report with the active brand organizationId', async () => {
    const res = await LIST_POST(req({ method: 'POST', body: validCreateBody }));
    expect(res.status).toBe(201);
    expect(mockGetEffectiveOrganizationId).toHaveBeenCalledWith(USER_ID);
    const createArg = mockPrisma.report.create.mock.calls[0][0];
    expect(createArg.data.userId).toBe(USER_ID);
    expect(createArg.data.organizationId).toBe(ACTIVE_BRAND);
  });

  it('no-org fallback: organizationId stamped as null when no active brand', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValue(null);
    await LIST_POST(req({ method: 'POST', body: validCreateBody }));
    const createArg = mockPrisma.report.create.mock.calls[0][0];
    expect(createArg.data.organizationId).toBeNull();
  });
});

// ── DELETE /api/analytics/reports/scheduled (cancel) ────────────────────────
describe('DELETE /api/analytics/reports/scheduled — brand-scoped cancel guard', () => {
  const delUrl = `http://localhost/api/analytics/reports/scheduled?id=${REPORT_ID}`;

  it('scopes the cancel ownership guard to the active brand', async () => {
    await CANCEL_DELETE(req({ method: 'DELETE', url: delUrl }));
    const findArg = mockPrisma.report.findFirst.mock.calls[0][0];
    expect(findArg.where).toMatchObject({
      id: REPORT_ID,
      ...BRAND_OWNERSHIP,
      type: 'scheduled',
    });
  });

  it('cross-brand guard: cancelling another brand’s report is Not Found (404)', async () => {
    // The brand-scoped findFirst returns nothing because the report lives under
    // a different brand than the active one.
    mockPrisma.report.findFirst.mockResolvedValue(null);
    const res = await CANCEL_DELETE(req({ method: 'DELETE', url: delUrl }));
    expect(res.status).toBe(404);
    expect(mockPrisma.report.update).not.toHaveBeenCalled();
  });

  it('no-org fallback: guard uses userId-only when no active brand', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValue(null);
    await CANCEL_DELETE(req({ method: 'DELETE', url: delUrl }));
    const findArg = mockPrisma.report.findFirst.mock.calls[0][0];
    expect(findArg.where).toEqual({
      id: REPORT_ID,
      userId: USER_ID,
      type: 'scheduled',
    });
  });
});
