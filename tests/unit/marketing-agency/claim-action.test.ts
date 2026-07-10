/**
 * Unit test for the Marketing Agency Claim action API (SYN-977, SYN-MCP-001).
 *
 * Verifies POST /api/marketing-agency/claims/[id]/action via stubbed
 * request objects (the project's jest.setup.js Request shim conflicts
 * with `new NextRequest(new URL(...))`, so we construct minimal stubs
 * that satisfy the route's actual needs).
 *
 * SYN-MCP-001 semantics under test:
 *   - approve/reject write ONLY approvalStatus (+ approver provenance);
 *   - evidenceStatus is derived-only: approve upgrades it to 'verified' iff
 *     a sourceRef is linked, otherwise leaves it UNTOUCHED (the SYN-1079
 *     headline defect regression);
 *   - reject never touches evidenceStatus;
 *   - both verbs are owner-gated (403 for collaborators);
 *   - the mutation is an atomic org-scoped updateMany (id + organizationId).
 */

const findFirstClaim = jest.fn();
const updateManyClaim = jest.fn();
const findUniqueUser = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    marketingAgencyClaim: {
      findFirst: (...args: unknown[]) => findFirstClaim(...args),
      updateMany: (...args: unknown[]) => updateManyClaim(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => findUniqueUser(...args),
    },
  },
}));

const getUserIdMock = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => getUserIdMock(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  getUserIdMock.mockResolvedValue('user-1');
  // No membership row → owner (direct org creator) per resolveRole.
  findUniqueUser.mockResolvedValue({
    organizationId: 'org-1',
    teamMemberships: [],
  });
});

import { POST } from '@/app/api/marketing-agency/claims/[id]/action/route';

function makeRequest(claimId: string, body: unknown) {
  return {
    nextUrl: {
      pathname: `/api/marketing-agency/claims/${claimId}/action`,
      searchParams: new URLSearchParams(),
    },
    json: async () => body,
  } as unknown as Parameters<typeof POST>[0];
}

function baseClaim(overrides: Record<string, unknown> = {}) {
  return {
    id: 'claim-1',
    organizationId: 'org-1',
    sourceRefId: null,
    claimType: 'factual',
    approvalStatus: 'pending',
    evidenceStatus: 'blocked',
    statement: 'Some claim',
    metadata: {},
    ...overrides,
  };
}

/**
 * The route does findFirst (metadata read) → updateMany → findFirst (readback).
 * Queue both findFirst results.
 */
function primeClaim(
  claim: Record<string, unknown>,
  readback?: Record<string, unknown>
) {
  findFirstClaim.mockResolvedValueOnce(claim);
  findFirstClaim.mockResolvedValueOnce(readback ?? claim);
  updateManyClaim.mockResolvedValue({ count: 1 });
}

