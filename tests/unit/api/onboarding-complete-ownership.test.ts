/**
 * SYN-1108 — onboarding ownership-mint guard.
 *
 * A brand-new user completing onboarding on their own org SHOULD become its
 * owner (first-org bootstrap). But a member/collaborator of an org that is
 * ALREADY owned by someone else must NOT silently mint a co-ownership +
 * isMultiBusinessOwner by completing onboarding.
 */

jest.mock('next/server', () => {
  class MockCookies {
    private _store = new Map<string, { value: string; options: Record<string, unknown> }>();
    set(name: string, value: string, options: Record<string, unknown> = {}) {
      this._store.set(name, { value, options });
    }
    get(name: string) {
      return this._store.get(name);
    }
  }
  class MockNextResponse {
    status: number;
    cookies: MockCookies;
    private _body: string;
    constructor(body: string, init: { status?: number } = {}) {
      this._body = body;
      this.status = init.status ?? 200;
      this.cookies = new MockCookies();
    }
    json() {
      return Promise.resolve(JSON.parse(this._body));
    }
    static json(data: unknown, init: { status?: number } = {}) {
      return new MockNextResponse(JSON.stringify(data), init);
    }
  }
  return { NextResponse: MockNextResponse, NextRequest: class extends Request {} };
});

const mockGetUserId = jest.fn();
const mockUnauthorized = jest.fn();
const mockGenerateToken = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => mockGetUserId(...a),
  unauthorizedResponse: (...a: unknown[]) => mockUnauthorized(...a),
  generateToken: (...a: unknown[]) => mockGenerateToken(...a),
}));

const mockUserFindUnique = jest.fn();
const mockUserUpdate = jest.fn();
const mockOrgFindFirst = jest.fn();
const mockProgressFindFirst = jest.fn();
const mockProgressUpdateMany = jest.fn();
const mockOwnershipFindFirst = jest.fn();
const mockOwnershipCreate = jest.fn();
const mockPersonaCreate = jest.fn();
const mockBrandDnaUpsert = jest.fn();
const mockQueryRaw = jest.fn();

const prismaMock = {
  user: { findUnique: mockUserFindUnique, update: mockUserUpdate },
  organization: { findFirst: mockOrgFindFirst },
  onboardingProgress: {
    findFirst: mockProgressFindFirst,
    updateMany: mockProgressUpdateMany,
  },
  businessOwnership: {
    findFirst: mockOwnershipFindFirst,
    create: mockOwnershipCreate,
  },
  persona: { create: mockPersonaCreate },
  brandDNA: { upsert: mockBrandDnaUpsert },
  $queryRaw: mockQueryRaw,
  $transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb(prismaMock),
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: prismaMock,
  prisma: prismaMock,
}));

jest.mock('@/lib/email/billing-emails', () => ({
  sendWelcomeSequenceDay0: jest.fn(),
}));
jest.mock('@/lib/vault/onboarding-seeder', () => ({
  seedVaultFromOnboarding: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/autopilot/launch-pipeline', () => ({
  runLaunchPipeline: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { createMockNextRequest } from '../../helpers/mock-request';

const USER_ID = 'user-1';
const ORG_ID = 'org-1';

function makeReq() {
  return createMockNextRequest({
    method: 'POST',
    url: 'http://localhost/api/onboarding/complete',
    body: {},
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserId.mockResolvedValue(USER_ID);
  mockUserFindUnique.mockResolvedValue({
    id: USER_ID,
    email: 'u@example.com',
    name: 'U',
    onboardingComplete: false,
    activeOrganizationId: null,
    preferences: {},
  });
  mockOrgFindFirst.mockResolvedValue({ id: ORG_ID, name: 'Acme' });
  mockProgressFindFirst.mockResolvedValue({ auditData: {} });
  mockProgressUpdateMany.mockResolvedValue({ count: 1 });
  mockOwnershipCreate.mockResolvedValue({ id: 'own-new' });
  mockUserUpdate.mockResolvedValue({ id: USER_ID });
  mockPersonaCreate.mockResolvedValue({ id: 'p1' });
  mockBrandDnaUpsert.mockResolvedValue({ id: 'b1' });
  mockGenerateToken.mockResolvedValue('jwt');
  mockQueryRaw.mockResolvedValue([]);
});

describe('POST /api/onboarding/complete — ownership-mint guard (SYN-1108)', () => {
  it('mints ownership for a first-org bootstrap (no existing owner)', async () => {
    // No ownership at all for this org.
    mockOwnershipFindFirst.mockResolvedValue(null);

    const { POST } = await import('@/app/api/onboarding/complete/route');
    const res = await POST(makeReq() as never);

    expect(res.status).toBe(200);
    expect(mockOwnershipCreate).toHaveBeenCalledTimes(1);
    expect(mockOwnershipCreate.mock.calls[0][0].data.ownerId).toBe(USER_ID);
    // Flagged as a multi-business owner.
    const update = mockUserUpdate.mock.calls.find(
      c => c[0]?.data?.isMultiBusinessOwner !== undefined
    );
    expect(update![0].data.isMultiBusinessOwner).toBe(true);
  });

  it('refuses to mint ownership when the org is already owned by another user', async () => {
    // First call: this user's own ownership (none). Second call: a foreign owner exists.
    mockOwnershipFindFirst
      .mockResolvedValueOnce(null) // ownerId: user.id
      .mockResolvedValueOnce({ id: 'own-foreign' }); // ownerId: { not: user.id }

    const { POST } = await import('@/app/api/onboarding/complete/route');
    const res = await POST(makeReq() as never);

    expect(res.status).toBe(200); // onboarding still completes
    expect(mockOwnershipCreate).not.toHaveBeenCalled();
    const update = mockUserUpdate.mock.calls.find(
      c => c[0]?.data?.isMultiBusinessOwner !== undefined
    );
    expect(update![0].data.isMultiBusinessOwner).toBe(false);
    // onboarding is still marked complete.
    expect(update![0].data.onboardingComplete).toBe(true);
  });

  it('acquires a per-org advisory lock BEFORE the ownership check-then-create (race guard)', async () => {
    mockOwnershipFindFirst.mockResolvedValue(null);

    const { POST } = await import('@/app/api/onboarding/complete/route');
    await POST(makeReq() as never);

    // The advisory lock serialises concurrent completions for this org.
    expect(mockQueryRaw).toHaveBeenCalled();
    // It must be taken before the ownership row is created, or the lock is
    // useless — the whole check-then-create window must sit under the lock.
    expect(mockQueryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      mockOwnershipFindFirst.mock.invocationCallOrder[0]
    );
    expect(mockQueryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      mockOwnershipCreate.mock.invocationCallOrder[0]
    );
  });
});
