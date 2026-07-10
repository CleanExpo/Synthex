/**
 * SYN-1028 — Linear webhook: project-agnostic autonomous-label detection.
 * SYN-MCP-005 (SYN-1081) — verified task lifecycle:
 *   - deterministic jobId `linear:{issue.id}:{contentHash}` on every enqueue
 *   - enqueue on Issue CREATE only; an `update` enqueues ONLY when the
 *     autonomous label was newly added by that update (updatedFrom.labelIds)
 *   - a TaskEnvelope rides along in the job data
 *
 * The webhook must enqueue an autonomous task for any issue labelled
 * `pi-dev:autonomous`, `mesh:auto`, or `autonomous` that sits in an eligible
 * state (Backlog / Todo / In Progress), regardless of which Linear project it
 * belongs to. Completed/canceled issues and unlabelled issues must be ignored.
 */

const mockAddJob = jest.fn();
jest.mock('@/lib/queue/bull-queue', () => ({
  addJob: (...a: unknown[]) => mockAddJob(...a),
  QUEUE_NAMES: { AUTONOMOUS_TASKS: 'autonomous-tasks' },
}));

const mockVerify = jest.fn();
jest.mock('@/lib/linear/webhook-verifier', () => ({
  verifyLinearWebhook: (...a: unknown[]) => mockVerify(...a),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { POST } from '@/app/api/webhooks/linear/route';
import { buildJobId, contentHash } from '@/lib/tasks/task-envelope';

type Payload = Record<string, unknown>;

function makeRequest(payload: Payload, signature = 'valid-sig') {
  const body = JSON.stringify(payload);
  return {
    text: async () => body,
    headers: {
      get: (k: string) => (k === 'linear-signature' ? signature : null),
    },
  } as unknown as Parameters<typeof POST>[0];
}

function issuePayload(opts: {
  action?: string;
  stateType?: string;
  labels?: string[];
  title?: string;
  description?: string;
  updatedFrom?: Record<string, unknown>;
}): Payload {
  return {
    type: 'Issue',
    action: opts.action ?? 'create',
    data: {
      id: 'issue-uuid-1',
      identifier: 'SYN-9999',
      title: opts.title ?? 'Test autonomous issue',
      description: opts.description ?? 'do the thing',
      state: opts.stateType
        ? { id: 's1', name: 'X', type: opts.stateType }
        : undefined,
      labels: {
        nodes: (opts.labels ?? []).map((name, i) => ({ id: `l${i}`, name })),
      },
    },
    ...(opts.updatedFrom !== undefined
      ? { updatedFrom: opts.updatedFrom }
      : {}),
    organizationId: 'org-1',
  };
}

describe('Linear webhook — autonomous-label detection (SYN-1028)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerify.mockReturnValue(true);
  });

  it('rejects an invalid signature with 401 and never enqueues', async () => {
    mockVerify.mockReturnValue(false);
    const res = await POST(
      makeRequest(
        issuePayload({ stateType: 'started', labels: ['autonomous'] })
      )
    );
    expect(res.status).toBe(401);
    expect(mockAddJob).not.toHaveBeenCalled();
  });

  it('enqueues a created Todo (unstarted) issue labelled `autonomous`', async () => {
    const res = await POST(
      makeRequest(
        issuePayload({ stateType: 'unstarted', labels: ['autonomous'] })
      )
    );
    expect(res.status).toBe(200);
    expect(mockAddJob).toHaveBeenCalledTimes(1);
    expect(mockAddJob).toHaveBeenCalledWith(
      'autonomous-tasks',
      expect.objectContaining({
        type: 'autonomous:execute-task',
        issueId: 'issue-uuid-1',
        identifier: 'SYN-9999',
      }),
      expect.objectContaining({
        jobId: expect.stringMatching(/^linear:issue-uuid-1:[0-9a-f]{16}$/),
      })
    );
  });

  it('enqueues a created Backlog issue labelled `pi-dev:autonomous`', async () => {
    await POST(
      makeRequest(
        issuePayload({ stateType: 'backlog', labels: ['pi-dev:autonomous'] })
      )
    );
    expect(mockAddJob).toHaveBeenCalledTimes(1);
  });

  it('enqueues a created In Progress (started) issue labelled `mesh:auto`', async () => {
    await POST(
      makeRequest(issuePayload({ stateType: 'started', labels: ['mesh:auto'] }))
    );
    expect(mockAddJob).toHaveBeenCalledTimes(1);
  });

  it('matches labels case-insensitively', async () => {
    await POST(
      makeRequest(
        issuePayload({ stateType: 'started', labels: ['PI-DEV:Autonomous'] })
      )
    );
    expect(mockAddJob).toHaveBeenCalledTimes(1);
  });

  it('ignores an autonomous issue in a completed state', async () => {
    const res = await POST(
      makeRequest(
        issuePayload({ stateType: 'completed', labels: ['autonomous'] })
      )
    );
    expect(res.status).toBe(200);
    expect(mockAddJob).not.toHaveBeenCalled();
  });

  it('ignores an autonomous issue in a canceled state', async () => {
    await POST(
      makeRequest(
        issuePayload({ stateType: 'canceled', labels: ['autonomous'] })
      )
    );
    expect(mockAddJob).not.toHaveBeenCalled();
  });

  it('ignores an eligible-state issue with no autonomous label', async () => {
    await POST(
      makeRequest(
        issuePayload({ stateType: 'started', labels: ['Bug', 'Feature'] })
      )
    );
    expect(mockAddJob).not.toHaveBeenCalled();
  });

  it('ignores a non-Issue payload', async () => {
    const res = await POST(
      makeRequest({ type: 'Comment', action: 'create', data: {} })
    );
    expect(res.status).toBe(200);
    expect(mockAddJob).not.toHaveBeenCalled();
  });
});

