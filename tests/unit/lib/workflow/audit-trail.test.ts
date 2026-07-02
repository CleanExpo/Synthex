/**
 * Unit tests for buildWorkflowAuditTrail — the Audit leg of the agency loop
 * (SYN-972). Pure mapping over StepExecution rows into a decision timeline.
 */
import {
  buildWorkflowAuditTrail,
  type AuditStepInput,
} from '@/lib/workflow/audit-trail';

const at = new Date('2026-06-17T01:00:00.000Z');

function step(over: Partial<AuditStepInput>): AuditStepInput {
  return {
    stepIndex: 0,
    stepName: 'Step',
    stepType: 'ai',
    status: 'completed',
    ...over,
  };
}

describe('buildWorkflowAuditTrail', () => {
  it('orders steps by stepIndex regardless of input order', () => {
    const trail = buildWorkflowAuditTrail([
      step({ stepIndex: 2, stepName: 'C' }),
      step({ stepIndex: 0, stepName: 'A' }),
      step({ stepIndex: 1, stepName: 'B' }),
    ]);
    expect(trail.map((e) => e.stepName)).toEqual(['A', 'B', 'C']);
  });

  it('distinguishes auto-approved from human-approved completions', () => {
    const [auto, human] = buildWorkflowAuditTrail([
      step({ stepIndex: 0, autoApproved: true, completedAt: at }),
      step({
        stepIndex: 1,
        autoApproved: false,
        approvedBy: 'ceo-1',
        approvedAt: at,
      }),
    ]);
    expect(auto.outcome).toBe('auto_approved');
    expect(human.outcome).toBe('approved');
    expect(human.actor).toBe('ceo-1');
    expect(human.at).toBe(at.toISOString());
  });

  it('captures a rejection with its actor and reason', () => {
    const [e] = buildWorkflowAuditTrail([
      step({
        stepIndex: 0,
        stepType: 'approval',
        status: 'rejected',
        errorMessage: 'Tone too salesy',
        outputData: { rejectedBy: 'ceo-1', reason: 'Tone too salesy' },
        completedAt: at,
      }),
    ]);
    expect(e.outcome).toBe('rejected');
    expect(e.actor).toBe('ceo-1');
    expect(e.detail).toBe('Tone too salesy');
    expect(e.at).toBe(at.toISOString());
  });

  it('records a failure with its message', () => {
    const [e] = buildWorkflowAuditTrail([
      step({ stepIndex: 0, status: 'failed', errorMessage: 'Max retries exceeded', completedAt: at }),
    ]);
    expect(e.outcome).toBe('failed');
    expect(e.detail).toBe('Max retries exceeded');
  });

  it('marks waiting_approval and in-progress states', () => {
    const trail = buildWorkflowAuditTrail([
      step({ stepIndex: 0, status: 'waiting_approval' }),
      step({ stepIndex: 1, status: 'running' }),
    ]);
    expect(trail[0].outcome).toBe('awaiting_approval');
    expect(trail[1].outcome).toBe('in_progress');
  });

  it('produces a full agency-loop timeline end to end', () => {
    const trail = buildWorkflowAuditTrail([
      step({ stepIndex: 0, stepName: 'Generate content', autoApproved: true, completedAt: at }),
      step({ stepIndex: 1, stepName: 'Brand voice gate', stepType: 'validation', autoApproved: true, completedAt: at }),
      step({ stepIndex: 2, stepName: 'Human review', stepType: 'approval', approvedBy: 'ceo-1', approvedAt: at }),
      step({ stepIndex: 3, stepName: 'Publish to platform', stepType: 'action', autoApproved: true, completedAt: at }),
    ]);
    expect(trail.map((e) => e.outcome)).toEqual([
      'auto_approved',
      'auto_approved',
      'approved',
      'auto_approved',
    ]);
    expect(trail[2].actor).toBe('ceo-1');
  });
});
