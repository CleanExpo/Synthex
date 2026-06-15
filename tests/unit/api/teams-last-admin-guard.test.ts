/**
 * Unit tests — last-admin orphaning guard
 *
 * Covers DELETE /api/teams/members/[memberId] and
 * PATCH  /api/teams/members/[memberId]/role.
 *
 * An organisation must never be left with zero admins/owners. Removing or
 * demoting the LAST admin must be rejected with 409 and make NO write;
 * removing/demoting a non-last admin must still succeed.
 *
 * @task teams-last-admin-guard
 */

// --- Prisma mock --------------------------------------------------------------
// userRole.findMany is called with two distinct `where` shapes:
//   1. { userId }                      -> checkUserIsAdmin / memberIsAdmin probe
//   2. { roleId: { in }, userId:{not}} -> countOtherAdmins probe
// We dispatch on the shape so each test can stage both independently.
const mockUserFindUnique = jest.fn();
const mockUserFindFirst = jest.fn();
const mockUserUpdate = jest.fn();
const mockUserRoleFindMany = jest.fn();
const mockUserRoleCreate = jest.fn();
const mockUserRoleDeleteMany = jest.fn();
const mockRoleFindMany = jest.fn();
const mockRoleFindFirst = jest.fn();
const mockPermissionAuditCreate = jest.fn();

const prismaMock = {
  user: {
    findUnique: mockUserFindUnique,
    findFirst: mockUserFindFirst,
    update: mockUserUpdate,
  },
  userRole: {
    findMany: mockUserRoleFindMany,
    create: mockUserRoleCreate,
    deleteMany: mockUserRoleDeleteMany,
  },
  role: {
    findMany: mockRoleFindMany,
    findFirst: mockRoleFindFirst,
  },
  permissionAudit: { create: mockPermissionAuditCreate },
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: prismaMock,
  prisma: prismaMock,
}));

const mockGetUserId = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserId(...args),
}));

jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: jest.fn().mockResolvedValue({ allowed: true }),
    createSecureResponse: (body: unknown, status: number) =>
      ({ status, json: async () => body }) as unknown,
  },
  DEFAULT_POLICIES: { AUTHENTICATED_READ: {}, AUTHENTICATED_WRITE: {} },
}));

