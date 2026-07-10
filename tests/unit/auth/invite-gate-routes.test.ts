/**
 * Track A — consumption boundary (handoff-20260711-074357).
 *
 * Route-level regression tests proving the three open-market bypasses are
 * closed when invite-only mode is on (which is the FAIL-CLOSED default —
 * these tests deliberately leave NEXT_PUBLIC_INVITE_ONLY_MODE unset):
 *
 *   1. POST /api/auth/unified {action:'signup'} — the parallel signup door
 *      that never honoured the invite gate.
 *   2. POST /api/onboarding/review — auto-created an Organization for any
 *      authenticated user with none.
 *   3. POST /api/organizations — let any authenticated user self-provision
 *      an Organization.
 *
 * The gate logic itself runs for real; only the data layer (prisma), auth
 * identity, and infra wrappers are mocked.
 */
import { createMockNextRequest } from '@/tests/helpers/mock-request';

// --- Infra mocks ---------------------------------------------------------
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/lib/rate-limit', () => ({
  rateLimiters: {
    auth: (_req: unknown, fn: () => Promise<unknown>) => fn(),
  },
}));

jest.mock('bcryptjs', () => ({
  __esModule: true,
  default: {
    hash: jest.fn(async () => 'hashed-password'),
    compare: jest.fn(async () => false),
  },
}));

const mockGetUserId = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => {
  const { NextResponse } = require('next/server');
  return {
    generateToken: jest.fn(() => 'test-token'),
    getUserIdFromRequestOrCookies: (...a: unknown[]) => mockGetUserId(...a),
    unauthorizedResponse: () =>
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    isOwnerEmail: jest.fn(() => false),
  };
});

const mockSecurityCheck = jest.fn();
jest.mock('@/lib/security/api-security-checker', () => {
  const { NextResponse } = require('next/server');
  return {
    APISecurityChecker: {
      check: (...a: unknown[]) => mockSecurityCheck(...a),
      createSecureResponse: (body: unknown, status: number) =>
        NextResponse.json(body, { status }),
    },
    DEFAULT_POLICIES: { AUTHENTICATED_WRITE: 'AUTHENTICATED_WRITE' },
  };
});

jest.mock('@/lib/auth/rbac/ensure-default-roles', () => ({
  ensureDefaultRoles: jest.fn(async () => undefined),
}));

// --- Prisma mock ----------------------------------------------------------
const mockUserFindUnique = jest.fn();
const mockUserCreate = jest.fn();
const mockOrgFindFirst = jest.fn();
const mockOrgFindUnique = jest.fn();
const mockOrgCreate = jest.fn();
const mockOrgUpdate = jest.fn();
const mockProgressUpsert = jest.fn();
const mockTeamFindFirst = jest.fn();
const mockCodeFindFirst = jest.fn();
const mockTransaction = jest.fn();

const prismaMock = {
  user: {
    findUnique: (...a: unknown[]) => mockUserFindUnique(...a),
    create: (...a: unknown[]) => mockUserCreate(...a),
  },
  organization: {
    findFirst: (...a: unknown[]) => mockOrgFindFirst(...a),
    findUnique: (...a: unknown[]) => mockOrgFindUnique(...a),
    create: (...a: unknown[]) => mockOrgCreate(...a),
    update: (...a: unknown[]) => mockOrgUpdate(...a),
  },
  onboardingProgress: { upsert: (...a: unknown[]) => mockProgressUpsert(...a) },
  teamInvitation: { findFirst: (...a: unknown[]) => mockTeamFindFirst(...a) },
  inviteCode: { findFirst: (...a: unknown[]) => mockCodeFindFirst(...a) },
  $transaction: (...a: unknown[]) => mockTransaction(...a),
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: prismaMock,
  default: prismaMock,
}));

import { POST as unifiedPost } from '@/app/api/auth/unified/route';
import { POST as reviewPost } from '@/app/api/onboarding/review/route';
import { POST as organizationsPost } from '@/app/api/organizations/route';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  // Fail-closed default: flag deliberately unset.
  delete process.env.NEXT_PUBLIC_INVITE_ONLY_MODE;
  jest.clearAllMocks();
  mockUserFindUnique.mockResolvedValue(null);
  mockUserCreate.mockResolvedValue({
    id: 'user-new',
    email: 'new@example.com',
    name: 'New User',
    preferences: null,
  });
  mockOrgFindFirst.mockResolvedValue(null);
  mockOrgFindUnique.mockResolvedValue(null);
  mockOrgCreate.mockResolvedValue({ id: 'org-1' });
  mockOrgUpdate.mockResolvedValue({});
  mockProgressUpsert.mockResolvedValue({});
  mockTeamFindFirst.mockResolvedValue(null);
  mockCodeFindFirst.mockResolvedValue(null);
  mockGetUserId.mockResolvedValue('user-1');
  mockSecurityCheck.mockResolvedValue({
    allowed: true,
    context: { userId: 'user-1' },
  });
  mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
    fn({
      organization: {
        create: async () => ({
          id: 'org-tx',
          name: 'Acme',
          slug: 'acme',
          plan: 'free',
          domain: 'acme.synthex.social',
          status: 'active',
          createdAt: new Date('2026-07-11T00:00:00Z'),
          users: [{ id: 'user-1', name: 'U', email: 'u@example.com' }],
        }),
      },
    })
  );
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

