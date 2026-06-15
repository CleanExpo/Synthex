/**
 * Behavioural coverage for the web-projects brand-isolation fix.
 *
 * BUG: every web-projects route scoped Project queries/mutations by `userId`
 * ALONE, even though Project carries an `organizationId` column. A
 * multi-business owner who switched their active brand therefore saw and
 * mutated the SAME user's web-design projects across ALL their brands — no
 * brand isolation.
 *
 * FIX: each ownership guard now resolves the active brand via
 * getEffectiveOrganizationId(userId) and scopes the project lookup by BOTH the
 * owning user AND the active brand (organizationId), while preserving legacy
 * projects created before brand-scoping (organizationId === null) and the
 * no-org fallback (effective org null -> userId only). Create stamps the
 * active brand.
 *
 * These tests drive the REAL handlers (GET/POST list, GET/PATCH/DELETE single)
 * and assert the where-clause / create data the route hands to Prisma.
 */

import { createMockNextRequest } from '../../helpers/mock-request';

const HOME_ORG = 'org-home';
const ACTIVE_BRAND = 'org-brand-b';
const USER_ID = 'u1';
const PROJECT_ID = 'proj-1';

// ── Prisma mock (route imports the DEFAULT export) ────────────────────────────
const mockPrisma = {
  project: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
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
  unauthorizedResponse: () => ({
    status: 401,
    json: async () => ({ error: 'Authentication required' }),
  }),
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

import { GET as LIST_GET, POST as LIST_POST } from '@/app/api/web-projects/route';
import {
  GET as ONE_GET,
  PATCH as ONE_PATCH,
  DELETE as ONE_DELETE,
} from '@/app/api/web-projects/[id]/route';

function req(opts: { method?: string; body?: object; url?: string } = {}) {
  return createMockNextRequest({
    url: opts.url ?? 'http://localhost/api/web-projects',
    method: opts.method ?? 'GET',
    body: opts.body,
  }) as never;
}

function params() {
  return { params: Promise.resolve({ id: PROJECT_ID }) } as never;
}

function ownedProject(extra: Record<string, unknown> = {}) {
  return {
    id: PROJECT_ID,
    userId: USER_ID,
    organizationId: ACTIVE_BRAND,
    type: 'webdesign',
    name: 'Site',
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
  mockPrisma.project.findMany.mockResolvedValue([]);
  mockPrisma.project.findFirst.mockResolvedValue(ownedProject());
  mockPrisma.project.create.mockResolvedValue(ownedProject());
  mockPrisma.project.update.mockResolvedValue(ownedProject());
  mockPrisma.project.delete.mockResolvedValue(ownedProject());
});

// ── GET /api/web-projects (list) ────────────────────────────────────────────
describe('GET /api/web-projects — list scoped to active brand', () => {
  it('filters the list by the ACTIVE brand, not just userId', async () => {
    await LIST_GET(req());

    expect(mockGetEffectiveOrganizationId).toHaveBeenCalledWith(USER_ID);
    const findArg = mockPrisma.project.findMany.mock.calls[0][0];
    expect(findArg.where).toMatchObject(BRAND_OWNERSHIP);
    // The type filter is preserved alongside the brand scope.
    expect(findArg.where.type).toBe('webdesign');
  });

  it('keeps legacy null-org projects visible via the OR carve-out', async () => {
    await LIST_GET(req());
    const findArg = mockPrisma.project.findMany.mock.calls[0][0];
    expect(findArg.where.OR).toContainEqual({ organizationId: null });
  });

  it('does not leak across brands: home org never appears in the filter', async () => {
    await LIST_GET(req());
    const findArg = mockPrisma.project.findMany.mock.calls[0][0];
    expect(JSON.stringify(findArg.where)).not.toContain(HOME_ORG);
    expect(JSON.stringify(findArg.where)).toContain(ACTIVE_BRAND);
  });

  it('no-org fallback: effective org null -> userId-only filter preserved', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValue(null);
    await LIST_GET(req());
    const findArg = mockPrisma.project.findMany.mock.calls[0][0];
    expect(findArg.where).toEqual({ userId: USER_ID, type: 'webdesign' });
  });

  it('returns 401 and never queries when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await LIST_GET(req());
    expect(res.status).toBe(401);
    expect(mockPrisma.project.findMany).not.toHaveBeenCalled();
  });
});

