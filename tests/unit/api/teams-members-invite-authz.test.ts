/**
 * Unit tests — POST /api/teams/members (member-invite authorisation)
 *
 * Verifies the invite POST now authorises with the SAME canonical
 * admin/owner-or-permission, org-scoped definition used by the sibling
 * change-role (`[memberId]/role`) and remove-member (`[memberId]`) routes via a
 * route-local `checkUserIsAdmin` helper — closing the prior gap where invite
 * used weaker/narrower ad-hoc `userRole.findFirst` logic (first role only,
 * ignored `manage_roles`/`manage_members`/`*`, not reliably org-scoped).
 *
 * Drives the REAL POST handler.
 *
 * Scenarios:
 *  - admin-by-role-name → invite succeeds (201)
 *  - admin-by `manage_members` permission → invite succeeds (201)
 *  - admin-by `*` wildcard permission → invite succeeds (201)
 *  - non-admin (viewer) → 403, no write
 *  - cross-org actor (admin role belongs to a different org) → 403, no write
 *
 * @task invite-authz-align
 */

const mockUserFindUnique = jest.fn();
const mockUserFindUniqueByEmail = jest.fn();
const mockUserRoleFindMany = jest.fn();
const mockTeamInvitationFindFirst = jest.fn();
const mockTeamInvitationCreate = jest.fn();

// prisma.user.findUnique is called twice in the handler:
//  1) by { id } to resolve the inviter's org
//  2) by { email } to check the invitee already exists
// Route them by the shape of the `where` clause. NOTE: the jest config sets
// resetMocks:true, which wipes inline jest.fn() implementations before each
// test — so the router implementation is (re)installed in beforeEach below.
const mockUserFindUniqueRouter = jest.fn();

const prismaMock = {
  user: { findUnique: mockUserFindUniqueRouter },
  userRole: { findMany: mockUserRoleFindMany },
  teamInvitation: {
    findFirst: mockTeamInvitationFindFirst,
    create: mockTeamInvitationCreate,
  },
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: prismaMock,
  prisma: prismaMock,
}));

const mockSecurityCheck = jest.fn();
jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: (...args: unknown[]) => mockSecurityCheck(...args),
    createSecureResponse: (body: unknown, status: number) =>
      ({
        status,
        json: async () => body,
      }) as unknown,
  },
  DEFAULT_POLICIES: { AUTHENTICATED_WRITE: {}, AUTHENTICATED_READ: {} },
}));

