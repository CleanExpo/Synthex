/**
 * A post edited after its final approval does not publish the unapproved
 * wording (SYN-1256).
 *
 * SEAM: PATCH /api/approvals/[id], PATCH /api/scheduler/posts/[postId],
 * PATCH /api/scheduler/posts and GET /api/cron/publish-scheduled, called
 * through createMockNextRequest against one in-memory Post / ApprovalRequest
 * store. The store applies the cron's due-post filter and the publish claim's
 * conditional updateMany, so the routes decide the outcome. The only stub at a
 * system boundary is the platform adapter (createPost), which records what
 * would have been sent.
 *
 * CATCHES:
 *   - the cron sending wording (text, platform, images or link) that changed
 *     after the approval, when the change was written straight to the row,
 *     so no edit-path hold can mask a missing cron check;
 *   - either scheduler PATCH route leaving an edited, approved post scheduled,
 *     or letting a client set a held post back to scheduled;
 *   - a bound approval that is not final yet letting a post publish;
 *   - a failed approval lookup read as "no approval";
 *   - a dead end: resubmit and re-approve must publish the new wording once.
 *
 * MISSES: real Postgres transaction semantics and row locks; Post writers
 * other than the two PATCH routes (the cron check covers them, since it reads
 * the row it sends); the CalendarPost path.
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';
import { buildApprovedCampaignAuthorityManifest } from '@/tests/helpers/campaign-authority-manifest';
import {
  CAMPAIGN_AUTHORITY_MANIFEST_KEY,
  type CampaignEvidenceManifest,
} from '@/lib/marketing-agency/campaign-authority-manifest';
import {
  CONTENT_FINGERPRINT_KEY,
  postContentFingerprint,
} from '@/lib/approvals/content-fingerprint';

// ---------------------------------------------------------------------------
// In-memory store. Plain functions, not jest.fn: the jest config resets mocks
// between tests, which would wipe jest.fn implementations.
// ---------------------------------------------------------------------------

type Row = Record<string, any>;

const mockDb = {
  posts: new Map<string, Row>(),
  campaigns: new Map<string, Row>(),
  approvals: new Map<string, Row>(),
  users: new Map<string, Row>(),
  published: [] as { text: string; mediaUrls?: unknown; linkUrl?: unknown }[],
  currentUser: 'reviewer-1',
  approvalLookupFails: false,
};

function mockMatches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, cond]) => {
    const value = row[key];
    if (cond === null) return value === null || value === undefined;
    if (cond instanceof Date) return value?.getTime?.() === cond.getTime();
    if (typeof cond === 'object') {
      if ('lte' in cond) return value instanceof Date && value <= cond.lte;
      if ('lt' in cond) return value instanceof Date && value < cond.lt;
      if ('in' in cond) return cond.in.includes(value);
      return false;
    }
    return value === cond;
  });
}

function mockClone<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function mockPostView(row: Row): Row {
  return {
    ...row,
    metadata: mockClone(row.metadata),
    campaign: mockDb.campaigns.get(row.campaignId),
  };
}

function mockApprovalView(row: Row): Row {
  return {
    ...mockClone(row),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    dueDate: null,
    submitter: { name: 'Submitter', email: 's@example.test' },
  };
}

const mockPrisma: Record<string, any> = {
  post: {
    findMany: async ({ where }: { where: Row }) =>
      [...mockDb.posts.values()]
        .filter(row => mockMatches(row, where))
        .sort((a, b) => a.scheduledAt - b.scheduledAt)
        .map(mockPostView),
    findUnique: async ({ where }: { where: Row }) => {
      const row = mockDb.posts.get(where.id);
      return row ? mockPostView(row) : null;
    },
    update: async ({ where, data }: { where: Row; data: Row }) => {
      const row = mockDb.posts.get(where.id);
      if (!row) throw new Error(`post ${where.id} not found`);
      Object.assign(row, mockClone(data), { updatedAt: new Date() });
      if (data.publishedAt) row.publishedAt = new Date(data.publishedAt);
      if (data.scheduledAt) row.scheduledAt = new Date(data.scheduledAt);
      return mockPostView(row);
    },
    updateMany: async ({ where, data }: { where: Row; data: Row }) => {
      let count = 0;
      for (const row of mockDb.posts.values()) {
        if (!mockMatches(row, where)) continue;
        Object.assign(row, mockClone(data), { updatedAt: new Date() });
        count++;
      }
      return { count };
    },
  },
  approvalRequest: {
    findUnique: async ({ where }: { where: Row }) => {
      const row = mockDb.approvals.get(where.id);
      return row ? mockApprovalView(row) : null;
    },
    findFirst: async ({ where }: { where: Row }) => {
      if (mockDb.approvalLookupFails) throw new Error('database unavailable');
      const rows = [...mockDb.approvals.values()]
        .filter(row => mockMatches(row, where))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return rows[0] ? mockApprovalView(rows[0]) : null;
    },
    update: async ({ where, data }: { where: Row; data: Row }) => {
      const row = mockDb.approvals.get(where.id)!;
      Object.assign(row, mockClone(data), { updatedAt: new Date() });
      return mockApprovalView(row);
    },
  },
  user: {
    findUnique: async ({ where }: { where: Row }) =>
      mockDb.users.get(where.id) ?? null,
  },
  auditLog: { create: async () => ({}) },
  teamNotification: { create: async () => ({}) },
  notification: { create: async () => ({}) },
  organization: { findUnique: async () => null },
  platformConnection: {
    findFirst: async () => ({
      id: 'conn-1',
      accessToken: 'test-access-token',
      refreshToken: null,
      expiresAt: null,
      profileId: 'profile-1',
      profileName: 'CARSI',
    }),
  },
  platformPost: { create: async () => ({}) },
  // The approve path re-reads the post under a row lock inside the
  // transaction: SELECT content, platform, metadata FROM posts WHERE id = $1.
  $queryRaw: async (_sql: TemplateStringsArray, ...values: unknown[]) => {
    const row = mockDb.posts.get(values[0] as string);
    return row
      ? [
          {
            content: row.content,
            platform: row.platform,
            metadata: mockClone(row.metadata),
          },
        ]
      : [];
  },
};
mockPrisma.$transaction = async (cb: (tx: unknown) => unknown) =>
  cb(mockPrisma);

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

jest.mock('@/lib/auth/jwt-utils', () => ({
  __esModule: true,
  getUserIdFromRequestOrCookies: async () => mockDb.currentUser,
  getUserIdFromCookies: async () => mockDb.currentUser,
}));

jest.mock('@/lib/multi-business', () => ({
  __esModule: true,
  getEffectiveOrganizationId: async () => 'org-1',
}));
jest.mock('@/lib/multi-business/business-scope', () => ({
  __esModule: true,
  getEffectiveOrganizationId: async () => 'org-1',
}));

jest.mock('@/lib/security/api-security-checker', () => {
  const { NextResponse } = jest.requireActual('next/server');
  return {
    DEFAULT_POLICIES: { AUTHENTICATED_WRITE: {}, AUTHENTICATED_READ: {} },
    APISecurityChecker: {
      check: async () => ({
        allowed: true,
        context: { userId: mockDb.currentUser },
      }),
      createSecureResponse: (body: unknown, status: number) =>
        NextResponse.json(body, { status }),
    },
  };
});

jest.mock('@/lib/auth/cron-auth', () => ({
  verifyCronRequest: () => ({ ok: true, scope: 'shared-fallback' }),
}));

// System boundary: the external platform. Records what would have gone out.
jest.mock('@/lib/social', () => ({
  isPlatformSupported: () => true,
  createPlatformService: () => ({
    createPost: async (input: {
      text: string;
      mediaUrls?: unknown;
      linkUrl?: unknown;
    }) => {
      mockDb.published.push({ text: input.text });
      return {
        success: true,
        postId: 'ext-1',
        url: 'https://example.test/p/1',
      };
    },
  }),
}));

jest.mock('@/lib/redis-client', () => ({
  getRedisClient: () => ({ keys: async () => [], del: async () => 0 }),
}));
jest.mock('@/lib/social/connection-warnings', () => ({
  getScheduleConnectionWarnings: async () => [],
}));
jest.mock('@/lib/security/field-encryption', () => ({
  decryptFieldSafe: (v: string) => v,
  encryptField: (v: string) => v,
}));
jest.mock('@/lib/unite-group-connector', () => ({
  pushUniteGroupEvent: async () => undefined,
}));
jest.mock('@/lib/cache/invalidate-stats', () => ({
  invalidatePostStats: async () => undefined,
}));
jest.mock('@/lib/logger', () => ({
  logger: {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    debug: () => undefined,
  },
}));

import { PATCH as approvalPATCH } from '@/app/api/approvals/[id]/route';
import { GET as cronGET } from '@/app/api/cron/publish-scheduled/route';
import { PATCH as postByIdPATCH } from '@/app/api/scheduler/posts/[postId]/route';
import { PATCH as postsPATCH } from '@/app/api/scheduler/posts/route';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
const PAST_SCHEDULED_AT = new Date(Date.now() - 3 * DAY_MS);
// The [postId] route validates a cuid.
const POST_ID = 'cpostsyn1256approval';
const APPROVED_TEXT = 'CARSI water damage course: enrolments open this week.';
const EDITED_TEXT = 'CARSI water damage course: 90% off, guaranteed pass!';

function manifestUnderReview(): CampaignEvidenceManifest {
  // Both platforms carry an output, so a platform change reaches the
  // approval check rather than being stopped earlier by the authority gate.
  const base = buildApprovedCampaignAuthorityManifest({
    platformOutputs: [
      { platform: 'linkedin', status: 'approved', contentRef: 'post-li' },
      { platform: 'facebook', status: 'approved', contentRef: 'post-fb' },
    ],
  });
  return { ...base, approval: { status: 'pending_review' } };
}

function seedPost(metadata: Record<string, unknown>, status = 'scheduled') {
  mockDb.campaigns.set('camp-1', {
    userId: 'owner-1',
    platform: 'linkedin',
    organizationId: 'org-1',
    settings: {},
    content: {},
  });
  mockDb.posts.set(POST_ID, {
    id: POST_ID,
    content: APPROVED_TEXT,
    platform: 'linkedin',
    status,
    scheduledAt: PAST_SCHEDULED_AT,
    publishedAt: null,
    deletedAt: null,
    updatedAt: new Date(),
    campaignId: 'camp-1',
    metadata,
  });
}

/** A request bound to the post as it stands now, as POST /api/approvals does. */
function seedBoundApproval(status = 'pending') {
  const row = post();
  mockDb.approvals.set('apr-1', {
    id: 'apr-1',
    contentId: POST_ID,
    contentType: 'post',
    workflowId: null,
    submittedBy: 'owner-1',
    status,
    priority: 'normal',
    currentStep: 0,
    totalSteps: 1,
    steps: [
      {
        id: 'step-0',
        order: 0,
        type: 'final_approval',
        name: 'Final approval',
        status: 'in_review',
        assignedTo: ['*'],
        comments: [],
        requiredApprovals: 1,
        currentApprovals: 0,
        isOptional: false,
        createdAt: new Date().toISOString(),
      },
    ],
    title: 'Approve CARSI post',
    description: null,
    metadata: {
      platforms: ['linkedin'],
      [CONTENT_FINGERPRINT_KEY]: postContentFingerprint({
        content: row.content,
        platform: row.platform,
        metadata: row.metadata,
      }),
    },
    organizationId: 'org-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function post() {
  return mockDb.posts.get(POST_ID)!;
}

function historyEvents(): string[] {
  return ((post().metadata?.history as Row[]) ?? []).map(h => h.event);
}

async function runCron() {
  const res = await cronGET(
    createMockNextRequest({
      url: 'http://localhost/api/cron/publish-scheduled',
    })
  );
  return res.json();
}

async function approvalAct(user: string, body: Record<string, unknown>) {
  mockDb.currentUser = user;
  return approvalPATCH(
    createMockNextRequest({
      method: 'PATCH',
      url: 'http://localhost/api/approvals/apr-1',
      body,
    }),
    { params: Promise.resolve({ id: 'apr-1' }) }
  );
}

async function editById(body: Record<string, unknown>) {
  mockDb.currentUser = 'owner-1';
  return postByIdPATCH(
    createMockNextRequest({
      method: 'PATCH',
      url: `http://localhost/api/scheduler/posts/${POST_ID}`,
      body,
    }),
    { params: Promise.resolve({ postId: POST_ID }) }
  );
}

async function editViaCollection(body: Record<string, unknown>) {
  mockDb.currentUser = 'owner-1';
  return postsPATCH(
    createMockNextRequest({
      method: 'PATCH',
      url: 'http://localhost/api/scheduler/posts',
      body: { id: POST_ID, ...body },
    })
  );
}

/**
 * The reviewer's reproduction: a scheduled post with a manifest under review
 * is blocked by the real cron, submitted with a bound request, and approved.
 * The approval puts it back in the queue.
 */
async function approvedAndRequeued() {
  seedPost({ [CAMPAIGN_AUTHORITY_MANIFEST_KEY]: manifestUnderReview() });
  const first = await runCron();
  expect(first.blocked).toBe(1);
  seedBoundApproval();
  const res = await approvalAct('reviewer-1', { action: 'approve' });
  expect(res.status).toBe(200);
  expect(mockDb.approvals.get('apr-1')!.status).toBe('approved');
  expect(post().status).toBe('scheduled');
}

function expectHeld(reason: string) {
  expect(post().status).toBe('pending_approval');
  expect(post().metadata.publishGate.allowed).toBe(false);
  expect(post().metadata.publishGate.blockers).toContain(reason);
  expect(historyEvents()).toContain('held_for_approval');
}

beforeEach(() => {
  mockDb.posts.clear();
  mockDb.campaigns.clear();
  mockDb.approvals.clear();
  mockDb.users.clear();
  mockDb.published.length = 0;
  mockDb.approvalLookupFails = false;
  mockDb.currentUser = 'reviewer-1';
  for (const id of ['reviewer-1', 'owner-1']) {
    mockDb.users.set(id, {
      name: id,
      email: `${id}@example.test`,
      isMultiBusinessOwner: false,
      activeOrganizationId: null,
      organizationId: 'org-1',
    });
  }
});

// ---------------------------------------------------------------------------
// Control: the bound approval round trip still publishes.
// ---------------------------------------------------------------------------

it('CONTROL: an approved post that nobody edited publishes the approved wording once', async () => {
  await approvedAndRequeued();

  const summary = await runCron();

  expect(summary.published).toBe(1);
  expect(mockDb.published).toEqual([{ text: APPROVED_TEXT }]);
});

// ---------------------------------------------------------------------------
// Cron: the enforcement point. Edits are written straight to the row so no
// edit-path hold can stand in for the cron check.
// ---------------------------------------------------------------------------

describe('GET /api/cron/publish-scheduled refuses wording changed after approval', () => {
  it.each([
    ['text', (row: Row) => (row.content = EDITED_TEXT)],
    ['platform', (row: Row) => (row.platform = 'facebook')],
    [
      'images',
      (row: Row) =>
        (row.metadata = {
          ...row.metadata,
          images: ['https://example.test/x.png'],
        }),
    ],
    [
      'link',
      (row: Row) =>
        (row.metadata = { ...row.metadata, linkUrl: 'https://example.test' }),
    ],
  ])(
    'SYN-1256-cron-%s: a change written after approval sends nothing and holds the post',
    async (_field, change) => {
      await approvedAndRequeued();
      change(post());

      const summary = await runCron();

      expect(summary.published).toBe(0);
      expect(mockDb.published).toEqual([]);
      expectHeld('approved_content_changed');
    }
  );

  it('SYN-1256-not-final: a bound request still in review holds a post whose manifest already passes', async () => {
    seedPost({
      [CAMPAIGN_AUTHORITY_MANIFEST_KEY]: buildApprovedCampaignAuthorityManifest(
        {
          platformOutputs: [
            { platform: 'linkedin', status: 'approved', contentRef: 'p' },
          ],
        }
      ),
    });
    seedBoundApproval('in_review');

    const summary = await runCron();

    expect(summary.published).toBe(0);
    expect(mockDb.published).toEqual([]);
    expectHeld('approval_not_final');
  });

  it('SYN-1256-fail-closed: a failed approval lookup never publishes', async () => {
    await approvedAndRequeued();
    mockDb.approvalLookupFails = true;

    const summary = await runCron();

    expect(summary.published).toBe(0);
    expect(mockDb.published).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Edit paths: each PATCH route holds an approved post as soon as its wording
// changes.
// ---------------------------------------------------------------------------

describe('PATCH /api/scheduler/posts/[postId]', () => {
  it('SYN-1256-edit-by-id: changing the text of an approved post holds it, and the cron sends nothing', async () => {
    await approvedAndRequeued();

    const res = await editById({ content: EDITED_TEXT });

    expect(res.status).toBe(200);
    expect(post().content).toBe(EDITED_TEXT);
    expectHeld('approved_content_changed');
    const summary = await runCron();
    expect(summary.processed).toBe(0);
    expect(mockDb.published).toEqual([]);
  });

  it('SYN-1256-edit-by-id-metadata: replacing metadata with a new link holds the post', async () => {
    await approvedAndRequeued();

    const res = await editById({
      metadata: { ...post().metadata, linkUrl: 'https://example.test' },
    });

    expect(res.status).toBe(200);
    expectHeld('approved_content_changed');
  });

  it('SYN-1256-reschedule-held: setting a held post back to scheduled keeps it held', async () => {
    await approvedAndRequeued();
    await editById({ content: EDITED_TEXT });

    const res = await editById({ status: 'scheduled' });

    expect(res.status).toBe(200);
    expect(post().status).toBe('pending_approval');
  });

  it('a time-only change to an approved post leaves it scheduled and it still publishes', async () => {
    await approvedAndRequeued();

    const res = await editById({
      scheduledAt: PAST_SCHEDULED_AT.toISOString(),
    });

    expect(res.status).toBe(200);
    expect(post().status).toBe('scheduled');
    const summary = await runCron();
    expect(summary.published).toBe(1);
    expect(mockDb.published).toEqual([{ text: APPROVED_TEXT }]);
  });
});

describe('PATCH /api/scheduler/posts', () => {
  it('SYN-1256-edit-collection: changing the text of an approved post holds it, and the cron sends nothing', async () => {
    await approvedAndRequeued();

    const res = await editViaCollection({ content: EDITED_TEXT });

    expect(res.status).toBe(200);
    expectHeld('approved_content_changed');
    const summary = await runCron();
    expect(summary.processed).toBe(0);
    expect(mockDb.published).toEqual([]);
  });

  it('SYN-1256-edit-collection-images: new images on an approved post hold it', async () => {
    await approvedAndRequeued();

    const res = await editViaCollection({
      metadata: { images: ['https://example.test/x.png'] },
    });

    expect(res.status).toBe(200);
    expectHeld('approved_content_changed');
  });

  it('SYN-1256-reschedule-held-collection: setting a held post back to scheduled keeps it held', async () => {
    await approvedAndRequeued();
    await editViaCollection({ content: EDITED_TEXT });

    const res = await editViaCollection({ status: 'scheduled' });

    expect(res.status).toBe(200);
    expect(post().status).toBe('pending_approval');
  });
});

// ---------------------------------------------------------------------------
// The way back out: resubmit and re-approve publishes the new wording.
// ---------------------------------------------------------------------------

it('SYN-1256-way-out: after an edit is held, resubmit and approval publish the edited wording exactly once', async () => {
  await approvedAndRequeued();
  await editById({ content: EDITED_TEXT });
  expect(post().status).toBe('pending_approval');

  const resubmit = await approvalAct('owner-1', { action: 'resubmit' });
  expect(resubmit.status).toBe(200);
  const approve = await approvalAct('reviewer-1', { action: 'approve' });
  expect(approve.status).toBe(200);
  expect(post().status).toBe('scheduled');

  const first = await runCron();
  const second = await runCron();

  expect(first.published).toBe(1);
  expect(second.processed).toBe(0);
  expect(mockDb.published).toEqual([{ text: EDITED_TEXT }]);
});
