/**
 * Unit test for the Marketing Agency Claim action API (SYN-977).
 *
 * Verifies POST /api/marketing-agency/claims/[id]/action via stubbed
 * request objects (the project's jest.setup.js Request shim conflicts
 * with `new NextRequest(new URL(...))`, so we construct minimal stubs
 * that satisfy the route's actual needs).
 */

const findFirstClaim = jest.fn();
const updateClaim = jest.fn();
const findUniqueUser = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    marketingAgencyClaim: {
      findFirst: (...args: unknown[]) => findFirstClaim(...args),
      update: (...args: unknown[]) => updateClaim(...args),
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

describe('POST /api/marketing-agency/claims/[id]/action', () => {
  test('approve happy path → verified + reviewLog entry', async () => {
    findFirstClaim.mockResolvedValue({
      id: 'claim-1',
      organizationId: 'org-1',
      evidenceStatus: 'blocked',
      statement: 'Some claim',
      metadata: {},
    });
    updateClaim.mockResolvedValue({
      id: 'claim-1',
      evidenceStatus: 'verified',
      statement: 'Some claim',
    });

    const res = await POST(makeRequest('claim-1', { action: 'approve' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.claim).toMatchObject({ id: 'claim-1', evidenceStatus: 'verified' });
    expect(data.action).toBe('approve');

    const updateCall = updateClaim.mock.calls[0][0];
    expect(updateCall.data.evidenceStatus).toBe('verified');
    expect(updateCall.data.metadata.reviewLog).toHaveLength(1);
    expect(updateCall.data.metadata.reviewLog[0]).toMatchObject({
      action: 'approve',
      reviewedBy: 'user-1',
      previousEvidenceStatus: 'blocked',
    });
  });

  test('reject with comment → disputed + reviewLog has comment', async () => {
    findFirstClaim.mockResolvedValue({
      id: 'claim-1',
      organizationId: 'org-1',
      evidenceStatus: 'blocked',
      statement: 'Some claim',
      metadata: {},
    });
    updateClaim.mockResolvedValue({
      id: 'claim-1',
      evidenceStatus: 'disputed',
      statement: 'Some claim',
    });

    const res = await POST(
      makeRequest('claim-1', { action: 'reject', comment: 'Not supported by source' }),
    );
    expect(res.status).toBe(200);
    const updateCall = updateClaim.mock.calls[0][0];
    expect(updateCall.data.evidenceStatus).toBe('disputed');
    expect(updateCall.data.metadata.reviewLog[0].comment).toBe('Not supported by source');
  });

  test('reject without comment → 400', async () => {
    findFirstClaim.mockResolvedValue({
      id: 'claim-1',
      organizationId: 'org-1',
      evidenceStatus: 'blocked',
      statement: 'Some claim',
      metadata: {},
    });

    const res = await POST(makeRequest('claim-1', { action: 'reject' }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/comment is required/i);
    expect(updateClaim).not.toHaveBeenCalled();
  });

  test('claim not owned by org → 404', async () => {
    findFirstClaim.mockResolvedValue(null);
    const res = await POST(makeRequest('claim-x', { action: 'approve' }));
    expect(res.status).toBe(404);
    expect(updateClaim).not.toHaveBeenCalled();
  });

  test('existing reviewLog preserved on append', async () => {
    const existingLog = [
      {
        action: 'approve',
        reviewedBy: 'user-old',
        reviewedAt: '2026-05-01T00:00:00.000Z',
        previousEvidenceStatus: 'pending',
      },
    ];
    findFirstClaim.mockResolvedValue({
      id: 'claim-1',
      organizationId: 'org-1',
      evidenceStatus: 'verified',
      statement: 'Some claim',
      metadata: { reviewLog: existingLog, otherField: 'preserve me' },
    });
    updateClaim.mockResolvedValue({
      id: 'claim-1',
      evidenceStatus: 'disputed',
      statement: 'Some claim',
    });

    const res = await POST(
      makeRequest('claim-1', { action: 'reject', comment: 'Disputed by new info' }),
    );
    expect(res.status).toBe(200);
    const updateCall = updateClaim.mock.calls[0][0];
    expect(updateCall.data.metadata.reviewLog).toHaveLength(2);
    expect(updateCall.data.metadata.reviewLog[0]).toMatchObject({ reviewedBy: 'user-old' });
    expect(updateCall.data.metadata.reviewLog[1]).toMatchObject({
      action: 'reject',
      comment: 'Disputed by new info',
    });
    expect(updateCall.data.metadata.otherField).toBe('preserve me');
  });

  test('invalid action enum → 400', async () => {
    const res = await POST(makeRequest('claim-1', { action: 'discard' }));
    expect(res.status).toBe(400);
  });
});
