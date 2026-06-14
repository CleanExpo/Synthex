/**
 * Unit tests — ensureDefaultRoles / grantSystemRole (RBAC seeding)
 *
 * Covers:
 *   - ensureDefaultRoles seeds Admin/Editor/Viewer idempotently (skipDuplicates)
 *   - Editor is the org default role
 *   - grantSystemRole grants the named role, falls back to the default role,
 *     and no-ops when no role exists
 *
 * @task collaborator-access-rbac
 */

const mockRoleCreateMany = jest.fn();
const mockRoleFindUnique = jest.fn();
const mockRoleFindFirst = jest.fn();
const mockUserRoleCreateMany = jest.fn();

const prismaMock = {
  role: {
    createMany: mockRoleCreateMany,
    findUnique: mockRoleFindUnique,
    findFirst: mockRoleFindFirst,
  },
  userRole: { createMany: mockUserRoleCreateMany },
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: prismaMock,
  prisma: prismaMock,
}));

const ORG_ID = 'org-roles-001';
const USER_ID = 'user-collab-001';

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  mockRoleCreateMany.mockResolvedValue({ count: 3 });
  mockUserRoleCreateMany.mockResolvedValue({ count: 1 });
});

describe('ensureDefaultRoles', () => {
  it('seeds Admin/Editor/Viewer with skipDuplicates (idempotent)', async () => {
    const { ensureDefaultRoles } = await import(
      '@/lib/auth/rbac/ensure-default-roles'
    );
    await ensureDefaultRoles(ORG_ID);

    expect(mockRoleCreateMany).toHaveBeenCalledTimes(1);
    const arg = mockRoleCreateMany.mock.calls[0][0];
    expect(arg.skipDuplicates).toBe(true);

    const names = arg.data.map((r: { name: string }) => r.name);
    expect(names).toEqual(['Admin', 'Editor', 'Viewer']);
    arg.data.forEach((r: { organizationId: string; isSystem: boolean }) => {
      expect(r.organizationId).toBe(ORG_ID);
      expect(r.isSystem).toBe(true);
    });

    // Editor is the org default role.
    const editor = arg.data.find((r: { name: string }) => r.name === 'Editor');
    expect(editor.isDefault).toBe(true);
  });
});

describe('grantSystemRole', () => {
  it('grants the named role when it exists', async () => {
    mockRoleFindUnique.mockResolvedValue({ id: 'role-viewer-1' });

    const { grantSystemRole } = await import(
      '@/lib/auth/rbac/ensure-default-roles'
    );
    await grantSystemRole(USER_ID, ORG_ID, 'Viewer', 'owner-1');

    expect(mockUserRoleCreateMany).toHaveBeenCalledTimes(1);
    const arg = mockUserRoleCreateMany.mock.calls[0][0];
    expect(arg.skipDuplicates).toBe(true);
    expect(arg.data[0]).toMatchObject({
      userId: USER_ID,
      roleId: 'role-viewer-1',
      grantedBy: 'owner-1',
    });
  });

  it('falls back to the org default role when the named role is absent', async () => {
    mockRoleFindUnique.mockResolvedValue(null);
    mockRoleFindFirst.mockResolvedValue({ id: 'role-default-editor' });

    const { grantSystemRole } = await import(
      '@/lib/auth/rbac/ensure-default-roles'
    );
    await grantSystemRole(USER_ID, ORG_ID, 'Viewer', 'owner-1');

    expect(mockRoleFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG_ID, isDefault: true },
      })
    );
    expect(mockUserRoleCreateMany.mock.calls[0][0].data[0].roleId).toBe(
      'role-default-editor'
    );
  });

  it('no-ops when no role exists for the org', async () => {
    mockRoleFindUnique.mockResolvedValue(null);
    mockRoleFindFirst.mockResolvedValue(null);

    const { grantSystemRole } = await import(
      '@/lib/auth/rbac/ensure-default-roles'
    );
    await grantSystemRole(USER_ID, ORG_ID, 'Viewer', 'owner-1');

    expect(mockUserRoleCreateMany).not.toHaveBeenCalled();
  });
});
