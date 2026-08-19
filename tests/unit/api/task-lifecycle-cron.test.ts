/**
 * SYN-MCP-005 (SYN-1081) — /api/cron/task-lifecycle: the interim cron drain.
 *
 * Pins the bench's cron-drain scope (must_fix 5):
 *   - auth-gated (verifyCronRequest)
 *   - Leg A: verifies "In Review" issues with a linked PR; green verdict →
 *     transitionIssueDone; reject → stays In Review + idempotent comment;
 *     no PR link → skipped
 *   - Leg B: dead-letters stale queued jobs + logs queue depth
 *   - NEVER executes agent work (no SDK import, no worker boot)
 */

const mockVerifyCompletion = jest.fn();
const mockTransitionDone = jest.fn();
jest.mock('@/lib/tasks/completion-verifier', () => {
  const actual = jest.requireActual('@/lib/tasks/completion-verifier');
  return {
    ...actual,
    verifyCompletion: (...a: unknown[]) => mockVerifyCompletion(...a),
    transitionIssueDone: (...a: unknown[]) => mockTransitionDone(...a),
  };
});

const mockIssues = jest.fn();
const mockCreateComment = jest.fn();
jest.mock('@/lib/linear/client', () => ({
  getLinearClient: () => ({
    issues: (...a: unknown[]) => mockIssues(...a),
    createComment: (...a: unknown[]) => mockCreateComment(...a),
  }),
}));

