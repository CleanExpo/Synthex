/**
 * Approving a calendar draft never leaves a portfolio brand's stored draft
 * naming a word the brand never uses.
 *
 * SEAM: PATCH /api/approvals/[id] through createMockNextRequest against one
 * in-memory CalendarPost/ApprovalRequest store. The transaction client
 * answers the guard's locked reads ($queryRaw on organizations, then
 * calendar_posts FOR UPDATE) from the same store, so the check sees the row
 * the approval writes to.
 *
 * CATCHES: an approval that checks only the metadata it writes and keeps a
 * forbidden stored title; a stored-row read that is not locked for update.
 *
 * MISSES: real Postgres locking; the post and campaign approval paths
 * (approval-requeues-blocked-post.test.ts, approval-binds-version.test.ts).
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';
import { buildApprovedCampaignAuthorityManifest } from '@/tests/helpers/campaign-authority-manifest';
import { CAMPAIGN_AUTHORITY_MANIFEST_KEY } from '@/lib/marketing-agency/campaign-authority-manifest';

// Plain functions, not jest.fn: the worktree jest config sets resetMocks.
type Row = Record<string, any>;

const mockDb = {
  calendarPosts: new Map<string, Row>(),
  approvals: new Map<string, Row>(),
  orgs: [
    {
      id: 'org-ug',
      slug: 'unite-group',
      status: 'active',
      parentOrgId: null,
    },
  ] as Row[],
};

function mockClone<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
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
  $queryRaw: async (sql: TemplateStringsArray, ...values: unknown[]) => {
    const text = sql.join('?');
    if (text.includes('calendar_posts')) {
      if (!/FOR UPDATE/.test(text))
        throw new Error('stored row read without FOR UPDATE');
      const row = mockDb.calendarPosts.get(values[0] as string);
      return row ? [mockClone(row)] : [];
    }
    if (text.includes('FROM organizations')) {
      const [id, rootSlug] = values;
      return mockDb.orgs.filter(o => o.id === id || o.slug === rootSlug);
    }
    throw new Error(`unexpected query: ${text}`);
  },
  calendarPost: {
    findUnique: async ({ where }: { where: Row }) => {
      const row = mockDb.calendarPosts.get(where.id);
      return row ? mockClone(row) : null;
    },
    update: async ({ where, data }: { where: Row; data: Row }) => {
      const row = mockDb.calendarPosts.get(where.id);
      if (!row) throw new Error(`calendar post ${where.id} not found`);
      Object.assign(row, mockClone(data));
      return mockClone(row);
    },
  },
  approvalRequest: {
    findUnique: async ({ where }: { where: Row }) => {
      const row = mockDb.approvals.get(where.id);
      return row ? mockApprovalView(row) : null;
    },
    update: async ({ where, data }: { where: Row; data: Row }) => {
      const row = mockDb.approvals.get(where.id)!;
      Object.assign(row, mockClone(data), { updatedAt: new Date() });
      return mockApprovalView(row);
    },
  },
  user: {
    findUnique: async () => ({
      name: 'Reviewer',
      email: 'reviewer@example.test',
      isMultiBusinessOwner: false,
      activeOrganizationId: null,
      organizationId: 'org-ug',
    }),
  },
  auditLog: { create: async () => ({}) },
  teamNotification: { create: async () => ({}) },
  notification: { create: async () => ({}) },
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
  getUserIdFromRequestOrCookies: async () => 'reviewer-1',
  getUserIdFromCookies: async () => 'reviewer-1',
}));

jest.mock('@/lib/multi-business', () => ({
  __esModule: true,
  getEffectiveOrganizationId: async () => 'org-ug',
}));

jest.mock('@/lib/unite-group-connector', () => ({
  pushUniteGroupEvent: async () => undefined,
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

function seedDraft(title: string) {
  const manifest = buildApprovedCampaignAuthorityManifest({
    platformOutputs: [
      { platform: 'linkedin', status: 'approved', contentRef: 'cal-1' },
    ],
  });
  mockDb.calendarPosts.set('cal-1', {
    id: 'cal-1',
    title,
    content: 'A week of tips for local cafes',
    hashtags: [],
    mentions: [],
    platforms: ['linkedin'],
    organizationId: 'org-ug',
    metadata: {
      [CAMPAIGN_AUTHORITY_MANIFEST_KEY]: {
        ...manifest,
        approval: { status: 'pending_review' },
      },
    },
  });
  mockDb.approvals.set('apr-1', {
    id: 'apr-1',
    contentId: 'cal-1',
    contentType: 'calendar_post',
    workflowId: null,
    submittedBy: 'owner-1',
    status: 'pending',
    priority: 'normal',
    currentStep: 0,
    totalSteps: 1,
    steps: [
      {
        id: 'step-0',
        order: 0,
        type: 'final_approval',
        name: 'Final',
        status: 'in_review',
        assignedTo: ['*'],
        comments: [],
        requiredApprovals: 1,
        currentApprovals: 0,
        isOptional: false,
        createdAt: new Date().toISOString(),
      },
    ],
    title: 'Approve a calendar draft',
    description: null,
    metadata: { platforms: ['linkedin'] },
    organizationId: 'org-ug',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

const approve = () =>
  PATCH(
    createMockNextRequest({
      method: 'PATCH',
      url: 'http://localhost/api/approvals/apr-1',
      body: { action: 'approve' },
    }),
    { params: Promise.resolve({ id: 'apr-1' }) }
  );

const approvalStatus = (row: Row) =>
  row.metadata[CAMPAIGN_AUTHORITY_MANIFEST_KEY].approval.status;

beforeEach(() => {
  mockDb.calendarPosts.clear();
  mockDb.approvals.clear();
});

describe('PATCH /api/approvals/[id] on a portfolio calendar draft', () => {
  it('refuses to stamp approval on a stored draft whose title is forbidden', async () => {
    seedDraft('CARSI courses this week');

    const res = await approve();

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(approvalStatus(mockDb.calendarPosts.get('cal-1')!)).toBe(
      'pending_review'
    );
  });

  it('stamps approval on a clean stored draft', async () => {
    seedDraft('Tips for local cafes');

    const res = await approve();

    expect(res.status).toBe(200);
    expect(approvalStatus(mockDb.calendarPosts.get('cal-1')!)).toBe('approved');
  });
});
