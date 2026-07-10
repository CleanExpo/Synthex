/**
 * Unit test for POST /api/marketing-agency/claims/[id]/verify
 * (SYN-MCP-006 wiring).
 *
 * Same stubbed-request pattern as claim-action.test.ts. Pins:
 *   - 202 + jobId on success, verify-claim job enqueued with jobData built
 *     ONLY from the withAuth context (must_fix org-from-auth);
 *   - cross-tenant claimId → 404, nothing enqueued;
 *   - collaborator → 403 (owner-only, mirroring the action route);
 *   - the route NEVER writes evidenceStatus (no claim mutation at all).
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

const queueVerifyClaimMock = jest.fn();
const registerVerifyClaimHandlerMock = jest.fn();
jest.mock('@/lib/evidence/verify-claim-job', () => ({
  queueVerifyClaim: (...args: unknown[]) => queueVerifyClaimMock(...args),
  registerVerifyClaimHandler: (...args: unknown[]) =>
    registerVerifyClaimHandlerMock(...args),
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
  queueVerifyClaimMock.mockResolvedValue({ id: 'job-1', status: 'pending' });
});

import { POST } from '@/app/api/marketing-agency/claims/[id]/verify/route';

function makeRequest(claimId: string) {
  return {
    nextUrl: {
      pathname: `/api/marketing-agency/claims/${claimId}/verify`,
      searchParams: new URLSearchParams(),
    },
    json: async () => ({}),
  } as unknown as Parameters<typeof POST>[0];
}

describe('POST /api/marketing-agency/claims/[id]/verify', () => {
  test('owner + in-org claim → 202 with jobId; job data from auth context only', async () => {
    findFirstClaim.mockResolvedValue({ id: 'claim-1' });

    const res = await POST(makeRequest('claim-1'));
    expect(res.status).toBe(202);
    const data = await res.json();
    expect(data).toMatchObject({ success: true, jobId: 'job-1' });

    // Org-scoped existence check.
    expect(findFirstClaim).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'claim-1', organizationId: 'org-1' },
      })
    );
    // Handler registered before enqueue; job data comes from withAuth context.
    expect(registerVerifyClaimHandlerMock).toHaveBeenCalledTimes(1);
    expect(queueVerifyClaimMock).toHaveBeenCalledWith({
      claimId: 'claim-1',
      organizationId: 'org-1',
      userId: 'user-1',
    });
    // The route NEVER touches the claim row (no evidenceStatus write).
    expect(updateManyClaim).not.toHaveBeenCalled();
  });

  test('cross-tenant claimId → 404, nothing enqueued', async () => {
    findFirstClaim.mockResolvedValue(null);

    const res = await POST(makeRequest('claim-other-org'));
    expect(res.status).toBe(404);
    expect(queueVerifyClaimMock).not.toHaveBeenCalled();
    expect(updateManyClaim).not.toHaveBeenCalled();
  });

  test('collaborator → 403 (owner-only), nothing enqueued', async () => {
    findUniqueUser.mockResolvedValue({
      organizationId: 'org-1',
      teamMemberships: [{ role: 'collaborator', organizationId: 'org-1' }],
    });

    const res = await POST(makeRequest('claim-1'));
    expect(res.status).toBe(403);
    expect(findFirstClaim).not.toHaveBeenCalled();
    expect(queueVerifyClaimMock).not.toHaveBeenCalled();
  });

  test('unauthenticated → 401', async () => {
    getUserIdMock.mockResolvedValue(null);

    const res = await POST(makeRequest('claim-1'));
    expect(res.status).toBe(401);
    expect(queueVerifyClaimMock).not.toHaveBeenCalled();
  });

  test('enqueue failure → 500 with no claim mutation', async () => {
    findFirstClaim.mockResolvedValue({ id: 'claim-1' });
    queueVerifyClaimMock.mockRejectedValue(new Error('queue down'));

    const res = await POST(makeRequest('claim-1'));
    expect(res.status).toBe(500);
    expect(updateManyClaim).not.toHaveBeenCalled();
  });
});
