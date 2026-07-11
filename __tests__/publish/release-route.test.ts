/**
 * Tests for the human publish-release route — SYN-1075 WS4b.
 *
 * Coverage (acceptance §15(6), §14 concurrency, §15(8) audit):
 *  - 401 unauthenticated
 *  - 400 invalid body (Zod)
 *  - 403 no organisation
 *  - 403 non-owner (owner/RBAC gate)
 *  - 200 owner release → atomic queued_human_gated→pending updateMany + audit row
 *  - org-scoped: cross-org item never matches (404, no side effect)
 *  - reject → queued_human_gated→held
 *  - concurrency: the loser of the atomic claim releases 0 (no double-publish)
 *  - SYN-1094 defense-in-depth: `unassigned`-platform cuts are skipped on
 *    release (never transitioned to pending), reported in `skippedUnassigned`;
 *    a mixed batch still releases the assignable cuts; reject is unaffected.
 *
 * Everything is mocked — no prisma, no network.
 */

const mockGetUserId = jest.fn();
const mockUserFindUnique = jest.fn();
const mockUpdateMany = jest.fn();
const mockFindMany = jest.fn();
const mockAuditCreate = jest.fn();
const mockTransaction = jest.fn();

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// writeDefault passthrough — exercise the handler directly.
jest.mock('@/lib/rate-limit', () => ({
  writeDefault: (_req: unknown, handler: () => Promise<unknown>) => handler(),
}));

jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserId(...args),
}));

// Real resolveRole logic, mocked to avoid pulling the auth import chain.
jest.mock('@/lib/auth/with-auth', () => ({
  resolveRole: (role?: string | null) =>
    role === undefined || role === null
      ? 'owner'
      : role === 'owner'
        ? 'owner'
        : 'collaborator',
}));

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
    $transaction: (...a: unknown[]) => mockTransaction(...a),
  },
}));

import { POST } from '@/app/api/publish-queue/release/route';

const ORG_ID = 'org-owner-1';

function makeRequest(body: unknown): Request {
  return {
    json: async () => body,
  } as unknown as Request;
}

// A $transaction impl that runs the callback with a tx exposing the reads/writes.
// `unassignedIds` seeds the findMany the release path uses to detect (and skip)
// `unassigned`-platform cuts; defaults to none.
function wireTransaction(
  updateManyResult: { count: number },
  unassignedIds: string[] = []
) {
  mockUpdateMany.mockResolvedValue(updateManyResult);
  mockFindMany.mockResolvedValue(unassignedIds.map(id => ({ id })));
  mockAuditCreate.mockResolvedValue({ id: 'audit-1' });
  mockTransaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb({
      publishQueueItem: {
        updateMany: (...a: unknown[]) => mockUpdateMany(...a),
        findMany: (...a: unknown[]) => mockFindMany(...a),
      },
      auditLog: { create: (...a: unknown[]) => mockAuditCreate(...a) },
    })
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/publish-queue/release — auth ladder', () => {
  it('401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await POST(makeRequest({ itemIds: ['q1'] }) as never);
    expect(res.status).toBe(401);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('400 when the body fails Zod validation', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    const res = await POST(makeRequest({ itemIds: [] }) as never);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Validation Error');
    expect(json.details).toBeDefined();
  });

  it('403 when the user has no organisation', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockUserFindUnique.mockResolvedValue({
      organizationId: null,
      teamMemberships: [],
    });
    const res = await POST(makeRequest({ itemIds: ['q1'] }) as never);
    expect(res.status).toBe(403);
  });

  it('403 when the user is a collaborator (not owner)', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockUserFindUnique.mockResolvedValue({
      organizationId: ORG_ID,
      teamMemberships: [{ role: 'collaborator', organizationId: ORG_ID }],
    });
    const res = await POST(makeRequest({ itemIds: ['q1'] }) as never);
    expect(res.status).toBe(403);
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});

