/**
 * SYN-1105 P1 (alternate org PATCH) — plan self-grant via team settings.
 *
 * PATCH /api/teams/[id]/settings accepted `plan` in its schema and wrote it to
 * the organization row from the client body, so a team admin could self-grant
 * an 'enterprise' plan without any verified Stripe subscription. This test
 * executes the REAL PATCH handler and proves `plan` is never written from the
 * body — an org's plan derives only from verified Stripe state.
 */

const mockGetUserId = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => mockGetUserId(...a),
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const mockUserFindFirst = jest.fn();
const mockOrgFindUnique = jest.fn();
const mockTxOrgUpdate = jest.fn();
const mockTxAuditCreate = jest.fn();
const mockTransaction = jest.fn();

const txMock = {
  organization: { update: (...a: unknown[]) => mockTxOrgUpdate(...a) },
  auditLog: { create: (...a: unknown[]) => mockTxAuditCreate(...a) },
};

jest.mock('@/lib/prisma', () => {
  const prismaMock = {
    user: { findFirst: (...a: unknown[]) => mockUserFindFirst(...a) },
    organization: { findUnique: (...a: unknown[]) => mockOrgFindUnique(...a) },
    $transaction: (...a: unknown[]) => mockTransaction(...a),
  };
  return { __esModule: true, default: prismaMock, prisma: prismaMock };
});

import { createMockNextRequest } from '@/tests/helpers/mock-request';
import { PATCH } from '@/app/api/teams/[id]/settings/route';

const TEAM_ID = 'org_team_1';
const USER_ID = 'user_admin';

function patchRequest(body: object) {
  return createMockNextRequest({
    method: 'PATCH',
    url: `http://localhost/api/teams/${TEAM_ID}/settings`,
    body,
  }) as unknown as import('next/server').NextRequest;
}

const paramsArg = { params: Promise.resolve({ id: TEAM_ID }) };

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserId.mockResolvedValue(USER_ID);
  // canManageTeam: membership + admin in settings.
  mockUserFindFirst.mockResolvedValue({ id: USER_ID, organizationId: TEAM_ID });
  mockOrgFindUnique.mockResolvedValue({ settings: { admins: [USER_ID] } });
  mockTxOrgUpdate.mockImplementation(async ({ data }: { data: any }) => ({
    id: TEAM_ID,
    name: data.name ?? 'Team',
    plan: 'free',
    settings: data.settings ?? {},
    updatedAt: new Date(),
  }));
  mockTxAuditCreate.mockResolvedValue({});
  mockTransaction.mockImplementation(
    async (fn: (tx: typeof txMock) => unknown) => fn(txMock)
  );
});

describe('PATCH /api/teams/[id]/settings — plan cannot be self-granted (SYN-1105 P1)', () => {
  it('ignores a client-supplied plan — org plan is never written from the body', async () => {
    const res = await PATCH(
      patchRequest({ name: 'Renamed', plan: 'enterprise' }),
      paramsArg
    );

    expect(res.status).toBe(200);
    const written = mockTxOrgUpdate.mock.calls[0][0].data;
    expect(written).not.toHaveProperty('plan');
    expect(written.name).toBe('Renamed');
  });
});
