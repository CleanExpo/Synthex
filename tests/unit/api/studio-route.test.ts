/**
 * Unit tests for the Client Content Studio board API (SYN-1005 / VS-6).
 * Auth, client-org resolution, access checks, board reads, and the approve gate.
 *
 * g9: the `[client]` segment is the organisation slug and the Studio config is
 * derived from the organisation record — there is no hardcoded client registry,
 * so a business that exists in the vault gets a board with no code change.
 * g2: approving a draft schedules it through the approve→schedule bridge; a
 * blocked or failed schedule hands the draft back and answers 409 / 502.
 *
 * SYN-1412: the access rule and the approval rule are never stood in for here.
 * The database client is a row store (tests/helpers/prisma-row-store.ts): each
 * case lists the rows that exist, decoys included, and the real rules read them.
 * Approve cases are written in the house order 401, 403, 400, 200, then 404,
 * 409, 500, 502, 503. The handler's own evaluation order (401, 400, 404, 403)
 * is pinned by the three "before any ... read" cases.
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';
import { createPrismaRowStore } from '@/tests/helpers/prisma-row-store';

const mockSecurityCheck = jest.fn();
const mockSecureResponse = jest.fn((data: unknown, status = 200) => ({
  status,
  json: async () => data,
}));
const mockListStudioDrafts = jest.fn();
const mockApproveAndSchedule = jest.fn();
const mockStore = createPrismaRowStore();

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

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  get default() {
    return mockStore.client;
  },
  get prisma() {
    return mockStore.client;
  },
}));

jest.mock('server-only', () => ({}));

jest.mock('@/lib/marketing-agency/studio/draft-store', () => ({
  listStudioDrafts: (...args: unknown[]) => mockListStudioDrafts(...args),
}));

jest.mock('@/lib/marketing-agency/studio/approve-and-schedule', () => ({
  approveAndScheduleStudioDraft: (...args: unknown[]) =>
    mockApproveAndSchedule(...args),
  APPROVAL_BLOCKER: 'human_or_client_approval_required',
  CREDENTIALS_BLOCKER: 'platform_credentials_required',
  RESERVED_CLEARANCES: new Set([
    'human_or_client_approval_required',
    'platform_credentials_required',
  ]),
  InvalidClearanceError: class InvalidClearanceError extends Error {
    blockers: string[];
    constructor(blockers: string[]) {
      super(
        `These blockers cannot be discharged by naming them: ${blockers.join(', ')}`
      );
      this.blockers = blockers;
    }
  },
}));

const mockSignedUrls = jest.fn();
jest.mock('@/lib/storage/object-storage', () => ({
  signedUrls: (...args: unknown[]) => mockSignedUrls(...args),
}));

const mockLog = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};
jest.mock('@/lib/logger', () => ({
  logger: {
    error: (...args: unknown[]) => mockLog.error(...args),
    warn: (...args: unknown[]) => mockLog.warn(...args),
    info: (...args: unknown[]) => mockLog.info(...args),
    debug: (...args: unknown[]) => mockLog.debug(...args),
  },
}));
const mockTrackError = jest.fn();
jest.mock('@/lib/observability/error-tracker', () => ({
  trackError: (...args: unknown[]) => mockTrackError(...args),
}));

import { GET, POST } from '@/app/api/marketing-agency/studio/[client]/route';
import { InvalidClearanceError } from '@/lib/marketing-agency/studio/approve-and-schedule';

const ctx = { params: Promise.resolve({ client: 'restoreassist' }) };
const unknownCtx = { params: Promise.resolve({ client: 'unknown-client' }) };

const ORG_SELECT = {
  where: { slug: 'restoreassist' },
  select: { id: true, name: true, slug: true, website: true, settings: true },
};

// The clock is fixed, so "expired" and "not yet expired" are decided by the
// code under test against a known instant, not by when the suite happens to run.
const NOW = new Date('2026-11-11T00:00:00.000Z');
const PAST = new Date(NOW.getTime() - 60_000);
const FUTURE = new Date(NOW.getTime() + 60_000);

const CODES = {
  role: 'STUDIO_APPROVE_ROLE_REQUIRED',
  notMember: 'STUDIO_APPROVE_NOT_ORG_MEMBER',
  approveUnavailable: 'STUDIO_APPROVE_CHECK_UNAVAILABLE',
  accessUnavailable: 'STUDIO_ACCESS_CHECK_UNAVAILABLE',
} as const;

// The sentences a person reads (spec section 10 and, for membership, the text
// the route already answers with).
const SENTENCES = {
  role: 'You can view this board. Approving needs an editor, admin or owner role in this organisation. An owner or admin of this organisation can change your role.',
  notMember:
    'Approval requires membership of this organisation (its own member or an active business owner), not of its parent workspace',
  approveUnavailable:
    'Approval could not be checked just now. Reload the page to try again.',
  accessUnavailable:
    'Access could not be checked just now. Reload the page to try again.',
} as const;

/** The records the caller (user-1) holds about the Studio organisation. */
interface Caller {
  /** User.organizationId: the organisation the caller belongs to directly. */
  home: string;
  /** BusinessOwnership.isActive on the Studio organisation; null for no row. */
  ownership: boolean | null;
  /** TeamMember.role on the Studio organisation; null for no row. */
  teamRole: string | null;
  /** UserRole grants on roles of the Studio organisation. */
  grants: Array<{ roleId: string; expiresAt: Date | null }>;
}

