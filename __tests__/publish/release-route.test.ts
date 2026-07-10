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
 *
 * Everything is mocked — no prisma, no network.
 */

const mockGetUserId = jest.fn();
const mockUserFindUnique = jest.fn();
const mockUpdateMany = jest.fn();
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

// A $transaction impl that runs the callback with a tx exposing the two writes.
function wireTransaction(updateManyResult: { count: number }) {
  mockUpdateMany.mockResolvedValue(updateManyResult);
  mockAuditCreate.mockResolvedValue({ id: 'audit-1' });
  mockTransaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb({
      publishQueueItem: {
        updateMany: (...a: unknown[]) => mockUpdateMany(...a),
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

    // Atomic claim: scoped to org + gated status, transitions to pending.
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['q1', 'q2'] },
        organizationId: ORG_ID,
        status: 'queued_human_gated',
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
