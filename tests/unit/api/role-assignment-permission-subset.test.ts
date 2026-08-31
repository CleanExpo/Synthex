/**
 * SYN-1112 F6 — role-ASSIGNMENT permission containment.
 *
 * `assertPermissionsWithinActor` guarded role DEFINITION (createRole /
 * updateRole). Assignment was guarded only by `requireIssuerOutranks`, which
 * buckets a role into four coarse ranks: a custom-NAMED role whose permissions
 * are canonical `resource:action` strings ranks as `viewer`, because
 * ADMIN_PERMISSIONS only lists the legacy underscore names (`manage_roles`,
 * `manage_members`). So a `roles:manage` holder — itself ranked `viewer` for
 * the same reason — passed the rank guard (0 >= 0) and could seat a role
 * carrying `organization:manage` on themselves.
 *
 * WHAT IS REAL AND WHAT IS STUBBED (stated precisely, because a docstring that
 * overstates its own rigour is the defect it claims to prevent):
 *   REAL     — the route handler, RoleManager.grantRole, assignDefaultRole,
 *              assertPermissionsWithinActor, canDelegatePermissions,
 *              rankOfRole / requireIssuerOutranks / resolveIssuerRole.
 *   STUBBED  — the Prisma client (the persistence boundary), and
 *              PermissionEngine.check / getUserPermissions, which are the
 *              cache-and-database resolvers. Their stubs supply INPUT to the
 *              containment logic; they never decide its outcome.
 *
 * So a denial here is produced by the real containment algorithm, and the
 * assertion is on the persistence call (`userRole.create`) never happening —
 * not on a mock returning a rehearsed verdict.
 */

const mockGetUserId = jest.fn();
const mockUserFindUnique = jest.fn();
const mockRoleFindUnique = jest.fn();
const mockRoleFindFirst = jest.fn();
const mockRoleUpdate = jest.fn();
const mockRoleUpdateMany = jest.fn();
const mockUserRoleFindUnique = jest.fn();
const mockUserRoleCreate = jest.fn();
const mockUserRoleUpdate = jest.fn();
const mockUserRoleFindMany = jest.fn();
const mockAuditCreate = jest.fn();
const mockOwnershipFindFirst = jest.fn();
const mockTeamMemberFindUnique = jest.fn();
const mockGetUserPermissions = jest.fn();
const mockInvalidateUserPermissions = jest.fn();
const mockPermissionCheck = jest.fn();

jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: mockGetUserId,
}));

