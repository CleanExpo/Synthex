/**
 * Unit tests for the Client Content Studio board API (SYN-1005 / VS-6).
 * Auth, client-org resolution, access checks, board reads, and approve gate.
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockSecurityCheck = jest.fn();
const mockSecureResponse = jest.fn((data: unknown, status = 200) => ({
  status,
  json: async () => data,
}));
const mockHasOrganizationAccess = jest.fn();
const mockOrganizationFindUnique = jest.fn();
const mockListStudioDrafts = jest.fn();
const mockApproveStudioDraft = jest.fn();
const mockGetStudioClient = jest.fn();

jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: (...args: unknown[]) => mockSecurityCheck(...args),
    createSecureResponse: (...args: unknown[]) => mockSecureResponse(...args),
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_READ: { requireAuth: true },
    AUTHENTICATED_WRITE: { requireAuth: true },
  },
}));

jest.mock('@/lib/multi-business', () => ({
  hasOrganizationAccess: (...args: unknown[]) =>
    mockHasOrganizationAccess(...args),
}));

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    organization: {
      findUnique: (...args: unknown[]) => mockOrganizationFindUnique(...args),
    },
  },
}));

jest.mock('@/lib/marketing-agency/studio/draft-store', () => ({
  listStudioDrafts: (...args: unknown[]) => mockListStudioDrafts(...args),
  approveStudioDraft: (...args: unknown[]) => mockApproveStudioDraft(...args),
}));

jest.mock('@/lib/marketing-agency/studio/clients', () => ({
  getStudioClient: (...args: unknown[]) => mockGetStudioClient(...args),
}));

jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }));

import { GET, POST } from '@/app/api/marketing-agency/studio/[client]/route';

const ctx = { params: Promise.resolve({ client: 'restoreassist' }) };

beforeEach(() => {
  jest.clearAllMocks();
  mockSecureResponse.mockImplementation((data: unknown, status = 200) => ({
    status,
    json: async () => data,
  }));
  mockSecurityCheck.mockResolvedValue({
    allowed: true,
    context: { userId: 'user-1' },
  });
  mockOrganizationFindUnique.mockResolvedValue({ id: 'org-ra' });
  mockHasOrganizationAccess.mockResolvedValue(true);
  mockGetStudioClient.mockReturnValue({
    clientSlug: 'restoreassist',
    displayName: 'RestoreAssist',
  });
});

describe('GET /api/marketing-agency/studio/[client]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSecurityCheck.mockResolvedValueOnce({
      allowed: false,
      error: 'Auth required',
      context: {},
    });
    const res = await GET(
      createMockNextRequest({
        url: 'http://x/api/marketing-agency/studio/restoreassist',
      }),
      ctx
    );
    expect(res.status).toBe(401);
    expect(mockListStudioDrafts).not.toHaveBeenCalled();
  });

  it('returns 404 when the studio client organisation is missing', async () => {
    mockOrganizationFindUnique.mockResolvedValueOnce(null);
    const res = await GET(createMockNextRequest({ url: 'http://x' }), ctx);
    expect(res.status).toBe(404);
    expect(mockListStudioDrafts).not.toHaveBeenCalled();
  });

  it('returns 403 when the user cannot access the client organisation', async () => {
    mockHasOrganizationAccess.mockResolvedValueOnce(false);
    const res = await GET(createMockNextRequest({ url: 'http://x' }), ctx);
    expect(res.status).toBe(403);
    expect(mockListStudioDrafts).not.toHaveBeenCalled();
  });

  it('returns 404 for unknown studio clients', async () => {
    mockGetStudioClient.mockReturnValueOnce(undefined);
    const res = await GET(createMockNextRequest({ url: 'http://x' }), {
      params: Promise.resolve({ client: 'unknown-client' }),
    });
    expect(res.status).toBe(404);
    expect(mockListStudioDrafts).not.toHaveBeenCalled();
  });

  it('returns 200 with an org-scoped board grouped by status', async () => {
    mockListStudioDrafts.mockResolvedValue([
      { id: 'd1', status: 'awaiting_approval', topic: 'A' },
      { id: 'd2', status: 'approved', topic: 'B' },
      { id: 'd3', status: 'awaiting_approval', topic: 'C' },
    ]);
    const res = await GET(createMockNextRequest({ url: 'http://x' }), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.displayName).toBe('RestoreAssist');
    expect(body.board.awaiting_approval).toHaveLength(2);
    expect(body.board.approved).toHaveLength(1);
    expect(body.total).toBe(3);
    expect(mockOrganizationFindUnique).toHaveBeenCalledWith({
      where: { slug: 'restoreassist' },
      select: { id: true },
    });
    expect(mockHasOrganizationAccess).toHaveBeenCalledWith('user-1', 'org-ra');
    // client-org-scoped read
    expect(mockListStudioDrafts).toHaveBeenCalledWith({
      organizationId: 'org-ra',
      clientSlug: 'restoreassist',
    });
  });
});

describe('POST /api/marketing-agency/studio/[client] (approve)', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSecurityCheck.mockResolvedValueOnce({
      allowed: false,
      error: 'Auth required',
      context: {},
    });
    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: 'http://x',
        body: { draftId: 'd1' },
      }),
      ctx
    );
    expect(res.status).toBe(401);
    expect(mockApproveStudioDraft).not.toHaveBeenCalled();
  });

  it('returns 400 on an invalid body', async () => {
    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: 'http://x',
        body: { nope: true },
      }),
      ctx
    );
    expect(res.status).toBe(400);
    expect(mockApproveStudioDraft).not.toHaveBeenCalled();
  });

  it('returns 404 when the draft is not found / not awaiting approval / wrong org', async () => {
    mockApproveStudioDraft.mockResolvedValue(0);
    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: 'http://x',
        body: { draftId: 'd1' },
      }),
      ctx
    );
    expect(res.status).toBe(404);
  });

  it('returns 403 on approve when the user cannot access the client organisation', async () => {
    mockHasOrganizationAccess.mockResolvedValueOnce(false);
    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: 'http://x',
        body: { draftId: 'd1' },
      }),
      ctx
    );
    expect(res.status).toBe(403);
    expect(mockApproveStudioDraft).not.toHaveBeenCalled();
  });

  it('returns 404 on approve for unknown studio clients', async () => {
    mockGetStudioClient.mockReturnValueOnce(undefined);
    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: 'http://x',
        body: { draftId: 'd1' },
      }),
      { params: Promise.resolve({ client: 'unknown-client' }) }
    );
    expect(res.status).toBe(404);
    expect(mockApproveStudioDraft).not.toHaveBeenCalled();
  });

  it('returns 200 and approves (org-scoped, approvedBy = caller) on success', async () => {
    mockApproveStudioDraft.mockResolvedValue(1);
    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: 'http://x',
        body: { draftId: 'd1' },
      }),
      ctx
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.approved).toBe(true);
    expect(mockOrganizationFindUnique).toHaveBeenCalledWith({
      where: { slug: 'restoreassist' },
      select: { id: true },
    });
    expect(mockHasOrganizationAccess).toHaveBeenCalledWith('user-1', 'org-ra');
    expect(mockApproveStudioDraft).toHaveBeenCalledWith({
      organizationId: 'org-ra',
      id: 'd1',
      approvedBy: 'user-1',
    });
  });
});
