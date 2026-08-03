import {
  AddSignalsRequestSchema,
  ApproveGoalRequestSchema,
  BuildWorkPacketRequestSchema,
  CreateWorkspaceRequestSchema,
  IntentScapeWorkspaceIdSchema,
} from '@/lib/intentscape/runtime';

describe('IntentScape authenticated request contracts', () => {
  it('accepts a bounded workspace intake without execution fields', () => {
    expect(
      CreateWorkspaceRequestSchema.parse({
        title: 'Explore the acquisition constraint',
        originSignal: 'Build a better product image tool.',
      })
    ).toEqual({
      title: 'Explore the acquisition constraint',
      originSignal: 'Build a better product image tool.',
      retentionClass: 'standard',
    });
    expect(() =>
      CreateWorkspaceRequestSchema.parse({
        title: 'Explore the acquisition constraint',
        originSignal: 'Build a better product image tool.',
        selectedCapabilities: ['image-generation'],
      })
    ).toThrow();
  });

  it('forbids replacing the Origin Signal or self-asserting verified evidence', () => {
    const base = {
      expectedContextVersion: 1,
      signals: [
        {
          kind: 'note',
          label: 'Customer interview',
          content: 'Customers cannot compare the proof behind each option.',
        },
      ],
    };
    expect(AddSignalsRequestSchema.parse(base).signals[0]).toMatchObject({
      evidenceState: 'opinion',
    });
    expect(() =>
      AddSignalsRequestSchema.parse({
        ...base,
        signals: [{ ...base.signals[0], kind: 'origin-signal' }],
      })
    ).toThrow();
    expect(() =>
      AddSignalsRequestSchema.parse({
        ...base,
        signals: [{ ...base.signals[0], evidenceState: 'verified' }],
      })
    ).toThrow();
    expect(() =>
      AddSignalsRequestSchema.parse({
        ...base,
        signals: [
          {
            ...base.signals[0],
            autoLabels: [{ label: 'Attacker-selected workflow' }],
          },
        ],
      })
    ).toThrow();
  });

  it('derives approver identity and time server-side', () => {
    const approval = {
      hypothesisId: 'hypothesis-trust',
      hypothesisVersion: 1,
      primaryStakeholder: 'Prospective customer',
      acceptanceCriteria: ['Qualified comparison completion increases.'],
      exclusions: [],
      authorityBoundaries: ['Research and draft only.'],
    };
    expect(ApproveGoalRequestSchema.parse(approval)).toEqual(approval);
    expect(() =>
      ApproveGoalRequestSchema.parse({
        ...approval,
        approvedBy: 'attacker-selected-user',
        approvedAt: '2026-08-03T00:00:00.000Z',
      })
    ).toThrow();
  });

  it('allows Work Packets to reference only an approved contract id', () => {
    expect(
      BuildWorkPacketRequestSchema.parse({ goalContractId: 'goal-1' })
    ).toEqual({ goalContractId: 'goal-1' });
    expect(() =>
      BuildWorkPacketRequestSchema.parse({
        goalContractId: 'goal-1',
        goal: 'Attacker supplied replacement mission',
      })
    ).toThrow();
  });

  it.each(['workspace-1', 'ws_2', 'abc123'])(
    'accepts safe workspace id %s',
    id => expect(IntentScapeWorkspaceIdSchema.parse(id)).toBe(id)
  );

  it.each(['../workspace', 'workspace/other', '', 'x'.repeat(201)])(
    'rejects unsafe workspace id %s',
    id => expect(() => IntentScapeWorkspaceIdSchema.parse(id)).toThrow()
  );
});