const prismaMock = {
  user: { findUnique: mockUserFindUnique },
  role: {
    findUnique: mockRoleFindUnique,
    findFirst: mockRoleFindFirst,
    update: mockRoleUpdate,
    updateMany: mockRoleUpdateMany,
  },
  userRole: {
    findUnique: mockUserRoleFindUnique,
    create: mockUserRoleCreate,
    update: mockUserRoleUpdate,
    findMany: mockUserRoleFindMany,
  },
  permissionAudit: { create: mockAuditCreate },
  businessOwnership: { findFirst: mockOwnershipFindFirst },
  teamMember: { findUnique: mockTeamMemberFindUnique },
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
      invalidateUserPermissions: mockInvalidateUserPermissions,
      isValidPermission: actual.PermissionEngine.isValidPermission,
    },
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
  // Mirrors permission-engine.ts:142-149 — `check` resolves through
  // getUserPermissions and denies when it returns null. Reproduced so the
  // route's upstream gate and the containment guard are driven by ONE
  // permission source, as they are in production. Set here, not in the module
  // factory, because the suite runs with resetMocks:true.
  mockPermissionCheck.mockImplementation(
    async (userId: string, organizationId: string) => {
      const perms = await mockGetUserPermissions(userId, organizationId);
      if (!perms) {
        return {
          allowed: false,
          reason: 'User has no permissions in this organization',
        };
      }
      return { allowed: true };
    }
  );
  mockGetUserId.mockResolvedValue(ATTACKER_ID);
  mockUserFindUnique.mockImplementation(async (args: any) => ({
    id: args.where.id,
    organizationId: ORG_ID,
  }));
  mockRoleFindUnique.mockResolvedValue(opsLeadRole());
  mockUserRoleFindUnique.mockResolvedValue(null); // not already assigned
  mockUserRoleCreate.mockResolvedValue({});
  mockUserRoleUpdate.mockResolvedValue({});
  mockRoleUpdate.mockResolvedValue(opsLeadRole());
  mockRoleUpdateMany.mockResolvedValue({});
  mockAuditCreate.mockResolvedValue({});
  mockInvalidateUserPermissions.mockResolvedValue(undefined);
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
      message: 'Role permissions cannot exceed your own permissions',
    });
    expect(mockUserRoleCreate).not.toHaveBeenCalled();
  });

  it('refuses the same escalation when seated on a third party', async () => {
    const { POST } = await import('@/app/api/roles/[id]/users/route');

    const response = await POST(grant('victim-1'), params);

    expect(response.status).toBe(403);
    expect(mockUserRoleCreate).not.toHaveBeenCalled();
  });

  // Positive controls. The issuer-rank guard scores both sides identically in
  // every case below, so only the containment invariant separates these from
  // the denials above — proving it discriminates rather than blanket-denies.
  it('allows an actor who already holds organization:manage to delegate it', async () => {
    seatActorWith(['roles:manage', 'organization:manage']);
    const { POST } = await import('@/app/api/roles/[id]/users/route');

    const response = await POST(grant('teammate-1'), params);

    expect(response.status).toBe(200);
    expect(mockUserRoleCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'teammate-1',
        roleId: ROLE_ID,
        grantedBy: ATTACKER_ID,
      }),
    });
  });

  it('allows a wildcard holder to delegate any declared permission', async () => {
    seatActorWith(['*']);
    const { POST } = await import('@/app/api/roles/[id]/users/route');

    const response = await POST(grant('teammate-1'), params);

    expect(response.status).toBe(200);
    expect(mockUserRoleCreate).toHaveBeenCalled();
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
    expect(mockUserRoleCreate).toHaveBeenCalled();
  });

  /**
   * Review finding (deepseek/deepseek-v4-pro, P1): "the new guard locks out a
   * legitimate roles:manage actor whose permission is not a UserRole row".
   * It does not, and this is the demonstration rather than the assertion: the
   * route's own gate resolves through the SAME resolver, so such an actor is
   * already refused upstream with the pre-existing message. The containment
   * guard is never reached, so it cannot have changed this outcome.
   */
  it('leaves an actor with no UserRole rows refused by the pre-existing gate', async () => {
    mockGetUserPermissions.mockResolvedValue(null);
    const { POST } = await import('@/app/api/roles/[id]/users/route');

    const response = await POST(grant('teammate-1'), params);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      message: 'roles:manage permission required',
    });
    expect(mockUserRoleCreate).not.toHaveBeenCalled();
  });
});

