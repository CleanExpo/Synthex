/**
 * SYN-1112 F6 — role-ASSIGNMENT permission containment.
 *
 * `assertPermissionsWithinActor` guards role DEFINITION (createRole /
 * updateRole). Assignment was guarded only by `requireIssuerOutranks`, which
 * buckets a role into four coarse ranks: a custom-NAMED role whose permissions
 * are canonical `resource:action` strings ranks as `viewer`, because
 * ADMIN_PERMISSIONS only lists the legacy underscore names (`manage_roles`,
 * `manage_members`). So a `roles:manage` holder — itself ranked `viewer` for
 * the same reason — passed the rank guard (0 >= 0) and could seat a role
 * carrying `organization:manage` on themselves.
 *
 * These tests exercise the REAL containment logic (canDelegatePermissions and
 * assertPermissionsWithinActor come from `requireActual`); only the
 * persistence write (`RoleManager.grantRole`) is stubbed, so a pass proves the
 * invariant fired rather than proving a mock returned what it was told to.
 */

const mockGetUserId = jest.fn();
const mockUserFindUnique = jest.fn();
const mockRoleFindUnique = jest.fn();
const mockPermissionCheck = jest.fn();
const mockGetUserPermissions = jest.fn();
const mockGrantRole = jest.fn();
const mockOwnershipFindFirst = jest.fn();
const mockTeamMemberFindUnique = jest.fn();
const mockUserRoleFindMany = jest.fn();

jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: mockGetUserId,
}));

const prismaMock = {
  user: { findUnique: mockUserFindUnique },
  role: { findUnique: mockRoleFindUnique },
  businessOwnership: { findFirst: mockOwnershipFindFirst },
  teamMember: { findUnique: mockTeamMemberFindUnique },
  userRole: { findMany: mockUserRoleFindMany },
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: prismaMock,
  prisma: prismaMock,
}));

jest.mock('@/lib/auth/rbac/permission-engine', () => {
  const actual = jest.requireActual('@/lib/auth/rbac/permission-engine');
  return {
    ...actual,
    PermissionEngine: {
      check: mockPermissionCheck,
      getUserPermissions: mockGetUserPermissions,
      isValidPermission: actual.PermissionEngine.isValidPermission,
    },
  };
});

jest.mock('@/lib/auth/rbac/role-manager', () => {
  const actual = jest.requireActual('@/lib/auth/rbac/role-manager');
  return {
    ...actual,
    RoleManager: { grantRole: mockGrantRole },
  };
});

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

jest.mock('@/lib/utils/error-utils', () => ({
  sanitizeErrorForResponse: (_error: unknown, fallback: string) => fallback,
}));

const ORG_ID = 'org-1';
const ATTACKER_ID = 'attacker-1';
const ROLE_ID = 'role-ops-lead';

/**
 * A custom-named role carrying organisation-wide authority. Its name is not
 * reserved (SYN-1109 blocks 'owner'/'admin'), and none of its permissions
 * appear in ADMIN_PERMISSIONS — so rankOfRole() scores it `viewer`.
 */
function opsLeadRole() {
  return {
    id: ROLE_ID,
    name: 'Ops Lead',
    description: null,
    permissions: ['organization:manage'],
    isDefault: false,
    isSystem: false,
    organizationId: ORG_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/** Seat the actor with exactly `permissions`, held via a custom-named role. */
function seatActorWith(permissions: string[]) {
  mockGetUserPermissions.mockResolvedValue({
    userId: ATTACKER_ID,
    organizationId: ORG_ID,
    permissions,
    roles: [],
    cachedAt: new Date(),
  });
  mockUserRoleFindMany.mockResolvedValue([
    { role: { name: 'Role Steward', permissions } },
  ]);
}

function grant(targetUserId: string) {
  const url = `http://localhost:3008/api/roles/${ROLE_ID}/users`;
  return {
    url,
    method: 'POST',
    headers: {
      get: (name: string) =>
        name === 'content-type' ? 'application/json' : null,
      has: () => false,
    },
    nextUrl: new URL(url),
    json: async () => ({ userId: targetUserId }),
    text: async () => JSON.stringify({ userId: targetUserId }),
    cookies: { get: () => undefined, getAll: () => [], has: () => false },
  } as any;
}

const params = { params: Promise.resolve({ id: ROLE_ID }) };

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserId.mockResolvedValue(ATTACKER_ID);
  mockUserFindUnique.mockImplementation(async (args: any) => ({
    id: args.where.id,
    organizationId: ORG_ID,
  }));
  mockRoleFindUnique.mockResolvedValue(opsLeadRole());
  mockPermissionCheck.mockResolvedValue({ allowed: true });
  mockGrantRole.mockResolvedValue(undefined);
  // No durable ownership signal: the actor is not an owner.
  mockOwnershipFindFirst.mockResolvedValue(null);
  mockTeamMemberFindUnique.mockResolvedValue(null);
  seatActorWith(['roles:manage']);
});

describe('POST /api/roles/[id]/users — assignment permission containment', () => {
  it('refuses a roles:manage holder self-seating organization:manage', async () => {
    const { POST } = await import('@/app/api/roles/[id]/users/route');

    const response = await POST(grant(ATTACKER_ID), params);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Forbidden',
    });
    expect(mockGrantRole).not.toHaveBeenCalled();
  });

  it('refuses the same escalation when seated on a third party', async () => {
    const { POST } = await import('@/app/api/roles/[id]/users/route');

    const response = await POST(grant('victim-1'), params);

    expect(response.status).toBe(403);
    expect(mockGrantRole).not.toHaveBeenCalled();
  });

  // Positive controls. The issuer-rank guard scores both sides identically in
  // every case below, so only the containment invariant separates these from
  // the denials above — proving it discriminates rather than blanket-denies.
  it('allows an actor who already holds organization:manage to delegate it', async () => {
    seatActorWith(['roles:manage', 'organization:manage']);
    const { POST } = await import('@/app/api/roles/[id]/users/route');

    const response = await POST(grant('teammate-1'), params);

    expect(response.status).toBe(200);
    expect(mockGrantRole).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'teammate-1', roleId: ROLE_ID }),
      ATTACKER_ID
    );
  });

  it('allows a wildcard holder to delegate any declared permission', async () => {
    seatActorWith(['*']);
    const { POST } = await import('@/app/api/roles/[id]/users/route');

    const response = await POST(grant('teammate-1'), params);

    expect(response.status).toBe(200);
    expect(mockGrantRole).toHaveBeenCalled();
  });

  it('allows assigning a role whose permissions the actor already holds', async () => {
    mockRoleFindUnique.mockResolvedValue({
      ...opsLeadRole(),
      name: 'Reader',
      permissions: ['posts:read'],
    });
    seatActorWith(['roles:manage', 'posts:read']);
    const { POST } = await import('@/app/api/roles/[id]/users/route');

    const response = await POST(grant('teammate-1'), params);

    expect(response.status).toBe(200);
    expect(mockGrantRole).toHaveBeenCalled();
  });
});
