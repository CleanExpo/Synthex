/**
 * Behavioural coverage for the content-drafts brand-isolation fix.
 *
 * BUG: the content-drafts routes scoped every ContentDraft query/mutation by
 * `userId` ALONE, even though ContentDraft carries an `organizationId` column.
 * A multi-business owner who switched their active brand therefore saw and
 * mutated the SAME user's drafts across ALL their brands — no brand isolation.
 *
 * FIX: each query resolves the active brand via getEffectiveOrganizationId(
 * userId) and scopes the draft lookup by BOTH the owning user AND the active
 * brand (organizationId), while preserving legacy drafts created before
 * brand-scoping (organizationId === null) and the no-org fallback (effective
 * org null -> userId only). Create stamps the active brand.
 *
 * These tests drive the REAL handlers (GET/POST list, PATCH/DELETE single) and
 * assert the where-clause the route hands to Prisma.
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

const HOME_ORG = 'org-home';
const ACTIVE_BRAND = 'org-brand-b';
const USER_ID = 'u1';
const DRAFT_ID = 'draft-1';

// ── Prisma mock ───────────────────────────────────────────────────────────────
const mockPrisma = {
  contentDraft: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
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

import { GET as LIST_GET, POST as LIST_POST } from '@/app/api/content-drafts/route';
import {
  PATCH as ONE_PATCH,
  DELETE as ONE_DELETE,
} from '@/app/api/content-drafts/[id]/route';

function req(opts: { method?: string; body?: object; url?: string } = {}) {
  return createMockNextRequest({
    url: opts.url ?? 'http://localhost/api/content-drafts',
    method: opts.method ?? 'GET',
    body: opts.body,
  }) as never;
}

function params() {
  return { params: Promise.resolve({ id: DRAFT_ID }) } as never;
}

function ownedDraft(extra: Record<string, unknown> = {}) {
  return {
    id: DRAFT_ID,
    userId: USER_ID,
    organizationId: ACTIVE_BRAND,
    platform: 'twitter',
    content: 'hello',
    title: 'A draft',
    status: 'draft',
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
  mockPrisma.contentDraft.findMany.mockResolvedValue([]);
  mockPrisma.contentDraft.count.mockResolvedValue(0);
  mockPrisma.contentDraft.findFirst.mockResolvedValue(ownedDraft());
  mockPrisma.contentDraft.create.mockResolvedValue(ownedDraft());
  mockPrisma.contentDraft.update.mockResolvedValue(ownedDraft());
  mockPrisma.contentDraft.delete.mockResolvedValue(ownedDraft());
});

// ── GET /api/content-drafts (list) ──────────────────────────────────────────
describe('GET /api/content-drafts — list scoped to active brand', () => {
  it('filters the list AND count by the ACTIVE brand, not just userId', async () => {
    await LIST_GET(req());

    expect(mockGetEffectiveOrganizationId).toHaveBeenCalledWith(USER_ID);
    const findArg = mockPrisma.contentDraft.findMany.mock.calls[0][0];
    expect(findArg.where).toMatchObject(BRAND_OWNERSHIP);
    // The count uses the same brand-scoped filter.
    const countArg = mockPrisma.contentDraft.count.mock.calls[0][0];
    expect(countArg.where).toMatchObject(BRAND_OWNERSHIP);
  });

  it('does not leak across brands: home org never appears in the filter', async () => {
    await LIST_GET(req());
    const findArg = mockPrisma.contentDraft.findMany.mock.calls[0][0];
    expect(JSON.stringify(findArg.where)).not.toContain(HOME_ORG);
    expect(JSON.stringify(findArg.where)).toContain(ACTIVE_BRAND);
  });

  it('legacy null-org drafts remain visible via the OR carve-out', async () => {
    await LIST_GET(req());
    const findArg = mockPrisma.contentDraft.findMany.mock.calls[0][0];
    expect(findArg.where.OR).toContainEqual({ organizationId: null });
  });

  it('no-org fallback: effective org null -> userId-only filter preserved', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValue(null);
    await LIST_GET(req());
    const findArg = mockPrisma.contentDraft.findMany.mock.calls[0][0];
    expect(findArg.where).toEqual({ userId: USER_ID });
    const countArg = mockPrisma.contentDraft.count.mock.calls[0][0];
    expect(countArg.where).toEqual({ userId: USER_ID });
  });

  it('returns 401 and never queries when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await LIST_GET(req());
    expect(res.status).toBe(401);
    expect(mockPrisma.contentDraft.findMany).not.toHaveBeenCalled();
  });
});

// ── POST /api/content-drafts (create) ───────────────────────────────────────
describe('POST /api/content-drafts — stamps the active brand', () => {
  const validBody = { platform: 'twitter', content: 'hello world' };

  it('stamps the new draft with the active brand organizationId', async () => {
    const res = await LIST_POST(req({ method: 'POST', body: validBody }));
    expect(res.status).toBe(201);
    expect(mockGetEffectiveOrganizationId).toHaveBeenCalledWith(USER_ID);
    const createArg = mockPrisma.contentDraft.create.mock.calls[0][0];
    expect(createArg.data.userId).toBe(USER_ID);
    expect(createArg.data.organizationId).toBe(ACTIVE_BRAND);
  });

  it('no-org fallback: organizationId stamped as null when no active brand', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValue(null);
    await LIST_POST(req({ method: 'POST', body: validBody }));
    const createArg = mockPrisma.contentDraft.create.mock.calls[0][0];
    expect(createArg.data.organizationId).toBeNull();
  });
});

// ── PATCH/DELETE /api/content-drafts/[id] ───────────────────────────────────
describe('PATCH/DELETE /api/content-drafts/[id] — brand-scoped guard', () => {
  it('PATCH scopes the ownership guard to the active brand', async () => {
    await ONE_PATCH(
      req({
        method: 'PATCH',
        url: `http://localhost/api/content-drafts/${DRAFT_ID}`,
        body: { status: 'scheduled' },
      }),
      params()
    );
    const findArg = mockPrisma.contentDraft.findFirst.mock.calls[0][0];
    expect(findArg.where).toMatchObject({ id: DRAFT_ID, ...BRAND_OWNERSHIP });
  });

  it('DELETE scopes the ownership guard to the active brand', async () => {
    await ONE_DELETE(
      req({
        method: 'DELETE',
        url: `http://localhost/api/content-drafts/${DRAFT_ID}`,
      }),
      params()
    );
    const findArg = mockPrisma.contentDraft.findFirst.mock.calls[0][0];
    expect(findArg.where).toMatchObject({ id: DRAFT_ID, ...BRAND_OWNERSHIP });
  });

  it('cross-brand guard: a draft owned under another brand is Not Found (404)', async () => {
    // The brand-scoped findFirst returns nothing because the draft lives under
    // a different brand than the active one.
    mockPrisma.contentDraft.findFirst.mockResolvedValue(null);
    const res = await ONE_PATCH(
      req({
        method: 'PATCH',
        url: `http://localhost/api/content-drafts/${DRAFT_ID}`,
        body: { status: 'scheduled' },
      }),
      params()
    );
    expect(res.status).toBe(404);
    expect(mockPrisma.contentDraft.update).not.toHaveBeenCalled();
  });

  it('cross-brand DELETE: another brand’s draft is 404 and never deleted', async () => {
    mockPrisma.contentDraft.findFirst.mockResolvedValue(null);
    const res = await ONE_DELETE(
      req({
        method: 'DELETE',
        url: `http://localhost/api/content-drafts/${DRAFT_ID}`,
      }),
      params()
    );
    expect(res.status).toBe(404);
    expect(mockPrisma.contentDraft.delete).not.toHaveBeenCalled();
  });

  it('no-org fallback: guard uses userId-only when no active brand', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValue(null);
    await ONE_PATCH(
      req({
        method: 'PATCH',
        url: `http://localhost/api/content-drafts/${DRAFT_ID}`,
        body: { status: 'scheduled' },
      }),
      params()
    );
    const findArg = mockPrisma.contentDraft.findFirst.mock.calls[0][0];
    expect(findArg.where).toEqual({ id: DRAFT_ID, userId: USER_ID });
  });
});