// ===========================================================================
// 1. /api/auth/unified — the parallel signup door
// ===========================================================================
describe('POST /api/auth/unified {action:signup} — invite gate', () => {
  const signupBody = {
    action: 'signup',
    email: 'new@example.com',
    password: 'Password123',
    name: 'New User',
  };

  it('refuses signup (403) in invite-only mode — flag unset, fail closed', async () => {
    const res = await unifiedPost(
      createMockNextRequest({
        method: 'POST',
        url: 'http://localhost/api/auth/unified',
        body: signupBody,
      })
    );
    expect(res.status).toBe(403);
    expect(mockUserCreate).not.toHaveBeenCalled();
  });

  it('refuses signup (403) when the flag is explicitly "true"', async () => {
    process.env.NEXT_PUBLIC_INVITE_ONLY_MODE = 'true';
    const res = await unifiedPost(
      createMockNextRequest({
        method: 'POST',
        url: 'http://localhost/api/auth/unified',
        body: signupBody,
      })
    );
    expect(res.status).toBe(403);
    expect(mockUserCreate).not.toHaveBeenCalled();
  });

  it('allows signup when the market is explicitly open (=false)', async () => {
    process.env.NEXT_PUBLIC_INVITE_ONLY_MODE = 'false';
    const res = await unifiedPost(
      createMockNextRequest({
        method: 'POST',
        url: 'http://localhost/api/auth/unified',
        body: signupBody,
      })
    );
    expect(res.status).toBe(200);
    expect(mockUserCreate).toHaveBeenCalled();
  });
});

// ===========================================================================
// 2. /api/onboarding/review — auto-org provisioning
// ===========================================================================
describe('POST /api/onboarding/review — auto-org gate', () => {
  const reviewBody = { businessName: 'Acme Restorations' };

  it('refuses (403) to auto-create an org for an uninvited user in invite-only mode', async () => {
    mockUserFindUnique.mockResolvedValue({ email: 'p@example.com' });

    const res = await reviewPost(
      createMockNextRequest({
        method: 'POST',
        url: 'http://localhost/api/onboarding/review',
        body: reviewBody,
      })
    );

    expect(res.status).toBe(403);
    expect(mockOrgCreate).not.toHaveBeenCalled();
  });

  it('auto-creates the org when the user has invite evidence', async () => {
    mockUserFindUnique.mockResolvedValue({ email: 'p@example.com' });
    mockTeamFindFirst.mockResolvedValue({ id: 'ti-1' });

    const res = await reviewPost(
      createMockNextRequest({
        method: 'POST',
        url: 'http://localhost/api/onboarding/review',
        body: reviewBody,
      })
    );

    expect(res.status).toBe(200);
    expect(mockOrgCreate).toHaveBeenCalled();
    const json = await res.json();
    expect(json).toEqual({ success: true, organizationId: 'org-1' });
  });

  it('is unaffected for users who already belong to an org', async () => {
    mockOrgFindFirst.mockResolvedValue({ id: 'org-9' });

    const res = await reviewPost(
      createMockNextRequest({
        method: 'POST',
        url: 'http://localhost/api/onboarding/review',
        body: reviewBody,
      })
    );

    expect(res.status).toBe(200);
    expect(mockOrgCreate).not.toHaveBeenCalled();
  });

  it('still auto-creates without evidence when the market is explicitly open', async () => {
    process.env.NEXT_PUBLIC_INVITE_ONLY_MODE = 'false';

    const res = await reviewPost(
      createMockNextRequest({
        method: 'POST',
        url: 'http://localhost/api/onboarding/review',
        body: reviewBody,
      })
    );

    expect(res.status).toBe(200);
    expect(mockOrgCreate).toHaveBeenCalled();
  });
});

// ===========================================================================
// 3. /api/organizations — self-provisioning
// ===========================================================================
describe('POST /api/organizations — self-provisioning gate', () => {
  const orgBody = { name: 'Acme Restorations' };

  it('refuses (403) an org-less uninvited user in invite-only mode', async () => {
    mockUserFindUnique.mockResolvedValue({ email: 'p@example.com' });

    const res = await organizationsPost(
      createMockNextRequest({
        method: 'POST',
        url: 'http://localhost/api/organizations',
        body: orgBody,
      })
    );

    expect(res.status).toBe(403);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('allows a member of an existing org to create another org', async () => {
    mockOrgFindFirst.mockResolvedValue({ id: 'org-9' });

    const res = await organizationsPost(
      createMockNextRequest({
        method: 'POST',
        url: 'http://localhost/api/organizations',
        body: orgBody,
      })
    );

    expect(res.status).toBe(201);
    expect(mockTransaction).toHaveBeenCalled();
  });

  it('allows an org-less user who has invite evidence', async () => {
    mockUserFindUnique.mockResolvedValue({ email: 'p@example.com' });
    mockTeamFindFirst.mockResolvedValue({ id: 'ti-1' });

    const res = await organizationsPost(
      createMockNextRequest({
        method: 'POST',
        url: 'http://localhost/api/organizations',
        body: orgBody,
      })
    );

    expect(res.status).toBe(201);
    expect(mockTransaction).toHaveBeenCalled();
  });
});