const mockEmailSend = jest.fn();
jest.mock('@/lib/email/index', () => ({
  email: { send: (...args: unknown[]) => mockEmailSend(...args) },
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const ADMIN_ID = 'user-admin-1';
const ORG_ID = 'org-1';
const OTHER_ORG_ID = 'org-2';

function makeReq(body: unknown = { email: 'collab@example.com', role: 'editor' }) {
  return { json: async () => body } as unknown;
}

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  process.env.DATABASE_URL = 'postgres://test';

  mockSecurityCheck.mockResolvedValue({
    allowed: true,
    context: { userId: ADMIN_ID },
  });

  // (Re)install the findUnique router after jest's per-test mock reset.
  mockUserFindUniqueRouter.mockImplementation(
    (args: { where?: { id?: string; email?: string } }) => {
      if (args?.where?.email !== undefined) {
        return mockUserFindUniqueByEmail(args);
      }
      return mockUserFindUnique(args);
    }
  );

  // Inviter resolves to ORG_ID.
  mockUserFindUnique.mockResolvedValue({
    organizationId: ORG_ID,
    organization: { id: ORG_ID, name: 'Acme Org' },
  });
  // Invitee does not already exist.
  mockUserFindUniqueByEmail.mockResolvedValue(null);
  // No pending invitation.
  mockTeamInvitationFindFirst.mockResolvedValue(null);
  mockTeamInvitationCreate.mockResolvedValue({
    id: 'inv-new-1',
    email: 'collab@example.com',
    role: 'editor',
    status: 'sent',
    sentAt: new Date('2026-06-15T00:00:00.000Z'),
  });
  mockEmailSend.mockReturnValue(Promise.resolve());
});

describe('POST /api/teams/members — invite authorisation alignment', () => {
  it('allows an admin (by role NAME) to invite — 201, write performed', async () => {
    mockUserRoleFindMany.mockResolvedValue([
      { role: { name: 'Admin', permissions: [] } },
    ]);

    const { POST } = await import('@/app/api/teams/members/route');
    const res = (await POST(makeReq() as never)) as { status: number };

    expect(res.status).toBe(201);
    // org-scoped admin query mirrors the sibling routes
    expect(mockUserRoleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: ADMIN_ID, role: { organizationId: ORG_ID } },
      })
    );
    expect(mockTeamInvitationCreate).toHaveBeenCalledTimes(1);
  });

  it('allows an admin whose status comes from the `manage_members` PERMISSION (not role name) — 201', async () => {
    mockUserRoleFindMany.mockResolvedValue([
      { role: { name: 'Team Lead', permissions: ['manage_members'] } },
    ]);

    const { POST } = await import('@/app/api/teams/members/route');
    const res = (await POST(makeReq() as never)) as { status: number };

    expect(res.status).toBe(201);
    expect(mockTeamInvitationCreate).toHaveBeenCalledTimes(1);
  });

  it('allows an admin whose status comes from the `*` wildcard PERMISSION — 201', async () => {
    mockUserRoleFindMany.mockResolvedValue([
      { role: { name: 'Custom', permissions: ['*'] } },
    ]);

    const { POST } = await import('@/app/api/teams/members/route');
    const res = (await POST(makeReq() as never)) as { status: number };

    expect(res.status).toBe(201);
    expect(mockTeamInvitationCreate).toHaveBeenCalledTimes(1);
  });

  it('applies the shared issuer-rank guard: an admin may seat a peer admin (equal rank) — 201', async () => {
    mockUserRoleFindMany.mockResolvedValue([
      { role: { name: 'Admin', permissions: [] } },
    ]);
    mockTeamInvitationCreate.mockResolvedValue({
      id: 'inv-admin-1',
      email: 'collab@example.com',
      role: 'admin',
      status: 'sent',
      sentAt: new Date('2026-06-15T00:00:00.000Z'),
    });

    const { POST } = await import('@/app/api/teams/members/route');
    const res = (await POST(
      makeReq({ email: 'collab@example.com', role: 'admin' }) as never
    )) as { status: number };

    expect(res.status).toBe(201);
    expect(mockTeamInvitationCreate).toHaveBeenCalledTimes(1);
    expect(mockTeamInvitationCreate.mock.calls[0][0].data.role).toBe('admin');
  });

  it('rejects a non-admin (viewer) — 403, no write', async () => {
    mockUserRoleFindMany.mockResolvedValue([
      { role: { name: 'Viewer', permissions: ['posts:read'] } },
    ]);

    const { POST } = await import('@/app/api/teams/members/route');
    const res = (await POST(makeReq() as never)) as {
      status: number;
      json: () => Promise<{ error?: string }>;
    };

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/administrators/i);
    expect(mockTeamInvitationCreate).not.toHaveBeenCalled();
  });

  it('rejects a cross-org actor whose admin role belongs to a DIFFERENT org — 403, no write', async () => {
    // The actor IS an admin somewhere, but only in OTHER_ORG_ID. Because the
    // admin query is org-scoped to the inviter's org (ORG_ID), the role does
    // not match and no admin role is returned.
    mockUserRoleFindMany.mockImplementation(
      (args: { where?: { role?: { organizationId?: string } } }) => {
        if (args?.where?.role?.organizationId === OTHER_ORG_ID) {
          return Promise.resolve([
            { role: { name: 'Admin', permissions: ['*'] } },
          ]);
        }
        return Promise.resolve([]);
      }
    );

    const { POST } = await import('@/app/api/teams/members/route');
    const res = (await POST(makeReq() as never)) as { status: number };

    expect(res.status).toBe(403);
    // Query was scoped to the inviter's org, not the actor's foreign admin org.
    expect(mockUserRoleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: ADMIN_ID, role: { organizationId: ORG_ID } },
      })
    );
    expect(mockTeamInvitationCreate).not.toHaveBeenCalled();
  });
});
