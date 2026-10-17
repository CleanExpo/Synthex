/**
 * @jest-environment node
 */
import {
  applyMotionEvent,
  newMotionJob,
  IllegalMotionTransition,
  MAX_FIX_ATTEMPTS,
  type MotionJob,
} from '@/lib/motion';

const run = (
  job: MotionJob,
  ...events: Parameters<typeof applyMotionEvent>[1][]
) => events.reduce((j, e) => applyMotionEvent(j, e), job);

describe('motion job', () => {
  it('runs the happy path to export', () => {
    const job = run(
      newMotionJob('j1'),
      { id: 'e1', type: 'plan', factsOk: true },
      { id: 'e2', type: 'render', renderId: 'r1' },
      { id: 'e3', type: 'critique', defects: [] },
      { id: 'e4', type: 'approve', approverId: 'phill' },
      { id: 'e5', type: 'export', url: 'https://example.com/v.mp4' }
    );
    expect(job.state).toBe('EXPORTED');
    expect(job.approverId).toBe('phill');
  });

  it('blocks render when facts fail, and allows a re-plan', () => {
    const blocked = run(newMotionJob('j'), {
      id: 'e1',
      type: 'plan',
      factsOk: false,
    });
    expect(blocked.state).toBe('BLOCKED_FACTS');
    expect(() =>
      applyMotionEvent(blocked, { id: 'e2', type: 'render', renderId: 'r' })
    ).toThrow(IllegalMotionTransition);
    expect(
      applyMotionEvent(blocked, { id: 'e3', type: 'plan', factsOk: true }).state
    ).toBe('PLANNED');
  });

  it('never exports or approves without a clean critique and a human approval', () => {
    const rendered = run(
      newMotionJob('j'),
      { id: 'e1', type: 'plan', factsOk: true },
      { id: 'e2', type: 'render', renderId: 'r' }
    );
    expect(() =>
      applyMotionEvent(rendered, { id: 'e3', type: 'approve', approverId: 'x' })
    ).toThrow(IllegalMotionTransition);
    expect(() =>
      applyMotionEvent(rendered, { id: 'e4', type: 'export', url: 'u' })
    ).toThrow(IllegalMotionTransition);
    const critiqued = applyMotionEvent(rendered, {
      id: 'e5',
      type: 'critique',
      defects: [],
    });
    expect(() =>
      applyMotionEvent(critiqued, { id: 'e6', type: 'export', url: 'u' })
    ).toThrow(IllegalMotionTransition);
  });

  it('is replay-safe: a repeated event id changes nothing', () => {
    const once = run(
      newMotionJob('j'),
      { id: 'e1', type: 'plan', factsOk: true },
      { id: 'e2', type: 'render', renderId: 'r' },
      { id: 'e3', type: 'critique', defects: ['clipped digits'] }
    );
    const replay = applyMotionEvent(once, {
      id: 'e3',
      type: 'critique',
      defects: ['clipped digits'],
    });
    expect(replay).toBe(once);
    expect(replay.fixAttempts).toBe(1);
  });

  it(`escalates to a human after ${MAX_FIX_ATTEMPTS} fix rounds`, () => {
    let job = run(newMotionJob('j'), { id: 'p', type: 'plan', factsOk: true });
    for (let i = 1; i <= MAX_FIX_ATTEMPTS; i++) {
      job = run(
        job,
        { id: `r${i}`, type: 'render', renderId: `r${i}` },
        { id: `c${i}`, type: 'critique', defects: ['still clipped'] }
      );
      expect(job.state).toBe('NEEDS_FIX');
      expect(job.fixAttempts).toBe(i);
    }
    job = run(
      job,
      { id: 'r9', type: 'render', renderId: 'r9' },
      { id: 'c9', type: 'critique', defects: ['still clipped'] }
    );
    expect(job.state).toBe('ESCALATED');
    expect(() =>
      applyMotionEvent(job, { id: 'x', type: 'render', renderId: 'r' })
    ).toThrow(IllegalMotionTransition);
  });
});
