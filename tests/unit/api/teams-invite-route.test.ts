/**
 * Unit tests — POST /api/teams/invite (team invitation creation)
 *
 * Covers:
 *  - the P0 token-unify fix: the route derives the inviter's organisation and
 *    stamps it onto the TeamInvitation so accept can link the invitee's org.
 *  - the SYN-1107 privesc fix: only an org admin/owner may invite, and the
 *    invited role is capped to the caller's authority (only an owner may seat
 *    another owner). Any authenticated non-admin is rejected 403.
 *
 * @task collaborator-access-rbac / SYN-1107
 */

const mockUserFindUnique = jest.fn();
const mockTeamInvitationCreate = jest.fn();
const mockUserRoleFindMany = jest.fn();
const mockOwnershipFindFirst = jest.fn();
const mockTeamMemberFindUnique = jest.fn();

const prismaMock = {
  user: { findUnique: mockUserFindUnique },
  teamInvitation: { create: mockTeamInvitationCreate },
  userRole: { findMany: mockUserRoleFindMany },
  // resolveIssuerRole (shared SYN-1108 guard) reads these durable signals.
  businessOwnership: { findFirst: mockOwnershipFindFirst },
  teamMember: { findUnique: mockTeamMemberFindUnique },
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
  DEFAULT_POLICIES: { AUTHENTICATED_WRITE: {} },
}));

const mockSendBranded = jest.fn();
jest.mock('@/lib/email/team-invite-email', () => ({
  sendBrandedTeamInviteEmail: (...args: unknown[]) => mockSendBranded(...args),
}));
jest.mock('@/lib/email', () => ({
  sendTeamInviteEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
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
  return { NextResponse: MockNextResponse, NextRequest: class extends Request {} };
});

const INVITER_ID = 'user-owner-1';
const ORG_ID = 'org-1';

/** Any org-scoped role with the `*` wildcard reads as admin/owner. */
const ADMIN_ROLES = [{ role: { name: 'Admin', permissions: ['*'] } }];

/**
 * Build an inviter user row.
 * @param organizationId  null models a user with no org.
 * @param membership      TeamMember role for this org; omit to model the
 *                        direct org creator (no membership row → owner).
 */
function inviterRow({
  organizationId = ORG_ID as string | null,
  membership,
}: { organizationId?: string | null; membership?: string } = {}) {
  return {
    name: 'Phill Owner',
    email: 'phill@example.com',
    organizationId,
    organization: organizationId ? { name: 'Acme Org' } : null,
    teamMemberships:
      membership && organizationId
        ? [{ role: membership, organizationId }]
        : [],
  };
}

function makeReq(body: unknown = { email: 'collab@example.com', role: 'viewer' }) {
  return {
    json: async () => body,
  } as unknown;
}

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  process.env.DATABASE_URL = 'postgres://test';
  mockSecurityCheck.mockResolvedValue({
    allowed: true,
    context: { userId: INVITER_ID },
  });
  mockTeamInvitationCreate.mockResolvedValue({ id: 'inv-new-1' });
  // Default: caller is NOT an admin (no admin roles) — tests opt in.
  mockUserRoleFindMany.mockResolvedValue([]);
  // Default: no durable owner signal — tests opt in to owner rank.
  mockOwnershipFindFirst.mockResolvedValue(null);
  mockTeamMemberFindUnique.mockResolvedValue(null);
});