// ── POST /api/web-projects (create) ─────────────────────────────────────────
describe('POST /api/web-projects — stamps the active brand', () => {
  const validBody = { name: 'New site', status: 'draft' };

  it('stamps the new project with the active brand organizationId', async () => {
    const res = await LIST_POST(req({ method: 'POST', body: validBody }));
    expect(res.status).toBe(201);
    expect(mockGetEffectiveOrganizationId).toHaveBeenCalledWith(USER_ID);
    const createArg = mockPrisma.project.create.mock.calls[0][0];
    expect(createArg.data.organizationId).toBe(ACTIVE_BRAND);
    expect(createArg.data.userId).toBe(USER_ID);
  });

  it('no-org fallback: effective org null -> organizationId null on create', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValue(null);
    await LIST_POST(req({ method: 'POST', body: validBody }));
    const createArg = mockPrisma.project.create.mock.calls[0][0];
    expect(createArg.data.organizationId).toBeNull();
  });

  it('returns 400 on invalid body and never creates', async () => {
    const res = await LIST_POST(req({ method: 'POST', body: { name: '' } }));
    expect(res.status).toBe(400);
    expect(mockPrisma.project.create).not.toHaveBeenCalled();
  });
});

// ── GET /api/web-projects/[id] (read) ────────────────────────────────────────
describe('GET /api/web-projects/[id] — read scoped to active brand', () => {
  it('scopes the lookup by the active brand, not just userId', async () => {
    await ONE_GET(req(), params());
    expect(mockGetEffectiveOrganizationId).toHaveBeenCalledWith(USER_ID);
    const findArg = mockPrisma.project.findFirst.mock.calls[0][0];
    expect(findArg.where).toMatchObject({ id: PROJECT_ID, ...BRAND_OWNERSHIP });
    expect(findArg.where.type).toBe('webdesign');
  });

  it('no-org fallback: effective org null -> userId-only lookup', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValue(null);
    await ONE_GET(req(), params());
    const findArg = mockPrisma.project.findFirst.mock.calls[0][0];
    expect(findArg.where).toEqual({
      id: PROJECT_ID,
      userId: USER_ID,
      type: 'webdesign',
    });
  });

  it("returns 404 when the project is outside the active brand", async () => {
    mockPrisma.project.findFirst.mockResolvedValue(null);
    const res = await ONE_GET(req(), params());
    expect(res.status).toBe(404);
  });
});

// ── PATCH /api/web-projects/[id] (update) ────────────────────────────────────
describe('PATCH /api/web-projects/[id] — update scoped to active brand', () => {
  it('verifies ownership against the active brand before updating', async () => {
    const res = await ONE_PATCH(
      req({ method: 'PATCH', body: { name: 'Renamed' } }),
      params()
    );
    expect(res.status).toBe(200);
    const findArg = mockPrisma.project.findFirst.mock.calls[0][0];
    expect(findArg.where).toMatchObject({ id: PROJECT_ID, ...BRAND_OWNERSHIP });
  });

  it('returns 404 and never updates a project outside the active brand', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(null);
    const res = await ONE_PATCH(
      req({ method: 'PATCH', body: { name: 'Renamed' } }),
      params()
    );
    expect(res.status).toBe(404);
    expect(mockPrisma.project.update).not.toHaveBeenCalled();
  });
});

// ── DELETE /api/web-projects/[id] (delete) ───────────────────────────────────
describe('DELETE /api/web-projects/[id] — delete scoped to active brand', () => {
  it('verifies ownership against the active brand before deleting', async () => {
    const res = await ONE_DELETE(req({ method: 'DELETE' }), params());
    expect(res.status).toBe(200);
    const findArg = mockPrisma.project.findFirst.mock.calls[0][0];
    expect(findArg.where).toMatchObject({ id: PROJECT_ID, ...BRAND_OWNERSHIP });
    expect(mockPrisma.project.delete).toHaveBeenCalledWith({
      where: { id: PROJECT_ID },
    });
  });

  it('returns 404 and never deletes a project outside the active brand', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(null);
    const res = await ONE_DELETE(req({ method: 'DELETE' }), params());
    expect(res.status).toBe(404);
    expect(mockPrisma.project.delete).not.toHaveBeenCalled();
  });
});
