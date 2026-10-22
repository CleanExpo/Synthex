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
 * MISSES: real Postgres transactions; calendar-slot and campaign approvals
 * (only contentType 'post' is bound); edits to media or scheduling, which the
 * fingerprint (platform + text) does not cover.
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

type Row = Record<string, any>;

// Plain functions, not jest.fn: the worktree jest config sets resetMocks.
const mockDb = {
  posts: new Map<string, Row>(),
  approvals: new Map<string, Row>(),
  audit: [] as Row[],
  currentUser: 'submitter-1',
  nextId: 1,
};

function mockClone<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
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
    findUnique: async ({ where }: { where: Row }) => {
      const row = mockDb.posts.get(where.id);
      return row ? mockClone(row) : null;
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
  getUserIdFromRequestOrCookies: async () => mockDb.currentUser,
  getUserIdFromCookies: async () => mockDb.currentUser,
}));

jest.mock('@/lib/multi-business', () => ({
  __esModule: true,
  getEffectiveOrganizationId: async () => 'org-1',
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

function seedPost(content = SUBMITTED_TEXT) {
  mockDb.posts.set('post-1', {
    id: 'post-1',
    content,
    platform: 'linkedin',
    status: 'draft',
  });
}

function editPost(content: string) {
  mockDb.posts.get('post-1')!.content = content;
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

async function act(id: string, action: string, user: string) {
  mockDb.currentUser = user;
  return PATCH(
    createMockNextRequest({
      method: 'PATCH',
      url: `http://localhost/api/approvals/${id}`,
      body: { action },
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
  mockDb.nextId = 1;
});

describe('POST /api/approvals binds a post approval to its wording', () => {
  it('stores the server-computed fingerprint of the submitted wording', async () => {
    seedPost();
    const id = await submit();

    expect(mockDb.approvals.get(id)!.metadata[CONTENT_FINGERPRINT_KEY]).toBe(
      postContentFingerprint({ content: SUBMITTED_TEXT, platform: 'linkedin' })
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

  it('resubmit re-binds to the current wording, after which approval succeeds', async () => {
    seedPost();
    const id = await submit();
    editPost(EDITED_TEXT);
    expect((await act(id, 'approve', 'reviewer-1')).status).toBe(409);

    expect((await act(id, 'resubmit', 'submitter-1')).status).toBe(200);
    expect(mockDb.approvals.get(id)!.metadata[CONTENT_FINGERPRINT_KEY]).toBe(
      postContentFingerprint({ content: EDITED_TEXT, platform: 'linkedin' })
    );

    expect((await act(id, 'approve', 'reviewer-1')).status).toBe(200);
    expect((await act(id, 'approve', 'reviewer-1')).status).toBe(200);
    expect(mockDb.approvals.get(id)!.status).toBe('approved');
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
