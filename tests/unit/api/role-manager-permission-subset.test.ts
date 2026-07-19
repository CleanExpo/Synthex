/**
 * SYN-1112 F6 — role-definition permission containment.
 *
 * Wildcards are authority over an open-ended namespace. They may only be
 * delegated from an equal or broader wildcard; finite concrete grants never
 * combine into wildcard authority.
 */

const mockRoleFindUnique = jest.fn();
const mockRoleUpdateMany = jest.fn();
const mockRoleCreate = jest.fn();
const mockRoleUpdate = jest.fn();
const mockAuditCreate = jest.fn();
const mockGetUserPermissions = jest.fn();
const mockInvalidateOrganizationPermissions = jest.fn();

const prismaMock = {
  role: {
    findUnique: mockRoleFindUnique,
    updateMany: mockRoleUpdateMany,
    create: mockRoleCreate,
    update: mockRoleUpdate,
  },
  permissionAudit: { create: mockAuditCreate },
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
      isValidPermission: actual.PermissionEngine.isValidPermission,
      getUserPermissions: mockGetUserPermissions,
      invalidateOrganizationPermissions: mockInvalidateOrganizationPermissions,
    },
  };
});

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const ORG_ID = 'org-1';
const ACTOR_ID = 'actor-1';

function actorPermissions(permissions: string[]) {
  return {
    userId: ACTOR_ID,
    organizationId: ORG_ID,
    permissions,
    roles: [],
    cachedAt: new Date(),
  };
}

function existingRole() {
  return {
    id: 'role-1',
    name: 'Custom Role',
    description: null,
    permissions: ['roles:manage', 'posts:read'],
    isDefault: false,
    isSystem: false,
    organizationId: ORG_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRoleFindUnique.mockResolvedValue(null);
  mockRoleCreate.mockResolvedValue({ ...existingRole(), id: 'role-new' });
  mockRoleUpdate.mockResolvedValue(existingRole());
  mockAuditCreate.mockResolvedValue({});
  mockGetUserPermissions.mockResolvedValue(
    actorPermissions(['roles:manage', 'posts:read'])
  );
  mockInvalidateOrganizationPermissions.mockResolvedValue(undefined);
});

describe('canDelegatePermissions — structural wildcard containment', () => {
  it.each([
    [['posts:read'], ['posts:read']],
    [['posts:*'], ['posts:read']],
    [['*:read'], ['posts:read']],
    [['campaigns:manage'], ['campaigns:create']],
    [['*'], ['posts:*', '*:read', 'billing:manage']],
  ])('allows actor grants %j to contain %j', async (actor, requested) => {
    const { canDelegatePermissions } =
      await import('@/lib/auth/rbac/permission-engine');
    expect(canDelegatePermissions(actor, requested)).toBe(true);
  });

  it.each([
    [
      [
        'posts:read',
        'posts:create',
        'posts:update',
        'posts:delete',
        'posts:approve',
      ],
      ['posts:*'],
    ],
    [['campaigns:manage'], ['campaigns:*']],
    [['posts:read', 'campaigns:read', 'analytics:read'], ['*:read']],
    [['*:manage'], ['posts:*']],
    [['posts:*'], ['*:read']],
    [['roles:manage'], ['*']],
  ])(
    'denies actor grants %j from minting wildcard %j',
    async (actor, requested) => {
      const { canDelegatePermissions } =
        await import('@/lib/auth/rbac/permission-engine');
      expect(canDelegatePermissions(actor, requested)).toBe(false);
    }
  );

  it('treats *:manage as action-scoped rather than global authority', async () => {
    const { canDelegatePermissions } =
      await import('@/lib/auth/rbac/permission-engine');
    expect(canDelegatePermissions(['*:manage'], ['billing:manage'])).toBe(true);
    expect(canDelegatePermissions(['*:manage'], ['billing:update'])).toBe(
      false
    );
    expect(canDelegatePermissions(['*:manage'], ['*'])).toBe(false);
  });

  it('fails closed for malformed requested permissions', async () => {
    const { canDelegatePermissions } =
      await import('@/lib/auth/rbac/permission-engine');
    expect(canDelegatePermissions(['*'], ['not-a-permission'])).toBe(false);
    expect(canDelegatePermissions(['*'], ['constructor:*'])).toBe(false);
    expect(canDelegatePermissions(['*'], ['constructor:read'])).toBe(false);
  });
});

