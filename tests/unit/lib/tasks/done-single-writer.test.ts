/**
 * SYN-MCP-005 (SYN-1081) — regression pin: the completed-state ("Done")
 * transition exists ONLY in lib/tasks/completion-verifier.ts.
 *
 * The false-Done defect was two independent Done-writers with no evidence
 * requirement: .claude/task-runner.sh (CLI exit 0 → Done) and
 * lib/queue/workers/autonomous-task-worker.ts (SDK success → Done). Both were
 * removed; this test greps the lifecycle surfaces so a Done-writer can never
 * quietly reappear (bench must_fix 9).
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../../../..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

describe('Done single-writer (SYN-MCP-005)', () => {
  it('.claude/task-runner.sh has NO Done-state resolution or transition', () => {
    const sh = read('.claude/task-runner.sh');
    expect(sh).not.toMatch(/DONE_STATE_ID/);
    expect(sh).not.toMatch(/update_issue_done/);
    expect(sh).not.toMatch(/select\(\.name == "Done"\)/);
    // and it DOES move to In Review instead
    expect(sh).toMatch(/IN_REVIEW_STATE_ID/);
    expect(sh).toMatch(/update_issue_in_review/);
  });

  it('autonomous-task-worker.ts has NO completed-state lookup or transition', () => {
    const worker = read('lib/queue/workers/autonomous-task-worker.ts');
    expect(worker).not.toMatch(/getCompletedStateId/);
    expect(worker).not.toMatch(/type === 'completed'/);
    expect(worker).not.toMatch(/completedStateCache/);
    // and it DOES resolve In Review instead
    expect(worker).toMatch(/getInReviewStateId/);
  });

  it('the webhook route never transitions issue state at all', () => {
    const route = read('app/api/webhooks/linear/route.ts');
    expect(route).not.toMatch(/updateIssue/);
    expect(route).not.toMatch(/stateId:/);
  });

  it("the cron route delegates Done exclusively to the verifier's transitionIssueDone", () => {
    const route = read('app/api/cron/task-lifecycle/route.ts');
    // no direct state mutation…
    expect(route).not.toMatch(/updateIssue\(/);
    expect(route).not.toMatch(/type === 'completed'/);
    // …only the single writer, imported from the verifier
    expect(route).toMatch(/transitionIssueDone/);
    expect(route).toMatch(/from '@\/lib\/tasks\/completion-verifier'/);
  });

  it('completion-verifier.ts is the ONLY lifecycle surface with a completed-state transition', () => {
    const surfaces: Record<string, string> = {
      '.claude/task-runner.sh': read('.claude/task-runner.sh'),
      'lib/queue/workers/autonomous-task-worker.ts': read(
        'lib/queue/workers/autonomous-task-worker.ts'
      ),
      'app/api/webhooks/linear/route.ts': read(
        'app/api/webhooks/linear/route.ts'
      ),
      'app/api/cron/task-lifecycle/route.ts': read(
        'app/api/cron/task-lifecycle/route.ts'
      ),
      'lib/tasks/task-envelope.ts': read('lib/tasks/task-envelope.ts'),
      'lib/tasks/completion-verifier.ts': read(
        'lib/tasks/completion-verifier.ts'
      ),
    };
    const completedTransitionPattern = /type === 'completed'/;
    const withTransition = Object.entries(surfaces)
      .filter(([, src]) => completedTransitionPattern.test(src))
      .map(([file]) => file);
    expect(withTransition).toEqual(['lib/tasks/completion-verifier.ts']);
  });

  it('completion-verifier declares itself the single writer', () => {
    const verifier = read('lib/tasks/completion-verifier.ts');
    expect(verifier).toMatch(/DONE-TRANSITION-SINGLE-WRITER/);
    expect(verifier).toMatch(/transitionIssueDone/);
  });
});