// Every refused caller below differs from an allowed one in exactly one field.
const EDITOR: Caller = {
  home: 'org-ra',
  ownership: null,
  teamRole: 'editor',
  grants: [],
};
const VIEWER: Caller = { ...EDITOR, teamRole: 'viewer' };
const OWNER_WITH_VIEWER_ROW: Caller = { ...VIEWER, ownership: true };
/** Sees the board from the parent workspace; holds a row but no membership. */
const PARENT_ONLY: Caller = { ...EDITOR, home: 'org-parent' };
/** Belongs to another brand of the same workspace. */
const STRANGER: Caller = { ...EDITOR, home: 'org-other' };

/**
 * Seed the organisations, the caller's records, and the decoys every case
 * carries: another user who is owner and admin of the Studio organisation, the
 * caller's own owner row, active ownership and Admin role in ANOTHER
 * organisation, and the caller's expired Admin role in the Studio organisation.
 * None of the decoys may count for the caller.
 */
function seedStudio(caller: Caller, organisationId = 'org-ra') {
  mockStore.seed({
    organization: [
      {
        id: 'org-parent',
        name: 'Unite Group',
        slug: 'unite',
        parentOrgId: null,
      },
      {
        id: 'org-ra',
        name: 'RestoreAssist',
        slug: 'restoreassist',
        website: 'https://restoreassist.app',
        settings: null,
        parentOrgId: 'org-parent',
      },
      {
        id: 'org-ccw',
        name: 'Carpet Cleaners Warehouse',
        slug: 'ccw',
        website: 'https://ccwonline.com.au',
        settings: null,
        parentOrgId: 'org-parent',
      },
      {
        id: 'org-other',
        name: 'Another Brand',
        slug: 'another-brand',
        parentOrgId: 'org-parent',
      },
    ],
    user: [
      {
        id: 'user-1',
        organizationId: caller.home,
        isMultiBusinessOwner: false,
      },
      {
        id: 'user-2',
        organizationId: organisationId,
        isMultiBusinessOwner: true,
      },
    ],
    businessOwnership: [
      { ownerId: 'user-2', organizationId: organisationId, isActive: true },
      { ownerId: 'user-1', organizationId: 'org-other', isActive: true },
      ...(caller.ownership === null
        ? []
        : [
            {
              ownerId: 'user-1',
              organizationId: organisationId,
              isActive: caller.ownership,
            },
          ]),
    ],
    teamMember: [
      {
        userId: 'user-2',
        organizationId: organisationId,
        role: 'owner',
        acceptedAt: PAST,
      },
      {
        userId: 'user-1',
        organizationId: 'org-other',
        role: 'owner',
        acceptedAt: PAST,
      },
      ...(caller.teamRole === null
        ? []
        : [
            {
              userId: 'user-1',
              organizationId: organisationId,
              role: caller.teamRole,
              acceptedAt: PAST,
            },
          ]),
    ],
    role: [
      {
        id: 'role-admin',
        name: 'Admin',
        permissions: ['*'],
        organizationId: organisationId,
      },
      {
        id: 'role-editor',
        name: 'Editor',
        permissions: ['content:write'],
        organizationId: organisationId,
      },
      {
        id: 'role-viewer',
        name: 'Viewer',
        permissions: ['content:read'],
        organizationId: organisationId,
      },
      {
        id: 'role-other-admin',
        name: 'Admin',
        permissions: ['*'],
        organizationId: 'org-other',
      },
    ],
    userRole: [
      { userId: 'user-2', roleId: 'role-admin', expiresAt: null },
      { userId: 'user-1', roleId: 'role-other-admin', expiresAt: null },
      { userId: 'user-1', roleId: 'role-admin', expiresAt: PAST },
      ...caller.grants.map(grant => ({ userId: 'user-1', ...grant })),
    ],
  });
}

function approveRequest(body: unknown) {
  return createMockNextRequest({
    method: 'POST',
    url: 'http://x',
    body: body as object,
  });
}

