/**
 * SYN-MCP-005 (SYN-1081) — completion-verifier: the ONLY path to Done.
 *
 * Pins the bench's verifier decision table:
 *   missing-PR → reject | red-CI → reject | pending-CI → reject |
 *   zero check-runs → reject (no CI evidence) | green → accept
 * plus: acceptanceResults are SELF-ATTESTED and never gate the verdict,
 * the read-only token env is mandatory (no write-token fallback), and the
 * lifecycle state machine table.
 */

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('@/lib/linear/client', () => ({
  getLinearClient: jest.fn(() => {
    throw new Error('unit tests must inject a linear dep');
  }),
}));

import {
  __resetCompletedStateCacheForTests,
  deriveCiStatus,
  formatEvidenceComment,
  LIFECYCLE_TRANSITIONS,
  nextState,
  parsePrUrl,
  TASK_VERIFIER_TOKEN_ENV,
  transitionIssueDone,
  verifyCompletion,
  type CompletionEvidence,
} from '@/lib/tasks/completion-verifier';
import { buildTaskEnvelope } from '@/lib/tasks/task-envelope';

const envelope = buildTaskEnvelope({
  source: 'cron',
  issueId: 'issue-1',
  identifier: 'SYN-1081',
  acceptance: ['crit A', 'crit B'],
  traceId: 'trace-1',
});

const PR_URL = 'https://github.com/CleanExpo/Synthex/pull/123';

type FetchResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
};

function jsonResponse(status: number, body: unknown): FetchResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => body,
  };
}