describe('POST /api/teams/invite', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSecurityCheck.mockResolvedValue({
      allowed: false,
      context: {},
      error: 'Authentication required',
    });
    const { POST } = await import('@/app/api/teams/invite/route');
    const res = await POST(makeReq() as never);
    expect(res.status).toBe(401);
  });

  it('returns 403 when the inviter has no organisation', async () => {
    mockUserFindUnique.mockResolvedValue(inviterRow({ organizationId: null }));
    const { POST } = await import('@/app/api/teams/invite/route');
    const res = await POST(makeReq() as never);
    expect(res.status).toBe(403);
    expect(mockTeamInvitationCreate).not.toHaveBeenCalled();
  });

  it('returns 400 on invalid body', async () => {
    mockUserFindUnique.mockResolvedValue(inviterRow());
    const { POST } = await import('@/app/api/teams/invite/route');
    const res = await POST(makeReq({ email: 'not-an-email' }) as never);
    expect(res.status).toBe(400);
  });

  it('returns 403 when a non-admin member tries to invite (SYN-1107)', async () => {
    mockUserFindUnique.mockResolvedValue(
      inviterRow({ membership: 'collaborator' })
    );
    mockUserRoleFindMany.mockResolvedValue([]); // no admin role
    const { POST } = await import('@/app/api/teams/invite/route');
    const res = await POST(
      makeReq({ email: 'collab@example.com', role: 'viewer' }) as never
    );
    expect(res.status).toBe(403);
    expect(mockTeamInvitationCreate).not.toHaveBeenCalled();
  });

  it('returns 403 when a non-admin member tries to invite an owner (SYN-1107)', async () => {
    mockUserFindUnique.mockResolvedValue(
      inviterRow({ membership: 'collaborator' })
    );
    mockUserRoleFindMany.mockResolvedValue([]); // no admin role
    const { POST } = await import('@/app/api/teams/invite/route');
    const res = await POST(
      makeReq({ email: 'evil@example.com', role: 'owner' }) as never
    );
    expect(res.status).toBe(403);
    expect(mockTeamInvitationCreate).not.toHaveBeenCalled();
  });

  it('caps the invited role: a non-owner admin cannot invite an owner (SYN-1107)', async () => {
    // Admin-by-permission but a collaborator membership → not the org owner.
    mockUserFindUnique.mockResolvedValue(
      inviterRow({ membership: 'collaborator' })
    );
    mockUserRoleFindMany.mockResolvedValue(ADMIN_ROLES);
    const { POST } = await import('@/app/api/teams/invite/route');
    const res = await POST(
      makeReq({ email: 'evil@example.com', role: 'owner' }) as never
    );
    expect(res.status).toBe(403);
    expect(mockTeamInvitationCreate).not.toHaveBeenCalled();
  });

  it('rejects an unknown role with 400 (SYN-1107)', async () => {
    mockUserFindUnique.mockResolvedValue(inviterRow());
    mockUserRoleFindMany.mockResolvedValue(ADMIN_ROLES);
    const { POST } = await import('@/app/api/teams/invite/route');
    const res = await POST(
      makeReq({ email: 'x@example.com', role: 'superadmin' }) as never
    );
    expect(res.status).toBe(400);
    expect(mockTeamInvitationCreate).not.toHaveBeenCalled();
  });

  it('allows an admin to invite an editor and stamps the inviter org (happy path)', async () => {
    mockUserFindUnique.mockResolvedValue(inviterRow()); // owner (no membership row)
    mockUserRoleFindMany.mockResolvedValue(ADMIN_ROLES);
    mockSendBranded.mockResolvedValue({ success: true });
    process.env.RESEND_API_KEY = 'test-key';

    const { POST } = await import('@/app/api/teams/invite/route');
    const res = await POST(
      makeReq({ email: 'collab@example.com', role: 'Editor' }) as never
    );

    expect(res.status).toBe(200);
    expect(mockTeamInvitationCreate).toHaveBeenCalledTimes(1);
    const data = mockTeamInvitationCreate.mock.calls[0][0].data;
    expect(data.organizationId).toBe(ORG_ID);
    expect(data.userId).toBe(INVITER_ID);
    expect(data.status).toBe('sent');
    // Role is normalised to lower-case for the accept-flow mapping.
    expect(data.role).toBe('editor');

    // Branded accept-page email is sent with the persisted invitation id.
    expect(mockSendBranded).toHaveBeenCalledTimes(1);
    expect(mockSendBranded.mock.calls[0][0].invitationId).toBe('inv-new-1');
  });

  it('allows the org owner to invite another owner (SYN-1107)', async () => {
    // Owner = holds an ACTIVE BusinessOwnership row (the durable owner signal
    // resolveIssuerRole reads), so the shared guard permits seating an owner.
    mockUserFindUnique.mockResolvedValue(inviterRow());
    mockUserRoleFindMany.mockResolvedValue(ADMIN_ROLES);
    mockOwnershipFindFirst.mockResolvedValue({ id: 'own-1' });
    const { POST } = await import('@/app/api/teams/invite/route');
    const res = await POST(
      makeReq({ email: 'coowner@example.com', role: 'owner' }) as never
    );
    expect(res.status).toBe(200);
    expect(mockTeamInvitationCreate).toHaveBeenCalledTimes(1);
    expect(mockTeamInvitationCreate.mock.calls[0][0].data.role).toBe('owner');
  });
});