const mockGetJobCounts = jest.fn();
const mockGetJobs = jest.fn();
jest.mock('@/lib/queue/bull-queue', () => ({
  QUEUE_NAMES: { AUTONOMOUS_TASKS: 'autonomous-tasks' },
  getQueue: () => ({
    getJobCounts: (...a: unknown[]) => mockGetJobCounts(...a),
    getJobs: (...a: unknown[]) => mockGetJobs(...a),
  }),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { GET } from '@/app/api/cron/task-lifecycle/route';
import { verifierCommentMarker } from '@/lib/tasks/completion-verifier';

const PR_URL = 'https://github.com/CleanExpo/Synthex/pull/55';

function makeRequest(authorization?: string) {
  return {
    headers: {
      get: (k: string) =>
        k.toLowerCase() === 'authorization' ? (authorization ?? null) : null,
    },
  } as unknown as Parameters<typeof GET>[0];
}

function makeIssue(opts: {
  id?: string;
  identifier?: string;
  attachments?: string[];
  comments?: string[];
}) {
  return {
    id: opts.id ?? 'issue-1',
    identifier: opts.identifier ?? 'SYN-1',
    description: '- [ ] crit',
    attachments: jest.fn(async () => ({
      nodes: (opts.attachments ?? []).map(url => ({ url })),
    })),
    comments: jest.fn(async () => ({
      nodes: (opts.comments ?? []).map(body => ({ body })),
    })),
  };
}

describe('/api/cron/task-lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = 'cron-test-secret';
    delete process.env.CRON_SECRET_TASK_LIFECYCLE;
    // The In Review sweep is gated on LINEAR_API_KEY (skips when Linear isn't
    // configured). These tests exercise the sweep-active path with a fully
    // mocked Linear client, so a dummy key just satisfies the gate.
    process.env.LINEAR_API_KEY = 'test-linear-key';
    mockIssues.mockResolvedValue({ nodes: [] });
    mockGetJobCounts.mockResolvedValue({
      waiting: 0,
      delayed: 0,
      active: 0,
      failed: 0,
    });
    mockGetJobs.mockResolvedValue([]);
  });

  afterAll(() => {
    delete process.env.CRON_SECRET;
    delete process.env.LINEAR_API_KEY;
  });

  it('skips the In Review sweep when LINEAR_API_KEY is not set (no throw, 200)', async () => {
    delete process.env.LINEAR_API_KEY;
    const res = await GET(makeRequest('Bearer cron-test-secret'));
    expect(res.status).toBe(200);
    // The sweep is skipped entirely — the Linear client is never queried and
    // nothing is recorded as an error (the drain leg still runs).
    expect(mockIssues).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.swept).toBe(0);
    expect(body.errors).toEqual([]);
  });

  it('rejects an unauthenticated request with 401 and touches nothing', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(mockIssues).not.toHaveBeenCalled();
    expect(mockTransitionDone).not.toHaveBeenCalled();
  });

  it('rejects a wrong secret with 401', async () => {
    const res = await GET(makeRequest('Bearer wrong'));
    expect(res.status).toBe(401);
  });

  it('green verdict → transitionIssueDone via the single writer', async () => {
    const issue = makeIssue({ attachments: [PR_URL] });
    mockIssues.mockResolvedValue({ nodes: [issue] });
    mockVerifyCompletion.mockResolvedValue({
      verdict: 'accept',
      evidence: {
        prUrl: PR_URL,
        ciStatus: 'success',
        acceptanceResults: [],
        prState: 'merged',
        headSha: 'abc',
        checkedAt: 'now',
      },
    });
    mockTransitionDone.mockResolvedValue({ ok: true });

    const res = await GET(makeRequest('Bearer cron-test-secret'));
    const body = await res.json();

    expect(mockVerifyCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'cron',
        issueId: 'issue-1',
        identifier: 'SYN-1',
      }),
      { prUrl: PR_URL }
    );
    expect(mockTransitionDone).toHaveBeenCalledWith(
      'issue-1',
      expect.objectContaining({ ciStatus: 'success' })
    );
    expect(body.transitionedDone).toBe(1);
    expect(body.rejected).toBe(0);
  });

  it('reject verdict → NO Done transition, posts an explanatory comment, stays In Review', async () => {
    const issue = makeIssue({ attachments: [PR_URL] });
    mockIssues.mockResolvedValue({ nodes: [issue] });
    mockVerifyCompletion.mockResolvedValue({
      verdict: 'reject',
      reason: 'ci-failure',
      evidence: { headSha: 'abc' },
    });

    const res = await GET(makeRequest('Bearer cron-test-secret'));
    const body = await res.json();

    expect(mockTransitionDone).not.toHaveBeenCalled();
    expect(mockCreateComment).toHaveBeenCalledWith(
      expect.objectContaining({
        issueId: 'issue-1',
        body: expect.stringContaining('ci-failure'),
      })
    );
    expect(body.rejected).toBe(1);
    expect(body.transitionedDone).toBe(0);
  });

  it('reject comment is idempotent — not re-posted when the marker already exists', async () => {
    const marker = verifierCommentMarker('reject-ci-failure', 'abc');
    const issue = makeIssue({
      attachments: [PR_URL],
      comments: [`${marker}\nold comment`],
    });
    mockIssues.mockResolvedValue({ nodes: [issue] });
    mockVerifyCompletion.mockResolvedValue({
      verdict: 'reject',
      reason: 'ci-failure',
      evidence: { headSha: 'abc' },
    });

    await GET(makeRequest('Bearer cron-test-secret'));
    expect(mockCreateComment).not.toHaveBeenCalled();
  });

  it('issue with no PR attachment → skipped, never verified, never transitioned', async () => {
    const issue = makeIssue({ attachments: ['https://example.com/not-a-pr'] });
    mockIssues.mockResolvedValue({ nodes: [issue] });

    const res = await GET(makeRequest('Bearer cron-test-secret'));
    const body = await res.json();

    expect(mockVerifyCompletion).not.toHaveBeenCalled();
    expect(mockTransitionDone).not.toHaveBeenCalled();
    expect(body.skippedNoPr).toBe(1);
  });

  it('dead-letters stale queued jobs and comments on the issue', async () => {
    const staleTimestamp = Date.now() - 10 * 24 * 60 * 60 * 1000; // 10 days old
    const freshTimestamp = Date.now() - 60 * 1000;
    const staleRemove = jest.fn();
    const freshRemove = jest.fn();
    mockGetJobs.mockResolvedValue([
      {
        id: 'linear:i1:aaaa',
        timestamp: staleTimestamp,
        data: { issueId: 'i1', identifier: 'SYN-2' },
        remove: staleRemove,
      },
      {
        id: 'linear:i2:bbbb',
        timestamp: freshTimestamp,
        data: { issueId: 'i2', identifier: 'SYN-3' },
        remove: freshRemove,
      },
    ]);

    const res = await GET(makeRequest('Bearer cron-test-secret'));
    const body = await res.json();

    expect(staleRemove).toHaveBeenCalled();
    expect(freshRemove).not.toHaveBeenCalled();
    expect(body.staleDeadLettered).toBe(1);
    expect(mockCreateComment).toHaveBeenCalledWith(
      expect.objectContaining({
        issueId: 'i1',
        body: expect.stringContaining('dead-lettered'),
      })
    );
  });

  it('reports queue depth every run', async () => {
    mockGetJobCounts.mockResolvedValue({
      waiting: 7,
      delayed: 1,
      active: 0,
      failed: 2,
    });
    const res = await GET(makeRequest('Bearer cron-test-secret'));
    const body = await res.json();
    expect(body.queueDepth).toEqual({
      waiting: 7,
      delayed: 1,
      active: 0,
      failed: 2,
    });
  });

  it('survives Redis being unreachable — verification leg still reported, 200', async () => {
    mockGetJobCounts.mockRejectedValue(new Error('ECONNREFUSED'));
    const res = await GET(makeRequest('Bearer cron-test-secret'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.errors.join(' ')).toContain('drain');
  });

  it('survives a Linear sweep error — returns 200 with the error recorded', async () => {
    mockIssues.mockRejectedValue(new Error('linear down'));
    const res = await GET(makeRequest('Bearer cron-test-secret'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.errors.join(' ')).toContain('sweep');
  });
});
