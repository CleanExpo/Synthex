/**
 * Approval re-queues a post the campaign-authority gate blocked.
 *
 * SEAM: PATCH /api/approvals/[id] and GET /api/cron/publish-scheduled, called
 * through createMockNextRequest against one in-memory Post/ApprovalRequest
 * store. The store applies the cron's real due-post filter (status, scheduledAt
 * <= now, publishedAt null, deletedAt null) and the publish claim's conditional
 * updateMany, so the round trip is decided by the routes, not by the test.
 * The only stub at a system boundary is the platform adapter (createPost).
 *
 * CATCHES: a final approval that leaves the post in pending_approval (the cron
 * never selects it again); a rejection or an intermediate step approval that
 * re-queues; a re-queue while the approved manifest still fails the gate;
 * a cron that publishes an unapproved post; a past scheduledAt being skipped.
 *
 * MISSES: real Postgres transaction semantics; content/version binding between
 * an approval request and the post body (covered by
 * approval-binds-version.test.ts); the CalendarPost path (no publisher reads
 * CalendarPost).
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';
import { buildApprovedCampaignAuthorityManifest } from '@/tests/helpers/campaign-authority-manifest';
import {
  CAMPAIGN_AUTHORITY_MANIFEST_KEY,
  type CampaignEvidenceManifest,
} from '@/lib/marketing-agency/campaign-authority-manifest';
import { buildMinimalCampaignAuthorityManifest } from '@/lib/marketing-agency/minimal-authority-manifest';
import { assertCampaignPublishable } from '@/lib/marketing-agency/publish-gate';

// ---------------------------------------------------------------------------
// In-memory store. Plain functions, not jest.fn: the worktree jest config sets
// resetMocks, which would wipe jest.fn implementations between tests.
// ---------------------------------------------------------------------------

type Row = Record<string, any>;

const mockDb = {
  posts: new Map<string, Row>(),
  campaigns: new Map<string, Row>(),
  approvals: new Map<string, Row>(),
  users: new Map<string, Row>(),
  published: [] as { text: string }[],
  currentUser: 'reviewer-1',
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
      return row
        ? {
            ...mockClone(row),
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            dueDate: null,
            submitter: { name: 'Submitter', email: 's@example.test' },
          }
        : null;
    },
    update: async ({ where, data }: { where: Row; data: Row }) => {
      const row = mockDb.approvals.get(where.id)!;
      Object.assign(row, mockClone(data), { updatedAt: new Date() });
      return {
        ...mockClone(row),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        dueDate: null,
        submitter: { name: 'Submitter', email: 's@example.test' },
      };
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

jest.mock('@/lib/auth/cron-auth', () => ({
  verifyCronRequest: () => ({ ok: true, scope: 'shared-fallback' }),
}));

// System boundary: the external platform. Records what would have gone out.
jest.mock('@/lib/social', () => ({
  isPlatformSupported: () => true,
  createPlatformService: () => ({
    createPost: async (input: { text: string }) => {
      mockDb.published.push({ text: input.text });
      return {
        success: true,
        postId: 'ext-1',
        url: 'https://example.test/p/1',
      };
    },
  }),
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

import { PATCH } from '@/app/api/approvals/[id]/route';
import { GET } from '@/app/api/cron/publish-scheduled/route';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
const PAST_SCHEDULED_AT = new Date(Date.now() - 3 * DAY_MS);
const POST_TEXT = 'CARSI water damage course: enrolments open this week.';

/** A rich manifest still under human review: scores exist, approval does not. */
function manifestUnderReview(
  overrides: Partial<CampaignEvidenceManifest> = {}
): CampaignEvidenceManifest {
  const base = buildApprovedCampaignAuthorityManifest({
    platformOutputs: [
      { platform: 'linkedin', status: 'approved', contentRef: 'post-li' },
    ],
    ...overrides,
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
  mockDb.posts.set('post-1', {
    id: 'post-1',
    content: POST_TEXT,
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

function seedApproval(stepCount = 1) {
  const steps = Array.from({ length: stepCount }, (_, i) => ({
    id: `step-${i}`,
    order: i,
    type: i === stepCount - 1 ? 'final_approval' : 'review',
    name: `Step ${i}`,
    status: i === 0 ? 'in_review' : 'pending',
    assignedTo: ['*'],
    comments: [],
    requiredApprovals: 1,
    currentApprovals: 0,
    isOptional: false,
    createdAt: new Date().toISOString(),
  }));
  mockDb.approvals.set('apr-1', {
    id: 'apr-1',
    contentId: 'post-1',
    contentType: 'post',
    workflowId: null,
    submittedBy: 'owner-1',
    status: 'pending',
    priority: 'normal',
    currentStep: 0,
    totalSteps: stepCount,
    steps,
    title: 'Approve CARSI post',
    description: null,
    metadata: { platforms: ['linkedin'] },
    organizationId: 'org-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

async function runCron() {
  const res = await GET(
    createMockNextRequest({
      url: 'http://localhost/api/cron/publish-scheduled',
    })
  );
  return res.json();
}

async function act(body: Record<string, unknown>) {
  const res = await PATCH(
    createMockNextRequest({
      method: 'PATCH',
      url: 'http://localhost/api/approvals/apr-1',
      body,
    }),
    { params: Promise.resolve({ id: 'apr-1' }) }
  );
  return res;
}

function post() {
  return mockDb.posts.get('post-1')!;
}

function historyEvents(): string[] {
  return ((post().metadata?.history as Row[]) ?? []).map(h => h.event);
}

/** Seed a scheduled post with a manifest under review and let the real cron block it. */
async function blockedByGate(
  overrides: Partial<CampaignEvidenceManifest> = {}
) {
  seedPost({
    [CAMPAIGN_AUTHORITY_MANIFEST_KEY]: manifestUnderReview(overrides),
  });
  const first = await runCron();
  expect(first.blocked).toBe(1);
  expect(post().status).toBe('pending_approval');
}

beforeEach(() => {
  mockDb.posts.clear();
  mockDb.campaigns.clear();
  mockDb.approvals.clear();
  mockDb.users.clear();
  mockDb.published.length = 0;
  mockDb.currentUser = 'reviewer-1';
  mockDb.users.set('reviewer-1', {
    name: 'Reviewer',
    email: 'reviewer@example.test',
    isMultiBusinessOwner: false,
    activeOrganizationId: null,
    organizationId: 'org-1',
  });
});

// ---------------------------------------------------------------------------
// Approval side
// ---------------------------------------------------------------------------

describe('PATCH /api/approvals/[id] re-queues a gate-blocked post', () => {
  it('REQ-final-requeues: the final approval sets the post back to scheduled, keeps scheduledAt and records history', async () => {
    await blockedByGate();
    seedApproval(1);

    const res = await act({ action: 'approve' });

    expect(res.status).toBe(200);
    expect(post().status).toBe('scheduled');
    expect(post().scheduledAt.getTime()).toBe(PAST_SCHEDULED_AT.getTime());
    expect(historyEvents()).toContain('requeued_after_approval');
  });

  it('REQ-reject-no-requeue: a rejection leaves the post in pending_approval', async () => {
    await blockedByGate();
    seedApproval(1);

    const res = await act({ action: 'reject', comment: 'Claims need work' });

    expect(res.status).toBe(200);
    expect(post().status).toBe('pending_approval');
    expect(historyEvents()).not.toContain('requeued_after_approval');
  });

  it('REQ-intermediate-no-requeue: only the last step of a multi-step approval re-queues', async () => {
    await blockedByGate();
    seedApproval(2);

    await act({ action: 'approve' });
    expect(post().status).toBe('pending_approval');

    await act({ action: 'approve' });
    expect(post().status).toBe('scheduled');
  });

  it('REQ-still-blocked-no-requeue: an approved manifest that still fails the gate (no evaluation) stays pending_approval', async () => {
    await blockedByGate({ evaluation: undefined });
    seedApproval(1);

    await act({ action: 'approve' });

    expect(post().status).toBe('pending_approval');
    expect(historyEvents()).toContain('approval_recorded_gate_still_blocked');
    expect(post().metadata.publishGate.blockers).toContain(
      'campaign_evaluation_missing'
    );
  });

  it('REQ-still-blocked-no-requeue: an autopilot minimal manifest (no scheduler, no evaluation) stays pending_approval after approval', async () => {
    // Exactly what the cron writes for an autopilot post: the real minimal
    // builder with no scheduler, and the real gate's verdict on it.
    const minimal = buildMinimalCampaignAuthorityManifest({
      platforms: ['linkedin'],
      idSeed: 'post-1',
    });
    const publishGate = assertCampaignPublishable({
      manifest: minimal,
      platforms: ['linkedin'],
      requestedAction: 'cron_external_publish',
    });
    expect(publishGate.allowed).toBe(false);
    seedPost(
      {
        source: 'autopilot',
        [CAMPAIGN_AUTHORITY_MANIFEST_KEY]: minimal,
        publishGate,
        history: [{ event: 'publish_blocked_authority_gate' }],
      },
      'pending_approval'
    );
    seedApproval(1);

    await act({ action: 'approve' });

    expect(post().status).toBe('pending_approval');
  });

  it('does not touch a pending_approval post the gate never blocked (no publishGate in metadata)', async () => {
    seedPost(
      { [CAMPAIGN_AUTHORITY_MANIFEST_KEY]: manifestUnderReview() },
      'pending_approval'
    );
    seedApproval(1);

    await act({ action: 'approve' });

    expect(post().status).toBe('pending_approval');
  });
});

// ---------------------------------------------------------------------------
// Cron side: the round trip
// ---------------------------------------------------------------------------

describe('GET /api/cron/publish-scheduled after approval', () => {
  it('REQ-cron-publishes-approved: an approved, re-queued post reaches the platform adapter and is published', async () => {
    await blockedByGate();
    seedApproval(1);
    await act({ action: 'approve' });

    const summary = await runCron();

    expect(summary.published).toBe(1);
    expect(mockDb.published).toEqual([{ text: POST_TEXT }]);
    expect(post().status).toBe('published');
  });

  it('REQ-cron-skips-unapproved: a blocked post with no approval never reaches the platform adapter', async () => {
    await blockedByGate();

    const summary = await runCron();

    expect(summary.processed).toBe(0);
    expect(mockDb.published).toEqual([]);
    expect(post().status).toBe('pending_approval');
  });

  it('REQ-past-scheduledAt: a re-queued post whose scheduledAt is three days past is still due and published', async () => {
    await blockedByGate();
    seedApproval(1);
    await act({ action: 'approve' });
    expect(post().scheduledAt.getTime()).toBeLessThan(Date.now() - 2 * DAY_MS);

    const summary = await runCron();

    expect(summary.processed).toBe(1);
    expect(summary.published).toBe(1);
  });
});
