/**
 * SYN-1216 — finish setup with every channel Coming soon / skipped.
 *
 * Finish setup must persist onboardingComplete and return a fresh
 * onboardingComplete:true JWT even when no platform is connected.
 * Vault / launch side effects must not block that response — a hang
 * here is what left the connect page on “Finishing…” and sent
 * /dashboard back to /onboarding on a stale JWT.
 */

jest.mock('next/server', () => {
  class MockCookies {
    private _store = new Map<
      string,
      { value: string; options: Record<string, unknown> }
    >();
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
    headers: { get: () => null; set: jest.Mock; has: () => boolean };
    private _body: string;
    constructor(body: string, init: { status?: number } = {}) {
      this._body = body;
      this.status = init.status ?? 200;
      this.cookies = new MockCookies();
      this.headers = { get: () => null, set: jest.fn(), has: () => false };
    }
    json() {
      return Promise.resolve(JSON.parse(this._body));
    }
    static json(data: unknown, init: { status?: number } = {}) {
      return new MockNextResponse(JSON.stringify(data), init);
    }
  }
  return {
    NextResponse: MockNextResponse,
    NextRequest: class extends Request {},
  };
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
const mockOrgUpdate = jest.fn();
const mockProgressFindFirst = jest.fn();
const mockProgressUpdateMany = jest.fn();
const mockOwnershipFindFirst = jest.fn();
const mockOwnershipCreate = jest.fn();
const mockPersonaCreate = jest.fn();
const mockBrandDnaUpsert = jest.fn();
const mockExecuteRaw = jest.fn();

const prismaMock = {
  user: { findUnique: mockUserFindUnique, update: mockUserUpdate },
  organization: { findFirst: mockOrgFindFirst, update: mockOrgUpdate },
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
  $executeRaw: mockExecuteRaw,
  $transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb(prismaMock),
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: prismaMock,
  prisma: prismaMock,
}));

jest.mock('@/lib/onboarding/ensure-org', () => ({
  ensureOnboardingOrganization: () => Promise.resolve({ id: 'org-1' }),
}));
jest.mock('@/lib/onboarding/persist', () => ({
  migrateOrphanRecordsToOrg: () =>
    Promise.resolve({ connections: 0, credentials: 0 }),
}));

jest.mock('@/lib/email/billing-emails', () => ({
  sendWelcomeSequenceDay0: jest.fn(),
}));

const mockSeedVault = jest.fn();
jest.mock('@/lib/vault/onboarding-seeder', () => ({
  seedVaultFromOnboarding: (...a: unknown[]) => mockSeedVault(...a),
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
  mockOrgUpdate.mockResolvedValue({ id: ORG_ID, name: 'Acme' });
  mockProgressFindFirst.mockResolvedValue({ auditData: null });
  mockProgressUpdateMany.mockResolvedValue({ count: 0 });
  mockOwnershipFindFirst.mockResolvedValue(null);
  mockOwnershipCreate.mockResolvedValue({ id: 'own-new' });
  mockUserUpdate.mockResolvedValue({ id: USER_ID });
  mockPersonaCreate.mockResolvedValue({ id: 'p1' });
  mockBrandDnaUpsert.mockResolvedValue({ id: 'b1' });
  mockGenerateToken.mockResolvedValue('jwt-complete');
  mockExecuteRaw.mockResolvedValue(undefined);
  mockSeedVault.mockResolvedValue(undefined);
});

describe('POST /api/onboarding/complete — skipped / Coming soon channels (SYN-1216)', () => {
  it('persists onboardingComplete and issues a completed JWT with no connections', async () => {
    const { POST } = await import('@/app/api/onboarding/complete/route');
    const res = await POST(makeReq() as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(res.cookies.get('auth-token')?.value).toBe('jwt-complete');
    expect(mockGenerateToken).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        onboardingComplete: true,
      })
    );

    const completeUpdate = mockUserUpdate.mock.calls.find(
      c => c[0]?.data?.onboardingComplete === true
    );
    expect(completeUpdate).toBeDefined();
  });

  it('re-issues a completed JWT on alreadyComplete so /dashboard does not loop', async () => {
    mockUserFindUnique.mockResolvedValue({
      id: USER_ID,
      email: 'u@example.com',
      name: 'U',
      onboardingComplete: true,
      activeOrganizationId: ORG_ID,
      preferences: {},
    });

    const { POST } = await import('@/app/api/onboarding/complete/route');
    const res = await POST(makeReq() as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.alreadyComplete).toBe(true);
    expect(res.cookies.get('auth-token')?.value).toBe('jwt-complete');
    expect(mockGenerateToken).toHaveBeenCalledWith(
      expect.objectContaining({ onboardingComplete: true })
    );
    expect(mockOwnershipCreate).not.toHaveBeenCalled();
    expect(mockSeedVault).not.toHaveBeenCalled();
  });

  it('returns the JWT even when vault seeding never resolves', async () => {
    mockSeedVault.mockImplementation(
      () =>
        new Promise(() => {
          /* hang — must not block Set-Cookie */
        })
    );

    const { POST } = await import('@/app/api/onboarding/complete/route');
    const res = await Promise.race([
      POST(makeReq() as never),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('complete handler hung')), 400)
      ),
    ]);

    expect(res.status).toBe(200);
    expect(res.cookies.get('auth-token')?.value).toBe('jwt-complete');
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