describe('POST /api/publish-queue/release — owner happy path', () => {
  beforeEach(() => {
    mockGetUserId.mockResolvedValue('user-owner');
    mockUserFindUnique.mockResolvedValue({
      organizationId: ORG_ID,
      // no membership row → resolveRole → 'owner' (direct org owner)
      teamMemberships: [],
    });
  });

  it('200 releases gated cuts: queued_human_gated→pending + audit row', async () => {
    wireTransaction({ count: 2 });

    const res = await POST(
      makeRequest({ itemIds: ['q1', 'q2'], action: 'release' }) as never
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.released).toBe(2);
    // No unassigned cuts in this batch → nothing skipped.
    expect(json.skippedUnassigned).toEqual([]);

    // Atomic claim: scoped to org + gated status + assignable-platform only,
    // transitions to pending. The `platform !== unassigned` predicate is the
    // SYN-1094 server-side guard.
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['q1', 'q2'] },
        organizationId: ORG_ID,
        status: 'queued_human_gated',
        platform: { not: 'unassigned' },
      },
      data: expect.objectContaining({ status: 'pending' }),
    });

    // Audit row written in the same transaction.
    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'publish_queue_release',
          resource: 'publish_queue',
          userId: 'user-owner',
        }),
      })
    );
  });

  it('reject transitions gated cuts to held, never pending', async () => {
    wireTransaction({ count: 1 });

    const res = await POST(
      makeRequest({ itemIds: ['q1'], action: 'reject' }) as never
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.rejected).toBe(1);

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['q1'] },
        organizationId: ORG_ID,
        status: 'queued_human_gated',
      },
      data: expect.objectContaining({ status: 'held' }),
    });
    // The reject data block must NOT contain a pending transition.
    const dataArg = mockUpdateMany.mock.calls[0][0].data;
    expect(dataArg.status).not.toBe('pending');
  });

  it('404 when nothing matches (cross-org / already released) — no leak', async () => {
    wireTransaction({ count: 0 });

    const res = await POST(
      makeRequest({ itemIds: ['other-org-item'] }) as never
    );

    expect(res.status).toBe(404);
    // The org filter is always applied so a cross-org id cannot be actioned.
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: ORG_ID }),
      })
    );
  });

  it('concurrency: the loser of the atomic claim releases 0 (no double-publish)', async () => {
    // First release wins both rows; a concurrent second release for the same
    // ids finds them no longer queued_human_gated → count 0 → 404.
    wireTransaction({ count: 2 });
    const first = await POST(makeRequest({ itemIds: ['q1', 'q2'] }) as never);
    expect(first.status).toBe(200);

    mockUpdateMany.mockResolvedValueOnce({ count: 0 });
    const second = await POST(makeRequest({ itemIds: ['q1', 'q2'] }) as never);
    expect(second.status).toBe(404);
  });
});

describe('POST /api/publish-queue/release — SYN-1094 unassigned guard', () => {
  beforeEach(() => {
    mockGetUserId.mockResolvedValue('user-owner');
    mockUserFindUnique.mockResolvedValue({
      organizationId: ORG_ID,
      teamMemberships: [],
    });
  });

  it('mixed batch: releases assignable cuts, skips the unassigned one', async () => {
    // q1 = assignable (transitions), q2 = unassigned (skipped, stays gated).
    // updateMany claims only q1 (count 1); findMany reports q2 as unassigned.
    wireTransaction({ count: 1 }, ['q2']);

    const res = await POST(
      makeRequest({ itemIds: ['q1', 'q2'], action: 'release' }) as never
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.released).toBe(1);
    expect(json.skippedUnassigned).toEqual(['q2']);

    // The transition query excludes unassigned rows → the unassigned id can
    // never reach `pending` (§15.9 gate is only NARROWED, never widened).
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['q1', 'q2'] },
        organizationId: ORG_ID,
        status: 'queued_human_gated',
        platform: { not: 'unassigned' },
      },
      data: expect.objectContaining({ status: 'pending' }),
    });

    // Audit trail records which ids were skipped for observability.
    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          details: expect.objectContaining({ skippedUnassignedIds: ['q2'] }),
        }),
      })
    );
  });

  it('all-unassigned batch: 200 skip-and-report, releases 0, not a 404', async () => {
    // No row transitions (count 0) but the caller's own gated-unassigned cuts
    // exist → skip-and-report, NOT the not-found path.
    wireTransaction({ count: 0 }, ['q1', 'q2']);

    const res = await POST(
      makeRequest({ itemIds: ['q1', 'q2'], action: 'release' }) as never
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.released).toBe(0);
    expect(json.skippedUnassigned).toEqual(['q1', 'q2']);
  });

  it('reject is unaffected: an unassigned cut can still be parked to held', async () => {
    // Reject must NOT add the platform predicate — parking an unassigned cut is
    // fine. findMany is release-only, so it is never consulted here.
    wireTransaction({ count: 1 });

    const res = await POST(
      makeRequest({ itemIds: ['q-unassigned'], action: 'reject' }) as never
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.rejected).toBe(1);
    expect(json.skippedUnassigned).toEqual([]);

    // No platform filter on reject — the where clause is the original 3 keys.
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['q-unassigned'] },
        organizationId: ORG_ID,
        status: 'queued_human_gated',
      },
      data: expect.objectContaining({ status: 'held' }),
    });
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('genuine not-found still 404: no rows matched and nothing skipped', async () => {
    // Non-existent / cross-org ids: updateMany count 0 AND no unassigned rows
    // found → the no-leak 404 is preserved.
    wireTransaction({ count: 0 }, []);

    const res = await POST(
      makeRequest({ itemIds: ['ghost-id'], action: 'release' }) as never
    );

    expect(res.status).toBe(404);
  });
});