/** fetchFn stub: first call = pulls, second call = check-runs. */
function githubStub(opts: {
  pull?: FetchResponse;
  checks?: FetchResponse;
}): jest.Mock {
  const fetchFn = jest.fn();
  fetchFn.mockImplementation(async (url: string) => {
    if (url.includes('/pulls/')) {
      return (
        opts.pull ??
        jsonResponse(200, {
          state: 'open',
          merged: false,
          head: { sha: 'abc123' },
        })
      );
    }
    if (url.includes('/check-runs')) {
      return (
        opts.checks ??
        jsonResponse(200, {
          total_count: 1,
          check_runs: [{ status: 'completed', conclusion: 'success' }],
        })
      );
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
  return fetchFn;
}

const env = { [TASK_VERIFIER_TOKEN_ENV]: 'ro-test-token' } as NodeJS.ProcessEnv;

describe('lifecycle state machine (table tests)', () => {
  it.each([
    ['enqueued', 'worker-start', 'running'],
    ['running', 'agent-success', 'in_review'],
    ['running', 'agent-failure', 'enqueued'],
    ['in_review', 'verify-pass', 'done'],
    ['in_review', 'verify-fail', 'in_review'],
  ] as const)('%s + %s → %s', (from, event, to) => {
    expect(nextState(from, event)).toBe(to);
  });

  it.each([
    // agent success can NEVER jump straight to done
    ['running', 'verify-pass'],
    ['enqueued', 'verify-pass'],
    // done is terminal
    ['done' as const, 'agent-success'],
    ['done' as const, 'verify-pass'],
    // verification only applies in review
    ['enqueued', 'verify-fail'],
  ] as const)('%s + %s is an INVALID transition (null)', (from, event) => {
    expect(nextState(from, event)).toBeNull();
  });

  it('the only transition INTO done is in_review + verify-pass', () => {
    const intoDone = LIFECYCLE_TRANSITIONS.filter(t => t.to === 'done');
    expect(intoDone).toEqual([
      { from: 'in_review', event: 'verify-pass', to: 'done' },
    ]);
  });
});

describe('parsePrUrl', () => {
  it('parses a canonical GitHub PR URL', () => {
    expect(parsePrUrl(PR_URL)).toEqual({
      owner: 'CleanExpo',
      repo: 'Synthex',
      number: 123,
    });
  });

  it.each([
    'https://github.com/CleanExpo/Synthex/issues/123',
    'https://gitlab.com/x/y/pull/1',
    'https://github.com/CleanExpo/Synthex/pull/123/files/../../../evil',
    'not a url',
    'https://github.com/CleanExpo/pull/1',
  ])('rejects %s', bad => {
    expect(parsePrUrl(bad)).toBeNull();
  });
});

describe('deriveCiStatus', () => {
  it('unknown when there are zero check-runs (no CI evidence)', () => {
    expect(deriveCiStatus([])).toBe('unknown');
  });
  it('pending when any run has not completed', () => {
    expect(
      deriveCiStatus([
        { status: 'completed', conclusion: 'success' },
        { status: 'in_progress', conclusion: null },
      ])
    ).toBe('pending');
  });
  it('failure when any run failed / timed out / cancelled', () => {
    for (const conclusion of [
      'failure',
      'timed_out',
      'cancelled',
      'action_required',
    ]) {
      expect(
        deriveCiStatus([
          { status: 'completed', conclusion: 'success' },
          { status: 'completed', conclusion },
        ])
      ).toBe('failure');
    }
  });
  it('success when every run is success/neutral/skipped', () => {
    expect(
      deriveCiStatus([
        { status: 'completed', conclusion: 'success' },
        { status: 'completed', conclusion: 'neutral' },
        { status: 'completed', conclusion: 'skipped' },
      ])
    ).toBe('success');
  });
});

describe('verifyCompletion decision table', () => {
  it('rejects an invalid envelope', async () => {
    const result = await verifyCompletion(
      { junk: true },
      { prUrl: PR_URL },
      { env }
    );
    expect(result).toEqual({ verdict: 'reject', reason: 'invalid-envelope' });
  });

  it('rejects when prUrl is missing (missing-PR leg)', async () => {
    const result = await verifyCompletion(envelope, { prUrl: null }, { env });
    expect(result.verdict).toBe('reject');
    if (result.verdict === 'reject')
      expect(result.reason).toBe('missing-pr-url');
  });

  it('rejects a malformed prUrl', async () => {
    const result = await verifyCompletion(
      envelope,
      { prUrl: 'https://example.com/pr/1' },
      { env }
    );
    expect(result.verdict).toBe('reject');
    if (result.verdict === 'reject')
      expect(result.reason).toBe('invalid-pr-url');
  });

  it('throws (hard) when the read-only token env is missing — never silently degrades', async () => {
    await expect(
      verifyCompletion(
        envelope,
        { prUrl: PR_URL },
        {
          env: {} as NodeJS.ProcessEnv,
          fetchFn: githubStub({}) as unknown as typeof fetch,
        }
      )
    ).rejects.toThrow(TASK_VERIFIER_TOKEN_ENV);
  });

  it('rejects when the PR does not exist (404)', async () => {
    const fetchFn = githubStub({ pull: jsonResponse(404, {}) });
    const result = await verifyCompletion(
      envelope,
      { prUrl: PR_URL },
      { env, fetchFn: fetchFn as unknown as typeof fetch }
    );
    expect(result.verdict).toBe('reject');
    if (result.verdict === 'reject') expect(result.reason).toBe('pr-not-found');
  });

  it('rejects on a GitHub API error (5xx) — fail closed', async () => {
    const fetchFn = githubStub({ pull: jsonResponse(502, {}) });
    const result = await verifyCompletion(
      envelope,
      { prUrl: PR_URL },
      { env, fetchFn: fetchFn as unknown as typeof fetch }
    );
    expect(result.verdict).toBe('reject');
    if (result.verdict === 'reject') expect(result.reason).toBe('github-error');
  });

  it('rejects red CI', async () => {
    const fetchFn = githubStub({
      checks: jsonResponse(200, {
        total_count: 1,
        check_runs: [{ status: 'completed', conclusion: 'failure' }],
      }),
    });
    const result = await verifyCompletion(
      envelope,
      { prUrl: PR_URL },
      { env, fetchFn: fetchFn as unknown as typeof fetch }
    );
    expect(result.verdict).toBe('reject');
    if (result.verdict === 'reject') {
      expect(result.reason).toBe('ci-failure');
      expect(result.evidence?.ciStatus).toBe('failure');
    }
  });

  it('rejects pending CI', async () => {
    const fetchFn = githubStub({
      checks: jsonResponse(200, {
        total_count: 1,
        check_runs: [{ status: 'queued', conclusion: null }],
      }),
    });
    const result = await verifyCompletion(
      envelope,
      { prUrl: PR_URL },
      { env, fetchFn: fetchFn as unknown as typeof fetch }
    );
    expect(result.verdict).toBe('reject');
    if (result.verdict === 'reject') expect(result.reason).toBe('ci-pending');
  });

  it('rejects zero check-runs (no CI evidence ≠ green)', async () => {
    const fetchFn = githubStub({
      checks: jsonResponse(200, { total_count: 0, check_runs: [] }),
    });
    const result = await verifyCompletion(
      envelope,
      { prUrl: PR_URL },
      { env, fetchFn: fetchFn as unknown as typeof fetch }
    );
    expect(result.verdict).toBe('reject');
    if (result.verdict === 'reject')
      expect(result.reason).toBe('no-ci-evidence');
  });

  it('accepts PR-exists + all-green check-runs, with full CompletionEvidence', async () => {
    const fetchFn = githubStub({
      pull: jsonResponse(200, {
        state: 'closed',
        merged: true,
        head: { sha: 'deadbeef' },
      }),
    });
    const result = await verifyCompletion(
      envelope,
      { prUrl: PR_URL },
      { env, fetchFn: fetchFn as unknown as typeof fetch }
    );
    expect(result.verdict).toBe('accept');
    if (result.verdict === 'accept') {
      expect(result.evidence.prUrl).toBe(PR_URL);
      expect(result.evidence.ciStatus).toBe('success');
      expect(result.evidence.prState).toBe('merged');
      expect(result.evidence.headSha).toBe('deadbeef');
    }
  });

  it('acceptanceResults are self-attested and NEVER gate the verdict', async () => {
    // All acceptance criteria attested as FAILED — objective legs still green
    // → still accept, with the failures recorded for humans.
    const result = await verifyCompletion(
      envelope,
      {
        prUrl: PR_URL,
        acceptanceResults: [
          { criterion: 'crit A', passed: false },
          { criterion: 'crit B', passed: false },
        ],
      },
      { env, fetchFn: githubStub({}) as unknown as typeof fetch }
    );
    expect(result.verdict).toBe('accept');
    if (result.verdict === 'accept') {
      expect(result.evidence.acceptanceResults).toEqual([
        { criterion: 'crit A', passed: false, selfAttested: true },
        { criterion: 'crit B', passed: false, selfAttested: true },
      ]);
    }
  });

  it('defaults acceptanceResults from the envelope as unattested (passed: false)', async () => {
    const result = await verifyCompletion(
      envelope,
      { prUrl: PR_URL },
      { env, fetchFn: githubStub({}) as unknown as typeof fetch }
    );
    expect(result.verdict).toBe('accept');
    if (result.verdict === 'accept') {
      expect(result.evidence.acceptanceResults.map(r => r.criterion)).toEqual([
        'crit A',
        'crit B',
      ]);
      expect(result.evidence.acceptanceResults.every(r => r.selfAttested)).toBe(
        true
      );
    }
  });
});

describe('transitionIssueDone (the single Done-writer)', () => {
  const evidence: CompletionEvidence = {
    prUrl: PR_URL,
    ciStatus: 'success',
    acceptanceResults: [
      { criterion: 'crit A', passed: true, selfAttested: true },
    ],
    prState: 'merged',
    headSha: 'deadbeef',
    checkedAt: '2026-07-10T00:00:00.000Z',
  };

  function makeLinearStub(
    states: Array<{ id: string; name: string; type: string }>
  ) {
    return {
      workflowStates: jest.fn(async () => ({ nodes: states })),
      issue: jest.fn(async () => ({ team: Promise.resolve({ id: 'team-1' }) })),
      updateIssue: jest.fn(async () => ({})),
      createComment: jest.fn(async () => ({})),
    };
  }

  beforeEach(() => {
    __resetCompletedStateCacheForTests();
  });

  it('posts the evidence comment then moves the issue to the completed state', async () => {
    const linear = makeLinearStub([
      { id: 'st-progress', name: 'In Progress', type: 'started' },
      { id: 'st-done', name: 'Done', type: 'completed' },
    ]);
    const result = await transitionIssueDone('issue-1', evidence, { linear });
    expect(result.ok).toBe(true);
    expect(linear.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        issueId: 'issue-1',
        body: expect.stringContaining(PR_URL),
      })
    );
    expect(linear.updateIssue).toHaveBeenCalledWith('issue-1', {
      stateId: 'st-done',
    });
  });

  it('fails soft (no transition) when the team has no completed state', async () => {
    const linear = makeLinearStub([
      { id: 'st-progress', name: 'In Progress', type: 'started' },
    ]);
    const result = await transitionIssueDone('issue-1', evidence, { linear });
    expect(result).toEqual({ ok: false, reason: 'no-completed-state' });
    expect(linear.updateIssue).not.toHaveBeenCalled();
  });

  it('caches the completed state per team across calls', async () => {
    const linear = makeLinearStub([
      { id: 'st-done', name: 'Done', type: 'completed' },
    ]);
    await transitionIssueDone('issue-1', evidence, { linear });
    await transitionIssueDone('issue-2', evidence, { linear });
    expect(linear.workflowStates).toHaveBeenCalledTimes(1);
  });

  it('formatEvidenceComment marks acceptance as self-attested', () => {
    const body = formatEvidenceComment(evidence);
    expect(body).toContain('self-attested');
    expect(body).toContain(PR_URL);
    expect(body).toContain('deadbeef');
  });
});
