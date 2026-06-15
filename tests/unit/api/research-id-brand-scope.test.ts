/**
 * Behavioural coverage for the research single-report brand-isolation fix
 * (brand-scope audit #6).
 *
 * BUG: app/api/research/[id]/route.ts scoped GEOResearchReport reads/updates/
 * deletes by `userId` ALONE, even though GEOResearchReport carries an
 * `organizationId` column. A multi-business owner who switched their active
 * brand could therefore read, update, and delete the SAME user's reports
 * across ALL their brands — no brand isolation.
 *
 * FIX: each handler resolves the active brand via getEffectiveOrganizationId
 * (userId) and scopes the report lookup by BOTH the owning user AND the active
 * brand (organizationId), while preserving legacy reports created before brand-
 * scoping (organizationId === null) and the no-org fallback (effective org null
 * -> userId only).
 *
 * These tests drive the REAL GET/PATCH/DELETE handlers and assert the
 * where-clause the route hands to Prisma.
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

const HOME_ORG = 'org-home';
const ACTIVE_BRAND = 'org-brand-b';
const USER_ID = 'u1';
const REPORT_ID = 7;

// ── Prisma mock ───────────────────────────────────────────────────────────────
const mockPrisma = {
  gEOResearchReport: {
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
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

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import {
  GET as ONE_GET,
  PATCH as ONE_PATCH,
  DELETE as ONE_DELETE,
} from '@/app/api/research/[id]/route';

function req(opts: { method?: string; body?: object; url?: string } = {}) {
  return createMockNextRequest({
    url: opts.url ?? `http://localhost/api/research/${REPORT_ID}`,
    method: opts.method ?? 'GET',
    body: opts.body,
  }) as never;
}

function params() {
  return { params: Promise.resolve({ id: String(REPORT_ID) }) } as never;
}

function ownedReport(extra: Record<string, unknown> = {}) {
  return {
    id: REPORT_ID,
    userId: USER_ID,
    organizationId: ACTIVE_BRAND,
    title: 'A research report',
    slug: 'a-research-report',
    status: 'draft',
    visuals: [],
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
  mockPrisma.gEOResearchReport.findFirst.mockResolvedValue(ownedReport());
  mockPrisma.gEOResearchReport.update.mockResolvedValue(ownedReport());
  mockPrisma.gEOResearchReport.delete.mockResolvedValue(ownedReport());
});

// ── GET /api/research/[id] ──────────────────────────────────────────────────
describe('GET /api/research/[id] — read scoped to active brand', () => {
  it('scopes the lookup to the ACTIVE brand, not just userId', async () => {
    await ONE_GET(req(), params());

    expect(mockGetEffectiveOrganizationId).toHaveBeenCalledWith(USER_ID);
    const findArg = mockPrisma.gEOResearchReport.findFirst.mock.calls[0][0];
    expect(findArg.where).toMatchObject({ id: REPORT_ID, ...BRAND_OWNERSHIP });
  });

  it('does not leak across brands: home org never appears in the filter', async () => {
    await ONE_GET(req(), params());
    const findArg = mockPrisma.gEOResearchReport.findFirst.mock.calls[0][0];
    expect(JSON.stringify(findArg.where)).not.toContain(HOME_ORG);
    expect(JSON.stringify(findArg.where)).toContain(ACTIVE_BRAND);
  });

  it('legacy null-org reports stay visible via the OR carve-out', async () => {
    await ONE_GET(req(), params());
    const findArg = mockPrisma.gEOResearchReport.findFirst.mock.calls[0][0];
    expect(findArg.where.OR).toContainEqual({ organizationId: null });
  });

  it('cross-brand guard: a report under another brand is Not Found (404)', async () => {
    // The brand-scoped findFirst returns nothing because the report lives under
    // a different brand than the active one.
    mockPrisma.gEOResearchReport.findFirst.mockResolvedValue(null);
    const res = await ONE_GET(req(), params());
    expect(res.status).toBe(404);
  });

  it('no-org fallback: effective org null -> userId-only filter preserved', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValue(null);
    await ONE_GET(req(), params());
    const findArg = mockPrisma.gEOResearchReport.findFirst.mock.calls[0][0];
    expect(findArg.where).toEqual({ id: REPORT_ID, userId: USER_ID });
  });

  it('returns 401 and never queries when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await ONE_GET(req(), params());
    expect(res.status).toBe(401);
    expect(mockPrisma.gEOResearchReport.findFirst).not.toHaveBeenCalled();
  });
});

// ── PATCH /api/research/[id] ────────────────────────────────────────────────
describe('PATCH /api/research/[id] — update scoped to active brand', () => {
  const validBody = { title: 'Updated research title' };

  it('scopes the ownership guard to the active brand before updating', async () => {
    await ONE_PATCH(req({ method: 'PATCH', body: validBody }), params());

    expect(mockGetEffectiveOrganizationId).toHaveBeenCalledWith(USER_ID);
    const findArg = mockPrisma.gEOResearchReport.findFirst.mock.calls[0][0];
    expect(findArg.where).toMatchObject({ id: REPORT_ID, ...BRAND_OWNERSHIP });
  });

  it('cross-brand guard: 404 and no update when report is under another brand', async () => {
    mockPrisma.gEOResearchReport.findFirst.mockResolvedValue(null);
    const res = await ONE_PATCH(
      req({ method: 'PATCH', body: validBody }),
      params()
    );
    expect(res.status).toBe(404);
    expect(mockPrisma.gEOResearchReport.update).not.toHaveBeenCalled();
  });

  it('no-org fallback: guard uses userId-only when no active brand', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValue(null);
    await ONE_PATCH(req({ method: 'PATCH', body: validBody }), params());
    const findArg = mockPrisma.gEOResearchReport.findFirst.mock.calls[0][0];
    expect(findArg.where).toEqual({ id: REPORT_ID, userId: USER_ID });
  });

  it('returns 401 and never queries when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await ONE_PATCH(
      req({ method: 'PATCH', body: validBody }),
      params()
    );
    expect(res.status).toBe(401);
    expect(mockPrisma.gEOResearchReport.findFirst).not.toHaveBeenCalled();
  });
});

// ── DELETE /api/research/[id] ───────────────────────────────────────────────
describe('DELETE /api/research/[id] — delete scoped to active brand', () => {
  it('scopes the ownership guard to the active brand before deleting', async () => {
    await ONE_DELETE(req({ method: 'DELETE' }), params());

    expect(mockGetEffectiveOrganizationId).toHaveBeenCalledWith(USER_ID);
    const findArg = mockPrisma.gEOResearchReport.findFirst.mock.calls[0][0];
    expect(findArg.where).toMatchObject({ id: REPORT_ID, ...BRAND_OWNERSHIP });
  });

  it('cross-brand guard: 404 and no delete when report is under another brand', async () => {
    mockPrisma.gEOResearchReport.findFirst.mockResolvedValue(null);
    const res = await ONE_DELETE(req({ method: 'DELETE' }), params());
    expect(res.status).toBe(404);
    expect(mockPrisma.gEOResearchReport.delete).not.toHaveBeenCalled();
  });

  it('no-org fallback: guard uses userId-only when no active brand', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValue(null);
    await ONE_DELETE(req({ method: 'DELETE' }), params());
    const findArg = mockPrisma.gEOResearchReport.findFirst.mock.calls[0][0];
    expect(findArg.where).toEqual({ id: REPORT_ID, userId: USER_ID });
  });

  it('returns 401 and never queries when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await ONE_DELETE(req({ method: 'DELETE' }), params());
    expect(res.status).toBe(401);
    expect(mockPrisma.gEOResearchReport.findFirst).not.toHaveBeenCalled();
  });
});