function approve(body: unknown = { draftId: 'd1' }, context = ctx) {
  return POST(approveRequest(body), context);
}

function board(context = ctx) {
  return GET(createMockNextRequest({ url: 'http://x' }), context);
}

const NO_READS = {
  user: 0,
  organization: 0,
  businessOwnership: 0,
  teamMember: 0,
  userRole: 0,
};

/** The fields a log call carried: every plain-object argument after the message. */
function logFields(call: unknown[]): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const arg of call.slice(1)) {
    if (arg && typeof arg === 'object' && !(arg instanceof Error)) {
      Object.assign(fields, arg);
    }
  }
  return fields;
}

/** The error-tracker calls made for one operation: the error and its metadata. */
function tracked(operation: string) {
  return mockTrackError.mock.calls
    .map(([error, context]) => ({
      error: error as unknown,
      context: (context ?? {}) as {
        operation?: string;
        metadata?: Record<string, unknown>;
      },
    }))
    .filter(call => call.context.operation === operation)
    .map(call => ({
      error: call.error,
      metadata: call.context.metadata ?? {},
    }));
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({
    now: NOW,
    doNotFake: [
      'hrtime',
      'nextTick',
      'performance',
      'queueMicrotask',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'requestIdleCallback',
      'cancelIdleCallback',
      'setImmediate',
      'clearImmediate',
      'setInterval',
      'clearInterval',
      'setTimeout',
      'clearTimeout',
    ],
  });
  mockStore.reset();
  seedStudio(EDITOR);
  mockSecureResponse.mockImplementation((data: unknown, status = 200) => ({
    status,
    json: async () => data,
  }));
  mockSecurityCheck.mockResolvedValue({
    allowed: true,
    context: { userId: 'user-1' },
  });
  mockListStudioDrafts.mockResolvedValue([]);
  mockApproveAndSchedule.mockResolvedValue({
    approved: true,
    outcome: 'approved',
    scheduled: [],
    skipped: [],
  });
});

afterEach(() => {
  jest.useRealTimers();
  // A query the row store does not know is a fault in the test set-up, even
  // when the code under test caught it and answered something plausible.
  expect(mockStore.usageErrors).toEqual([]);
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
    const res = await board(unknownCtx);
    expect(res.status).toBe(404);
    expect(mockListStudioDrafts).not.toHaveBeenCalled();
  });

  it('returns 403 when the user cannot access the client organisation', async () => {
    seedStudio(STRANGER);
    const res = await board();
    expect(res.status).toBe(403);
    expect(mockListStudioDrafts).not.toHaveBeenCalled();
  });

  it('serves a business that exists in the vault but was never in the old hardcoded registry (g9)', async () => {
    seedStudio({ ...EDITOR, home: 'org-ccw' }, 'org-ccw');
    const res = await board({ params: Promise.resolve({ client: 'ccw' }) });
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
    const res = await board();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.displayName).toBe('RestoreAssist');
    expect(body.board.awaiting_approval).toHaveLength(2);
    expect(body.board.approved).toHaveLength(1);
    expect(body.total).toBe(3);
    expect(mockStore.calls).toContainEqual({
      model: 'organization',
      method: 'findUnique',
      args: ORG_SELECT,
    });
    // The access rule read this caller's own record.
    expect(mockStore.calls).toContainEqual({
      model: 'user',
      method: 'findUnique',
      args: expect.objectContaining({ where: { id: 'user-1' } }),
    });
    // client-org-scoped read
    expect(mockListStudioDrafts).toHaveBeenCalledWith({
      organizationId: 'org-ra',
      clientSlug: 'restoreassist',
    });
  });

  it('returns 503 STUDIO_ACCESS_CHECK_UNAVAILABLE on GET when the board access read fails', async () => {
    const planted = new Error('planted: user read failed');
    mockStore.fail({ model: 'user' }, planted);

    const res = await board();

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual(
      expect.objectContaining({
        error: SENTENCES.accessUnavailable,
        code: CODES.accessUnavailable,
      })
    );
    expect(mockListStudioDrafts).not.toHaveBeenCalled();
    expect(mockLog.error).toHaveBeenCalledTimes(1);
    const reported = tracked('studio/board-access');
    expect(reported).toHaveLength(1);
    expect(reported[0].error).toBe(planted);
  });

  it('writes one info line on GET when approve is refused', async () => {
    seedStudio(VIEWER);
    const refused = await board();
    expect(refused.status).toBe(200);
    expect(mockLog.info.mock.calls.map(call => call[0])).toEqual([
      'studio approve refused',
    ]);
    const fields = logFields(mockLog.info.mock.calls[0]);
    expect(fields.code).toBe(CODES.role);
    expect(Object.values(fields)).toEqual(
      expect.arrayContaining(['user-1', 'org-ra'])
    );

    // The paired allowed caller: an editor's board load writes no such line.
    mockLog.info.mockClear();
    seedStudio(EDITOR);
    const allowed = await board();
    expect(allowed.status).toBe(200);
    expect(mockLog.info).not.toHaveBeenCalled();
  });
});