describe('POST /api/marketing-agency/claims/[id]/action', () => {
  test('REGRESSION (SYN-1079): approve with NO sourceRef → approved-but-unverified, evidenceStatus UNCHANGED', async () => {
    primeClaim(
      baseClaim({ sourceRefId: null, evidenceStatus: 'blocked' }),
      baseClaim({
        sourceRefId: null,
        evidenceStatus: 'blocked',
        approvalStatus: 'approved',
      })
    );

    const res = await POST(makeRequest('claim-1', { action: 'approve' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.claim).toMatchObject({
      id: 'claim-1',
      approvalStatus: 'approved',
      evidenceStatus: 'blocked',
    });

    const updateCall = updateManyClaim.mock.calls[0][0];
    expect(updateCall.data.approvalStatus).toBe('approved');
    expect(updateCall.data.approvedById).toBe('user-1');
    expect(updateCall.data.approvedAt).toBeInstanceOf(Date);
    // The headline invariant: approve must NOT write evidenceStatus when the
    // policy is unsatisfied (no sourceRef).
    expect(updateCall.data.evidenceStatus).toBeUndefined();
  });

  test('approve WITH sourceRef → approvalStatus approved AND policy-derived evidenceStatus verified', async () => {
    primeClaim(
      baseClaim({ sourceRefId: 'src-1', evidenceStatus: 'pending_evidence' }),
      baseClaim({
        sourceRefId: 'src-1',
        evidenceStatus: 'verified',
        approvalStatus: 'approved',
      })
    );

    const res = await POST(makeRequest('claim-1', { action: 'approve' }));
    expect(res.status).toBe(200);

    const updateCall = updateManyClaim.mock.calls[0][0];
    expect(updateCall.data.approvalStatus).toBe('approved');
    expect(updateCall.data.evidenceStatus).toBe('verified');
    const data = await res.json();
    expect(data.claim.approvalStatus).toBe('approved');
    expect(data.claim.evidenceStatus).toBe('verified');
  });

  test('approve preserves grandfathered legacy verified row (no downgrade re-derive)', async () => {
    // Legacy row: verified with NO sourceRef (backfilled, migratedLegacyVerified).
    primeClaim(
      baseClaim({
        sourceRefId: null,
        evidenceStatus: 'verified',
        metadata: { migratedLegacyVerified: true },
      })
    );

    const res = await POST(makeRequest('claim-1', { action: 'approve' }));
    expect(res.status).toBe(200);
    const updateCall = updateManyClaim.mock.calls[0][0];
    // Policy unsatisfied → evidenceStatus untouched → stays 'verified'.
    expect(updateCall.data.evidenceStatus).toBeUndefined();
    expect(updateCall.data.metadata.migratedLegacyVerified).toBe(true);
  });

  test('reject with comment → approvalStatus rejected, evidenceStatus NEVER touched, approver cleared', async () => {
    primeClaim(
      baseClaim(),
      baseClaim({ approvalStatus: 'rejected', evidenceStatus: 'blocked' })
    );

    const res = await POST(
      makeRequest('claim-1', {
        action: 'reject',
        comment: 'Not supported by source',
      })
    );
    expect(res.status).toBe(200);
    const updateCall = updateManyClaim.mock.calls[0][0];
    expect(updateCall.data.approvalStatus).toBe('rejected');
    expect(updateCall.data.evidenceStatus).toBeUndefined();
    expect(updateCall.data.approvedById).toBeNull();
    expect(updateCall.data.approvedAt).toBeNull();
    expect(updateCall.data.metadata.reviewLog[0].comment).toBe(
      'Not supported by source'
    );
  });

  test('reject without comment → 400', async () => {
    const res = await POST(makeRequest('claim-1', { action: 'reject' }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/comment is required/i);
    expect(updateManyClaim).not.toHaveBeenCalled();
  });

  test('collaborator → 403 on approve and reject (owner gate)', async () => {
    findUniqueUser.mockResolvedValue({
      organizationId: 'org-1',
      teamMemberships: [{ role: 'collaborator', organizationId: 'org-1' }],
    });

    const approveRes = await POST(
      makeRequest('claim-1', { action: 'approve' })
    );
    expect(approveRes.status).toBe(403);

    const rejectRes = await POST(
      makeRequest('claim-1', { action: 'reject', comment: 'nope' })
    );
    expect(rejectRes.status).toBe(403);

    expect(updateManyClaim).not.toHaveBeenCalled();
    expect(findFirstClaim).not.toHaveBeenCalled();
  });

  test('mutation is atomically org-scoped: updateMany where includes id AND organizationId', async () => {
    primeClaim(baseClaim());

    await POST(makeRequest('claim-1', { action: 'approve' }));
    const updateCall = updateManyClaim.mock.calls[0][0];
    expect(updateCall.where).toEqual({
      id: 'claim-1',
      organizationId: 'org-1',
    });
  });

  test('claim not owned by org → 404 (findFirst miss)', async () => {
    findFirstClaim.mockResolvedValue(null);
    const res = await POST(makeRequest('claim-x', { action: 'approve' }));
    expect(res.status).toBe(404);
    expect(updateManyClaim).not.toHaveBeenCalled();
  });

  test('updateMany count 0 (row moved org between read and write) → 404', async () => {
    findFirstClaim.mockResolvedValueOnce(baseClaim());
    updateManyClaim.mockResolvedValue({ count: 0 });
    const res = await POST(makeRequest('claim-1', { action: 'approve' }));
    expect(res.status).toBe(404);
  });

  test('existing reviewLog preserved on append + previous statuses recorded', async () => {
    const existingLog = [
      {
        action: 'approve',
        reviewedBy: 'user-old',
        reviewedAt: '2026-05-01T00:00:00.000Z',
        previousEvidenceStatus: 'pending',
        previousApprovalStatus: 'pending',
      },
    ];
    primeClaim(
      baseClaim({
        approvalStatus: 'approved',
        evidenceStatus: 'verified',
        metadata: { reviewLog: existingLog, otherField: 'preserve me' },
      })
    );

    const res = await POST(
      makeRequest('claim-1', {
        action: 'reject',
        comment: 'Disputed by new info',
      })
    );
    expect(res.status).toBe(200);
    const updateCall = updateManyClaim.mock.calls[0][0];
    expect(updateCall.data.metadata.reviewLog).toHaveLength(2);
    expect(updateCall.data.metadata.reviewLog[0]).toMatchObject({
      reviewedBy: 'user-old',
    });
    expect(updateCall.data.metadata.reviewLog[1]).toMatchObject({
      action: 'reject',
      comment: 'Disputed by new info',
      previousEvidenceStatus: 'verified',
      previousApprovalStatus: 'approved',
    });
    expect(updateCall.data.metadata.otherField).toBe('preserve me');
  });

  test('API response keeps evidenceStatus and adds approvalStatus (MCP back-compat)', async () => {
    primeClaim(
      baseClaim(),
      baseClaim({ approvalStatus: 'approved', evidenceStatus: 'blocked' })
    );

    const res = await POST(makeRequest('claim-1', { action: 'approve' }));
    const data = await res.json();
    expect(data.claim).toHaveProperty('evidenceStatus');
    expect(data.claim).toHaveProperty('approvalStatus');
    expect(data.claim).toHaveProperty('statement');
    expect(data.action).toBe('approve');
  });

  test('invalid action enum → 400', async () => {
    const res = await POST(makeRequest('claim-1', { action: 'discard' }));
    expect(res.status).toBe(400);
  });
});
