/**
 * Unit tests for the Client Content Studio board API (SYN-1005 / VS-6).
 * Auth, client-org resolution, access checks, board reads, and the approve gate.
 *
 * g9: the `[client]` segment is the organisation slug and the Studio config is
 * derived from the organisation record — there is no hardcoded client registry,
 * so a business that exists in the vault gets a board with no code change.
 * g2: approving a draft schedules it through the approve→schedule bridge.
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
const mockApproveAndSchedule = jest.fn();

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
}));

jest.mock('@/lib/marketing-agency/studio/approve-and-schedule', () => ({
  approveAndScheduleStudioDraft: (...args: unknown[]) =>
    mockApproveAndSchedule(...args),
}));

jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }));

import { GET, POST } from '@/app/api/marketing-agency/studio/[client]/route';

const ctx = { params: Promise.resolve({ client: 'restoreassist' }) };

const RA_ORG = {
  id: 'org-ra',
  name: 'RestoreAssist',
  slug: 'restoreassist',
  website: 'https://restoreassist.com.au',
  settings: null,
};

const ORG_SELECT = {
  where: { slug: 'restoreassist' },
  select: { id: true, name: true, slug: true, website: true, settings: true },
};

function approveRequest(body: unknown) {
  return createMockNextRequest({ method: 'POST', url: 'http://x', body });
}

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
  mockOrganizationFindUnique.mockResolvedValue(RA_ORG);
  mockHasOrganizationAccess.mockResolvedValue(true);
  mockApproveAndSchedule.mockResolvedValue({
    approved: true,
    scheduled: [],
    skipped: [],
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

  it('serves a business that exists in the vault but was never in the old hardcoded registry (g9)', async () => {
    mockOrganizationFindUnique.mockResolvedValueOnce({
      id: 'org-ccw',
      name: 'Carpet Cleaners Warehouse',
      slug: 'ccw',
      website: 'https://ccwonline.com.au',
      settings: null,
    });
    mockListStudioDrafts.mockResolvedValue([]);
    const res = await GET(createMockNextRequest({ url: 'http://x' }), {
      params: Promise.resolve({ client: 'ccw' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.displayName).toBe('Carpet Cleaners Warehouse');
    expect(body.organizationId).toBe('org-ccw');
    expect(body.funnelUrl).toBe('https://ccwonline.com.au');
    // Unconfigured video is reported, not papered over with a placeholder.
    expect(body.videoConfigured).toBe(false);
    expect(JSON.stringify(body)).not.toMatch(/PLACEHOLDER/);
    expect(mockListStudioDrafts).toHaveBeenCalledWith({
      organizationId: 'org-ccw',
      clientSlug: 'ccw',
    });
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
    expect(mockOrganizationFindUnique).toHaveBeenCalledWith(ORG_SELECT);
    expect(mockHasOrganizationAccess).toHaveBeenCalledWith('user-1', 'org-ra');
    // client-org-scoped read
    expect(mockListStudioDrafts).toHaveBeenCalledWith({
      organizationId: 'org-ra',
      clientSlug: 'restoreassist',
    });
  });
});

describe('POST /api/marketing-agency/studio/[client] (approve → schedule)', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSecurityCheck.mockResolvedValueOnce({
      allowed: false,
      error: 'Auth required',
      context: {},
    });
    const res = await POST(approveRequest({ draftId: 'd1' }), ctx);
    expect(res.status).toBe(401);
    expect(mockApproveAndSchedule).not.toHaveBeenCalled();
  });

  it('returns 400 on an invalid body', async () => {
    const res = await POST(approveRequest({ nope: true }), ctx);
    expect(res.status).toBe(400);
    expect(mockApproveAndSchedule).not.toHaveBeenCalled();
  });

  it('returns 400 when scheduledAt is not an ISO instant', async () => {
    const res = await POST(
      approveRequest({ draftId: 'd1', scheduledAt: 'tomorrow' }),
      ctx
    );
    expect(res.status).toBe(400);
    expect(mockApproveAndSchedule).not.toHaveBeenCalled();
  });

  it('returns 404 when the draft is not found / not awaiting approval / wrong org', async () => {
    mockApproveAndSchedule.mockResolvedValue({
      approved: false,
      scheduled: [],
      skipped: [],
    });
    const res = await POST(approveRequest({ draftId: 'd1' }), ctx);
    expect(res.status).toBe(404);
  });

  it('returns 403 on approve when the user cannot access the client organisation', async () => {
    mockHasOrganizationAccess.mockResolvedValueOnce(false);
    const res = await POST(approveRequest({ draftId: 'd1' }), ctx);
    expect(res.status).toBe(403);
    expect(mockApproveAndSchedule).not.toHaveBeenCalled();
  });

  it('returns 404 on approve when the organisation does not exist', async () => {
    mockOrganizationFindUnique.mockResolvedValueOnce(null);
    const res = await POST(approveRequest({ draftId: 'd1' }), {
      params: Promise.resolve({ client: 'unknown-client' }),
    });
    expect(res.status).toBe(404);
    expect(mockApproveAndSchedule).not.toHaveBeenCalled();
  });

  it('approves through the bridge (org-scoped, approvedBy = caller, client resolved from the org) and returns what was scheduled', async () => {
    mockApproveAndSchedule.mockResolvedValue({
      approved: true,
      scheduled: [
        {
          platform: 'linkedin',
          postId: 'post-1',
          scheduledAt: '2026-09-02T14:00:00.000Z',
          linkUrl: 'https://restoreassist.com.au/?utm_source=linkedin',
        },
      ],
      skipped: [{ platform: 'blog', reason: 'platform_not_schedulable' }],
    });
    const res = await POST(approveRequest({ draftId: 'd1' }), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      approved: true,
      draftId: 'd1',
      scheduled: [
        {
          platform: 'linkedin',
          postId: 'post-1',
          scheduledAt: '2026-09-02T14:00:00.000Z',
          linkUrl: 'https://restoreassist.com.au/?utm_source=linkedin',
        },
      ],
      skipped: [{ platform: 'blog', reason: 'platform_not_schedulable' }],
    });
    expect(mockOrganizationFindUnique).toHaveBeenCalledWith(ORG_SELECT);
    expect(mockHasOrganizationAccess).toHaveBeenCalledWith('user-1', 'org-ra');
    expect(mockApproveAndSchedule).toHaveBeenCalledWith({
      organizationId: 'org-ra',
      id: 'd1',
      approvedBy: 'user-1',
      client: expect.objectContaining({
        clientSlug: 'restoreassist',
        funnelUrl: 'https://restoreassist.com.au',
      }),
      scheduledAt: undefined,
    });
  });

  it('passes a caller-supplied scheduledAt through as a Date', async () => {
    const res = await POST(
      approveRequest({
        draftId: 'd1',
        scheduledAt: '2026-09-03T09:00:00.000Z',
      }),
      ctx
    );
    expect(res.status).toBe(200);
    expect(mockApproveAndSchedule.mock.calls[0][0].scheduledAt).toEqual(
      new Date('2026-09-03T09:00:00.000Z')
    );
  });
});
