/**
 * A post approval binds to the wording that was submitted.
 *
 * SEAM: POST /api/approvals and PATCH /api/approvals/[id], called through
 * createMockNextRequest against one in-memory Post/ApprovalRequest/AuditLog
 * store. The fingerprint is computed by the routes, never by the test.
 *
 * CATCHES: an approval that goes through after the post text was edited; an
 * edit that leaves the step's approval count raised; a caller-supplied
 * fingerprint being trusted; resubmit failing to re-bind; a legacy request
 * (no fingerprint) being stranded or recorded silently.
 *
 * MISSES: real Postgres transactions and the FOR UPDATE row lock (the mock
 * proves only that the wording is re-read inside the transaction, after an
 * edit made between the first check and the commit); calendar-slot and campaign approvals
 * (only contentType 'post' is bound); edits to scheduling, which the
 * fingerprint (platform, text, images, link) does not cover. The mock honours
 * each query's select and the locked re-read's column list, so a route that
 * stops loading metadata loses the image and link binding here too.
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

type Row = Record<string, any>;

// Plain functions, not jest.fn: the worktree jest config sets resetMocks.
const mockDb = {
  posts: new Map<string, Row>(),
  approvals: new Map<string, Row>(),
  audit: [] as Row[],
  notifications: [] as Row[],
  // Runs as a transaction opens: stands in for a concurrent post edit that
  // lands after the route's first check but before its commit.
  onTransaction: null as null | (() => void),
  currentUser: 'submitter-1',
  // What getEffectiveOrganizationId returns; null means no org context.
  orgId: 'org-1' as string | null,
  nextId: 1,
};

function mockClone<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

// Honours a Prisma select, so a route that does not load a field never sees it.
function mockPick(row: Row, select?: Row): Row {
  if (!select) return mockClone(row);
  const out: Row = {};
  for (const key of Object.keys(select)) {
    if (select[key] && key in row) out[key] = mockClone(row[key]);
  }
  return out;
}

function mockApprovalView(row: Row): Row {
  return {
    ...mockClone(row),
    createdAt: new Date(),
    updatedAt: new Date(),
    dueDate: null,
    submitter: { name: 'Submitter', email: 's@example.test' },
  };
}

const mockPrisma: Record<string, any> = {
  post: {
    findUnique: async ({ where, select }: { where: Row; select?: Row }) => {
      const row = mockDb.posts.get(where.id);
      return row ? mockPick(row, select) : null;
    },
    // Honours the post -> campaign scope the POST route asks for: by
    // campaign.organizationId, or by campaign.userId (the owner).
    findFirst: async ({ where, select }: { where: Row; select?: Row }) => {
      const row = mockDb.posts.get(where.id);
      if (!row) return null;
      const scope = where.campaign ?? {};
      if (
        'organizationId' in scope &&
        row.organizationId !== scope.organizationId
      ) {
        return null;
      }
      if ('userId' in scope && row.ownerId !== scope.userId) return null;
      return mockPick(row, select);
    },
  },
  approvalRequest: {
    findUnique: async ({ where }: { where: Row }) => {
      const row = mockDb.approvals.get(where.id);
      return row ? mockApprovalView(row) : null;
    },
    create: async ({ data }: { data: Row }) => {
      const id = `apr-${mockDb.nextId++}`;
      mockDb.approvals.set(id, { id, ...mockClone(data) });
      return mockApprovalView(mockDb.approvals.get(id)!);
    },
    update: async ({ where, data }: { where: Row; data: Row }) => {
      const row = mockDb.approvals.get(where.id)!;
      Object.assign(row, mockClone(data));
      return mockApprovalView(row);
    },
  },
  user: {
    findUnique: async () => ({
      name: 'User',
      email: 'user@example.test',
      isMultiBusinessOwner: false,
      activeOrganizationId: null,
      organizationId: 'org-1',
    }),
  },
  workflowTemplate: { findUnique: async () => null },
  auditLog: {
    create: async ({ data }: { data: Row }) => {
      mockDb.audit.push(mockClone(data));
      return {};
    },
  },
  teamNotification: {
    create: async ({ data }: { data: Row }) => {
      mockDb.notifications.push(mockClone(data));
      return {};
    },
  },
  notification: { create: async () => ({}) },
  // The locked post re-read: SELECT <columns> FROM posts WHERE id = $1.
  // Returns only the columns the route's SQL names.
  $queryRaw: async (sql: TemplateStringsArray, ...values: unknown[]) => {
    const row = mockDb.posts.get(values[0] as string);
    if (!row) return [];
    const columns = /SELECT\s+([\s\S]+?)\s+FROM\s+posts/i
      .exec(sql.join('?'))![1]
      .split(',')
      .map(c => c.trim());
    return [Object.fromEntries(columns.map(c => [c, mockClone(row[c])]))];
  },
};
mockPrisma.$transaction = async (cb: (tx: unknown) => unknown) => {
  const hook = mockDb.onTransaction;
  mockDb.onTransaction = null;
  hook?.();
  return cb(mockPrisma);
};

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
  getEffectiveOrganizationId: async () => mockDb.orgId,
}));

jest.mock('@/lib/rate-limit', () => ({
  writeDefault: (_req: unknown, fn: () => Promise<unknown>) => fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    debug: () => undefined,
  },
}));

import { POST } from '@/app/api/approvals/route';
import { PATCH } from '@/app/api/approvals/[id]/route';
import {
  CONTENT_FINGERPRINT_KEY,
  postContentFingerprint,
} from '@/lib/approvals/content-fingerprint';

const SUBMITTED_TEXT = 'RestoreAssist: start a 14-day trial this week.';
const EDITED_TEXT = 'RestoreAssist: guaranteed results, start today.';
const SUBMITTED_IMAGES = ['https://cdn.synthex.test/restoreassist-trial.png'];
const SUBMITTED_LINK = 'https://restoreassist.test/trial?utm_source=linkedin';

function seedPost(
  content = SUBMITTED_TEXT,
  organizationId: string | null = 'org-1',
  ownerId = 'submitter-1'
) {
  mockDb.posts.set('post-1', {
    id: 'post-1',
    content,
    platform: 'linkedin',
    status: 'draft',
    // What the publish cron sends besides the text: images as media, linkUrl
    // as the LinkedIn article card.
    metadata: { images: [...SUBMITTED_IMAGES], linkUrl: SUBMITTED_LINK },
    // Stand in for post.campaign.organizationId and post.campaign.userId.
    organizationId,
    ownerId,
  });
}

async function postApproval() {
  mockDb.currentUser = 'submitter-1';
  return POST(
    createMockNextRequest({
      method: 'POST',
      url: 'http://localhost/api/approvals',
      body: {
        contentId: 'post-1',
        contentType: 'post',
        title: 'Approve post',
      },
    })
  );
}

function editPost(content: string) {
  mockDb.posts.get('post-1')!.content = content;
}

function editPostMetadata(patch: Row) {
  const post = mockDb.posts.get('post-1')!;
  post.metadata = { ...post.metadata, ...patch };
}

async function submit(metadata: Record<string, unknown> = {}) {
  mockDb.currentUser = 'submitter-1';
  const res = await POST(
    createMockNextRequest({
      method: 'POST',
      url: 'http://localhost/api/approvals',
      body: {
        contentId: 'post-1',
        contentType: 'post',
        title: 'Approve RestoreAssist post',
        metadata,
      },
    })
  );
  expect(res.status).toBeLessThan(300);
  return [...mockDb.approvals.keys()].pop()!;
}

async function act(id: string, action: string, user: string, comment?: string) {
  mockDb.currentUser = user;
  return PATCH(
    createMockNextRequest({
      method: 'PATCH',
      url: `http://localhost/api/approvals/${id}`,
      body: comment ? { action, comment } : { action },
    }),
    { params: Promise.resolve({ id }) }
  );
}

function seedLegacyApproval() {
  mockDb.approvals.set('apr-legacy', {
    id: 'apr-legacy',
    contentId: 'post-1',
    contentType: 'post',
    workflowId: null,
    submittedBy: 'submitter-1',
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
    title: 'Legacy request',
    description: null,
    metadata: { platforms: ['linkedin'] },
    organizationId: 'org-1',
  });
}

function lastAudit(action: string): Row | undefined {
  return [...mockDb.audit].reverse().find(a => a.action === action);
}

beforeEach(() => {
  mockDb.posts.clear();
  mockDb.approvals.clear();
  mockDb.audit.length = 0;
  mockDb.notifications.length = 0;
  mockDb.onTransaction = null;
  mockDb.orgId = 'org-1';
  mockDb.nextId = 1;
});

describe('POST /api/approvals binds a post approval to its wording', () => {
  it('stores the server-computed fingerprint of the submitted wording', async () => {
    seedPost();
    const id = await submit();

    expect(mockDb.approvals.get(id)!.metadata[CONTENT_FINGERPRINT_KEY]).toBe(
      postContentFingerprint({
        content: SUBMITTED_TEXT,
        platform: 'linkedin',
        metadata: { images: SUBMITTED_IMAGES, linkUrl: SUBMITTED_LINK },
      })
    );
  });

  it('ignores a fingerprint supplied by the caller', async () => {
    seedPost();
    const forged = postContentFingerprint({
      content: EDITED_TEXT,
      platform: 'linkedin',
    });
    const id = await submit({ [CONTENT_FINGERPRINT_KEY]: forged });

    expect(
      mockDb.approvals.get(id)!.metadata[CONTENT_FINGERPRINT_KEY]
    ).not.toBe(forged);
  });

  it('refuses with 404 a post from another organisation, and creates no approval', async () => {
    seedPost(SUBMITTED_TEXT, 'org-2');

    const res = await postApproval();
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: 'Not Found', message: 'Post not found' });
    expect(mockDb.approvals.size).toBe(0);
    expect(lastAudit('approval_request_created')).toBeUndefined();
  });

  it('with no org context, binds a post on a campaign the caller owns', async () => {
    mockDb.orgId = null;
    seedPost(SUBMITTED_TEXT, null, 'submitter-1');

    const res = await postApproval();

    expect(res.status).toBeLessThan(300);
    const [row] = [...mockDb.approvals.values()];
    expect(row.metadata[CONTENT_FINGERPRINT_KEY]).toBe(
      postContentFingerprint({
        content: SUBMITTED_TEXT,
        platform: 'linkedin',
        metadata: { images: SUBMITTED_IMAGES, linkUrl: SUBMITTED_LINK },
      })
    );
  });

  it("with no org context, refuses with 404 another user's post, and creates no approval", async () => {
    mockDb.orgId = null;
    seedPost(SUBMITTED_TEXT, null, 'someone-else');

    const res = await postApproval();
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: 'Not Found', message: 'Post not found' });
    expect(mockDb.approvals.size).toBe(0);
  });
});

describe('PATCH /api/approvals/[id] approve checks the wording is unchanged', () => {
  it('approves when the post wording is what was submitted', async () => {
    seedPost();
    const id = await submit();

    // Default workflow: Initial Review, then Final Approval.
    expect((await act(id, 'approve', 'reviewer-1')).status).toBe(200);
    expect((await act(id, 'approve', 'reviewer-1')).status).toBe(200);

    expect(mockDb.approvals.get(id)!.status).toBe('approved');
    expect(lastAudit('approval_approve')!.details.contentBinding).toBe('match');
  });

  it('refuses the final step when the post was edited after the first step approved', async () => {
    seedPost();
    const id = await submit();
    expect((await act(id, 'approve', 'reviewer-1')).status).toBe(200);
    editPost(EDITED_TEXT);

    const res = await act(id, 'approve', 'reviewer-1');

    expect(res.status).toBe(409);
    const row = mockDb.approvals.get(id)!;
    expect(row.status).toBe('in_review');
    expect(row.steps[1].currentApprovals).toBe(0);
  });

  it('refuses with 409 content_changed when the post was edited after submission, and records no approval', async () => {
    seedPost();
    const id = await submit();
    editPost(EDITED_TEXT);

    const res = await act(id, 'approve', 'reviewer-1');
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.code).toBe('content_changed');
    const row = mockDb.approvals.get(id)!;
    expect(row.status).toBe('pending');
    expect(row.steps[0].currentApprovals).toBe(0);
    expect(lastAudit('approval_approve')).toBeUndefined();
  });

  it('refuses with 409 content_changed when the post was deleted after submission, and records no approval', async () => {
    seedPost();
    const id = await submit();
    mockDb.posts.delete('post-1');

    const res = await act(id, 'approve', 'reviewer-1');
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.code).toBe('content_changed');
    const row = mockDb.approvals.get(id)!;
    expect(row.status).toBe('pending');
    expect(row.steps[0].currentApprovals).toBe(0);
    expect(lastAudit('approval_approve')).toBeUndefined();
  });

  it('refuses an approval when the post is edited between the check and the commit, and notifies no one', async () => {
    seedPost();
    const id = await submit();
    mockDb.notifications.length = 0;
    mockDb.onTransaction = () => editPost(EDITED_TEXT);

    const res = await act(id, 'approve', 'reviewer-1');
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.code).toBe('content_changed');
    const row = mockDb.approvals.get(id)!;
    expect(row.status).toBe('pending');
    expect(row.steps[0].currentApprovals).toBe(0);
    expect(lastAudit('approval_approve')).toBeUndefined();
    expect(mockDb.notifications).toEqual([]);
  });

  it('resubmit after an edit puts the comment on the step the workflow restarts at', async () => {
    seedPost();
    const id = await submit();
    expect((await act(id, 'approve', 'reviewer-1')).status).toBe(200);
    editPost(EDITED_TEXT);

    const res = await act(id, 'resubmit', 'submitter-1', 'Reworded the offer');

    expect(res.status).toBe(200);
    const row = mockDb.approvals.get(id)!;
    expect(row.currentStep).toBe(0);
    expect(row.steps[0].comments.map((c: Row) => c.content)).toEqual([
      'Reworded the offer',
    ]);
    expect(row.steps[1].comments).toEqual([]);
  });

  it('resubmit re-binds to the current wording, after which approval succeeds', async () => {
    seedPost();
    const id = await submit();
    editPost(EDITED_TEXT);
    expect((await act(id, 'approve', 'reviewer-1')).status).toBe(409);

    expect((await act(id, 'resubmit', 'submitter-1')).status).toBe(200);
    expect(mockDb.approvals.get(id)!.metadata[CONTENT_FINGERPRINT_KEY]).toBe(
      postContentFingerprint({
        content: EDITED_TEXT,
        platform: 'linkedin',
        metadata: { images: SUBMITTED_IMAGES, linkUrl: SUBMITTED_LINK },
      })
    );

    expect((await act(id, 'approve', 'reviewer-1')).status).toBe(200);
    expect((await act(id, 'approve', 'reviewer-1')).status).toBe(200);
    expect(mockDb.approvals.get(id)!.status).toBe('approved');
  });

  it('resubmit after an edit resets every step, so an earlier approval of the old wording does not count', async () => {
    seedPost();
    const id = await submit();
    // Step 0 approves the submitted wording; then the post is edited.
    expect((await act(id, 'approve', 'reviewer-1')).status).toBe(200);
    expect(mockDb.approvals.get(id)!.steps[0].status).toBe('approved');
    editPost(EDITED_TEXT);
    expect((await act(id, 'approve', 'reviewer-1')).status).toBe(409);

    expect((await act(id, 'resubmit', 'submitter-1')).status).toBe(200);

    const row = mockDb.approvals.get(id)!;
    expect(row.currentStep).toBe(0);
    for (const step of row.steps) {
      expect(step.status).toBe('pending');
      expect(step.currentApprovals).toBe(0);
      expect(step.approvedBy).toBeUndefined();
    }

    // The new wording needs both steps approved again.
    expect((await act(id, 'approve', 'reviewer-1')).status).toBe(200);
    expect(mockDb.approvals.get(id)!.status).not.toBe('approved');

    expect((await act(id, 'approve', 'reviewer-1')).status).toBe(200);
    expect((await act(id, 'approve', 'reviewer-1')).status).toBe(200);
    expect(mockDb.approvals.get(id)!.status).toBe('approved');
  });

  it.each([
    ['swapped image', { images: ['https://evil.example/offer.png'] }],
    [
      'added image',
      { images: [...SUBMITTED_IMAGES, 'https://evil.example/2.png'] },
    ],
    ['removed images', { images: [] }],
    ['changed link', { linkUrl: 'https://evil.example/phish' }],
    ['removed link', { linkUrl: undefined }],
  ])(
    'refuses with 409 content_changed when only the %s changed after submission, and records no approval',
    async (_label, patch) => {
      seedPost();
      const id = await submit();
      editPostMetadata(patch);

      const res = await act(id, 'approve', 'reviewer-1');
      const body = await res.json();

      expect(res.status).toBe(409);
      expect(body.code).toBe('content_changed');
      const row = mockDb.approvals.get(id)!;
      expect(row.status).toBe('pending');
      expect(row.steps[0].currentApprovals).toBe(0);
      expect(lastAudit('approval_approve')).toBeUndefined();
    }
  );

  it('still approves when only metadata the publisher does not send changed', async () => {
    seedPost();
    const id = await submit();
    editPostMetadata({ history: [{ event: 'scheduled' }], retryCount: 1 });

    expect((await act(id, 'approve', 'reviewer-1')).status).toBe(200);
    expect(lastAudit('approval_approve')!.details.contentBinding).toBe('match');
  });

  it('refuses an approval when the image is swapped between the check and the commit', async () => {
    seedPost();
    const id = await submit();
    mockDb.notifications.length = 0;
    mockDb.onTransaction = () =>
      editPostMetadata({ images: ['https://evil.example/offer.png'] });

    const res = await act(id, 'approve', 'reviewer-1');
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.code).toBe('content_changed');
    expect(mockDb.approvals.get(id)!.steps[0].currentApprovals).toBe(0);
    expect(mockDb.notifications).toEqual([]);
  });

  it('resubmit after a link change re-binds to the new link, after which approval succeeds', async () => {
    seedPost();
    const id = await submit();
    editPostMetadata({ linkUrl: 'https://restoreassist.test/new-offer' });
    expect((await act(id, 'approve', 'reviewer-1')).status).toBe(409);

    expect((await act(id, 'resubmit', 'submitter-1')).status).toBe(200);

    expect((await act(id, 'approve', 'reviewer-1')).status).toBe(200);
    expect(lastAudit('approval_approve')!.details.contentBinding).toBe('match');
  });

  it('still approves a legacy request with no fingerprint and records it as unbound_legacy', async () => {
    seedPost(EDITED_TEXT);
    seedLegacyApproval();

    const res = await act('apr-legacy', 'approve', 'reviewer-1');

    expect(res.status).toBe(200);
    expect(mockDb.approvals.get('apr-legacy')!.status).toBe('approved');
    expect(lastAudit('approval_approve')!.details.contentBinding).toBe(
      'unbound_legacy'
    );
  });
});
