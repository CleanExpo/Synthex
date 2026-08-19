/**
 * Unit tests — RoleManager reserved-name guard (SYN-1109 root #2)
 *
 * A `roles:manage` holder could create — or RENAME a custom role to — 'owner'
 * (or 'admin'). rankOfRole()/resolveIssuerRole() then read that role as elevated
 * authority, bypassing the assignment-time issuer-rank guard which only covers
 * role ASSIGNMENT, not role DEFINITION. createRole/updateRole now reject the
 * reserved rank names (case-insensitive, trimmed).
 *
 * @task SYN-1109
 */

const mockRoleFindUnique = jest.fn();
const mockRoleUpdateMany = jest.fn();
const mockRoleCreate = jest.fn();
const mockRoleUpdate = jest.fn();
const mockAuditCreate = jest.fn();
const mockGetUserPermissions = jest.fn();

const prismaMock = {
  role: {
    findUnique: mockRoleFindUnique,
    updateMany: mockRoleUpdateMany,
    create: mockRoleCreate,
    update: mockRoleUpdate,
  },
  userRole: { count: jest.fn().mockResolvedValue(0) },
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
    canDelegatePermissions: actual.canDelegatePermissions,
    PermissionEngine: {
      isValidPermission: () => true,
      getUserPermissions: mockGetUserPermissions,
      invalidateOrganizationPermissions: jest.fn().mockResolvedValue(undefined),
    },
    Permission: {},
    ALL_PERMISSIONS: [],
  };
});

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const ORG_ID = 'org-1';
const ACTOR = 'user-1';

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserPermissions.mockResolvedValue({ permissions: ['*'] });
  mockRoleFindUnique.mockResolvedValue(null);
  mockRoleCreate.mockResolvedValue({ id: 'role-new', name: 'Editor Plus' });
  mockRoleUpdate.mockResolvedValue({ id: 'role-1', name: 'Editor Plus' });
});

describe('RoleManager.createRole — reserved names', () => {
  it.each(['owner', 'Owner', 'OWNER', ' admin ', 'Admin'])(
    'rejects creating a role named "%s"',
    async name => {
      const { RoleManager } = await import('@/lib/auth/rbac/role-manager');
      await expect(
        RoleManager.createRole(ORG_ID, { name, permissions: [] }, ACTOR)
      ).rejects.toThrow(/reserved role name/i);
      expect(mockRoleCreate).not.toHaveBeenCalled();
    }
  );

  it('allows a normal custom role name', async () => {
    const { RoleManager } = await import('@/lib/auth/rbac/role-manager');
    await RoleManager.createRole(
      ORG_ID,
      { name: 'Editor Plus', permissions: [] },
      ACTOR
    );
    expect(mockRoleCreate).toHaveBeenCalledTimes(1);
  });
});

describe('RoleManager.updateRole — reserved names', () => {
  it('rejects renaming a custom role to "owner"', async () => {
    mockRoleFindUnique.mockResolvedValue({
      id: 'role-1',
      name: 'Editor Plus',
      isSystem: false,
      organizationId: ORG_ID,
    });

    const { RoleManager } = await import('@/lib/auth/rbac/role-manager');
    await expect(
      RoleManager.updateRole('role-1', { name: 'owner' }, ACTOR)
    ).rejects.toThrow(/reserved role name/i);
    expect(mockRoleUpdate).not.toHaveBeenCalled();
  });

  it('allows a permissions-only update on a custom role (no name change)', async () => {
    mockRoleFindUnique.mockResolvedValue({
      id: 'role-1',
      name: 'Editor Plus',
      isSystem: false,
      organizationId: ORG_ID,
    });

    const { RoleManager } = await import('@/lib/auth/rbac/role-manager');
    await RoleManager.updateRole(
      'role-1',
      { permissions: ['posts:read'] },
      ACTOR
    );
    expect(mockRoleUpdate).toHaveBeenCalledTimes(1);
  });
});