describe('GET review links', () => {
  const stored = {
    id: 'd1',
    status: 'awaiting_approval',
    topic: 'A',
    videoUrl: 'https://old.example/expired',
    metadata: {
      storageBucket: 'media-uploads',
      storagePath: 'restoreassist/a-delivery.mp4',
    },
  };

  it('signs each stored review copy on every read, never serving the saved link', async () => {
    mockListStudioDrafts.mockResolvedValue([stored]);
    mockSignedUrls.mockResolvedValue(['https://signed.example/fresh']);
    const res = await board();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.board.awaiting_approval[0].videoUrl).toBe(
      'https://signed.example/fresh'
    );
    expect(mockSignedUrls).toHaveBeenCalledWith(
      'media-uploads',
      ['restoreassist/a-delivery.mp4'],
      6 * 60 * 60
    );
  });

  it('reports a failed signing on the card and still serves the board', async () => {
    mockListStudioDrafts.mockResolvedValue([stored]);
    mockSignedUrls.mockRejectedValue(new Error('storage down'));
    const res = await board();
    expect(res.status).toBe(200);
    const card = (await res.json()).board.awaiting_approval[0];
    expect(card.videoUrl).toBeNull();
    expect(card.videoError).toMatch(/could not be created/);
  });
});

describe('POST /api/marketing-agency/studio/[client] (approve → schedule)', () => {
  // ---- 401 ----------------------------------------------------------------

  it('returns 401 when unauthenticated', async () => {
    mockSecurityCheck.mockResolvedValueOnce({
      allowed: false,
      error: 'Auth required',
      context: {},
    });
    const res = await approve();
    expect(res.status).toBe(401);
    expect(mockApproveAndSchedule).not.toHaveBeenCalled();
  });

  it('returns 401 on approve with no session, even with an invalid body', async () => {
    mockSecurityCheck.mockResolvedValueOnce({
      allowed: false,
      error: 'Auth required',
      context: {},
    });
    const res = await approve({ nope: true });
    expect(res.status).toBe(401);
    // Identity is decided before the body, the organisation or any role is read.
    expect(mockStore.reads).toEqual(NO_READS);
    expect(mockApproveAndSchedule).not.toHaveBeenCalled();
  });

  // ---- 403 ----------------------------------------------------------------

  it('returns 403 on approve when the user does not belong to the client organisation', async () => {
    seedStudio(STRANGER);
    const res = await approve();
    expect(res.status).toBe(403);
    expect(mockApproveAndSchedule).not.toHaveBeenCalled();
  });

  it('refuses (403) an approver who only belongs to the parent workspace, while the board (GET) still serves them', async () => {
    // Seeing a child brand from the parent workspace is not the same as being
    // allowed to publish on its behalf.
    seedStudio(PARENT_ONLY);

    const post = await approve();
    expect(post.status).toBe(403);
    expect(mockApproveAndSchedule).not.toHaveBeenCalled();
    // The approve decision read this caller's own record and never asked
    // whether they belong to the parent workspace.
    expect(mockStore.calls).toContainEqual({
      model: 'user',
      method: 'findUnique',
      args: expect.objectContaining({ where: { id: 'user-1' } }),
    });
    expect(
      mockStore.calls.filter(
        call => call.model === 'organization' && call.method === 'findFirst'
      )
    ).toEqual([]);

    const get = await board();
    expect(get.status).toBe(200);
    // The board tells the client which of the two it holds, computed by the
    // same function the POST gates on.
    expect((await get.json()).canApprove).toBe(false);
  });

  it('refuses a viewer with STUDIO_APPROVE_ROLE_REQUIRED', async () => {
    seedStudio(VIEWER);

    const res = await approve();

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe(CODES.role);
    expect(body.error).toBe(SENTENCES.role);
    expect(mockApproveAndSchedule).not.toHaveBeenCalled();
    expect(mockLog.warn).toHaveBeenCalledTimes(1);
  });

  it('refuses a parent-workspace-only member with STUDIO_APPROVE_NOT_ORG_MEMBER', async () => {
    seedStudio(PARENT_ONLY);

    const res = await approve();

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe(CODES.notMember);
    expect(body.error).toBe(SENTENCES.notMember);
    expect(body.organizationId).toBe('org-ra');
    expect(mockApproveAndSchedule).not.toHaveBeenCalled();
    expect(mockLog.warn).toHaveBeenCalledTimes(1);
  });

  // ---- 400 ----------------------------------------------------------------

  it('returns 400 on an invalid body', async () => {
    const res = await approve({ nope: true });
    expect(res.status).toBe(400);
    expect(mockApproveAndSchedule).not.toHaveBeenCalled();
  });

  it('returns 400 when scheduledAt is not an ISO instant', async () => {
    const res = await approve({ draftId: 'd1', scheduledAt: 'tomorrow' });
    expect(res.status).toBe(400);
    expect(mockApproveAndSchedule).not.toHaveBeenCalled();
  });

  it('returns 400 to a viewer who sends an invalid body, before any organisation or role read', async () => {
    seedStudio(VIEWER);
    const res = await approve({ nope: true });
    expect(res.status).toBe(400);
    // The body is judged before the organisation, the membership or any role
    // is read: a viewer learns "invalid body", not "forbidden".
    expect(mockStore.reads).toEqual(NO_READS);
    expect(mockApproveAndSchedule).not.toHaveBeenCalled();
  });

  it('returns 400 naming the blockers when clearances name a reserved blocker (credentials must come from a live connection)', async () => {
    // The service owns the rule and refuses before any claim; the route turns
    // its typed error into the 400 a client can act on.
    mockApproveAndSchedule.mockRejectedValueOnce(
      new InvalidClearanceError(['platform_credentials_required'])
    );
    const res = await approve({
      draftId: 'd1',
      clearances: ['platform_credentials_required'],
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.blockers).toEqual(['platform_credentials_required']);
    expect(body.error).toMatch(/cannot be discharged/);
  });

  it('returns 400 naming the blocker when clearances name the approval blocker (the click is the approval)', async () => {
    mockApproveAndSchedule.mockRejectedValueOnce(
      new InvalidClearanceError(['human_or_client_approval_required'])
    );
    const res = await approve({
      draftId: 'd1',
      clearances: ['human_or_client_approval_required'],
    });
    expect(res.status).toBe(400);
    expect((await res.json()).blockers).toEqual([
      'human_or_client_approval_required',
    ]);
  });

  // ---- 200 ----------------------------------------------------------------

  it('approves through the bridge (org-scoped, approvedBy = caller, client resolved from the org) and returns what was scheduled', async () => {
    mockApproveAndSchedule.mockResolvedValue({
      approved: true,
      outcome: 'approved',
      scheduled: [
        {
          platform: 'linkedin',
          postId: 'post-1',
          scheduledAt: '2026-09-02T14:00:00.000Z',
          linkUrl: 'https://restoreassist.app/?utm_source=linkedin',
        },
      ],
      skipped: [{ platform: 'blog', reason: 'platform_not_schedulable' }],
    });
    const res = await approve();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      approved: true,
      draftId: 'd1',
      outcome: 'approved',
      scheduled: [
        {
          platform: 'linkedin',
          postId: 'post-1',
          scheduledAt: '2026-09-02T14:00:00.000Z',
          linkUrl: 'https://restoreassist.app/?utm_source=linkedin',
        },
      ],
      skipped: [{ platform: 'blog', reason: 'platform_not_schedulable' }],
    });
    expect(mockStore.calls).toContainEqual({
      model: 'organization',
      method: 'findUnique',
      args: ORG_SELECT,
    });
    // The approve decision read this caller's own record, and membership of
    // the parent workspace was never asked about.
    expect(mockStore.calls).toContainEqual({
      model: 'user',
      method: 'findUnique',
      args: expect.objectContaining({ where: { id: 'user-1' } }),
    });
    expect(
      mockStore.calls.filter(
        call => call.model === 'organization' && call.method === 'findFirst'
      )
    ).toEqual([]);
    expect(mockApproveAndSchedule).toHaveBeenCalledWith({
      organizationId: 'org-ra',
      id: 'd1',
      approvedBy: 'user-1',
      client: expect.objectContaining({
        clientSlug: 'restoreassist',
        funnelUrl: 'https://restoreassist.app',
      }),
      scheduledAt: undefined,
      clearances: undefined,
    });
  });

  it('passes a caller-supplied scheduledAt through as a Date', async () => {
    const res = await approve({
      draftId: 'd1',
      scheduledAt: '2026-09-03T09:00:00.000Z',
    });
    expect(res.status).toBe(200);
    expect(mockApproveAndSchedule.mock.calls[0][0].scheduledAt).toEqual(
      new Date('2026-09-03T09:00:00.000Z')
    );
  });

  it('passes explicit clearances through so the approver can discharge a pack blocker on record', async () => {
    const res = await approve({
      draftId: 'd1',
      clearances: ['final_asset_rights_check_required'],
    });
    expect(res.status).toBe(200);
    expect(mockApproveAndSchedule.mock.calls[0][0].clearances).toEqual([
      'final_asset_rights_check_required',
    ]);
  });

  it('allows an editor to approve', async () => {
    seedStudio(EDITOR);

    const res = await approve();

    expect(res.status).toBe(200);
    expect((await res.json()).approved).toBe(true);
    expect(mockApproveAndSchedule).toHaveBeenCalledTimes(1);
    expect(mockApproveAndSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-ra',
        approvedBy: 'user-1',
      })
    );
    expect(mockLog.warn).not.toHaveBeenCalled();
  });

  it('allows an active owner to approve when the UserRole read fails', async () => {
    // The pair of the 503 case below: the same viewer row and the same failed
    // read, plus an active ownership that was read successfully.
    seedStudio(OWNER_WITH_VIEWER_ROW);
    mockStore.fail(
      { model: 'userRole' },
      new Error('planted: role store down')
    );

    const res = await approve();

    expect(res.status).toBe(200);
    expect(mockApproveAndSchedule).toHaveBeenCalledTimes(1);
    expect(mockApproveAndSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-ra',
        approvedBy: 'user-1',
      })
    );
  });

  it('counts an organisation read and a role read when an editor approves', async () => {
    // The positive control for the two "before any ... read" pins: the same
    // counters that must be zero there move when the decision is reached.
    seedStudio(EDITOR);

    const res = await approve();

    expect(res.status).toBe(200);
    const reads = mockStore.reads;
    expect(reads.organization).toBeGreaterThan(0);
    expect(reads.user).toBeGreaterThan(0);
    expect(reads.teamMember).toBeGreaterThan(0);
    expect(reads.userRole).toBeGreaterThan(0);
    expect(reads.businessOwnership).toBeGreaterThan(0);
  });

  // ---- 404 ----------------------------------------------------------------

  it('returns 404 when the draft is not found / not awaiting approval / wrong org', async () => {
    mockApproveAndSchedule.mockResolvedValue({
      approved: false,
      outcome: 'not_awaiting_approval',
      scheduled: [],
      skipped: [],
    });
    const res = await approve();
    expect(res.status).toBe(404);
  });

  it('returns 404 on approve when the organisation does not exist', async () => {
    const res = await approve({ draftId: 'd1' }, unknownCtx);
    expect(res.status).toBe(404);
    expect(mockApproveAndSchedule).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown organisation before any role read', async () => {
    seedStudio(VIEWER);
    const res = await approve({ draftId: 'd1' }, unknownCtx);
    expect(res.status).toBe(404);
    // One read, the organisation lookup by slug, and nothing after it: neither
    // the membership nor any role is read for an organisation that is unknown.
    expect(mockStore.reads).toEqual({ ...NO_READS, organization: 1 });
    expect(mockApproveAndSchedule).not.toHaveBeenCalled();
  });

  // ---- 409 ----------------------------------------------------------------

  it('names the organisation and the remedy when the organisation publish-safety state blocks the approval', async () => {
    mockApproveAndSchedule.mockResolvedValue({
      approved: false,
      outcome: 'blocked',
      scheduled: [],
      skipped: [
        {
          platform: 'linkedin',
          reason: 'org_publish_gate: calendar_mode_shadow',
        },
      ],
    });
    const res = await approve();
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.organizationId).toBe('org-ra');
    expect(body.remedy).toEqual(
      expect.objectContaining({
        action: 'POST /api/calendar/live-mode-activate',
        body: { tier: 1, confirmed: true, organizationId: 'org-ra' },
      })
    );
  });

  it('answers 409 with the reasons when the pack blocks external publishing (the draft is handed back)', async () => {
    mockApproveAndSchedule.mockResolvedValue({
      approved: false,
      outcome: 'blocked',
      scheduled: [],
      skipped: [
        {
          platform: 'linkedin',
          reason:
            'external_publish_blocked: platform_credentials_required, final_asset_rights_check_required',
        },
      ],
    });
    const res = await approve();
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.outcome).toBe('blocked');
    expect(body.skipped[0].reason).toMatch(/platform_credentials_required/);
  });

  // ---- 500 ----------------------------------------------------------------

  it('reaches the error backend with the draft named when the bridge rejects (500)', async () => {
    mockApproveAndSchedule.mockRejectedValueOnce(
      new Error('draft record unavailable')
    );
    const res = await approve();
    expect(res.status).toBe(500);
    expect(mockTrackError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        operation: 'studio/approve-and-schedule',
        metadata: expect.objectContaining({
          organizationId: 'org-ra',
          draftId: 'd1',
          stage: 'route',
        }),
      })
    );
  });

  // ---- 502 ----------------------------------------------------------------

  it('answers 502 when every platform failed to schedule (the draft is handed back for retry)', async () => {
    mockApproveAndSchedule.mockResolvedValue({
      approved: false,
      outcome: 'schedule_failed',
      scheduled: [],
      skipped: [
        {
          platform: 'linkedin',
          reason: 'schedule_failed: database unavailable',
        },
      ],
    });
    const res = await approve();
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.outcome).toBe('schedule_failed');
  });

  // ---- 503 ----------------------------------------------------------------

  it('returns 503 STUDIO_APPROVE_CHECK_UNAVAILABLE when a role read fails for a viewer', async () => {
    // The pair of the owner case above: without the ownership, nothing that
    // was read allows, and the read that failed could have.
    seedStudio(VIEWER);
    mockStore.fail(
      { model: 'userRole' },
      new Error('planted: role store down')
    );

    const res = await approve();

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual(
      expect.objectContaining({
        error: SENTENCES.approveUnavailable,
        code: CODES.approveUnavailable,
      })
    );
    expect(mockApproveAndSchedule).not.toHaveBeenCalled();
  });
});

