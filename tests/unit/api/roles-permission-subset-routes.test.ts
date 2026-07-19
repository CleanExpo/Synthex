const mockGetUserId = jest.fn();
const mockUserFindUnique = jest.fn();
const mockRoleFindUnique = jest.fn();
const mockPermissionCheck = jest.fn();
const mockCreateRole = jest.fn();
const mockUpdateRole = jest.fn();

class MockRolePermissionSubsetError extends Error {
  constructor() {
    super('Role permissions cannot exceed your own permissions');
    this.name = 'RolePermissionSubsetError';
  }
}

jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: mockGetUserId,
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: mockUserFindUnique },
    role: { findUnique: mockRoleFindUnique },
    userRole: { count: jest.fn() },
  },
}));

jest.mock('@/lib/auth/rbac/permission-engine', () => ({
  PermissionEngine: { check: mockPermissionCheck },
  ALL_PERMISSIONS: [],
}));

jest.mock('@/lib/auth/rbac/role-manager', () => ({
  RolePermissionSubsetError: MockRolePermissionSubsetError,
  RoleManager: {
    createRole: mockCreateRole,
    updateRole: mockUpdateRole,
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

jest.mock('@/lib/utils/error-utils', () => ({
  sanitizeErrorForResponse: (_error: unknown, fallback: string) => fallback,
}));

const USER_ID = 'user-1';
const ORG_ID = 'org-1';

function request(method: string, body: object) {
  return {
    url: 'http://localhost:3008/api/roles',
    method,
    headers: {
      get: (name: string) =>
        name === 'content-type' ? 'application/json' : null,
      has: () => false,
    },
    nextUrl: new URL('http://localhost:3008/api/roles'),
    json: async () => body,
    text: async () => JSON.stringify(body),
    cookies: { get: () => undefined, getAll: () => [], has: () => false },
  } as any;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserId.mockResolvedValue(USER_ID);
  mockUserFindUnique.mockResolvedValue({ id: USER_ID, organizationId: ORG_ID });
  mockPermissionCheck.mockResolvedValue({ allowed: true });
  mockRoleFindUnique.mockResolvedValue({
    id: 'role-1',
    organizationId: ORG_ID,
    isSystem: false,
  });
});

describe('roles routes — permission subset denial', () => {
  it('POST returns deterministic 403 and keeps the actor organisation scoped', async () => {
    mockCreateRole.mockRejectedValue(new MockRolePermissionSubsetError());
    const { POST } = await import('@/app/api/roles/route');

    const response = await POST(
      request('POST', {
        name: 'Billing Manager',
        permissions: ['billing:manage'],
      })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Forbidden',
      message: 'Role permissions cannot exceed your own permissions',
    });
    expect(mockPermissionCheck).toHaveBeenCalledWith(USER_ID, ORG_ID, {
      resource: 'roles',
      action: 'manage',
    });
    expect(mockCreateRole).toHaveBeenCalledWith(
      ORG_ID,
      expect.objectContaining({ permissions: ['billing:manage'] }),
      USER_ID
    );
  });

  it('PATCH returns deterministic 403 after an organisation-owned role lookup', async () => {
    mockUpdateRole.mockRejectedValue(new MockRolePermissionSubsetError());
    const { PATCH } = await import('@/app/api/roles/[id]/route');

    const response = await PATCH(
      request('PATCH', { permissions: ['billing:manage'] }),
      { params: Promise.resolve({ id: 'role-1' }) }
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Forbidden',
      message: 'Role permissions cannot exceed your own permissions',
    });
    expect(mockRoleFindUnique).toHaveBeenCalledWith({
      where: { id: 'role-1' },
    });
    expect(mockUpdateRole).toHaveBeenCalledWith(
      'role-1',
      expect.objectContaining({ permissions: ['billing:manage'] }),
      USER_ID
    );
  });
});
