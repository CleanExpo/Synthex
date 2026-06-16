/**
 * Unit test — Approval Comments route (backlog #12).
 *
 * Drives the full validation ladder on the POST route (defineRoute + withAuth):
 *   401 (no session) → 403 (no org) → 400 (bad body) → 201 (created).
 * Plus: @-mention parsing fires a notification via the existing notifications
 * mechanism, and a notification failure never fails the comment write.
 */

const findFirstApproval = jest.fn();
const createComment = jest.fn();
const findManyComment = jest.fn();
const findUniqueUser = jest.fn();
const findManyUser = jest.fn();
const createManyNotification = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    approvalRequest: { findFirst: (...a: unknown[]) => findFirstApproval(...a) },
    approvalComment: {
      create: (...a: unknown[]) => createComment(...a),
      findMany: (...a: unknown[]) => findManyComment(...a),
    },
    user: {
      findUnique: (...a: unknown[]) => findUniqueUser(...a),
      findMany: (...a: unknown[]) => findManyUser(...a),
    },
    notification: { createMany: (...a: unknown[]) => createManyNotification(...a) },
  },
}));

const getUserIdMock = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => getUserIdMock(...a),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  // Default: authenticated user in org-1.
  getUserIdMock.mockResolvedValue('user-1');
  findUniqueUser.mockResolvedValue({ organizationId: 'org-1', teamMemberships: [] });
  // Default: the approval is visible to the caller.
  findFirstApproval.mockResolvedValue({
    id: 'appr-1',
    title: 'Spring campaign',
    organizationId: 'org-1',
  });
  createComment.mockResolvedValue({
    id: 'comment-1',
    approvalRequestId: 'appr-1',
    authorId: 'user-1',
    body: 'looks good',
    mentions: [],
    createdAt: new Date('2026-06-16T00:00:00.000Z'),
  });
  findManyUser.mockResolvedValue([]);
  createManyNotification.mockResolvedValue({ count: 0 });
});

import { POST, GET } from '@/app/api/approvals/[id]/comments/route';

function makeRequest(body: unknown) {
  return {
    nextUrl: {
      pathname: '/api/approvals/appr-1/comments',
      searchParams: new URLSearchParams(),
    },
    json: async () => body,
  } as unknown as Parameters<typeof POST>[0];
}

describe('POST /api/approvals/[id]/comments — validation ladder', () => {
  test('no session → 401', async () => {
    getUserIdMock.mockResolvedValue(null);
    const res = await POST(makeRequest({ body: 'hello' }));
    expect(res.status).toBe(401);
    expect(createComment).not.toHaveBeenCalled();
  });

  test('no organisation → 403', async () => {
    findUniqueUser.mockResolvedValue({ organizationId: null, teamMemberships: [] });
    const res = await POST(makeRequest({ body: 'hello' }));
    expect(res.status).toBe(403);
    expect(createComment).not.toHaveBeenCalled();
  });

  test('invalid body → 400 with { error, details }', async () => {
    const res = await POST(makeRequest({ body: '' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Validation failed');
    expect(json.details).toHaveProperty('body');
    expect(createComment).not.toHaveBeenCalled();
  });

  test('valid body → 201 with created comment', async () => {
    const res = await POST(makeRequest({ body: 'looks good' }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.comment).toMatchObject({ id: 'comment-1', approvalRequestId: 'appr-1' });

    const data = createComment.mock.calls[0][0].data;
    expect(data).toMatchObject({
      approvalRequestId: 'appr-1',
      authorId: 'user-1',
      body: 'looks good',
      mentions: [],
    });
  });
});

describe('POST /api/approvals/[id]/comments — org scope + mentions', () => {
  test('approval not visible to caller → 404', async () => {
    findFirstApproval.mockResolvedValue(null);
    const res = await POST(makeRequest({ body: 'looks good' }));
    expect(res.status).toBe(404);
    expect(createComment).not.toHaveBeenCalled();
  });

  test('@-mention is parsed from the body and persisted', async () => {
    createComment.mockResolvedValue({
      id: 'comment-2',
      approvalRequestId: 'appr-1',
      authorId: 'user-1',
      body: 'please review @user-2',
      mentions: ['user-2'],
      createdAt: new Date('2026-06-16T00:00:00.000Z'),
    });
    const res = await POST(makeRequest({ body: 'please review @user-2' }));
    expect(res.status).toBe(201);
    const data = createComment.mock.calls[0][0].data;
    expect(data.mentions).toContain('user-2');
  });

  test('@-mention of a real user fires a notification via the existing mechanism', async () => {
    findManyUser.mockResolvedValue([{ id: 'user-2' }]);
    createComment.mockResolvedValue({
      id: 'comment-3',
      approvalRequestId: 'appr-1',
      authorId: 'user-1',
      body: 'ping @user-2',
      mentions: ['user-2'],
      createdAt: new Date('2026-06-16T00:00:00.000Z'),
    });
    const res = await POST(makeRequest({ body: 'ping @user-2' }));
    expect(res.status).toBe(201);
    expect(createManyNotification).toHaveBeenCalledTimes(1);
    const rows = createManyNotification.mock.calls[0][0].data;
    expect(rows[0]).toMatchObject({ userId: 'user-2', type: 'info' });
    expect(rows[0].data).toMatchObject({ source: 'approval_comment_mention' });
  });

  test('notification failure does NOT fail the comment write', async () => {
    findManyUser.mockResolvedValue([{ id: 'user-2' }]);
    createManyNotification.mockRejectedValue(new Error('notify down'));
    createComment.mockResolvedValue({
      id: 'comment-4',
      approvalRequestId: 'appr-1',
      authorId: 'user-1',
      body: 'ping @user-2',
      mentions: ['user-2'],
      createdAt: new Date('2026-06-16T00:00:00.000Z'),
    });
    const res = await POST(makeRequest({ body: 'ping @user-2' }));
    expect(res.status).toBe(201);
  });

  test('self-mention does not notify the author', async () => {
    findManyUser.mockResolvedValue([{ id: 'user-1' }]);
    createComment.mockResolvedValue({
      id: 'comment-5',
      approvalRequestId: 'appr-1',
      authorId: 'user-1',
      body: 'note to self @user-1',
      mentions: ['user-1'],
      createdAt: new Date('2026-06-16T00:00:00.000Z'),
    });
    const res = await POST(makeRequest({ body: 'note to self @user-1' }));
    expect(res.status).toBe(201);
    expect(findManyUser).not.toHaveBeenCalled();
    expect(createManyNotification).not.toHaveBeenCalled();
  });
});

describe('GET /api/approvals/[id]/comments', () => {
  test('returns the thread in chronological order', async () => {
    findManyComment.mockResolvedValue([
      {
        id: 'comment-1',
        approvalRequestId: 'appr-1',
        authorId: 'user-1',
        body: 'first',
        mentions: [],
        createdAt: new Date('2026-06-16T00:00:00.000Z'),
        author: { name: 'Alice', email: 'alice@example.com' },
      },
    ]);
    const res = await GET(makeRequest(null));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.comments).toHaveLength(1);
    expect(json.comments[0]).toMatchObject({
      id: 'comment-1',
      authorName: 'Alice',
      body: 'first',
    });
    const orderBy = findManyComment.mock.calls[0][0].orderBy;
    expect(orderBy).toMatchObject({ createdAt: 'asc' });
  });

  test('no session → 401', async () => {
    getUserIdMock.mockResolvedValue(null);
    const res = await GET(makeRequest(null));
    expect(res.status).toBe(401);
  });
});
