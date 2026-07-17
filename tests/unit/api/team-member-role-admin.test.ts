/**
 * Team Member Role API — admin-authorisation regression tests
 *
 * @description Drives the real PATCH /api/teams/members/[memberId]/role handler
 * to guard against a regression where `checkUserIsAdmin` issued an invalid
 * Prisma query (a `where` clause nested inside a to-one `include` on the `role`
 * relation). That form throws PrismaClientValidationError at runtime; the helper's
 * catch swallowed it and returned `false`, so EVERY genuine admin was denied
 * (403) when changing a member's role.
 *
 * The mocked `userRole.findMany` here only resolves the admin's role when the
 * org is scoped on the TOP-LEVEL `where` (via `where.role.organizationId`) — the
 * correct Prisma pattern. A query that buries the org filter inside `include`
 * (the old bug) returns no roles and the admin is denied, failing these tests.
 */

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  userRole: {
    findMany: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
  role: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  permissionAudit: {
    create: jest.fn(),
  },
  // SYN-1108: resolveIssuerRole consults BusinessOwnership to detect owners.
  businessOwnership: {
    findFirst: jest.fn(),
  },
};

const mockSecurityChecker = {
  check: jest.fn().mockResolvedValue({ allowed: true, context: {} }),
  createSecureResponse: (body: unknown, status: number) =>
    new Response(JSON.stringify(body), { status }),
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: mockSecurityChecker,
  DEFAULT_POLICIES: { AUTHENTICATED_READ: {}, AUTHENTICATED_WRITE: {} },
}));

jest.mock('@/lib/security/audit-logger', () => ({
  auditLogger: { log: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: () => {}, error: () => {}, warn: () => {} },
}));

const mockGetUserId = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserId(...args),
}));

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) =>
      new Response(JSON.stringify(body), { status: init?.status ?? 200 }),
  },
  NextRequest: class {},
}));

// NOTE: use plain functions (not jest.fn) in module-mock factories — the Jest
// config sets resetMocks:true, which strips jest.fn implementations before each
// test and would make these return undefined.
jest.mock('@/lib/api/response-optimizer', () => ({
  ResponseOptimizer: {
    createResponse: (data: unknown, options?: { status?: number }) =>
      new Response(JSON.stringify(data), { status: options?.status ?? 200 }),
    createErrorResponse: (message: string, status: number) =>
      new Response(JSON.stringify({ error: message }), { status }),
  },
}));

import { PATCH } from '@/app/api/teams/members/[memberId]/role/route';

const ADMIN_ID = 'admin-user';
const MEMBER_ID = 'member-1';
const ORG_ID = 'org-1';
const NEW_ROLE_ID = 'role-editor';

/**
 * Faithful userRole.findMany mock: only returns the admin role when the org is
 * scoped on the top-level `where.role.organizationId`. This is what
 * `checkUserIsAdmin` must do; the old buried-in-`include` form would not set
 * this and would (correctly, per this mock) match nothing.
 */
function adminRoleFindMany(args: {
  where?: { userId?: string; role?: { organizationId?: string } };
}) {
  const where = args?.where ?? {};
  const orgScoped = where?.role?.organizationId === ORG_ID;
  if (where.userId === ADMIN_ID && orgScoped) {
    return Promise.resolve([
      { userId: ADMIN_ID, roleId: 'role-admin', role: { name: 'admin', permissions: ['*'] } },
    ]);
  }
  // Member's existing roles (for the "remove previous roles" step)
  if (where.userId === MEMBER_ID) {
    return Promise.resolve([
      { userId: MEMBER_ID, roleId: 'role-viewer', role: { id: 'role-viewer', name: 'viewer' } },
    ]);
  }
  return Promise.resolve([]);
}

function buildRequest(body: unknown): never {
  return { json: async () => body } as unknown as never;
}