describe('who may approve: GET and POST decide by the same records', () => {
  /** What the board says about approving, and what an approve then answers. */
  async function boardThenApprove(caller: Caller) {
    seedStudio(caller);
    const get = await board();
    const getBody = await get.json();
    const post = await approve();
    const postBody = await post.json();
    return {
      get: {
        status: get.status,
        canApprove: getBody.canApprove,
        approveRefusal: getBody.approveRefusal,
      },
      post: { status: post.status, code: postBody.code ?? null },
      approveServiceCalls: mockApproveAndSchedule.mock.calls.length,
    };
  }

  const allowed = {
    get: { status: 200, canApprove: true, approveRefusal: null },
    post: { status: 200, code: null },
    approveServiceCalls: 1,
  };
  const refusedWith = (code: string) => ({
    get: { status: 200, canApprove: false, approveRefusal: code },
    post: { status: 403, code },
    approveServiceCalls: 0,
  });

  // Rows D1 to D6 of the decision table (spec section 9.4).

  it('GET canApprove and approveRefusal agree with POST for D1', async () => {
    // Not a direct member, whatever else is held: here an editor row.
    expect(await boardThenApprove(PARENT_ONLY)).toEqual(
      refusedWith(CODES.notMember)
    );
  });

  it('GET canApprove and approveRefusal agree with POST for D2', async () => {
    // Direct member with an active ownership; the viewer row does not lower it.
    expect(await boardThenApprove(OWNER_WITH_VIEWER_ROW)).toEqual(allowed);
  });

  it('GET canApprove and approveRefusal agree with POST for D3', async () => {
    // Direct member with no team row: owner by convention, even holding only
    // the Viewer role.
    expect(
      await boardThenApprove({
        ...EDITOR,
        teamRole: null,
        grants: [{ roleId: 'role-viewer', expiresAt: null }],
      })
    ).toEqual(allowed);
  });

  it('GET canApprove and approveRefusal agree with POST for D4', async () => {
    // Direct member whose team row is editor, with no role grant at all.
    expect(await boardThenApprove(EDITOR)).toEqual(allowed);
  });

  it('GET canApprove and approveRefusal agree with POST for D5', async () => {
    // A viewer row, lifted by an Editor role that has not expired yet.
    expect(
      await boardThenApprove({
        ...VIEWER,
        grants: [{ roleId: 'role-editor', expiresAt: FUTURE }],
      })
    ).toEqual(allowed);
  });

  it('GET canApprove and approveRefusal agree with POST for D6', async () => {
    // The pair of D5, one field apart: the same Editor role, already expired.
    expect(
      await boardThenApprove({
        ...VIEWER,
        grants: [{ roleId: 'role-editor', expiresAt: PAST }],
      })
    ).toEqual(refusedWith(CODES.role));
  });

  it('puts the refusal sentence in error and the code in code on every refusal', async () => {
    const answers: Array<{ status: number; error: unknown; code: unknown }> =
      [];
    const record = async (res: {
      status: number;
      json: () => Promise<{ error?: unknown; code?: unknown }>;
    }) => {
      const body = await res.json();
      answers.push({ status: res.status, error: body.error, code: body.code });
    };

    seedStudio(VIEWER);
    await record(await approve());

    seedStudio(PARENT_ONLY);
    await record(await approve());

    mockStore.reset();
    seedStudio(VIEWER);
    mockStore.fail(
      { model: 'userRole' },
      new Error('planted: role store down')
    );
    await record(await approve());

    mockStore.reset();
    seedStudio(EDITOR);
    mockStore.fail({ model: 'user' }, new Error('planted: user read failed'));
    await record(await board());

    expect(answers).toEqual([
      { status: 403, error: SENTENCES.role, code: CODES.role },
      { status: 403, error: SENTENCES.notMember, code: CODES.notMember },
      {
        status: 503,
        error: SENTENCES.approveUnavailable,
        code: CODES.approveUnavailable,
      },
      {
        status: 503,
        error: SENTENCES.accessUnavailable,
        code: CODES.accessUnavailable,
      },
    ]);
    expect(mockApproveAndSchedule).not.toHaveBeenCalled();
  });

  it('reports each failed read to the error tracker with the read name', async () => {
    // An editor, so each planted failure breaks exactly one of the four reads
    // of the approve decision.
    const readsAndModels = [
      { read: 'membership', model: 'user' },
      { read: 'ownership', model: 'businessOwnership' },
      { read: 'teamMember', model: 'teamMember' },
      { read: 'userRole', model: 'userRole' },
    ] as const;
    const reported: Array<{ read: unknown; sameError: boolean }> = [];
    const errorLines: number[] = [];

    for (const { read, model } of readsAndModels) {
      const planted = new Error(`planted: ${read} read failed`);
      mockStore.reset();
      seedStudio(EDITOR);
      mockStore.fail({ model }, planted);
      mockTrackError.mockClear();
      mockLog.error.mockClear();

      await approve();

      for (const call of tracked('studio/approval-authority')) {
        reported.push({
          read: call.metadata.read,
          sameError: call.error === planted,
        });
      }
      errorLines.push(mockLog.error.mock.calls.length);
    }

    expect(reported).toEqual(
      readsAndModels.map(({ read }) => ({ read, sameError: true }))
    );
    // One error line per failed read, as well as the tracker call.
    expect(errorLines).toEqual([1, 1, 1, 1]);
  });

  it('every new log line on the approve and board paths carries its code field', async () => {
    const codesOf = (log: jest.Mock) =>
      log.mock.calls.map(call => logFields(call).code);
    const fresh = (caller: Caller) => {
      mockStore.reset();
      seedStudio(caller);
      mockLog.warn.mockClear();
      mockLog.info.mockClear();
      mockLog.error.mockClear();
      mockTrackError.mockClear();
    };

    // A 403 for role: one warn line.
    fresh(VIEWER);
    await approve();
    expect(codesOf(mockLog.warn)).toEqual([CODES.role]);

    // A 403 for membership: one warn line.
    fresh(PARENT_ONLY);
    await approve();
    expect(codesOf(mockLog.warn)).toEqual([CODES.notMember]);

    // A 503 on approve: one warn line, and the failed read's own error line
    // and tracker call name the decision and its code.
    fresh(VIEWER);
    mockStore.fail(
      { model: 'userRole' },
      new Error('planted: role store down')
    );
    await approve();
    expect(codesOf(mockLog.warn)).toEqual([CODES.approveUnavailable]);
    expect(mockLog.error.mock.calls.map(call => logFields(call))).toEqual([
      expect.objectContaining({
        read: 'userRole',
        decision: 'unavailable',
        code: CODES.approveUnavailable,
      }),
    ]);
    expect(
      tracked('studio/approval-authority').map(call => call.metadata)
    ).toEqual([
      expect.objectContaining({
        read: 'userRole',
        decision: 'unavailable',
        code: CODES.approveUnavailable,
      }),
    ]);

    // The same failed read beside a record that allows: the line names the
    // decision that was reached.
    fresh(OWNER_WITH_VIEWER_ROW);
    mockStore.fail(
      { model: 'userRole' },
      new Error('planted: role store down')
    );
    await approve();
    expect(mockLog.warn).not.toHaveBeenCalled();
    expect(mockLog.error.mock.calls.map(call => logFields(call))).toEqual([
      expect.objectContaining({ read: 'userRole', decision: 'allowed' }),
    ]);
    expect(
      tracked('studio/approval-authority').map(call => call.metadata)
    ).toEqual([
      expect.objectContaining({ read: 'userRole', decision: 'allowed' }),
    ]);

    // A board load that reports a refusal: one info line.
    fresh(VIEWER);
    await board();
    expect(codesOf(mockLog.info)).toEqual([CODES.role]);

    // A board read whose access check failed: one error line and one tracker
    // call, both with the code.
    fresh(EDITOR);
    mockStore.fail({ model: 'user' }, new Error('planted: user read failed'));
    await board();
    expect(codesOf(mockLog.error)).toEqual([CODES.accessUnavailable]);
    expect(
      tracked('studio/board-access').map(call => call.metadata.code)
    ).toEqual([CODES.accessUnavailable]);
  });
});
