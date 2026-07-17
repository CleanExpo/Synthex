/**
 * Unit tests — POST /api/team (attach existing user)
 *
 * SYN-1109 root #1: adding an existing user to an org used to set only their
 * `organizationId` with NO TeamMember row, so withAuth's no-membership default
 * resolved them as OWNER of the org — and it silently yanked a user out of a
 * DIFFERENT org (cross-tenant hijack). The route now:
 *   - refuses to reassign a user who already belongs to another org (409),
 *   - caps the seated role via the shared issuer-rank guard,
 *   - writes the attach as a CONDITIONAL updateMany inside the transaction so a
 *     concurrent reassignment cannot be clobbered (TOCTOU), and
 *   - writes an EXPLICIT accepted, non-owner TeamMember row.
 *
 * Drives the REAL POST handler.
 *
 * @task SYN-1109
 */

const mockUserFindUnique = jest.fn();
const mockUserFindUniqueByEmail = jest.fn();
const mockUserUpdateMany = jest.fn();
const mockTeamMemberUpsert = jest.fn();
const mockTeamInvitationCreate = jest.fn();
const mockUserFindUniqueRouter = jest.fn();
const mockTransaction = jest.fn();

// The interactive-transaction client the handler receives.
const txClient = {
  user: { updateMany: mockUserUpdateMany },
  teamMember: { upsert: mockTeamMemberUpsert },
};

const prismaMock = {
  user: { findUnique: mockUserFindUniqueRouter },
  teamInvitation: { create: mockTeamInvitationCreate },
  $transaction: mockTransaction,
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
  },
  DEFAULT_POLICIES: { ADMIN_ONLY: {} },
}));

// Keep the REAL requireIssuerOutranks (the rank matrix under test) but control
// the resolved issuer role.
const mockResolveIssuerRole = jest.fn();
jest.mock('@/lib/auth/rbac/issuer-rank', () => {
  const actual = jest.requireActual('@/lib/auth/rbac/issuer-rank');
  return {
    ...actual,
    resolveIssuerRole: (...args: unknown[]) => mockResolveIssuerRole(...args),
  };
});

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const ADMIN_ID = 'user-admin-1';
const ORG_ID = 'org-1';
const OTHER_ORG_ID = 'org-2';

function makeReq(body: unknown = { email: 'existing@example.com', role: 'viewer' }) {
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

  mockUserFindUniqueRouter.mockImplementation(
    (args: { where?: { id?: string; email?: string } }) => {
      if (args?.where?.email !== undefined) {
        return mockUserFindUniqueByEmail(args);
      }
      return mockUserFindUnique(args);
    }
  );

  // Admin resolves to ORG_ID.
  mockUserFindUnique.mockResolvedValue({ organizationId: ORG_ID });
  // Issuer is an admin by default (the route is ADMIN_ONLY gated anyway).
  mockResolveIssuerRole.mockResolvedValue('admin');
  mockUserUpdateMany.mockResolvedValue({ count: 1 });
  mockTeamMemberUpsert.mockResolvedValue({ id: 'tm-1' });
  // Interactive transaction: run the callback with the tx client.
  mockTransaction.mockImplementation((fn: (tx: typeof txClient) => unknown) =>
    Promise.resolve(fn(txClient))
  );
});

describe('POST /api/team — attach existing user (SYN-1109)', () => {
  it('refuses to reassign a user who already belongs to another org (409, no writes)', async () => {
    mockUserFindUniqueByEmail.mockResolvedValue({
      id: 'existing-1',
      organizationId: OTHER_ORG_ID,
    });

    const { POST } = await import('@/app/api/team/route');
    const res = (await POST(makeReq() as never)) as { status: number };

    expect(res.status).toBe(409);
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockTeamMemberUpsert).not.toHaveBeenCalled();
  });

  it('attaches an org-less user with an EXPLICIT accepted non-owner membership row', async () => {
    mockUserFindUniqueByEmail.mockResolvedValue({
      id: 'existing-1',
      organizationId: null,
    });

    const { POST } = await import('@/app/api/team/route');
    const res = (await POST(makeReq() as never)) as { status: number };

    expect(res.status).toBe(200);
    // Conditional attach: only reassigns while the org is null or already ours.
    expect(mockUserUpdateMany).toHaveBeenCalledTimes(1);
    const where = mockUserUpdateMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { organizationId: null },
      { organizationId: ORG_ID },
    ]);
    expect(mockTeamMemberUpsert).toHaveBeenCalledTimes(1);
    const upsertArg = mockTeamMemberUpsert.mock.calls[0][0] as {
      create: { role: string; acceptedAt: unknown };
    };
    expect(upsertArg.create.role).toBe('viewer');
    expect(upsertArg.create.acceptedAt).toBeInstanceOf(Date);
  });

  it('returns 409 without writing a membership row when a concurrent reassignment wins the race (TOCTOU)', async () => {
    mockUserFindUniqueByEmail.mockResolvedValue({
      id: 'existing-1',
      organizationId: null,
    });
    // The conditional updateMany matches zero rows — someone else moved the user
    // to a different org between the pre-check and the transaction.
    mockUserUpdateMany.mockResolvedValue({ count: 0 });

    const { POST } = await import('@/app/api/team/route');
    const res = (await POST(makeReq() as never)) as { status: number };

    expect(res.status).toBe(409);
    expect(mockUserUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockTeamMemberUpsert).not.toHaveBeenCalled();
  });

  it('rejects seating a role above the issuer via the shared rank guard (403)', async () => {
    mockResolveIssuerRole.mockResolvedValue('viewer');
    mockUserFindUniqueByEmail.mockResolvedValue({
      id: 'existing-1',
      organizationId: null,
    });

    const { POST } = await import('@/app/api/team/route');
    const res = (await POST(makeReq({ email: 'e@x.com', role: 'admin' }) as never)) as {
      status: number;
    };

    expect(res.status).toBe(403);
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockTeamMemberUpsert).not.toHaveBeenCalled();
  });
});