describe('PATCH /api/teams/members/[memberId]/role — admin authorisation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserId.mockResolvedValue(ADMIN_ID);
    mockSecurityChecker.check.mockResolvedValue({ allowed: true, context: {} });

    // Requesting (admin) user belongs to ORG_ID
    mockPrisma.user.findUnique.mockResolvedValue({ organizationId: ORG_ID });
    // Target member is in the same org
    mockPrisma.user.findFirst.mockResolvedValue({
      id: MEMBER_ID,
      email: 'member@example.com',
      name: 'Member One',
    });
    // Target role exists in the org
    mockPrisma.role.findFirst.mockResolvedValue({
      id: NEW_ROLE_ID,
      name: 'editor',
      permissions: ['edit_content'],
      organizationId: ORG_ID,
    });
    mockPrisma.userRole.findMany.mockImplementation(adminRoleFindMany);
    mockPrisma.userRole.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.userRole.create.mockResolvedValue({ userId: MEMBER_ID, roleId: NEW_ROLE_ID });
    mockPrisma.permissionAudit.create.mockResolvedValue(undefined);
    // Default: the admin actor is NOT a business owner.
    mockPrisma.businessOwnership.findFirst.mockResolvedValue(null);
  });

  it('lets a genuine org admin change a member role (200) and persists the new role', async () => {
    const res = await PATCH(buildRequest({ roleId: NEW_ROLE_ID }), {
      params: Promise.resolve({ memberId: MEMBER_ID }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.role.id).toBe(NEW_ROLE_ID);

    // The new role was actually written
    expect(mockPrisma.userRole.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: MEMBER_ID, roleId: NEW_ROLE_ID, grantedBy: ADMIN_ID }),
      })
    );
  });

  it('scopes the admin-role lookup by org on the top-level where (not inside include)', async () => {
    await PATCH(buildRequest({ roleId: NEW_ROLE_ID }), {
      params: Promise.resolve({ memberId: MEMBER_ID }),
    });

    // checkUserIsAdmin must org-scope via the top-level where.role relation.
    const adminLookup = mockPrisma.userRole.findMany.mock.calls.find(
      (c: any[]) => c[0]?.where?.userId === ADMIN_ID
    );
    expect(adminLookup).toBeDefined();
    expect(adminLookup![0].where.role).toEqual({ organizationId: ORG_ID });
    // And must NOT bury a `where` inside the to-one `include.role` (invalid Prisma).
    expect(adminLookup![0].include?.role?.where).toBeUndefined();
  });

  it('denies a non-admin member (403) without writing any role', async () => {
    // This user has only a viewer role in the org
    mockPrisma.userRole.findMany.mockImplementation((args: any) => {
      const where = args?.where ?? {};
      if (where.userId === ADMIN_ID && where?.role?.organizationId === ORG_ID) {
        return Promise.resolve([
          { userId: ADMIN_ID, roleId: 'role-viewer', role: { name: 'viewer', permissions: ['view_content'] } },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await PATCH(buildRequest({ roleId: NEW_ROLE_ID }), {
      params: Promise.resolve({ memberId: MEMBER_ID }),
    });

    expect(res.status).toBe(403);
    expect(mockPrisma.userRole.create).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/teams/members/[memberId]/role — issuer-rank guard (SYN-1108)', () => {
  const OWNER_ROLE_ID = 'role-owner';

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserId.mockResolvedValue(ADMIN_ID);
    mockSecurityChecker.check.mockResolvedValue({ allowed: true, context: {} });
    mockPrisma.user.findUnique.mockResolvedValue({ organizationId: ORG_ID });
    mockPrisma.user.findFirst.mockResolvedValue({
      id: MEMBER_ID,
      email: 'member@example.com',
      name: 'Member One',
    });
    // The target role being assigned is an OWNER-level role.
    mockPrisma.role.findFirst.mockResolvedValue({
      id: OWNER_ROLE_ID,
      name: 'owner',
      permissions: ['*'],
      organizationId: ORG_ID,
    });
    mockPrisma.userRole.findMany.mockImplementation(adminRoleFindMany);
    mockPrisma.userRole.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.userRole.create.mockResolvedValue({ userId: MEMBER_ID, roleId: OWNER_ROLE_ID });
    mockPrisma.permissionAudit.create.mockResolvedValue(undefined);
    mockPrisma.businessOwnership.findFirst.mockResolvedValue(null);
  });

  it('refuses an admin (not owner) assigning an owner-level role (403, no write)', async () => {
    const res = await PATCH(buildRequest({ roleId: OWNER_ROLE_ID }), {
      params: Promise.resolve({ memberId: MEMBER_ID }),
    });

    expect(res.status).toBe(403);
    expect(mockPrisma.userRole.create).not.toHaveBeenCalled();
  });

  it('allows an owner assigning an owner-level role (200)', async () => {
    // The actor holds a BusinessOwnership row ⇒ resolveIssuerRole ⇒ owner.
    mockPrisma.businessOwnership.findFirst.mockResolvedValue({ id: 'own-1' });

    const res = await PATCH(buildRequest({ roleId: OWNER_ROLE_ID }), {
      params: Promise.resolve({ memberId: MEMBER_ID }),
    });

    expect(res.status).toBe(200);
    expect(mockPrisma.userRole.create).toHaveBeenCalled();
  });
});
