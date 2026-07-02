/**
 * Unit tests — POST /api/teams/invite (team invitation creation)
 *
 * Covers the P0 token-unify fix: the route now derives the inviter's
 * organisation and stamps it onto the TeamInvitation, so the accept flow can
 * link the invitee to the correct org.
 *
 * Scenarios: 401 → 403 (no org) → 400 (bad body) → 201/200 happy path.
 *
 * @task collaborator-access-rbac
 */

const mockUserFindUnique = jest.fn();
const mockTeamInvitationCreate = jest.fn();

const prismaMock = {
  user: { findUnique: mockUserFindUnique },
  teamInvitation: { create: mockTeamInvitationCreate },
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

function makeReq(body: unknown = { email: 'collab@example.com', role: 'collaborator' }) {
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
    mockUserFindUnique.mockResolvedValue({
      name: 'Owner',
      email: 'owner@example.com',
      organizationId: null,
      organization: null,
    });
    const { POST } = await import('@/app/api/teams/invite/route');
    const res = await POST(makeReq() as never);
    expect(res.status).toBe(403);
    expect(mockTeamInvitationCreate).not.toHaveBeenCalled();
  });

  it('returns 400 on invalid body', async () => {
    mockUserFindUnique.mockResolvedValue({
      organizationId: ORG_ID,
      organization: { name: 'Org' },
    });
    const { POST } = await import('@/app/api/teams/invite/route');
    const res = await POST(makeReq({ email: 'not-an-email' }) as never);
    expect(res.status).toBe(400);
  });

  it('stamps the inviter org onto the TeamInvitation (happy path)', async () => {
    mockUserFindUnique.mockResolvedValue({
      name: 'Phill Owner',
      email: 'phill@example.com',
      organizationId: ORG_ID,
      organization: { name: 'Acme Org' },
    });
    mockSendBranded.mockResolvedValue({ success: true });
    process.env.RESEND_API_KEY = 'test-key';

    const { POST } = await import('@/app/api/teams/invite/route');
    const res = await POST(makeReq() as never);

    expect(res.status).toBe(200);
    expect(mockTeamInvitationCreate).toHaveBeenCalledTimes(1);
    const data = mockTeamInvitationCreate.mock.calls[0][0].data;
    expect(data.organizationId).toBe(ORG_ID);
    expect(data.userId).toBe(INVITER_ID);
    expect(data.status).toBe('sent');

    // Branded accept-page email is sent with the persisted invitation id.
    expect(mockSendBranded).toHaveBeenCalledTimes(1);
    expect(mockSendBranded.mock.calls[0][0].invitationId).toBe('inv-new-1');
  });
});