jest.mock('@/lib/security/audit-logger', () => ({
  auditLogger: { log: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

jest.mock('@/lib/api/response-optimizer', () => ({
  ResponseOptimizer: {
    createResponse: (data: unknown, opts: { status?: number } = {}) =>
      ({ status: opts.status ?? 200, json: async () => data }) as unknown,
    createErrorResponse: (message: string, status: number) =>
      ({ status, json: async () => ({ error: message }) }) as unknown,
  },
}));

jest.mock('next/server', () => {
  class MockNextResponse {
    status: number;
    private _body: string;
    constructor(body: string, init: { status?: number } = {}) {
      this._body = body;
      this.status = init.status ?? 200;
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

const ADMIN_ID = 'user-admin-acting';
const TARGET_ID = 'user-target';
const ORG_ID = 'org-1';

const ADMIN_ROLE = { id: 'role-admin', name: 'Admin', permissions: ['*'] };
const EDITOR_ROLE = {
  id: 'role-editor',
  name: 'Editor',
  permissions: ['posts:read'],
};

function makeReq(body?: unknown) {
  return {
    json: async () => body ?? {},
  } as unknown;
}

const params = (id: string) => ({ params: Promise.resolve({ memberId: id }) });

/**
 * Stage userRole.findMany so the per-user admin probe (`where.userId`) and the
 * countOtherAdmins probe (`where.roleId`) each return the requested data.
 *
 * @param adminUserIds  user ids that should resolve as holding the admin role
 * @param otherAdminIds user ids returned for the countOtherAdmins probe
 */
function stageUserRoles(adminUserIds: string[], otherAdminIds: string[]) {
  mockUserRoleFindMany.mockImplementation((args: { where?: Record<string, unknown> }) => {
    const where = args?.where ?? {};
    // countOtherAdmins probe
    if (where.roleId) {
      return Promise.resolve(otherAdminIds.map((userId) => ({ userId })));
    }
    // per-user admin probe (checkUserIsAdmin / memberIsAdmin / role PATCH current roles)
    const userId = where.userId as string;
    if (adminUserIds.includes(userId)) {
      return Promise.resolve([{ userId, roleId: ADMIN_ROLE.id, role: ADMIN_ROLE }]);
    }
    return Promise.resolve([{ userId, roleId: EDITOR_ROLE.id, role: EDITOR_ROLE }]);
  });
}

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  process.env.DATABASE_URL = 'postgres://test';
  mockGetUserId.mockResolvedValue(ADMIN_ID);
  mockUserFindUnique.mockResolvedValue({ organizationId: ORG_ID });
  mockUserFindFirst.mockResolvedValue({
    id: TARGET_ID,
    email: 'target@example.com',
    name: 'Target',
    organizationId: ORG_ID,
  });
  mockUserUpdate.mockResolvedValue({ id: TARGET_ID, organizationId: null });
  mockUserRoleDeleteMany.mockResolvedValue({ count: 1 });
  mockUserRoleCreate.mockResolvedValue({});
  mockRoleFindMany.mockResolvedValue([ADMIN_ROLE, EDITOR_ROLE]);
  mockRoleFindFirst.mockResolvedValue(EDITOR_ROLE);
  mockPermissionAuditCreate.mockResolvedValue({});
});

describe('DELETE /api/teams/members/[memberId] — last-admin guard', () => {
  it('rejects removing the last admin (409, no write)', async () => {
    // Acting user is admin; target is admin; NO other admin remains.
    stageUserRoles([ADMIN_ID, TARGET_ID], []);

    const { DELETE } = await import(
      '@/app/api/teams/members/[memberId]/route'
    );
    const res = await DELETE(makeReq() as never, params(TARGET_ID) as never);

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('Cannot remove the last admin of an organisation');
    expect(mockUserUpdate).not.toHaveBeenCalled();
    expect(mockUserRoleDeleteMany).not.toHaveBeenCalled();
  });

  it('allows removing a non-last admin (succeeds, writes)', async () => {
    // Target is admin, but another admin remains.
    stageUserRoles([ADMIN_ID, TARGET_ID], ['user-other-admin']);

    const { DELETE } = await import(
      '@/app/api/teams/members/[memberId]/route'
    );
    const res = await DELETE(makeReq() as never, params(TARGET_ID) as never);

    expect(res.status).toBe(200);
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TARGET_ID },
        data: { organizationId: null },
      })
    );
  });

  it('allows removing a non-admin member (guard does not trip)', async () => {
    // Acting user admin; target is NOT an admin -> guard skipped entirely.
    stageUserRoles([ADMIN_ID], []);

    const { DELETE } = await import(
      '@/app/api/teams/members/[memberId]/route'
    );
    const res = await DELETE(makeReq() as never, params(TARGET_ID) as never);

    expect(res.status).toBe(200);
    expect(mockUserUpdate).toHaveBeenCalledTimes(1);
  });
});

describe('PATCH /api/teams/members/[memberId]/role — last-admin guard', () => {
  it('rejects demoting the last admin (409, no write)', async () => {
    // Target currently admin; new role = Editor (non-admin); no other admin.
    mockRoleFindFirst.mockResolvedValue(EDITOR_ROLE);
    stageUserRoles([ADMIN_ID, TARGET_ID], []);

    const { PATCH } = await import(
      '@/app/api/teams/members/[memberId]/role/route'
    );
    const res = await PATCH(
      makeReq({ roleId: EDITOR_ROLE.id }) as never,
      params(TARGET_ID) as never
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('Cannot remove the last admin of an organisation');
    expect(mockUserRoleDeleteMany).not.toHaveBeenCalled();
    expect(mockUserRoleCreate).not.toHaveBeenCalled();
  });

  it('allows demoting when another admin exists (succeeds, writes)', async () => {
    mockRoleFindFirst.mockResolvedValue(EDITOR_ROLE);
    stageUserRoles([ADMIN_ID, TARGET_ID], ['user-other-admin']);

    const { PATCH } = await import(
      '@/app/api/teams/members/[memberId]/role/route'
    );
    const res = await PATCH(
      makeReq({ roleId: EDITOR_ROLE.id }) as never,
      params(TARGET_ID) as never
    );

    expect(res.status).toBe(200);
    expect(mockUserRoleDeleteMany).toHaveBeenCalledTimes(1);
    expect(mockUserRoleCreate).toHaveBeenCalledTimes(1);
  });

  it('allows promotion of the last admin to another admin role (guard not triggered)', async () => {
    // New role is itself admin/owner -> not a demotion, no orphaning risk.
    mockRoleFindFirst.mockResolvedValue(ADMIN_ROLE);
    stageUserRoles([ADMIN_ID, TARGET_ID], []);

    const { PATCH } = await import(
      '@/app/api/teams/members/[memberId]/role/route'
    );
    const res = await PATCH(
      makeReq({ roleId: ADMIN_ROLE.id }) as never,
      params(TARGET_ID) as never
    );

    expect(res.status).toBe(200);
    expect(mockUserRoleCreate).toHaveBeenCalledTimes(1);
  });
});