describe('RoleManager.grantRole — containment holds below the route', () => {
  it('refuses a grant whose permissions exceed the actor, called directly', async () => {
    const { RoleManager } = await import('@/lib/auth/rbac/role-manager');

    await expect(
      RoleManager.grantRole(
        { userId: 'victim-1', roleId: ROLE_ID },
        ATTACKER_ID
      )
    ).rejects.toThrow('Role permissions cannot exceed your own permissions');
    expect(mockUserRoleCreate).not.toHaveBeenCalled();
  });

  /**
   * The expiry-refresh branch returns before the write, so a containment check
   * placed after it would let an actor extend a grant they could never have
   * made. The guard runs first; this pins that ordering.
   */
  it('refuses an expiry refresh on an already-assigned over-privileged role', async () => {
    mockUserRoleFindUnique.mockResolvedValue({
      id: 'ur-1',
      userId: 'victim-1',
      roleId: ROLE_ID,
      expiresAt: new Date('2027-01-01'),
    });
    const { RoleManager } = await import('@/lib/auth/rbac/role-manager');

    await expect(
      RoleManager.grantRole(
        {
          userId: 'victim-1',
          roleId: ROLE_ID,
          expiresAt: new Date('2030-01-01'),
        },
        ATTACKER_ID
      )
    ).rejects.toThrow('Role permissions cannot exceed your own permissions');
    expect(mockUserRoleUpdate).not.toHaveBeenCalled();
  });

  it('allows the same direct grant once the actor holds the permission', async () => {
    seatActorWith(['roles:manage', 'organization:manage']);
    const { RoleManager } = await import('@/lib/auth/rbac/role-manager');

    await RoleManager.grantRole(
      { userId: 'victim-1', roleId: ROLE_ID },
      ATTACKER_ID
    );

    expect(mockUserRoleCreate).toHaveBeenCalled();
  });

  /**
   * Review finding (qwen3.7-max + qwen3.5-plus + qwen3.8-2.4t, P0): coercing a
   * malformed permission set to [] would make containment trivially satisfied,
   * since every actor contains the empty set. Prisma types the column as a
   * non-nullable String[], so this can only arise from a partial select or a
   * corrupt row — and the guard must refuse rather than guess.
   */
  it('refuses a role whose permission set is not an array', async () => {
    mockRoleFindUnique.mockResolvedValue({
      ...opsLeadRole(),
      permissions: undefined,
    });
    seatActorWith(['*']); // even a wildcard actor must not get a silent pass
    const { RoleManager } = await import('@/lib/auth/rbac/role-manager');

    await expect(
      RoleManager.grantRole(
        { userId: 'victim-1', roleId: ROLE_ID },
        ATTACKER_ID
      )
    ).rejects.toThrow('Role permissions cannot exceed your own permissions');
    expect(mockUserRoleCreate).not.toHaveBeenCalled();
  });

  /**
   * Review finding (qwen/qwen3.5-plus + deepseek-v4-flash, P0/P1): a
   * `private static` applyGrant would still be callable as
   * `RoleManager['applyGrant']`, because TypeScript's `private` is erased at
   * compile time. It is now a module-scoped function, so the runtime object
   * carries no such member and the unchecked write path cannot be reached
   * from another module at all.
   */
  it('exposes no applyGrant member that could skip containment', () => {
    const Manager = jest.requireActual('@/lib/auth/rbac/role-manager')
      .RoleManager as Record<string, unknown>;

    expect(Manager.applyGrant).toBeUndefined();
    expect(Object.getOwnPropertyNames(Manager)).not.toContain('applyGrant');
  });

  /**
   * Review finding (deepseek/deepseek-v4-pro, P0): "'contained when it was
   * defined' is not 'contained now' — an attacker with roles:manage could
   * raise the default role's permissions afterwards, and assignDefaultRole
   * would then seat the escalated role on every new member."
   *
   * That relies on the containment check being a one-time event at creation.
   * It is not: updateRole re-validates against the acting user on EVERY
   * permissions change, so the raise is refused before it can reach any
   * default role. This is the demonstration of that, so the bootstrap path's
   * safety rests on an executed control rather than on the comment above it.
   */
  it('refuses an attacker raising a role permission set after definition', async () => {
    mockRoleFindUnique.mockResolvedValue({
      ...opsLeadRole(),
      name: 'Member',
      permissions: ['posts:read'],
      isDefault: true,
    });
    seatActorWith(['roles:manage']);
    const { RoleManager } = await import('@/lib/auth/rbac/role-manager');

    await expect(
      RoleManager.updateRole(
        ROLE_ID,
        { permissions: ['posts:read', 'organization:manage'] },
        ATTACKER_ID
      )
    ).rejects.toThrow('Role permissions cannot exceed your own permissions');
    expect(mockRoleUpdate).not.toHaveBeenCalled();
  });

  /**
   * Signup bootstrap has no acting user to contain against, and by the control
   * above its role can never have come to exceed whoever last set it. This
   * path must keep working — a containment guard that failed closed here would
   * break every new member.
   */
  it('still seats the default role during bootstrap with no actor permissions', async () => {
    mockGetUserPermissions.mockResolvedValue(null);
    mockRoleFindFirst.mockResolvedValue({
      ...opsLeadRole(),
      id: 'role-default',
      name: 'Editor',
      isDefault: true,
    });
    const { RoleManager } = await import('@/lib/auth/rbac/role-manager');

    await RoleManager.assignDefaultRole('new-user-1', ORG_ID);

    expect(mockUserRoleCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'new-user-1',
        roleId: 'role-default',
      }),
    });
  });
});
