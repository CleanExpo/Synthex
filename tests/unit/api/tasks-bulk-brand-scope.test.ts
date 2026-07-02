/**
 * Behavioural coverage for the tasks/bulk brand-isolation fix (audit #10).
 *
 * BUG: the tasks/bulk route scoped Task ownership checks by `userId` ALONE
 * (`prisma.task.findMany({ where: { id: { in } }, select: { id, userId } })`
 * then `t.userId === userId`), even though Task carries an `organizationId`
 * column. A multi-business owner who switched their active brand could
 * therefore reorder/update/delete the SAME user's tasks across ALL their
 * brands — no brand isolation. The bulk updateMany/deleteMany were likewise
 * keyed by id alone.
 *
 * FIX: each guard now resolves the active brand via
 * getEffectiveOrganizationId(userId) and scopes the lookup (and the
 * updateMany/deleteMany) by BOTH the owning user AND the active brand
 * (organizationId), while preserving legacy tasks created before brand-scoping
 * (organizationId === null) and the no-org fallback (effective org null ->
 * userId only).
 *
 * These tests drive the REAL handlers (PATCH reorder, PATCH bulk-update,
 * DELETE) and assert the where-clause the route hands to Prisma.
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

const HOME_ORG = 'org-home';
const ACTIVE_BRAND = 'org-brand-b';
const USER_ID = 'u1';
const TASK_A = 'task-a';
const TASK_B = 'task-b';

// ── Prisma mock ───────────────────────────────────────────────────────────────
const mockPrisma = {
  task: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
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

import { PATCH, DELETE } from '@/app/api/tasks/bulk/route';

function req(opts: { method?: string; body?: object } = {}) {
  return createMockNextRequest({
    url: 'http://localhost/api/tasks/bulk',
    method: opts.method ?? 'PATCH',
    body: opts.body,
  }) as never;
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
  // Default: both requested tasks resolve under the active brand.
  mockPrisma.task.findMany.mockResolvedValue([{ id: TASK_A }, { id: TASK_B }]);
  mockPrisma.task.updateMany.mockResolvedValue({ count: 2 });
  mockPrisma.task.deleteMany.mockResolvedValue({ count: 2 });
  mockPrisma.$transaction.mockResolvedValue([]);
});

// ── PATCH reorder ───────────────────────────────────────────────────────────
describe('PATCH /api/tasks/bulk (reorder) — scoped to active brand', () => {
  const reorderBody = {
    tasks: [
      { id: TASK_A, order: 0 },
      { id: TASK_B, order: 1 },
    ],
  };

  it('scopes the ownership lookup by the ACTIVE brand, not just userId', async () => {
    const res = await PATCH(req({ body: reorderBody }));
    expect(res.status).toBe(200);
    expect(mockGetEffectiveOrganizationId).toHaveBeenCalledWith(USER_ID);
    const findArg = mockPrisma.task.findMany.mock.calls[0][0];
    expect(findArg.where).toMatchObject({
      id: { in: [TASK_A, TASK_B] },
      ...BRAND_OWNERSHIP,
    });
  });

  it('does not leak across brands: home org never appears in the filter', async () => {
    await PATCH(req({ body: reorderBody }));
    const findArg = mockPrisma.task.findMany.mock.calls[0][0];
    expect(JSON.stringify(findArg.where)).not.toContain(HOME_ORG);
    expect(JSON.stringify(findArg.where)).toContain(ACTIVE_BRAND);
  });

  it('cross-brand guard: a task under another brand is not returned -> 403', async () => {
    // The brand-scoped findMany only sees TASK_A (TASK_B lives under another brand).
    mockPrisma.task.findMany.mockResolvedValue([{ id: TASK_A }]);
    const res = await PATCH(req({ body: reorderBody }));
    expect(res.status).toBe(403);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('no-org fallback: effective org null -> userId-only filter preserved', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValue(null);
    await PATCH(req({ body: reorderBody }));
    const findArg = mockPrisma.task.findMany.mock.calls[0][0];
    expect(findArg.where).toEqual({ id: { in: [TASK_A, TASK_B] }, userId: USER_ID });
  });
});

// ── PATCH bulk-update ───────────────────────────────────────────────────────
describe('PATCH /api/tasks/bulk (update) — scoped to active brand', () => {
  const updateBody = {
    taskIds: [TASK_A, TASK_B],
    updates: { status: 'done' },
  };

  it('scopes BOTH the ownership lookup and updateMany by the active brand', async () => {
    const res = await PATCH(req({ body: updateBody }));
    expect(res.status).toBe(200);
    const findArg = mockPrisma.task.findMany.mock.calls[0][0];
    expect(findArg.where).toMatchObject({
      id: { in: [TASK_A, TASK_B] },
      ...BRAND_OWNERSHIP,
    });
    const updateArg = mockPrisma.task.updateMany.mock.calls[0][0];
    expect(updateArg.where).toMatchObject({
      id: { in: [TASK_A, TASK_B] },
      ...BRAND_OWNERSHIP,
    });
  });

  it('cross-brand guard: a task under another brand -> 403, no updateMany', async () => {
    mockPrisma.task.findMany.mockResolvedValue([{ id: TASK_A }]);
    const res = await PATCH(req({ body: updateBody }));
    expect(res.status).toBe(403);
    expect(mockPrisma.task.updateMany).not.toHaveBeenCalled();
  });

  it('no-org fallback: userId-only filter on both lookup and updateMany', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValue(null);
    await PATCH(req({ body: updateBody }));
    const findArg = mockPrisma.task.findMany.mock.calls[0][0];
    expect(findArg.where).toEqual({ id: { in: [TASK_A, TASK_B] }, userId: USER_ID });
    const updateArg = mockPrisma.task.updateMany.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: { in: [TASK_A, TASK_B] }, userId: USER_ID });
  });

  it('returns 401 and never queries when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await PATCH(req({ body: updateBody }));
    expect(res.status).toBe(401);
    expect(mockPrisma.task.findMany).not.toHaveBeenCalled();
  });
});

// ── DELETE bulk-delete ──────────────────────────────────────────────────────
describe('DELETE /api/tasks/bulk — scoped to active brand', () => {
  const deleteBody = { taskIds: [TASK_A, TASK_B] };

  it('scopes BOTH the ownership lookup and deleteMany by the active brand', async () => {
    const res = await DELETE(req({ method: 'DELETE', body: deleteBody }));
    expect(res.status).toBe(200);
    const findArg = mockPrisma.task.findMany.mock.calls[0][0];
    expect(findArg.where).toMatchObject({
      id: { in: [TASK_A, TASK_B] },
      ...BRAND_OWNERSHIP,
    });
    const deleteArg = mockPrisma.task.deleteMany.mock.calls[0][0];
    expect(deleteArg.where).toMatchObject({
      id: { in: [TASK_A, TASK_B] },
      ...BRAND_OWNERSHIP,
    });
  });

  it('cross-brand guard: a task under another brand -> 403, no deleteMany', async () => {
    mockPrisma.task.findMany.mockResolvedValue([{ id: TASK_A }]);
    const res = await DELETE(req({ method: 'DELETE', body: deleteBody }));
    expect(res.status).toBe(403);
    expect(mockPrisma.task.deleteMany).not.toHaveBeenCalled();
  });

  it('no-org fallback: userId-only filter on both lookup and deleteMany', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValue(null);
    await DELETE(req({ method: 'DELETE', body: deleteBody }));
    const findArg = mockPrisma.task.findMany.mock.calls[0][0];
    expect(findArg.where).toEqual({ id: { in: [TASK_A, TASK_B] }, userId: USER_ID });
    const deleteArg = mockPrisma.task.deleteMany.mock.calls[0][0];
    expect(deleteArg.where).toEqual({ id: { in: [TASK_A, TASK_B] }, userId: USER_ID });
  });

  it('returns 401 and never queries when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await DELETE(req({ method: 'DELETE', body: deleteBody }));
    expect(res.status).toBe(401);
    expect(mockPrisma.task.findMany).not.toHaveBeenCalled();
  });
});
