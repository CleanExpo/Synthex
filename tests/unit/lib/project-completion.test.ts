/**
 * SYN-1035 — autonomous project-completion loop.
 *
 * Covers all-complete, open-issue, blocked-accepted, blocked-unaccepted,
 * not-opted-in (broad-roadmap guard), verification-failed, and idempotency/rerun.
 */

import {
  evaluateProjectCompletion,
  runProjectCompletion,
  formatCompletionSummary,
  type ProjectCompletionInput,
  type RequiredIssue,
  type CompletionEffects,
} from '@/lib/autonomous-completion/project-completion';

function issue(overrides: Partial<RequiredIssue> = {}): RequiredIssue {
  return {
    id: 'i-1',
    identifier: 'SYN-1',
    title: 'Do the thing',
    state: 'completed',
    ...overrides,
  };
}

function input(overrides: Partial<ProjectCompletionInput> = {}): ProjectCompletionInput {
  return {
    projectId: 'proj-1',
    projectName: 'Autonomous Loop',
    autoCompleteEnabled: true,
    alreadyComplete: false,
    requiredIssues: [issue({ identifier: 'SYN-1' }), issue({ identifier: 'SYN-2', id: 'i-2' })],
    verification: { passed: true },
    ...overrides,
  };
}

function mockEffects(): CompletionEffects & { posted: string[]; closed: string[] } {
  const posted: string[] = [];
  const closed: string[] = [];
  return {
    posted,
    closed,
    postUpdate: async (_p, body) => {
      posted.push(body);
    },
    closeProject: async p => {
      closed.push(p);
    },
  };
}

describe('evaluateProjectCompletion (SYN-1035)', () => {
  it('all required issues complete + verified + opted-in → closeable', () => {
    const d = evaluateProjectCompletion(input());
    expect(d.closeable).toBe(true);
    expect(d.reasons).toEqual([]);
    expect(d.summary.completedIssues).toHaveLength(2);
  });

  it('an open (active) required issue blocks closure with a visible blocker', () => {
    const d = evaluateProjectCompletion(
      input({ requiredIssues: [issue(), issue({ identifier: 'SYN-2', state: 'active' })] })
    );
    expect(d.closeable).toBe(false);
    expect(d.reasons).toContain('open_issues');
    expect(d.blockers).toEqual([
      expect.objectContaining({ identifier: 'SYN-2', state: 'active' }),
    ]);
    expect(d.summary.openRisks[0]).toMatch(/SYN-2 still open/);
  });

  it('a blocked issue WITH an accepted reason is a valid exclusion → closeable', () => {
    const d = evaluateProjectCompletion(
      input({
        requiredIssues: [
          issue(),
          issue({ identifier: 'SYN-2', state: 'blocked', acceptedBlockReason: 'waiting on client' }),
        ],
      })
    );
    expect(d.closeable).toBe(true);
    expect(d.summary.blockedExclusions).toEqual([
      { identifier: 'SYN-2', reason: 'waiting on client' },
    ]);
  });

  it('a blocked issue WITHOUT an accepted reason blocks closure', () => {
    const d = evaluateProjectCompletion(
      input({ requiredIssues: [issue(), issue({ identifier: 'SYN-2', state: 'blocked' })] })
    );
    expect(d.closeable).toBe(false);
    expect(d.reasons).toContain('unaccepted_blocks');
  });

  it('a project not opted in is never closeable (broad-roadmap guard)', () => {
    const d = evaluateProjectCompletion(input({ autoCompleteEnabled: false }));
    expect(d.closeable).toBe(false);
    expect(d.reasons).toContain('not_opted_in');
  });

  it('failed verification blocks closure even when all issues are terminal', () => {
    const d = evaluateProjectCompletion(
      input({ verification: { passed: false, detail: 'build red' } })
    );
    expect(d.closeable).toBe(false);
    expect(d.reasons).toContain('verification_failed');
  });

  it('a project with no required issues is not closeable', () => {
    const d = evaluateProjectCompletion(input({ requiredIssues: [] }));
    expect(d.closeable).toBe(false);
    expect(d.reasons).toContain('no_required_issues');
  });

  it('an already-complete project is an idempotent no-op', () => {
    const d = evaluateProjectCompletion(input({ alreadyComplete: true }));
    expect(d.alreadyComplete).toBe(true);
    expect(d.closeable).toBe(false);
    expect(d.reasons).toEqual([]);
  });
});

describe('runProjectCompletion — effects + idempotency', () => {
  it('posts the summary then closes the project when closeable', async () => {
    const fx = mockEffects();
    const r = await runProjectCompletion(input(), fx);
    expect(r.closed).toBe(true);
    expect(fx.posted).toHaveLength(1);
    expect(fx.posted[0]).toMatch(/Project completion summary/);
    expect(fx.closed).toEqual(['proj-1']);
  });

  it('fires no effects when not closeable (open issue)', async () => {
    const fx = mockEffects();
    const r = await runProjectCompletion(
      input({ requiredIssues: [issue({ state: 'active' })] }),
      fx
    );
    expect(r.closed).toBe(false);
    expect(fx.posted).toHaveLength(0);
    expect(fx.closed).toHaveLength(0);
  });

  it('is safe to rerun — an already-complete project fires no effects', async () => {
    const fx = mockEffects();
    const r = await runProjectCompletion(input({ alreadyComplete: true }), fx);
    expect(r).toMatchObject({ closed: false, noop: true });
    expect(fx.posted).toHaveLength(0);
    expect(fx.closed).toHaveLength(0);
  });
});

describe('formatCompletionSummary', () => {
  it('renders completed, exclusions, verification, evidence, and risks', () => {
    const { summary } = evaluateProjectCompletion(
      input({
        requiredIssues: [
          issue({ identifier: 'SYN-1', evidenceRefs: ['linear:SYN-1', 'pr:#487'] }),
          issue({ identifier: 'SYN-2', state: 'blocked', acceptedBlockReason: 'client gate' }),
        ],
        verification: { passed: true, detail: '22/22 tests' },
      })
    );
    const text = formatCompletionSummary(summary);
    expect(text).toMatch(/Completed \(1\):\*\* SYN-1/);
    expect(text).toMatch(/Accepted-blocked exclusions:\*\* SYN-2 \(client gate\)/);
    expect(text).toMatch(/Verification:\*\* passed — 22\/22 tests/);
    expect(text).toMatch(/pr:#487/);
    expect(text).toMatch(/Open risks:\*\* none/);
  });
});