describe('RoleManager.createRole — actor permission containment', () => {
  it('rejects excess authority before duplicate/default/create/audit side effects', async () => {
    const { RoleManager } = await import('@/lib/auth/rbac/role-manager');

    await expect(
      RoleManager.createRole(
        ORG_ID,
        {
          name: 'Billing Manager',
          permissions: ['roles:manage', 'billing:manage'],
          isDefault: true,
        },
        ACTOR_ID
      )
    ).rejects.toThrow(/exceed your own permissions/i);

    expect(mockGetUserPermissions).toHaveBeenCalledWith(ACTOR_ID, ORG_ID);
    expect(mockRoleFindUnique).not.toHaveBeenCalled();
    expect(mockRoleUpdateMany).not.toHaveBeenCalled();
    expect(mockRoleCreate).not.toHaveBeenCalled();
    expect(mockAuditCreate).not.toHaveBeenCalled();
  });

  it('allows an exact concrete subset', async () => {
    const { RoleManager } = await import('@/lib/auth/rbac/role-manager');
    await expect(
      RoleManager.createRole(
        ORG_ID,
        { name: 'Content Reader', permissions: ['posts:read'] },
        ACTOR_ID
      )
    ).resolves.toBeDefined();
    expect(mockRoleCreate).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the actor lookup returns null or rejects', async () => {
    const { RoleManager } = await import('@/lib/auth/rbac/role-manager');

    mockGetUserPermissions.mockResolvedValueOnce(null);
    await expect(
      RoleManager.createRole(
        ORG_ID,
        { name: 'Reader', permissions: ['posts:read'] },
        ACTOR_ID
      )
    ).rejects.toThrow(/exceed your own permissions/i);

    mockGetUserPermissions.mockRejectedValueOnce(
      new Error('cache unavailable')
    );
    await expect(
      RoleManager.createRole(
        ORG_ID,
        { name: 'Reader', permissions: ['posts:read'] },
        ACTOR_ID
      )
    ).rejects.toThrow(/exceed your own permissions/i);

    expect(mockRoleCreate).not.toHaveBeenCalled();
    expect(mockAuditCreate).not.toHaveBeenCalled();
  });

  it('allows an empty grant without resolving actor permissions', async () => {
    mockGetUserPermissions.mockRejectedValue(new Error('must not be called'));
    const { RoleManager } = await import('@/lib/auth/rbac/role-manager');

    await expect(
      RoleManager.createRole(
        ORG_ID,
        { name: 'No Access', permissions: [] },
        ACTOR_ID
      )
    ).resolves.toBeDefined();

    expect(mockGetUserPermissions).not.toHaveBeenCalled();
    expect(mockRoleCreate).toHaveBeenCalledTimes(1);
  });
});

describe('RoleManager.updateRole — actor permission containment', () => {
  it('uses the existing role organisation and rejects excess authority before writes', async () => {
    mockRoleFindUnique.mockResolvedValue(existingRole());
    const { RoleManager } = await import('@/lib/auth/rbac/role-manager');

    await expect(
      RoleManager.updateRole(
        'role-1',
        { permissions: ['posts:read', 'billing:manage'], isDefault: true },
        ACTOR_ID
      )
    ).rejects.toThrow(/exceed your own permissions/i);

    expect(mockGetUserPermissions).toHaveBeenCalledWith(ACTOR_ID, ORG_ID);
    expect(mockRoleUpdateMany).not.toHaveBeenCalled();
    expect(mockRoleUpdate).not.toHaveBeenCalled();
    expect(mockInvalidateOrganizationPermissions).not.toHaveBeenCalled();
    expect(mockAuditCreate).not.toHaveBeenCalled();
  });

  it('leaves non-permission updates unchanged without resolving actor permissions', async () => {
    mockRoleFindUnique.mockResolvedValue(existingRole());
    mockGetUserPermissions.mockRejectedValue(new Error('must not be called'));
    const { RoleManager } = await import('@/lib/auth/rbac/role-manager');

    await expect(
      RoleManager.updateRole(
        'role-1',
        { description: 'Updated description' },
        ACTOR_ID
      )
    ).resolves.toBeDefined();

    expect(mockGetUserPermissions).not.toHaveBeenCalled();
    expect(mockRoleUpdate).toHaveBeenCalledTimes(1);
  });
});