describe('Linear webhook — create-only enqueue + label-newly-added (SYN-MCP-005)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerify.mockReturnValue(true);
  });

  it('does NOT enqueue on a plain `update` (no updatedFrom) — the duplicate-run defect', async () => {
    const res = await POST(
      makeRequest(
        issuePayload({
          action: 'update',
          stateType: 'started',
          labels: ['autonomous'],
        })
      )
    );
    expect(res.status).toBe(200);
    expect(mockAddJob).not.toHaveBeenCalled();
  });

  it('does NOT enqueue on an update whose updatedFrom lacks labelIds (labels untouched)', async () => {
    await POST(
      makeRequest(
        issuePayload({
          action: 'update',
          stateType: 'started',
          labels: ['autonomous'],
          updatedFrom: { title: 'old title' },
        })
      )
    );
    expect(mockAddJob).not.toHaveBeenCalled();
  });

  it('does NOT enqueue on an update where the autonomous label was already present', async () => {
    // labels[0] gets id "l0" — previous labelIds already contain it.
    await POST(
      makeRequest(
        issuePayload({
          action: 'update',
          stateType: 'started',
          labels: ['autonomous'],
          updatedFrom: { labelIds: ['l0'] },
        })
      )
    );
    expect(mockAddJob).not.toHaveBeenCalled();
  });

  it('enqueues on an update where the autonomous label was NEWLY added', async () => {
    await POST(
      makeRequest(
        issuePayload({
          action: 'update',
          stateType: 'started',
          labels: ['autonomous'],
          updatedFrom: { labelIds: ['some-other-label-id'] },
        })
      )
    );
    expect(mockAddJob).toHaveBeenCalledTimes(1);
  });

  it('enqueues when the autonomous label is added to an issue that had no labels', async () => {
    await POST(
      makeRequest(
        issuePayload({
          action: 'update',
          stateType: 'backlog',
          labels: ['mesh:auto'],
          updatedFrom: { labelIds: [] },
        })
      )
    );
    expect(mockAddJob).toHaveBeenCalledTimes(1);
  });
});

describe('Linear webhook — deterministic jobId + TaskEnvelope (SYN-MCP-005)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerify.mockReturnValue(true);
  });

  function lastJobOptions(): { jobId: string } {
    return mockAddJob.mock.calls[mockAddJob.mock.calls.length - 1][2];
  }

  it('same issue + same content → the SAME deterministic jobId (dedupe key)', async () => {
    const payload = issuePayload({
      stateType: 'started',
      labels: ['autonomous'],
    });
    await POST(makeRequest(payload));
    const first = lastJobOptions().jobId;
    await POST(makeRequest(payload));
    const second = lastJobOptions().jobId;
    expect(first).toBe(second);
    expect(first).toBe(
      buildJobId(
        'issue-uuid-1',
        contentHash('Test autonomous issue', 'do the thing')
      )
    );
  });

  it('edited content → a DIFFERENT jobId (legitimately re-runnable)', async () => {
    await POST(
      makeRequest(
        issuePayload({
          stateType: 'started',
          labels: ['autonomous'],
          title: 'v1',
        })
      )
    );
    const first = lastJobOptions().jobId;
    await POST(
      makeRequest(
        issuePayload({
          stateType: 'started',
          labels: ['autonomous'],
          title: 'v2',
        })
      )
    );
    const second = lastJobOptions().jobId;
    expect(first).not.toBe(second);
  });

  it('attaches a validated TaskEnvelope with acceptance extracted from checkboxes', async () => {
    await POST(
      makeRequest(
        issuePayload({
          stateType: 'started',
          labels: ['autonomous'],
          description:
            'Fix it.\n- [ ] criterion one\n- [x] criterion two\nnot a checkbox',
        })
      )
    );
    expect(mockAddJob).toHaveBeenCalledTimes(1);
    const jobData = mockAddJob.mock.calls[0][1];
    expect(jobData.envelope).toEqual(
      expect.objectContaining({
        source: 'webhook',
        issueId: 'issue-uuid-1',
        identifier: 'SYN-9999',
        acceptance: ['criterion one', 'criterion two'],
        budget: { maxTurns: 50, maxCostUsd: 10 },
      })
    );
    expect(typeof jobData.envelope.traceId).toBe('string');
    expect(jobData.envelope.traceId.length).toBeGreaterThan(0);
  });
});
